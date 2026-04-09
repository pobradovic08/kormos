//go:build integration

package testutil

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/pobradovic08/kormos/backend/internal/audit"
	"github.com/pobradovic08/kormos/backend/internal/auth"
	"github.com/pobradovic08/kormos/backend/internal/cluster"
	"github.com/pobradovic08/kormos/backend/internal/config"
	"github.com/pobradovic08/kormos/backend/internal/configure"
	"github.com/pobradovic08/kormos/backend/internal/crypto"
	"github.com/pobradovic08/kormos/backend/internal/db"
	"github.com/pobradovic08/kormos/backend/internal/interfaces"
	"github.com/pobradovic08/kormos/backend/internal/middleware"
	"github.com/pobradovic08/kormos/backend/internal/operation"
	"github.com/pobradovic08/kormos/backend/internal/proxy"
	"github.com/pobradovic08/kormos/backend/internal/router"
	"github.com/pobradovic08/kormos/backend/internal/routeros"
	"github.com/pobradovic08/kormos/backend/internal/setup"
	"github.com/pobradovic08/kormos/backend/internal/tenant"
	"github.com/pobradovic08/kormos/backend/internal/tunnel"
	"github.com/pobradovic08/kormos/backend/internal/user"
)

const (
	TestDBName    = "kormos_test"
	TestDBURL     = "postgres://kormos:kormos_dev@localhost:15432/" + TestDBName + "?sslmode=disable"
	AdminDBURL    = "postgres://kormos:kormos_dev@localhost:15432/postgres?sslmode=disable"
	TestJWTSecret = "test-jwt-secret"
	TestEncKey    = "0000000000000000000000000000000000000000000000000000000000000000"
	TestUserEmail = "owner@test.local"
	TestUserPass  = "testpass"
	TestUserName  = "Test Owner"
)

// TestContext holds all the state needed by integration tests.
type TestContext struct {
	Pool          *pgxpool.Pool
	Server        *httptest.Server
	TenantID      string
	UserID        string
	Token         string
	ClusterID     string
	Router1ID     string // master
	Router2ID     string // backup
	Router1Client *routeros.Client
	Router2Client *routeros.Client
	Config        *config.Config
}

// SetupTestDB creates the kormos_test database (dropping it first if it exists)
// and runs all embedded migrations. Returns a connection pool to the test DB.
func SetupTestDB() (*pgxpool.Pool, error) {
	ctx := context.Background()

	// Connect to the admin database to create/drop the test database.
	adminConn, err := pgx.Connect(ctx, AdminDBURL)
	if err != nil {
		return nil, fmt.Errorf("testutil: connect to admin db: %w", err)
	}

	// Terminate existing connections to the test database.
	_, _ = adminConn.Exec(ctx, fmt.Sprintf(
		"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '%s' AND pid <> pg_backend_pid()",
		TestDBName,
	))

	// Drop and recreate.
	_, _ = adminConn.Exec(ctx, "DROP DATABASE IF EXISTS "+TestDBName)
	_, err = adminConn.Exec(ctx, "CREATE DATABASE "+TestDBName)
	adminConn.Close(ctx)
	if err != nil {
		return nil, fmt.Errorf("testutil: create test db: %w", err)
	}

	// Connect to the test database and run migrations.
	migConn, err := pgx.Connect(ctx, TestDBURL)
	if err != nil {
		return nil, fmt.Errorf("testutil: connect to test db for migrations: %w", err)
	}
	defer migConn.Close(ctx)

	// Create schema_migrations table.
	_, err = migConn.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			filename VARCHAR(255) PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`)
	if err != nil {
		return nil, fmt.Errorf("testutil: create schema_migrations: %w", err)
	}

	// Read and apply all migrations.
	entries, err := fs.ReadDir(db.MigrationFS, "migrations")
	if err != nil {
		return nil, fmt.Errorf("testutil: read migrations dir: %w", err)
	}
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name() < entries[j].Name()
	})

	for _, entry := range entries {
		name := entry.Name()
		if entry.IsDir() || !strings.HasSuffix(name, ".sql") {
			continue
		}

		content, err := fs.ReadFile(db.MigrationFS, "migrations/"+name)
		if err != nil {
			return nil, fmt.Errorf("testutil: read migration %s: %w", name, err)
		}

		tx, err := migConn.Begin(ctx)
		if err != nil {
			return nil, fmt.Errorf("testutil: begin tx for %s: %w", name, err)
		}

		_, err = tx.Exec(ctx, string(content))
		if err != nil {
			_ = tx.Rollback(ctx)
			return nil, fmt.Errorf("testutil: apply migration %s: %w", name, err)
		}

		_, err = tx.Exec(ctx, "INSERT INTO schema_migrations (filename) VALUES ($1)", name)
		if err != nil {
			_ = tx.Rollback(ctx)
			return nil, fmt.Errorf("testutil: record migration %s: %w", name, err)
		}

		if err = tx.Commit(ctx); err != nil {
			return nil, fmt.Errorf("testutil: commit migration %s: %w", name, err)
		}
	}

	// Create a pool for tests to use.
	pool, err := pgxpool.New(ctx, TestDBURL)
	if err != nil {
		return nil, fmt.Errorf("testutil: create pool: %w", err)
	}

	return pool, nil
}

// SeedTestData inserts a test tenant, owner user, HA cluster with 2 routers,
// and generates a JWT token. Requires CHR1_IP, CHR2_IP, CHR_USER, CHR_PASSWORD
// environment variables.
func SeedTestData(pool *pgxpool.Pool) (*TestContext, error) {
	ctx := context.Background()

	chr1IP := os.Getenv("CHR1_IP")
	chr2IP := os.Getenv("CHR2_IP")
	chrUser := os.Getenv("CHR_USER")
	chrPass := os.Getenv("CHR_PASSWORD")

	if chr1IP == "" || chr2IP == "" || chrUser == "" || chrPass == "" {
		return nil, fmt.Errorf("testutil: CHR1_IP, CHR2_IP, CHR_USER, CHR_PASSWORD env vars are required")
	}

	tc := &TestContext{
		Pool: pool,
		Config: &config.Config{
			DatabaseURL:   TestDBURL,
			EncryptionKey: TestEncKey,
			JWTSecret:     TestJWTSecret,
			JWTAccessTTL:  1 * time.Hour,
			JWTRefreshTTL: 24 * time.Hour,
			ListenAddr:    ":0",
			CORSOrigins:   []string{"*"},
		},
	}

	// 1. Create tenant.
	err := pool.QueryRow(ctx,
		`INSERT INTO tenants (name, slug) VALUES ('Test Tenant', 'test-tenant') RETURNING id`,
	).Scan(&tc.TenantID)
	if err != nil {
		return nil, fmt.Errorf("testutil: create tenant: %w", err)
	}

	// 2. Create portal_settings so SetupGuard passes.
	_, err = pool.Exec(ctx,
		`INSERT INTO portal_settings (portal_name, default_timezone, support_email)
		 VALUES ('Test Portal', 'UTC', 'support@test.local')
		 ON CONFLICT DO NOTHING`,
	)
	if err != nil {
		return nil, fmt.Errorf("testutil: create portal_settings: %w", err)
	}

	// 3. Create owner user with bcrypt hashed password.
	hash, err := bcrypt.GenerateFromPassword([]byte(TestUserPass), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("testutil: hash password: %w", err)
	}

	err = pool.QueryRow(ctx,
		`INSERT INTO users (tenant_id, email, password_hash, name, role, is_active)
		 VALUES ($1, $2, $3, $4, 'owner', true) RETURNING id`,
		tc.TenantID, TestUserEmail, string(hash), TestUserName,
	).Scan(&tc.UserID)
	if err != nil {
		return nil, fmt.Errorf("testutil: create user: %w", err)
	}

	// 4. Create HA cluster.
	err = pool.QueryRow(ctx,
		`INSERT INTO clusters (tenant_id, name) VALUES ($1, 'Test HA Cluster') RETURNING id`,
		tc.TenantID,
	).Scan(&tc.ClusterID)
	if err != nil {
		return nil, fmt.Errorf("testutil: create cluster: %w", err)
	}

	// 5. Encrypt credentials for router storage.
	encryptedUser, err := crypto.Encrypt([]byte(chrUser), TestEncKey)
	if err != nil {
		return nil, fmt.Errorf("testutil: encrypt username: %w", err)
	}
	encryptedPass, err := crypto.Encrypt([]byte(chrPass), TestEncKey)
	if err != nil {
		return nil, fmt.Errorf("testutil: encrypt password: %w", err)
	}

	// 6. Create master router (CHR1).
	err = pool.QueryRow(ctx,
		`INSERT INTO routers (tenant_id, cluster_id, name, hostname, host, port, username_encrypted, password_encrypted, role)
		 VALUES ($1, $2, 'chr1-master', $3, $3, 443, $4, $5, 'master') RETURNING id`,
		tc.TenantID, tc.ClusterID, chr1IP, encryptedUser, encryptedPass,
	).Scan(&tc.Router1ID)
	if err != nil {
		return nil, fmt.Errorf("testutil: create router1: %w", err)
	}

	// 7. Create backup router (CHR2).
	err = pool.QueryRow(ctx,
		`INSERT INTO routers (tenant_id, cluster_id, name, hostname, host, port, username_encrypted, password_encrypted, role)
		 VALUES ($1, $2, 'chr2-backup', $3, $3, 443, $4, $5, 'backup') RETURNING id`,
		tc.TenantID, tc.ClusterID, chr2IP, encryptedUser, encryptedPass,
	).Scan(&tc.Router2ID)
	if err != nil {
		return nil, fmt.Errorf("testutil: create router2: %w", err)
	}

	// 8. Generate JWT token.
	tc.Token, err = auth.GenerateAccessToken(tc.UserID, tc.TenantID, "owner", TestUserEmail, TestJWTSecret, 1*time.Hour)
	if err != nil {
		return nil, fmt.Errorf("testutil: generate token: %w", err)
	}

	// 9. Create RouterOS clients.
	tc.Router1Client = routeros.NewClient(chr1IP, 443, chrUser, chrPass)
	tc.Router2Client = routeros.NewClient(chr2IP, 443, chrUser, chrPass)

	return tc, nil
}

// NewTestServer creates an httptest.Server with the EXACT same wiring as main.go.
func NewTestServer(pool *pgxpool.Pool, tc *TestContext) *httptest.Server {
	cfg := tc.Config

	setupRepo := setup.NewRepository(pool)
	setupService := setup.NewService(setupRepo, pool, cfg.JWTSecret, cfg.JWTAccessTTL, cfg.JWTRefreshTTL, cfg.EncryptionKey)
	setupHandler := setup.NewHandler(setupService)

	authHandler := auth.NewHandler(pool, cfg.JWTSecret, cfg.JWTAccessTTL, cfg.JWTRefreshTTL, cfg.EncryptionKey)

	routerRepo := router.NewRepository(pool)
	routerService := router.NewService(routerRepo, cfg.EncryptionKey, pool)
	routerHandler := router.NewHandler(routerService)

	interfaceFetcher := interfaces.NewFetcher(routerService)
	interfaceHandler := interfaces.NewHandler(interfaceFetcher)

	userRepo := user.NewRepository(pool)
	userService := user.NewService(userRepo)
	userHandler := user.NewHandler(userService)

	auditRepo := audit.NewRepository(pool)
	configureEngine := configure.NewEngine(routerService)
	configureHandler := configure.NewHandler(configureEngine, routerService, auditRepo, pool)

	operationRepo := operation.NewRepository(pool)
	operationService := operation.NewService(operationRepo, routerService)
	operationHandler := operation.NewHandler(operationService)

	clusterRepo := cluster.NewRepository(pool)
	clusterService := cluster.NewService(clusterRepo, routerService, cfg.EncryptionKey, pool)
	clusterHandler := cluster.NewHandler(clusterService)

	proxyHandler := proxy.NewHandler(routerService)

	tunnelService := tunnel.NewService(routerService, clusterService, operationService, interfaceFetcher)
	tunnelHandler := tunnel.NewHandler(tunnelService)

	tenantHandler := tenant.NewHandler(pool)

	r := chi.NewRouter()

	r.Use(chimw.Recoverer)
	r.Use(chimw.RequestID)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.CORSOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))
	r.Use(middleware.SecurityHeaders)
	// NOTE: Rate limiting uses a high limit for tests to avoid 429s.
	r.Use(middleware.RateLimit(10000, time.Minute))
	r.Use(middleware.SetupGuard(setupRepo))

	r.Route("/api/setup", func(r chi.Router) {
		r.Get("/status", setupHandler.Status)
		r.Post("/complete", setupHandler.Complete)
	})

	r.Route("/api/auth", func(r chi.Router) {
		r.Post("/login", authHandler.Login)
		r.Post("/refresh", authHandler.Refresh)
		r.Post("/logout", authHandler.Logout)
	})

	r.Route("/api", func(r chi.Router) {
		r.Use(middleware.Auth(cfg.JWTSecret))
		r.Use(middleware.TenantScope())

		r.Get("/portal/settings", setupHandler.GetSettings)
		r.With(middleware.RequireRole("owner")).Put("/portal/settings", setupHandler.UpdateSettings)

		r.Get("/tenant", tenantHandler.Get)
		r.With(middleware.RequireRole("owner")).Put("/tenant", tenantHandler.Update)

		r.Route("/users", func(r chi.Router) {
			r.Use(middleware.RequireRole("owner", "admin"))
			r.Get("/", userHandler.List)
			r.Post("/", userHandler.Create)
			r.Put("/{userID}", userHandler.Update)
			r.Delete("/{userID}", userHandler.Delete)
		})

		r.Route("/clusters", func(r chi.Router) {
			r.Get("/", clusterHandler.List)
			r.Post("/", clusterHandler.Create)
			r.Post("/test-connection", clusterHandler.TestConnection)
			r.Get("/{clusterID}", clusterHandler.GetByID)
			r.Put("/{clusterID}", clusterHandler.Update)
			r.Delete("/{clusterID}", clusterHandler.Delete)

			r.Route("/{clusterID}/tunnels", func(r chi.Router) {
				r.Route("/gre", func(r chi.Router) {
					r.Get("/", tunnelHandler.ListGRE)
					r.Post("/", tunnelHandler.CreateGRE)
					r.Get("/{name}", tunnelHandler.GetGRE)
					r.Patch("/{name}", tunnelHandler.UpdateGRE)
					r.Delete("/{name}", tunnelHandler.DeleteGRE)
				})
				r.Route("/ipsec", func(r chi.Router) {
					r.Get("/", tunnelHandler.ListIPsec)
					r.Post("/", tunnelHandler.CreateIPsec)
					r.Get("/{name}", tunnelHandler.GetIPsec)
					r.Patch("/{name}", tunnelHandler.UpdateIPsec)
					r.Delete("/{name}", tunnelHandler.DeleteIPsec)
				})
			})
			r.Route("/{clusterID}/wireguard", func(r chi.Router) {
				r.Get("/", tunnelHandler.ListWireGuard)
				r.Post("/", tunnelHandler.CreateWGInterface)
				r.Get("/{routerID}/{name}", tunnelHandler.GetWireGuard)
				r.Patch("/{routerID}/{name}", tunnelHandler.UpdateWGInterface)
				r.Delete("/{routerID}/{name}", tunnelHandler.DeleteWGInterface)
				r.Post("/{routerID}/{name}/peers", tunnelHandler.CreateWGPeer)
				r.Patch("/{routerID}/{name}/peers/{peerID}", tunnelHandler.UpdateWGPeer)
				r.Delete("/{routerID}/{name}/peers/{peerID}", tunnelHandler.DeleteWGPeer)
			})
			r.Route("/{clusterID}/interfaces", func(r chi.Router) {
				r.Get("/", tunnelHandler.ListInterfaces)
				r.Get("/{name}", tunnelHandler.GetInterface)
			})
			r.Route("/{clusterID}/firewall/filter", func(r chi.Router) {
				r.Get("/", tunnelHandler.ListFirewallRules)
				r.Post("/", tunnelHandler.CreateFirewallRule)
				r.Post("/move", tunnelHandler.MoveFirewallRule)
				r.Patch("/{ruleID}", tunnelHandler.UpdateFirewallRule)
				r.Delete("/{ruleID}", tunnelHandler.DeleteFirewallRule)
			})
			r.Route("/{clusterID}/routes", func(r chi.Router) {
				r.Get("/", tunnelHandler.ListRoutes)
				r.Post("/", tunnelHandler.CreateRoute)
				r.Get("/{routeID}", tunnelHandler.GetRoute)
				r.Patch("/{routeID}", tunnelHandler.UpdateRoute)
				r.Delete("/{routeID}", tunnelHandler.DeleteRoute)
			})
			r.Route("/{clusterID}/address-lists", func(r chi.Router) {
				r.Get("/", tunnelHandler.ListAddressLists)
				r.Post("/", tunnelHandler.CreateAddressEntry)
				r.Patch("/{entryID}", tunnelHandler.UpdateAddressEntry)
				r.Delete("/{entryID}", tunnelHandler.DeleteAddressEntry)
			})
		})

		r.Route("/routers", func(r chi.Router) {
			r.Get("/", routerHandler.List)
			r.Post("/", routerHandler.Create)
			r.Get("/{routerID}", routerHandler.GetByID)
			r.Put("/{routerID}", routerHandler.Update)
			r.Delete("/{routerID}", routerHandler.Delete)
			r.Get("/{routerID}/status", routerHandler.CheckStatus)

			r.Route("/{routerID}/interfaces", func(r chi.Router) {
				r.Get("/", interfaceHandler.List)
				r.Get("/{name}", interfaceHandler.GetByName)
			})

			r.Get("/{routerID}/firewall/filter", proxyHandler.FirewallRules)
			r.Get("/{routerID}/routes", proxyHandler.Routes)
			r.Post("/{routerID}/routes", proxyHandler.CreateRoute)
			r.Get("/{routerID}/routes/{routeID}", proxyHandler.RouteByID)
			r.Patch("/{routerID}/routes/{routeID}", proxyHandler.UpdateRoute)
			r.Delete("/{routerID}/routes/{routeID}", proxyHandler.DeleteRoute)
			r.Get("/{routerID}/address-lists", proxyHandler.AddressLists)
			r.Get("/{routerID}/tunnels", proxyHandler.Tunnels)

			r.With(middleware.RequireRole("owner", "admin")).Post("/{routerID}/configure", configureHandler.Configure)
		})

		r.With(middleware.RequireRole("owner", "admin")).Get("/audit-log", configureHandler.AuditList)

		r.Route("/v1/operations", func(r chi.Router) {
			r.With(middleware.RequireRole("owner", "admin", "operator")).Post("/execute", operationHandler.Execute)
			r.With(middleware.RequireRole("owner", "admin", "operator")).Post("/undo/{groupID}", operationHandler.Undo)
			r.Get("/history", operationHandler.History)
		})
	})

	r.Route("/api/admin", func(r chi.Router) {
		r.Use(middleware.Auth(cfg.JWTSecret))
		r.Use(middleware.RequireSuperAdmin(pool))

		r.Get("/tenants", tenantHandler.ListAll)
		r.Post("/tenants", tenantHandler.CreateTenant)
	})

	return httptest.NewServer(r)
}

// DoRequest makes an HTTP request to the test server with optional JSON body and auth token.
// Returns the HTTP response and response body bytes.
func DoRequest(server *httptest.Server, method, path string, body interface{}, token string) (*http.Response, []byte) {
	var reqBody io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			panic(fmt.Sprintf("testutil: marshal request body: %v", err))
		}
		reqBody = bytes.NewReader(data)
	}

	req, err := http.NewRequest(method, server.URL+path, reqBody)
	if err != nil {
		panic(fmt.Sprintf("testutil: create request: %v", err))
	}

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		panic(fmt.Sprintf("testutil: do request: %v", err))
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		panic(fmt.Sprintf("testutil: read response: %v", err))
	}

	return resp, respBody
}

// DoRequestWithCookie makes an HTTP request with a cookie set instead of (or in addition to) a Bearer token.
func DoRequestWithCookie(server *httptest.Server, method, path string, body interface{}, token string, cookies []*http.Cookie) (*http.Response, []byte) {
	var reqBody io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			panic(fmt.Sprintf("testutil: marshal request body: %v", err))
		}
		reqBody = bytes.NewReader(data)
	}

	req, err := http.NewRequest(method, server.URL+path, reqBody)
	if err != nil {
		panic(fmt.Sprintf("testutil: create request: %v", err))
	}

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	for _, c := range cookies {
		req.AddCookie(c)
	}

	// Do not follow redirects, and capture Set-Cookie headers.
	client := &http.Client{
		Timeout: 30 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	resp, err := client.Do(req)
	if err != nil {
		panic(fmt.Sprintf("testutil: do request: %v", err))
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		panic(fmt.Sprintf("testutil: read response: %v", err))
	}

	return resp, respBody
}

// AuthHeader returns the Authorization header value for a given token.
func AuthHeader(token string) string {
	return "Bearer " + token
}

// GenerateTokenForRole creates a JWT token for a specific role using the test context user info.
func GenerateTokenForRole(tc *TestContext, role string) string {
	token, err := auth.GenerateAccessToken(tc.UserID, tc.TenantID, role, TestUserEmail, TestJWTSecret, 1*time.Hour)
	if err != nil {
		panic(fmt.Sprintf("testutil: generate token for role %s: %v", role, err))
	}
	return token
}

// GenerateExpiredToken creates an expired JWT token for testing.
func GenerateExpiredToken(tc *TestContext) string {
	token, err := auth.GenerateAccessToken(tc.UserID, tc.TenantID, "owner", TestUserEmail, TestJWTSecret, -1*time.Hour)
	if err != nil {
		panic(fmt.Sprintf("testutil: generate expired token: %v", err))
	}
	return token
}

// CleanupTestDB drops the test database.
func CleanupTestDB(pool *pgxpool.Pool) {
	pool.Close()

	ctx := context.Background()
	adminConn, err := pgx.Connect(ctx, AdminDBURL)
	if err != nil {
		fmt.Fprintf(os.Stderr, "testutil: cleanup connect: %v\n", err)
		return
	}
	defer adminConn.Close(ctx)

	_, _ = adminConn.Exec(ctx, fmt.Sprintf(
		"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '%s' AND pid <> pg_backend_pid()",
		TestDBName,
	))
	_, _ = adminConn.Exec(ctx, "DROP DATABASE IF EXISTS "+TestDBName)
}
