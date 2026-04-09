package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/pobradovic08/kormos/backend/internal/audit"
	"github.com/pobradovic08/kormos/backend/internal/auth"
	"github.com/pobradovic08/kormos/backend/internal/cluster"
	"github.com/pobradovic08/kormos/backend/internal/config"
	"github.com/pobradovic08/kormos/backend/internal/configure"
	"github.com/pobradovic08/kormos/backend/internal/db"
	"github.com/pobradovic08/kormos/backend/internal/interfaces"
	"github.com/pobradovic08/kormos/backend/internal/middleware"
	"github.com/pobradovic08/kormos/backend/internal/operation"
	"github.com/pobradovic08/kormos/backend/internal/proxy"
	"github.com/pobradovic08/kormos/backend/internal/router"
	"github.com/pobradovic08/kormos/backend/internal/setup"
	"github.com/pobradovic08/kormos/backend/internal/tenant"
	"github.com/pobradovic08/kormos/backend/internal/tunnel"
	"github.com/pobradovic08/kormos/backend/internal/user"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	pool, err := db.NewPool(cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to create database pool: %v", err)
	}
	defer pool.Close()

	// Setup wizard.
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

	// Global middleware
	r.Use(chimw.Logger)
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
	r.Use(middleware.DefaultRateLimit())

	// Setup guard: blocks non-setup routes until initial setup is complete.
	r.Use(middleware.SetupGuard(setupRepo))

	// Public setup routes (no authentication required, exempt from SetupGuard).
	r.Route("/api/setup", func(r chi.Router) {
		r.Get("/status", setupHandler.Status)
		r.Post("/complete", setupHandler.Complete)
	})

	// Public auth routes (no authentication required)
	r.Route("/api/auth", func(r chi.Router) {
		r.Post("/login", authHandler.Login)
		r.Post("/refresh", authHandler.Refresh)
		r.Post("/logout", authHandler.Logout)
	})

	// Protected API routes (auth + tenant scope required)
	r.Route("/api", func(r chi.Router) {
		r.Use(middleware.Auth(cfg.JWTSecret))
		r.Use(middleware.TenantScope())

		// Portal settings (any authenticated user can read).
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

	// Superadmin routes (auth required, no tenant scope, superadmin check)
	r.Route("/api/admin", func(r chi.Router) {
		r.Use(middleware.Auth(cfg.JWTSecret))
		r.Use(middleware.RequireSuperAdmin(pool))

		r.Get("/tenants", tenantHandler.ListAll)
		r.Post("/tenants", tenantHandler.CreateTenant)
	})

	srv := &http.Server{
		Addr:    cfg.ListenAddr,
		Handler: r,
	}

	// Start server in a goroutine so we can handle shutdown signals.
	go func() {
		log.Printf("Starting server on %s", cfg.ListenAddr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	// Wait for SIGINT or SIGTERM.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	sig := <-quit
	log.Printf("Received %s, shutting down gracefully...", sig)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Graceful shutdown failed: %v", err)
	}

	log.Println("Server stopped")
}
