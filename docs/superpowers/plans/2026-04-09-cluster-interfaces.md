# Cluster-Scoped Interfaces Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cluster-scoped interfaces endpoints that fetch interfaces from all routers in a cluster and merge them by name, following the same pattern as `MergeGRETunnels`. Each interface appears once with per-router details in an `endpoints[]` array.

**Architecture:** The existing `internal/tunnel` package is extended with an `interfaces.Fetcher` dependency. New types (`MergedInterface`, `InterfaceEndpoint`, `InterfaceAddress`) are added to `tunnel/types.go`. A new `tunnel/interfaces.go` file contains the merge logic and is called from new `ListInterfaces`/`GetInterface` methods on `tunnel.Service`. Two new handler methods are registered under `/api/clusters/{clusterID}/interfaces`. The existing router-scoped `/api/routers/{routerID}/interfaces` endpoints remain unchanged.

**Tech Stack:** Go 1.22+, Chi v5, existing `interfaces.Fetcher`, existing `tunnel.Service` patterns.

---

## File Structure

```
internal/tunnel/              -- MODIFIED
  types.go                    -- add MergedInterface, InterfaceEndpoint, InterfaceAddress types
  interfaces.go               -- NEW: merge logic (MergeInterfaces, FindMergedInterfaceByName)
  service.go                  -- add interfaces.Fetcher dependency, ListInterfaces, GetInterface
  handler.go                  -- add ListInterfaces, GetInterface handler methods

cmd/server/
  main.go                     -- pass interfaceFetcher to tunnel.NewService, register cluster interface routes
```

---

### Task 1: Add MergedInterface Types to tunnel/types.go

**Files:**
- Modify: `backend/internal/tunnel/types.go`

- [ ] **Step 1: Append the new types at the end of tunnel/types.go**

Add the following types after the existing `RawWireGuardPeer` struct at the bottom of `backend/internal/tunnel/types.go`:

```go
// ─── Interface Types (cluster-scoped merge) ───────────────────────────────────

type InterfaceAddress struct {
	ID      string `json:"id"`
	Address string `json:"address"`
	Network string `json:"network"`
}

type InterfaceEndpoint struct {
	RouterID   string             `json:"routerId"`
	RouterName string             `json:"routerName"`
	Role       string             `json:"role"`
	RosID      string             `json:"rosId"`
	MACAddress string             `json:"macAddress"`
	Running    bool               `json:"running"`
	Addresses  []InterfaceAddress `json:"addresses"`
}

type MergedInterface struct {
	Name        string              `json:"name"`
	DefaultName string              `json:"defaultName,omitempty"`
	Type        string              `json:"type"`
	MTU         int                 `json:"mtu"`
	Disabled    bool                `json:"disabled"`
	Comment     string              `json:"comment,omitempty"`
	Endpoints   []InterfaceEndpoint `json:"endpoints"`
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/pavle/speckit/kormos/backend && go build ./...`
Expected: clean build, no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/tunnel/types.go
git commit -m "Add MergedInterface, InterfaceEndpoint, InterfaceAddress types"
```

---

### Task 2: Create tunnel/interfaces.go With Merge Logic

**Files:**
- Create: `backend/internal/tunnel/interfaces.go`

- [ ] **Step 1: Create the interfaces merge file**

Create `backend/internal/tunnel/interfaces.go` with the following content:

```go
package tunnel

import "github.com/pobradovic08/kormos/backend/internal/interfaces"

// MergeInterfaces groups per-router normalised interfaces by name, master first.
// Shared fields (type, MTU, disabled, comment, defaultName) come from the master
// router's copy. Per-router fields (rosId, macAddress, running, addresses) go
// into the endpoints array.
func MergeInterfaces(perRouter map[string][]interfaces.Interface, routers []RouterInfo) []MergedInterface {
	type ifaceEntry struct {
		shared    *interfaces.Interface
		endpoints []InterfaceEndpoint
	}
	byName := map[string]*ifaceEntry{}
	var orderedNames []string

	// Sort master first so shared fields come from master.
	sorted := make([]RouterInfo, 0, len(routers))
	for _, ri := range routers {
		if ri.Role == "master" {
			sorted = append(sorted, ri)
		}
	}
	for _, ri := range routers {
		if ri.Role != "master" {
			sorted = append(sorted, ri)
		}
	}

	for _, ri := range sorted {
		ifaces := perRouter[ri.ID]
		for _, iface := range ifaces {
			addrs := make([]InterfaceAddress, len(iface.Addresses))
			for j, a := range iface.Addresses {
				addrs[j] = InterfaceAddress{
					ID:      a.ID,
					Address: a.Address,
					Network: a.Network,
				}
			}

			ep := InterfaceEndpoint{
				RouterID:   ri.ID,
				RouterName: ri.Name,
				Role:       ri.Role,
				RosID:      iface.ID,
				MACAddress: iface.MACAddress,
				Running:    iface.Running,
				Addresses:  addrs,
			}
			if ep.Addresses == nil {
				ep.Addresses = []InterfaceAddress{}
			}

			entry, exists := byName[iface.Name]
			if !exists {
				ifaceCopy := iface
				entry = &ifaceEntry{shared: &ifaceCopy}
				byName[iface.Name] = entry
				orderedNames = append(orderedNames, iface.Name)
			}
			entry.endpoints = append(entry.endpoints, ep)
		}
	}

	result := make([]MergedInterface, 0, len(orderedNames))
	for _, name := range orderedNames {
		entry := byName[name]
		s := entry.shared
		result = append(result, MergedInterface{
			Name:        s.Name,
			DefaultName: s.DefaultName,
			Type:        s.Type,
			MTU:         s.MTU,
			Disabled:    s.Disabled,
			Comment:     s.Comment,
			Endpoints:   entry.endpoints,
		})
	}
	return result
}

// FindMergedInterfaceByName returns a pointer to the merged interface with the
// given name, or nil if not found.
func FindMergedInterfaceByName(ifaces []MergedInterface, name string) *MergedInterface {
	for i := range ifaces {
		if ifaces[i].Name == name {
			return &ifaces[i]
		}
	}
	return nil
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/pavle/speckit/kormos/backend && go build ./...`
Expected: clean build, no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/tunnel/interfaces.go
git commit -m "Add cluster-scoped interface merge logic"
```

---

### Task 3: Add interfaces.Fetcher Dependency to tunnel.Service and Add ListInterfaces/GetInterface Methods

**Files:**
- Modify: `backend/internal/tunnel/service.go`

- [ ] **Step 1: Add the interfaces import and Fetcher field**

In `backend/internal/tunnel/service.go`, replace the import block:

```go
import (
	"context"
	"fmt"

	"github.com/pobradovic08/kormos/backend/internal/cluster"
	"github.com/pobradovic08/kormos/backend/internal/operation"
	"github.com/pobradovic08/kormos/backend/internal/router"
	"github.com/pobradovic08/kormos/backend/internal/routeros"
)
```

with:

```go
import (
	"context"
	"fmt"

	"github.com/pobradovic08/kormos/backend/internal/cluster"
	"github.com/pobradovic08/kormos/backend/internal/interfaces"
	"github.com/pobradovic08/kormos/backend/internal/operation"
	"github.com/pobradovic08/kormos/backend/internal/router"
	"github.com/pobradovic08/kormos/backend/internal/routeros"
)
```

- [ ] **Step 2: Add the ifaceFetcher field to the Service struct**

Replace the Service struct and NewService function:

```go
// Service orchestrates tunnel CRUD operations across cluster routers.
type Service struct {
	routerSvc    *router.Service
	clusterSvc   *cluster.Service
	operationSvc *operation.Service
}

// NewService creates a new tunnel Service.
func NewService(routerSvc *router.Service, clusterSvc *cluster.Service, operationSvc *operation.Service) *Service {
	return &Service{routerSvc: routerSvc, clusterSvc: clusterSvc, operationSvc: operationSvc}
}
```

with:

```go
// Service orchestrates tunnel CRUD operations across cluster routers.
type Service struct {
	routerSvc    *router.Service
	clusterSvc   *cluster.Service
	operationSvc *operation.Service
	ifaceFetcher *interfaces.Fetcher
}

// NewService creates a new tunnel Service.
func NewService(routerSvc *router.Service, clusterSvc *cluster.Service, operationSvc *operation.Service, ifaceFetcher *interfaces.Fetcher) *Service {
	return &Service{routerSvc: routerSvc, clusterSvc: clusterSvc, operationSvc: operationSvc, ifaceFetcher: ifaceFetcher}
}
```

- [ ] **Step 3: Add the ListInterfaces and GetInterface methods**

Append the following at the end of `backend/internal/tunnel/service.go`, before the final closing (after the `DeleteWGPeer` method's closing brace):

```go
// ─── Interfaces (read-only, cluster-scoped) ────────────────────────────────────

// ListInterfaces fetches interfaces from all routers in the cluster and merges them by name.
func (s *Service) ListInterfaces(ctx context.Context, tenantID, clusterID string) ([]MergedInterface, error) {
	routers, _, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	perRouter := make(map[string][]interfaces.Interface)
	for _, ri := range routers {
		ifaces, err := s.ifaceFetcher.ListInterfaces(ctx, tenantID, ri.ID)
		if err != nil {
			return nil, fmt.Errorf("tunnel: list interfaces from router %s: %w", ri.Name, err)
		}
		perRouter[ri.ID] = ifaces
	}

	return MergeInterfaces(perRouter, routers), nil
}

// GetInterface returns a single merged interface by name.
func (s *Service) GetInterface(ctx context.Context, tenantID, clusterID, name string) (*MergedInterface, error) {
	ifaces, err := s.ListInterfaces(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	return FindMergedInterfaceByName(ifaces, name), nil
}
```

- [ ] **Step 4: Verify the build compiles**

Run: `cd /Users/pavle/speckit/kormos/backend && go build ./...`
Expected: compilation will fail because `main.go` still calls `tunnel.NewService` with 3 args. This is expected and will be fixed in Task 5.

- [ ] **Step 5: Commit**

```bash
git add backend/internal/tunnel/service.go
git commit -m "Add interfaces.Fetcher dependency and ListInterfaces/GetInterface to tunnel service"
```

---

### Task 4: Add ListInterfaces and GetInterface Handlers to tunnel/handler.go

**Files:**
- Modify: `backend/internal/tunnel/handler.go`

- [ ] **Step 1: Add the handler methods**

Append the following after the `DeleteWGPeer` handler method and before the `// ─── Helpers` section in `backend/internal/tunnel/handler.go`:

```go
// ─── Interface Handlers (cluster-scoped, read-only) ───────────────────────────

// ListInterfaces handles GET /api/clusters/{clusterID}/interfaces.
func (h *Handler) ListInterfaces(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")

	ifaces, err := h.service.ListInterfaces(r.Context(), tenantID, clusterID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	if ifaces == nil {
		ifaces = []MergedInterface{}
	}
	writeJSON(w, http.StatusOK, ifaces)
}

// GetInterface handles GET /api/clusters/{clusterID}/interfaces/{name}.
func (h *Handler) GetInterface(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")
	name := chi.URLParam(r, "name")

	iface, err := h.service.GetInterface(r.Context(), tenantID, clusterID, name)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	if iface == nil {
		writeError(w, http.StatusNotFound, "not_found", "Interface not found")
		return
	}
	writeJSON(w, http.StatusOK, iface)
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/pavle/speckit/kormos/backend && go build ./...`
Expected: still fails due to `main.go` NewService arity mismatch. Fixed in Task 5.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/tunnel/handler.go
git commit -m "Add ListInterfaces and GetInterface HTTP handlers"
```

---

### Task 5: Wire Dependencies and Register Routes in main.go

**Files:**
- Modify: `backend/cmd/server/main.go`

- [ ] **Step 1: Update the tunnel.NewService call to pass interfaceFetcher**

In `backend/cmd/server/main.go`, replace:

```go
	tunnelService := tunnel.NewService(routerService, clusterService, operationService)
```

with:

```go
	tunnelService := tunnel.NewService(routerService, clusterService, operationService, interfaceFetcher)
```

- [ ] **Step 2: Register cluster-scoped interface routes**

In `backend/cmd/server/main.go`, inside the `r.Route("/clusters", ...)` block, after the `/{clusterID}/wireguard` route group, add the interface routes. Replace:

```go
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
```

with:

```go
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
```

- [ ] **Step 3: Verify the build compiles**

Run: `cd /Users/pavle/speckit/kormos/backend && go build ./...`
Expected: clean build, no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/cmd/server/main.go
git commit -m "Wire interfaces.Fetcher into tunnel service and register cluster interface routes"
```

---

### Task 6: Build Docker Image and Verify

- [ ] **Step 1: Full build verification**

Run: `cd /Users/pavle/speckit/kormos/backend && go vet ./...`
Expected: no issues.

- [ ] **Step 2: Docker build**

Run: `cd /Users/pavle/speckit/kormos && docker build -t kormos-backend -f backend/Dockerfile backend/`
Expected: successful image build.

---

## Summary of All Changes

| File | Action | Description |
|------|--------|-------------|
| `backend/internal/tunnel/types.go` | Modify | Add `MergedInterface`, `InterfaceEndpoint`, `InterfaceAddress` types |
| `backend/internal/tunnel/interfaces.go` | Create | `MergeInterfaces` and `FindMergedInterfaceByName` functions |
| `backend/internal/tunnel/service.go` | Modify | Add `ifaceFetcher` field, update `NewService` signature, add `ListInterfaces`/`GetInterface` methods |
| `backend/internal/tunnel/handler.go` | Modify | Add `ListInterfaces`/`GetInterface` HTTP handler methods |
| `backend/cmd/server/main.go` | Modify | Pass `interfaceFetcher` to `tunnel.NewService`, register `/{clusterID}/interfaces` routes |

## API Endpoints Added

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/clusters/{clusterID}/interfaces` | `tunnelHandler.ListInterfaces` |
| GET | `/api/clusters/{clusterID}/interfaces/{name}` | `tunnelHandler.GetInterface` |

## Endpoints Preserved (unchanged)

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/routers/{routerID}/interfaces` | `interfaceHandler.List` |
| GET | `/api/routers/{routerID}/interfaces/{name}` | `interfaceHandler.GetByName` |
