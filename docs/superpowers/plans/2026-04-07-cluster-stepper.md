# Cluster Stepper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat "Add Router" flow with a cluster-first model where users create a cluster (1-2 routers for HA) via a 4-step stepper drawer.

**Architecture:** New `clusters` table + `cluster_id`/`role` columns on `routers`. New `cluster` backend package (repo/service/handler) following existing three-layer pattern. Frontend replaces `RouterForm` modal with `ClusterDrawer` stepper component. Existing `routerGrouping.ts` and `RoutersPage` updated to read cluster data from backend instead of mock-only fields.

**Tech Stack:** Go 1.22+ (pgx, chi), PostgreSQL 16+, React 19 + Mantine 9 (Stepper) + TanStack Query 5

---

## File Structure

### Backend (new files)

| File | Responsibility |
|------|---------------|
| `backend/internal/db/migrations/010_create_clusters.sql` | Migration: clusters table, alter routers |
| `backend/internal/cluster/types.go` | Request/response types |
| `backend/internal/cluster/repository.go` | PostgreSQL CRUD for clusters + routers |
| `backend/internal/cluster/service.go` | Business logic: create/update with diff, validation, credential encryption |
| `backend/internal/cluster/handler.go` | HTTP handlers: CRUD + test connection |

### Backend (modified files)

| File | Change |
|------|--------|
| `backend/cmd/server/main.go` | Wire up cluster handler, register `/api/clusters/*` routes |

### Frontend (new files)

| File | Responsibility |
|------|---------------|
| `frontend/src/features/routers/clustersApi.ts` | TanStack Query hooks for cluster CRUD |
| `frontend/src/features/routers/ClusterDrawer.tsx` | XL drawer with 4-step Mantine Stepper |

### Frontend (modified files)

| File | Change |
|------|--------|
| `frontend/src/api/types.ts` | Add Cluster type, update Router type (cluster_id/role required) |
| `frontend/src/features/routers/RoutersPage.tsx` | Use cluster API, replace RouterForm with ClusterDrawer |
| `frontend/src/features/routers/routerGrouping.ts` | Read cluster_id/role from backend data (no longer optional) |
| `frontend/src/mocks/mockData.ts` | Update mock data to match new cluster structure |
| `frontend/src/components/shell/RouterSelector.tsx` | Works as-is once cluster_id comes from backend |

### Frontend (removed files)

| File | Reason |
|------|--------|
| `frontend/src/features/routers/RouterForm.tsx` | Replaced by ClusterDrawer |

---

## Task 1: Database migration

**Files:**
- Create: `backend/internal/db/migrations/010_create_clusters.sql`

- [ ] **Step 1: Write the migration SQL**

Create `backend/internal/db/migrations/010_create_clusters.sql`:

```sql
CREATE TYPE router_role AS ENUM ('master', 'backup');

CREATE TABLE clusters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(tenant_id, name)
);

ALTER TABLE routers
    ADD COLUMN cluster_id UUID REFERENCES clusters(id) ON DELETE CASCADE,
    ADD COLUMN role router_role NOT NULL DEFAULT 'master';

CREATE INDEX idx_clusters_tenant ON clusters(tenant_id);
CREATE INDEX idx_routers_cluster ON routers(cluster_id);
```

Note: `cluster_id` is nullable initially because existing routers (if any) don't have clusters. The service layer enforces that new routers always have a cluster_id.

- [ ] **Step 2: Verify migration compiles**

```bash
cd backend && go build ./cmd/migrate/
```

- [ ] **Step 3: Apply the migration**

```bash
cd backend && export $(cat .env | grep -v '^#' | xargs) && go run ./cmd/migrate/ up
```

- [ ] **Step 4: Commit**

```bash
git add backend/internal/db/migrations/010_create_clusters.sql
git commit -m "Add clusters table and cluster_id/role columns on routers"
```

---

## Task 2: Backend types

**Files:**
- Create: `backend/internal/cluster/types.go`

- [ ] **Step 1: Create the types file**

Create `backend/internal/cluster/types.go`:

```go
package cluster

import "time"

// Cluster represents a managed cluster (1-2 routers for HA).
type Cluster struct {
	ID        string    `json:"id"`
	TenantID  string    `json:"tenant_id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ClusterResponse is the public representation of a cluster with its routers.
type ClusterResponse struct {
	ID        string           `json:"id"`
	Name      string           `json:"name"`
	Mode      string           `json:"mode"` // "ha" or "standalone"
	CreatedAt time.Time        `json:"created_at"`
	Routers   []RouterResponse `json:"routers"`
}

// RouterResponse is a router within a cluster response.
type RouterResponse struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Hostname    string     `json:"hostname"`
	Host        string     `json:"host"`
	Port        int        `json:"port"`
	Role        string     `json:"role"`
	IsReachable bool       `json:"is_reachable"`
	LastSeen    *time.Time `json:"last_seen"`
}

// CreateClusterRequest is the JSON body for POST /api/clusters.
type CreateClusterRequest struct {
	Name    string               `json:"name"`
	Routers []CreateRouterInput  `json:"routers"`
}

// CreateRouterInput describes a router to create within a cluster.
type CreateRouterInput struct {
	Name     string `json:"name"`
	Hostname string `json:"hostname"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

// UpdateClusterRequest is the JSON body for PUT /api/clusters/{id}.
type UpdateClusterRequest struct {
	Name    string              `json:"name"`
	Routers []UpdateRouterInput `json:"routers"`
}

// UpdateRouterInput describes a router in an update request.
// If ID is empty, the router is new. If ID is set, it's an update.
// Routers present in DB but absent from the array are deleted.
type UpdateRouterInput struct {
	ID       string `json:"id,omitempty"`
	Name     string `json:"name"`
	Hostname string `json:"hostname"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

// TestConnectionRequest is the JSON body for POST /api/clusters/test-connection.
type TestConnectionRequest struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"username"`
	Password string `json:"password"`
}

// TestConnectionResponse is returned from a connection test.
type TestConnectionResponse struct {
	Success         bool   `json:"success"`
	RouterOSVersion string `json:"routeros_version,omitempty"`
	BoardName       string `json:"board_name,omitempty"`
	Error           string `json:"error,omitempty"`
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd backend && go build ./internal/cluster/
```

- [ ] **Step 3: Commit**

```bash
git add backend/internal/cluster/types.go
git commit -m "Add cluster types with request/response structs"
```

---

## Task 3: Backend repository

**Files:**
- Create: `backend/internal/cluster/repository.go`

- [ ] **Step 1: Create the repository**

Create `backend/internal/cluster/repository.go`:

```go
package cluster

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Repository provides data access for clusters and their routers.
type Repository struct {
	pool *pgxpool.Pool
}

// NewRepository creates a new cluster Repository.
func NewRepository(pool *pgxpool.Pool) *Repository {
	return &Repository{pool: pool}
}

// CreateCluster inserts a new cluster row and returns it.
func (r *Repository) CreateCluster(ctx context.Context, tenantID, name string) (*Cluster, error) {
	c := &Cluster{TenantID: tenantID, Name: name}
	err := r.pool.QueryRow(ctx,
		`INSERT INTO clusters (tenant_id, name) VALUES ($1, $2)
		 RETURNING id, created_at, updated_at`,
		tenantID, name,
	).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("cluster: create: %w", err)
	}
	return c, nil
}

// CreateRouter inserts a router linked to a cluster.
func (r *Repository) CreateRouter(ctx context.Context, tenantID, clusterID string, name, hostname, host string, port int, role string, usernameEnc, passwordEnc []byte) (string, error) {
	var id string
	err := r.pool.QueryRow(ctx,
		`INSERT INTO routers (tenant_id, cluster_id, name, hostname, host, port, role, username_encrypted, password_encrypted)
		 VALUES ($1, $2, $3, $4, $5, $6, $7::router_role, $8, $9)
		 RETURNING id`,
		tenantID, clusterID, name, hostname, host, port, role, usernameEnc, passwordEnc,
	).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("cluster: create router: %w", err)
	}
	return id, nil
}

// UpdateClusterName updates a cluster's name.
func (r *Repository) UpdateClusterName(ctx context.Context, tenantID, clusterID, name string) error {
	tag, err := r.pool.Exec(ctx,
		`UPDATE clusters SET name = $1, updated_at = now() WHERE tenant_id = $2 AND id = $3`,
		name, tenantID, clusterID,
	)
	if err != nil {
		return fmt.Errorf("cluster: update name: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("cluster: update name: not found")
	}
	return nil
}

// UpdateRouter updates a router's fields. If usernameEnc/passwordEnc are nil, credentials are not changed.
func (r *Repository) UpdateRouter(ctx context.Context, tenantID, routerID, name, hostname, host string, port int, role string, usernameEnc, passwordEnc []byte) error {
	var err error
	if usernameEnc != nil && passwordEnc != nil {
		_, err = r.pool.Exec(ctx,
			`UPDATE routers SET name=$1, hostname=$2, host=$3, port=$4, role=$5::router_role,
			 username_encrypted=$6, password_encrypted=$7, updated_at=now()
			 WHERE tenant_id=$8 AND id=$9`,
			name, hostname, host, port, role, usernameEnc, passwordEnc, tenantID, routerID,
		)
	} else {
		_, err = r.pool.Exec(ctx,
			`UPDATE routers SET name=$1, hostname=$2, host=$3, port=$4, role=$5::router_role, updated_at=now()
			 WHERE tenant_id=$6 AND id=$7`,
			name, hostname, host, port, role, tenantID, routerID,
		)
	}
	if err != nil {
		return fmt.Errorf("cluster: update router: %w", err)
	}
	return nil
}

// DeleteRouter removes a router by ID.
func (r *Repository) DeleteRouter(ctx context.Context, tenantID, routerID string) error {
	_, err := r.pool.Exec(ctx,
		`DELETE FROM routers WHERE tenant_id = $1 AND id = $2`,
		tenantID, routerID,
	)
	if err != nil {
		return fmt.Errorf("cluster: delete router: %w", err)
	}
	return nil
}

// DeleteCluster removes a cluster and cascades to its routers.
func (r *Repository) DeleteCluster(ctx context.Context, tenantID, clusterID string) error {
	tag, err := r.pool.Exec(ctx,
		`DELETE FROM clusters WHERE tenant_id = $1 AND id = $2`,
		tenantID, clusterID,
	)
	if err != nil {
		return fmt.Errorf("cluster: delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("cluster: delete: not found")
	}
	return nil
}

// GetByID fetches a single cluster by ID.
func (r *Repository) GetByID(ctx context.Context, tenantID, clusterID string) (*Cluster, error) {
	c := &Cluster{}
	err := r.pool.QueryRow(ctx,
		`SELECT id, tenant_id, name, created_at, updated_at FROM clusters WHERE tenant_id = $1 AND id = $2`,
		tenantID, clusterID,
	).Scan(&c.ID, &c.TenantID, &c.Name, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("cluster: get by id: %w", err)
	}
	return c, nil
}

// ListClusters returns all clusters for a tenant.
func (r *Repository) ListClusters(ctx context.Context, tenantID string) ([]Cluster, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, tenant_id, name, created_at, updated_at FROM clusters WHERE tenant_id = $1 ORDER BY name`,
		tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("cluster: list: %w", err)
	}
	defer rows.Close()

	var clusters []Cluster
	for rows.Next() {
		var c Cluster
		if err := rows.Scan(&c.ID, &c.TenantID, &c.Name, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, fmt.Errorf("cluster: list scan: %w", err)
		}
		clusters = append(clusters, c)
	}
	return clusters, rows.Err()
}

// RouterRow is the raw database representation of a router with cluster fields.
type RouterRow struct {
	ID                string
	ClusterID         string
	Name              string
	Hostname          string
	Host              string
	Port              int
	Role              string
	UsernameEncrypted []byte
	PasswordEncrypted []byte
	IsReachable       bool
	LastSeen          *time.Time
}

// ListRoutersByCluster returns all routers for a given cluster.
func (r *Repository) ListRoutersByCluster(ctx context.Context, clusterID string) ([]RouterRow, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT id, cluster_id, name, hostname, host, port, role,
		        username_encrypted, password_encrypted, is_reachable, last_seen
		   FROM routers WHERE cluster_id = $1 ORDER BY role`,
		clusterID,
	)
	if err != nil {
		return nil, fmt.Errorf("cluster: list routers: %w", err)
	}
	defer rows.Close()

	var routers []RouterRow
	for rows.Next() {
		var rt RouterRow
		if err := rows.Scan(&rt.ID, &rt.ClusterID, &rt.Name, &rt.Hostname, &rt.Host, &rt.Port, &rt.Role,
			&rt.UsernameEncrypted, &rt.PasswordEncrypted, &rt.IsReachable, &rt.LastSeen); err != nil {
			return nil, fmt.Errorf("cluster: list routers scan: %w", err)
		}
		routers = append(routers, rt)
	}
	return routers, rows.Err()
}

// ListAllRoutersForTenant returns all routers with cluster info for a tenant.
func (r *Repository) ListAllRoutersForTenant(ctx context.Context, tenantID string) ([]RouterRow, error) {
	rows, err := r.pool.Query(ctx,
		`SELECT r.id, r.cluster_id, r.name, r.hostname, r.host, r.port, r.role,
		        r.username_encrypted, r.password_encrypted, r.is_reachable, r.last_seen
		   FROM routers r
		   JOIN clusters c ON c.id = r.cluster_id
		  WHERE c.tenant_id = $1
		  ORDER BY r.name`,
		tenantID,
	)
	if err != nil {
		return nil, fmt.Errorf("cluster: list all routers: %w", err)
	}
	defer rows.Close()

	var routers []RouterRow
	for rows.Next() {
		var rt RouterRow
		if err := rows.Scan(&rt.ID, &rt.ClusterID, &rt.Name, &rt.Hostname, &rt.Host, &rt.Port, &rt.Role,
			&rt.UsernameEncrypted, &rt.PasswordEncrypted, &rt.IsReachable, &rt.LastSeen); err != nil {
			return nil, fmt.Errorf("cluster: list all routers scan: %w", err)
		}
		routers = append(routers, rt)
	}
	return routers, rows.Err()
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd backend && go build ./internal/cluster/
```

- [ ] **Step 3: Commit**

```bash
git add backend/internal/cluster/repository.go
git commit -m "Add cluster repository with CRUD for clusters and routers"
```

---

## Task 4: Backend service

**Files:**
- Create: `backend/internal/cluster/service.go`

- [ ] **Step 1: Create the service**

Create `backend/internal/cluster/service.go`:

```go
package cluster

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/pobradovic08/kormos/backend/internal/crypto"
	"github.com/pobradovic08/kormos/backend/internal/routeros"
)

// Service provides business logic for cluster management.
type Service struct {
	repo          *Repository
	encryptionKey string
	pool          *pgxpool.Pool
}

// NewService creates a new cluster Service.
func NewService(repo *Repository, encryptionKey string, pool *pgxpool.Pool) *Service {
	return &Service{repo: repo, encryptionKey: encryptionKey, pool: pool}
}

// List returns all clusters with their routers for a tenant.
func (s *Service) List(ctx context.Context, tenantID string) ([]ClusterResponse, error) {
	clusters, err := s.repo.ListClusters(ctx, tenantID)
	if err != nil {
		return nil, err
	}

	var responses []ClusterResponse
	for _, c := range clusters {
		routers, err := s.repo.ListRoutersByCluster(ctx, c.ID)
		if err != nil {
			return nil, err
		}
		responses = append(responses, buildClusterResponse(c, routers))
	}
	return responses, nil
}

// GetByID returns a single cluster with its routers.
func (s *Service) GetByID(ctx context.Context, tenantID, clusterID string) (*ClusterResponse, error) {
	c, err := s.repo.GetByID(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	if c == nil {
		return nil, nil
	}

	routers, err := s.repo.ListRoutersByCluster(ctx, c.ID)
	if err != nil {
		return nil, err
	}

	resp := buildClusterResponse(*c, routers)
	return &resp, nil
}

// Create creates a new cluster with its routers.
func (s *Service) Create(ctx context.Context, tenantID string, req CreateClusterRequest) (*ClusterResponse, error) {
	if err := validateClusterRequest(req.Name, req.Routers); err != nil {
		return nil, err
	}

	c, err := s.repo.CreateCluster(ctx, tenantID, req.Name)
	if err != nil {
		return nil, err
	}

	for _, rt := range req.Routers {
		usernameEnc, err := crypto.Encrypt([]byte(rt.Username), s.encryptionKey)
		if err != nil {
			return nil, fmt.Errorf("cluster: encrypt username: %w", err)
		}
		passwordEnc, err := crypto.Encrypt([]byte(rt.Password), s.encryptionKey)
		if err != nil {
			return nil, fmt.Errorf("cluster: encrypt password: %w", err)
		}
		_, err = s.repo.CreateRouter(ctx, tenantID, c.ID, rt.Name, rt.Hostname, rt.Host, rt.Port, rt.Role, usernameEnc, passwordEnc)
		if err != nil {
			return nil, err
		}
	}

	return s.GetByID(ctx, tenantID, c.ID)
}

// Update applies changes to a cluster: rename, add/remove/update routers.
func (s *Service) Update(ctx context.Context, tenantID, clusterID string, req UpdateClusterRequest) (*ClusterResponse, error) {
	c, err := s.repo.GetByID(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	if c == nil {
		return nil, fmt.Errorf("cluster: not found")
	}

	if err := validateClusterRequest(req.Name, toCreateInputs(req.Routers)); err != nil {
		return nil, err
	}

	// Update cluster name if changed.
	if req.Name != c.Name {
		if err := s.repo.UpdateClusterName(ctx, tenantID, clusterID, req.Name); err != nil {
			return nil, err
		}
	}

	// Get current routers.
	currentRouters, err := s.repo.ListRoutersByCluster(ctx, clusterID)
	if err != nil {
		return nil, err
	}

	// Build set of router IDs in the update request.
	requestIDs := make(map[string]bool)
	for _, rt := range req.Routers {
		if rt.ID != "" {
			requestIDs[rt.ID] = true
		}
	}

	// Delete routers that are in DB but not in request.
	for _, existing := range currentRouters {
		if !requestIDs[existing.ID] {
			if err := s.repo.DeleteRouter(ctx, tenantID, existing.ID); err != nil {
				return nil, err
			}
		}
	}

	// Create or update routers from request.
	for _, rt := range req.Routers {
		if rt.ID == "" {
			// New router.
			usernameEnc, err := crypto.Encrypt([]byte(rt.Username), s.encryptionKey)
			if err != nil {
				return nil, fmt.Errorf("cluster: encrypt username: %w", err)
			}
			passwordEnc, err := crypto.Encrypt([]byte(rt.Password), s.encryptionKey)
			if err != nil {
				return nil, fmt.Errorf("cluster: encrypt password: %w", err)
			}
			_, err = s.repo.CreateRouter(ctx, tenantID, clusterID, rt.Name, rt.Hostname, rt.Host, rt.Port, rt.Role, usernameEnc, passwordEnc)
			if err != nil {
				return nil, err
			}
		} else {
			// Existing router — update.
			var usernameEnc, passwordEnc []byte
			if rt.Password != "" {
				usernameEnc, err = crypto.Encrypt([]byte(rt.Username), s.encryptionKey)
				if err != nil {
					return nil, fmt.Errorf("cluster: encrypt username: %w", err)
				}
				passwordEnc, err = crypto.Encrypt([]byte(rt.Password), s.encryptionKey)
				if err != nil {
					return nil, fmt.Errorf("cluster: encrypt password: %w", err)
				}
			}
			if err := s.repo.UpdateRouter(ctx, tenantID, rt.ID, rt.Name, rt.Hostname, rt.Host, rt.Port, rt.Role, usernameEnc, passwordEnc); err != nil {
				return nil, err
			}
		}
	}

	return s.GetByID(ctx, tenantID, clusterID)
}

// Delete removes a cluster and all its routers.
func (s *Service) Delete(ctx context.Context, tenantID, clusterID string) error {
	return s.repo.DeleteCluster(ctx, tenantID, clusterID)
}

// TestConnection attempts to connect to a RouterOS device and returns system info.
func (s *Service) TestConnection(ctx context.Context, req TestConnectionRequest) (*TestConnectionResponse, error) {
	client := routeros.NewClient(req.Host, req.Port, req.Username, req.Password)
	health, err := client.CheckHealth(ctx)
	if err != nil {
		return &TestConnectionResponse{
			Success: false,
			Error:   err.Error(),
		}, nil
	}

	resp := &TestConnectionResponse{Success: true}
	if v, ok := health["version"].(string); ok {
		resp.RouterOSVersion = v
	}
	if v, ok := health["board-name"].(string); ok {
		resp.BoardName = v
	}
	return resp, nil
}

// --- helpers ---

func buildClusterResponse(c Cluster, routers []RouterRow) ClusterResponse {
	mode := "standalone"
	if len(routers) == 2 {
		mode = "ha"
	}

	routerResponses := make([]RouterResponse, len(routers))
	for i, rt := range routers {
		routerResponses[i] = RouterResponse{
			ID:          rt.ID,
			Name:        rt.Name,
			Hostname:    rt.Hostname,
			Host:        rt.Host,
			Port:        rt.Port,
			Role:        rt.Role,
			IsReachable: rt.IsReachable,
			LastSeen:    rt.LastSeen,
		}
	}

	return ClusterResponse{
		ID:        c.ID,
		Name:      c.Name,
		Mode:      mode,
		CreatedAt: c.CreatedAt,
		Routers:   routerResponses,
	}
}

func validateClusterRequest(name string, routers []CreateRouterInput) error {
	if name == "" {
		return fmt.Errorf("cluster: name is required")
	}
	if len(routers) == 0 {
		return fmt.Errorf("cluster: at least one router is required")
	}
	if len(routers) > 2 {
		return fmt.Errorf("cluster: maximum 2 routers per cluster")
	}
	if len(routers) == 2 {
		if routers[0].Role == routers[1].Role {
			return fmt.Errorf("cluster: HA pair must have one master and one backup")
		}
	}
	for i, rt := range routers {
		if rt.Name == "" {
			return fmt.Errorf("cluster: router %d: name is required", i+1)
		}
		if rt.Host == "" {
			return fmt.Errorf("cluster: router %d: host is required", i+1)
		}
		if rt.Username == "" {
			return fmt.Errorf("cluster: router %d: username is required", i+1)
		}
		if rt.Role != "master" && rt.Role != "backup" {
			return fmt.Errorf("cluster: router %d: role must be 'master' or 'backup'", i+1)
		}
	}
	return nil
}

func toCreateInputs(inputs []UpdateRouterInput) []CreateRouterInput {
	result := make([]CreateRouterInput, len(inputs))
	for i, in := range inputs {
		result[i] = CreateRouterInput{
			Name:     in.Name,
			Hostname: in.Hostname,
			Host:     in.Host,
			Port:     in.Port,
			Username: in.Username,
			Password: in.Password,
			Role:     in.Role,
		}
	}
	return result
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd backend && go build ./internal/cluster/
```

- [ ] **Step 3: Commit**

```bash
git add backend/internal/cluster/service.go
git commit -m "Add cluster service with CRUD, validation, and test connection"
```

---

## Task 5: Backend handler

**Files:**
- Create: `backend/internal/cluster/handler.go`

- [ ] **Step 1: Create the handler**

Create `backend/internal/cluster/handler.go`:

```go
package cluster

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/pobradovic08/kormos/backend/internal/middleware"
)

// Handler provides HTTP handlers for cluster endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new cluster Handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// List handles GET /api/clusters.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)

	clusters, err := h.service.List(r.Context(), tenantID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to list clusters")
		return
	}
	if clusters == nil {
		clusters = []ClusterResponse{}
	}

	writeJSON(w, http.StatusOK, clusters)
}

// Create handles POST /api/clusters.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)

	var req CreateClusterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	resp, err := h.service.Create(r.Context(), tenantID, req)
	if err != nil {
		writeError(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

// GetByID handles GET /api/clusters/{clusterID}.
func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")

	resp, err := h.service.GetByID(r.Context(), tenantID, clusterID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to get cluster")
		return
	}
	if resp == nil {
		writeError(w, http.StatusNotFound, "not_found", "Cluster not found")
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// Update handles PUT /api/clusters/{clusterID}.
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")

	var req UpdateClusterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	resp, err := h.service.Update(r.Context(), tenantID, clusterID, req)
	if err != nil {
		writeError(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// Delete handles DELETE /api/clusters/{clusterID}.
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")

	if err := h.service.Delete(r.Context(), tenantID, clusterID); err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to delete cluster")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// TestConnection handles POST /api/clusters/test-connection.
func (h *Handler) TestConnection(w http.ResponseWriter, r *http.Request) {
	var req TestConnectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	resp, err := h.service.TestConnection(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Connection test failed")
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{
		"error":   code,
		"message": message,
	})
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd backend && go build ./internal/cluster/
```

- [ ] **Step 3: Commit**

```bash
git add backend/internal/cluster/handler.go
git commit -m "Add cluster HTTP handlers for CRUD and test connection"
```

---

## Task 6: Wire up routes

**Files:**
- Modify: `backend/cmd/server/main.go`

- [ ] **Step 1: Read main.go and add cluster wiring**

Add to imports:
```go
"github.com/pobradovic08/kormos/backend/internal/cluster"
```

Add after the `operationHandler` initialization:
```go
	clusterRepo := cluster.NewRepository(pool)
	clusterService := cluster.NewService(clusterRepo, cfg.EncryptionKey, pool)
	clusterHandler := cluster.NewHandler(clusterService)
```

Add inside the protected `/api` route group, before the `/routers` route:
```go
		r.Route("/clusters", func(r chi.Router) {
			r.Get("/", clusterHandler.List)
			r.Post("/", clusterHandler.Create)
			r.Post("/test-connection", clusterHandler.TestConnection)
			r.Get("/{clusterID}", clusterHandler.GetByID)
			r.Put("/{clusterID}", clusterHandler.Update)
			r.Delete("/{clusterID}", clusterHandler.Delete)
		})
```

- [ ] **Step 2: Verify it compiles**

```bash
cd backend && go build ./cmd/server/
```

- [ ] **Step 3: Test the endpoints**

Restart the backend and test:
```bash
# Kill old backend, start new
kill $(lsof -t -i :15480) 2>/dev/null
cd backend && export $(cat .env | grep -v '^#' | xargs) && go run ./cmd/server/ &
sleep 2

# Get a token (login)
TOKEN=$(curl -s -X POST http://localhost:15480/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your-password"}' \
  | jq -r '.access_token')

# Test list (should return empty array)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:15480/api/clusters | jq .

# Test connection to CHR1
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  http://localhost:15480/api/clusters/test-connection \
  -d '{"host":"172.16.4.122","port":443,"username":"admin","password":"zezalica123"}' | jq .
```

- [ ] **Step 4: Commit**

```bash
git add backend/cmd/server/main.go
git commit -m "Wire up cluster routes in main server"
```

---

## Task 7: Frontend types

**Files:**
- Modify: `frontend/src/api/types.ts`

- [ ] **Step 1: Read types.ts and update the Router interface**

Make `cluster_id`, `cluster_name`, and `role` required on Router (they now come from the backend). Add Cluster types:

```typescript
// Add after existing types:

export interface ClusterResponse {
  id: string;
  name: string;
  mode: 'ha' | 'standalone';
  created_at: string;
  routers: ClusterRouter[];
}

export interface ClusterRouter {
  id: string;
  name: string;
  hostname: string;
  host: string;
  port: number;
  role: 'master' | 'backup';
  is_reachable: boolean;
  last_seen: string | null;
}

export interface CreateClusterRequest {
  name: string;
  routers: {
    name: string;
    hostname: string;
    host: string;
    port: number;
    username: string;
    password: string;
    role: 'master' | 'backup';
  }[];
}

export interface UpdateClusterRequest {
  name: string;
  routers: {
    id?: string;
    name: string;
    hostname: string;
    host: string;
    port: number;
    username: string;
    password: string;
    role: 'master' | 'backup';
  }[];
}

export interface TestConnectionRequest {
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface TestConnectionResponse {
  success: boolean;
  routeros_version?: string;
  board_name?: string;
  error?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/types.ts
git commit -m "Add cluster types to frontend"
```

---

## Task 8: Frontend API hooks

**Files:**
- Create: `frontend/src/features/routers/clustersApi.ts`

- [ ] **Step 1: Create the cluster API hooks**

Create `frontend/src/features/routers/clustersApi.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import { useMockMode } from '../../mocks/useMockMode';
import type {
  ClusterResponse,
  CreateClusterRequest,
  UpdateClusterRequest,
  TestConnectionRequest,
  TestConnectionResponse,
} from '../../api/types';

export function useClusters() {
  const isMock = useMockMode();
  return useQuery<ClusterResponse[]>({
    queryKey: ['clusters'],
    queryFn: async () => {
      if (isMock) return []; // TODO: add mock data when needed
      const response = await apiClient.get<ClusterResponse[]>('/clusters');
      return response.data;
    },
  });
}

export function useCluster(clusterID: string | null) {
  const isMock = useMockMode();
  return useQuery<ClusterResponse>({
    queryKey: ['clusters', clusterID],
    queryFn: async () => {
      if (isMock) throw new Error('Not implemented in mock mode');
      const response = await apiClient.get<ClusterResponse>(`/clusters/${clusterID}`);
      return response.data;
    },
    enabled: !!clusterID && !isMock,
  });
}

export function useCreateCluster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: CreateClusterRequest) => {
      const response = await apiClient.post<ClusterResponse>('/clusters', req);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['clusters'] });
      void queryClient.invalidateQueries({ queryKey: ['routers'] });
    },
  });
}

export function useUpdateCluster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...req }: UpdateClusterRequest & { id: string }) => {
      const response = await apiClient.put<ClusterResponse>(`/clusters/${id}`, req);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['clusters'] });
      void queryClient.invalidateQueries({ queryKey: ['routers'] });
    },
  });
}

export function useDeleteCluster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/clusters/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['clusters'] });
      void queryClient.invalidateQueries({ queryKey: ['routers'] });
    },
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: async (req: TestConnectionRequest) => {
      const response = await apiClient.post<TestConnectionResponse>(
        '/clusters/test-connection',
        req,
      );
      return response.data;
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/routers/clustersApi.ts
git commit -m "Add frontend cluster API hooks"
```

---

## Task 9: Cluster Drawer component

**Files:**
- Create: `frontend/src/features/routers/ClusterDrawer.tsx`

- [ ] **Step 1: Create the stepper drawer**

This is the main UI component. Create `frontend/src/features/routers/ClusterDrawer.tsx`. The component is a Mantine Drawer with a 4-step Stepper:

1. **Step 1 (Cluster)**: name input, auto-derives router names
2. **Step 2 (Primary Router)**: name, hostname, host, port, credentials, test connection button
3. **Step 3 (Secondary Router)**: toggle for HA, same fields as step 2
4. **Step 4 (Review)**: summary, save button, delete button (edit mode)

Read the current `RouterForm.tsx` first to understand the form patterns (useForm, validation, mutation callbacks, notifications). Then create the new component following the same patterns but with a Stepper instead of a flat form.

Key implementation details:
- Use `Drawer` with `size="xl"` and `position="right"`
- Use Mantine `Stepper` component with `active` state
- Form state managed by `useForm` with all fields for both routers
- Auto-populate router names when cluster name changes (but only if not manually edited)
- "Test Connection" button per router step, using `useTestConnection` mutation
- Edit mode: pre-fill from `ClusterResponse`, password fields empty with "unchanged" placeholder
- Step 4 Review: show summary cards, "Delete Cluster" button in edit mode with confirm dialog

The implementer should read `RouterForm.tsx` and the Mantine Stepper docs to build this. The component should be ~300-400 lines.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/routers/ClusterDrawer.tsx
git commit -m "Add ClusterDrawer stepper component"
```

---

## Task 10: Update RoutersPage to use clusters

**Files:**
- Modify: `frontend/src/features/routers/RoutersPage.tsx`
- Remove: `frontend/src/features/routers/RouterForm.tsx`

- [ ] **Step 1: Read RoutersPage.tsx and update it**

Changes needed:
- Import `useClusters` and `useDeleteCluster` instead of router CRUD hooks
- Import `ClusterDrawer` instead of `RouterForm`
- Change "Add Router" button to "Add Cluster"
- Open `ClusterDrawer` instead of `RouterForm` for add/edit
- The `groupRouters` function should work with the cluster data from the API (since routers now have real `cluster_id` and `role` fields)
- Delete action should delete the cluster, not individual router
- Edit action should open ClusterDrawer with the cluster data

- [ ] **Step 2: Delete RouterForm.tsx**

```bash
rm frontend/src/features/routers/RouterForm.tsx
```

- [ ] **Step 3: Update routerGrouping.ts if needed**

The `groupRouters` function reads `cluster_id` from the Router interface. Since routers now come from the `/api/routers` endpoint (which includes cluster_id/role from the database), the grouping should work. However, verify the field names match and update if needed.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/routers/RoutersPage.tsx frontend/src/features/routers/routerGrouping.ts
git rm frontend/src/features/routers/RouterForm.tsx
git commit -m "Update RoutersPage to use cluster API and stepper drawer"
```

---

## Task 11: Update mock data and verify

**Files:**
- Modify: `frontend/src/mocks/mockData.ts`
- Modify: `frontend/src/features/routers/routersApi.ts`

- [ ] **Step 1: Update mock data to include cluster_id and role as required fields**

The mock routers already have `cluster_id`, `cluster_name`, and `role` fields. Verify they match the updated Router interface (these fields are no longer optional).

- [ ] **Step 2: Update routersApi.ts**

The `useRouters` hook needs to return routers with `cluster_id` and `role` from the backend. Since the `/api/routers` endpoint now returns these fields (from the database), the existing hook should work without changes for the real API path. For mock mode, verify the mock data has the required fields.

- [ ] **Step 3: Remove old create/update/delete router hooks from routersApi.ts**

These are replaced by the cluster API hooks. Keep `useRouters` (read) and `useRouterStatus` (read) only.

- [ ] **Step 4: Verify full build**

```bash
cd frontend && npx tsc --noEmit
cd backend && go build ./...
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/mocks/mockData.ts frontend/src/features/routers/routersApi.ts
git commit -m "Update mock data and remove old router CRUD hooks"
```
