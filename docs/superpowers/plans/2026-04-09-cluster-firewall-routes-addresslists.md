# Cluster-Scoped Firewall, Routes & Address Lists Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cluster-scoped CRUD endpoints for firewall rules, routes, and address lists. Reads come from the master router only; writes fan out to every router in the cluster via the operation system. Resources are matched by content (not by RouterOS `*ID`) when fanning out updates/deletes.

**Architecture:** New methods are added to the existing `internal/tunnel` package's `Service` and `Handler` structs, which already have `getClusterRouters`, `routerSvc`, `clusterSvc`, and `operationSvc`. Three new files (`firewall.go`, `routes.go`, `addresslists.go`) contain service methods + helpers. Three new handler files (`firewall_handler.go`, `routes_handler.go`, `addresslists_handler.go`) contain HTTP handlers. Existing proxy-package functions (`FetchFirewallRules`, `FetchRoutes`, `FetchAddressLists`) are reused directly. A shared `getMasterClient` helper finds the master router and returns its client.

**Tech Stack:** Go 1.22+, Chi v5, existing operation/undo system, existing proxy fetch/normalize functions.

---

## File Structure

```
internal/tunnel/              -- MODIFIED: add firewall, routes, address-list support
  service.go                  -- MODIFIED: add getMasterClient helper
  firewall.go                 -- NEW: cluster-scoped firewall service methods
  firewall_handler.go         -- NEW: HTTP handlers for firewall endpoints
  routes.go                   -- NEW: cluster-scoped routes service methods
  routes_handler.go           -- NEW: HTTP handlers for routes endpoints
  addresslists.go             -- NEW: cluster-scoped address-list service methods
  addresslists_handler.go     -- NEW: HTTP handlers for address-list endpoints

cmd/server/
  main.go                     -- MODIFIED: register new cluster-scoped routes, add PATCH to CORS
```

---

### Task 1: Add getMasterClient Helper to tunnel.Service

**Files:**
- Modify: `backend/internal/tunnel/service.go`

- [ ] **Step 1: Add getMasterClient method**

In `backend/internal/tunnel/service.go`, add after the `getClusterRouters` method (after line 46):

```go
// getMasterClient returns a RouterOS client for the master router in the cluster.
func (s *Service) getMasterClient(ctx context.Context, tenantID, clusterID string) (*routeros.Client, error) {
	cl, err := s.clusterSvc.GetByID(ctx, tenantID, clusterID)
	if err != nil {
		return nil, fmt.Errorf("cluster: get cluster: %w", err)
	}
	if cl == nil {
		return nil, fmt.Errorf("cluster: cluster not found")
	}

	for _, r := range cl.Routers {
		if r.Role == "master" {
			client, err := s.routerSvc.GetClientForRouter(ctx, tenantID, r.ID)
			if err != nil {
				return nil, fmt.Errorf("cluster: get client for master router %s: %w", r.Name, err)
			}
			return client, nil
		}
	}
	return nil, fmt.Errorf("cluster: no master router found in cluster")
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/pavle/speckit/kormos/backend && go build ./...`
Expected: clean build, no errors.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/tunnel/service.go
git commit -m "Add getMasterClient helper to tunnel service"
```

---

### Task 2: Cluster-Scoped Firewall CRUD

**Files:**
- Create: `backend/internal/tunnel/firewall.go`
- Create: `backend/internal/tunnel/firewall_handler.go`

- [ ] **Step 1: Create firewall service methods**

Create `backend/internal/tunnel/firewall.go`:

```go
package tunnel

import (
	"context"
	"fmt"

	"github.com/pobradovic08/kormos/backend/internal/operation"
	"github.com/pobradovic08/kormos/backend/internal/proxy"
)

// ─── Firewall Request Types ───────────────────────────────────────────────────

// CreateFirewallRuleRequest is the payload for creating a firewall filter rule.
type CreateFirewallRuleRequest struct {
	Chain           string `json:"chain"`
	Action          string `json:"action"`
	Protocol        string `json:"protocol,omitempty"`
	SrcAddress      string `json:"srcAddress,omitempty"`
	DstAddress      string `json:"dstAddress,omitempty"`
	SrcAddressList  string `json:"srcAddressList,omitempty"`
	DstAddressList  string `json:"dstAddressList,omitempty"`
	SrcPort         string `json:"srcPort,omitempty"`
	DstPort         string `json:"dstPort,omitempty"`
	InInterface     string `json:"inInterface,omitempty"`
	OutInterface    string `json:"outInterface,omitempty"`
	ConnectionState string `json:"connectionState,omitempty"`
	Disabled        bool   `json:"disabled"`
	Comment         string `json:"comment,omitempty"`
}

func (r CreateFirewallRuleRequest) toRouterOS() map[string]interface{} {
	m := map[string]interface{}{
		"chain":  r.Chain,
		"action": r.Action,
	}
	if r.Protocol != "" {
		m["protocol"] = r.Protocol
	}
	if r.SrcAddress != "" {
		m["src-address"] = r.SrcAddress
	}
	if r.DstAddress != "" {
		m["dst-address"] = r.DstAddress
	}
	if r.SrcAddressList != "" {
		m["src-address-list"] = r.SrcAddressList
	}
	if r.DstAddressList != "" {
		m["dst-address-list"] = r.DstAddressList
	}
	if r.SrcPort != "" {
		m["src-port"] = r.SrcPort
	}
	if r.DstPort != "" {
		m["dst-port"] = r.DstPort
	}
	if r.InInterface != "" {
		m["in-interface"] = r.InInterface
	}
	if r.OutInterface != "" {
		m["out-interface"] = r.OutInterface
	}
	if r.ConnectionState != "" {
		m["connection-state"] = r.ConnectionState
	}
	if r.Disabled {
		m["disabled"] = "true"
	}
	if r.Comment != "" {
		m["comment"] = r.Comment
	}
	return m
}

// UpdateFirewallRuleRequest is the payload for updating a firewall filter rule.
type UpdateFirewallRuleRequest struct {
	Action          *string `json:"action,omitempty"`
	Protocol        *string `json:"protocol,omitempty"`
	SrcAddress      *string `json:"srcAddress,omitempty"`
	DstAddress      *string `json:"dstAddress,omitempty"`
	SrcAddressList  *string `json:"srcAddressList,omitempty"`
	DstAddressList  *string `json:"dstAddressList,omitempty"`
	SrcPort         *string `json:"srcPort,omitempty"`
	DstPort         *string `json:"dstPort,omitempty"`
	InInterface     *string `json:"inInterface,omitempty"`
	OutInterface    *string `json:"outInterface,omitempty"`
	ConnectionState *string `json:"connectionState,omitempty"`
	Disabled        *bool   `json:"disabled,omitempty"`
	Comment         *string `json:"comment,omitempty"`
}

func (r UpdateFirewallRuleRequest) toRouterOS() map[string]interface{} {
	m := map[string]interface{}{}
	if r.Action != nil {
		m["action"] = *r.Action
	}
	if r.Protocol != nil {
		m["protocol"] = *r.Protocol
	}
	if r.SrcAddress != nil {
		m["src-address"] = *r.SrcAddress
	}
	if r.DstAddress != nil {
		m["dst-address"] = *r.DstAddress
	}
	if r.SrcAddressList != nil {
		m["src-address-list"] = *r.SrcAddressList
	}
	if r.DstAddressList != nil {
		m["dst-address-list"] = *r.DstAddressList
	}
	if r.SrcPort != nil {
		m["src-port"] = *r.SrcPort
	}
	if r.DstPort != nil {
		m["dst-port"] = *r.DstPort
	}
	if r.InInterface != nil {
		m["in-interface"] = *r.InInterface
	}
	if r.OutInterface != nil {
		m["out-interface"] = *r.OutInterface
	}
	if r.ConnectionState != nil {
		m["connection-state"] = *r.ConnectionState
	}
	if r.Disabled != nil {
		if *r.Disabled {
			m["disabled"] = "true"
		} else {
			m["disabled"] = "false"
		}
	}
	if r.Comment != nil {
		m["comment"] = *r.Comment
	}
	return m
}

// ─── Firewall Service Methods ─────────────────────────────────────────────────

// ListFirewallRules fetches firewall filter rules from the master router.
func (s *Service) ListFirewallRules(ctx context.Context, tenantID, clusterID string) ([]proxy.FirewallRule, error) {
	client, err := s.getMasterClient(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	return proxy.FetchFirewallRules(ctx, client)
}

// CreateFirewallRule creates a firewall rule on all routers in the cluster.
func (s *Service) CreateFirewallRule(ctx context.Context, tenantID, userID, clusterID string, req CreateFirewallRuleRequest) ([]proxy.FirewallRule, error) {
	routers, _, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	body := req.toRouterOS()
	ops := make([]operation.ExecuteOperation, 0, len(routers))
	for _, ri := range routers {
		ops = append(ops, operation.ExecuteOperation{
			RouterID:      ri.ID,
			Module:        "firewall",
			OperationType: operation.OpAdd,
			ResourcePath:  "/ip/firewall/filter",
			Body:          body,
		})
	}

	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Create firewall rule: %s %s", req.Chain, req.Action),
		Operations:  ops,
	}
	if _, err := s.operationSvc.Execute(ctx, tenantID, userID, execReq); err != nil {
		return nil, fmt.Errorf("firewall: create rule: %w", err)
	}

	return s.ListFirewallRules(ctx, tenantID, clusterID)
}

// findFirewallRuleByID finds a firewall rule by its RouterOS ID in a slice.
func findFirewallRuleByID(rules []proxy.FirewallRule, id string) *proxy.FirewallRule {
	for i := range rules {
		if rules[i].ID == id {
			return &rules[i]
		}
	}
	return nil
}

// findMatchingFirewallRule finds a rule on a target router that matches the reference rule by content.
// Matches on chain + action + protocol + src/dst addresses + src/dst ports + comment.
func findMatchingFirewallRule(rules []proxy.FirewallRule, ref proxy.FirewallRule) *proxy.FirewallRule {
	for i := range rules {
		r := &rules[i]
		if r.Chain == ref.Chain &&
			r.Action == ref.Action &&
			r.Protocol == ref.Protocol &&
			r.SrcAddress == ref.SrcAddress &&
			r.DstAddress == ref.DstAddress &&
			r.SrcAddressList == ref.SrcAddressList &&
			r.DstAddressList == ref.DstAddressList &&
			r.SrcPort == ref.SrcPort &&
			r.DstPort == ref.DstPort &&
			r.InInterface == ref.InInterface &&
			r.OutInterface == ref.OutInterface &&
			r.Comment == ref.Comment {
			return r
		}
	}
	return nil
}

// UpdateFirewallRule updates a firewall rule on all routers in the cluster.
// The ruleID is the master router's RouterOS ID; the matching rule is found by content on other routers.
func (s *Service) UpdateFirewallRule(ctx context.Context, tenantID, userID, clusterID, ruleID string, req UpdateFirewallRuleRequest) ([]proxy.FirewallRule, error) {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	// Fetch from master to get the canonical rule for content matching.
	var masterRules []proxy.FirewallRule
	var refRule *proxy.FirewallRule
	for _, ri := range routers {
		if ri.Role == "master" {
			masterRules, err = proxy.FetchFirewallRules(ctx, clients[ri.ID])
			if err != nil {
				return nil, fmt.Errorf("firewall: fetch rules from master: %w", err)
			}
			refRule = findFirewallRuleByID(masterRules, ruleID)
			break
		}
	}
	if refRule == nil {
		return nil, fmt.Errorf("firewall: rule %s not found on master router", ruleID)
	}

	body := req.toRouterOS()
	ops := make([]operation.ExecuteOperation, 0, len(routers))
	for _, ri := range routers {
		var targetID string
		if ri.Role == "master" {
			targetID = ruleID
		} else {
			rules, err := proxy.FetchFirewallRules(ctx, clients[ri.ID])
			if err != nil {
				return nil, fmt.Errorf("firewall: fetch rules from router %s: %w", ri.Name, err)
			}
			match := findMatchingFirewallRule(rules, *refRule)
			if match == nil {
				continue
			}
			targetID = match.ID
		}
		ops = append(ops, operation.ExecuteOperation{
			RouterID:      ri.ID,
			Module:        "firewall",
			OperationType: operation.OpModify,
			ResourcePath:  "/ip/firewall/filter",
			ResourceID:    targetID,
			Body:          body,
		})
	}

	if len(ops) == 0 {
		return nil, fmt.Errorf("firewall: rule not found on any router")
	}

	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Update firewall rule %s", ruleID),
		Operations:  ops,
	}
	if _, err := s.operationSvc.Execute(ctx, tenantID, userID, execReq); err != nil {
		return nil, fmt.Errorf("firewall: update rule: %w", err)
	}

	return s.ListFirewallRules(ctx, tenantID, clusterID)
}

// DeleteFirewallRule deletes a firewall rule from all routers in the cluster.
func (s *Service) DeleteFirewallRule(ctx context.Context, tenantID, userID, clusterID, ruleID string) error {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return err
	}

	// Fetch from master to get the canonical rule for content matching.
	var refRule *proxy.FirewallRule
	for _, ri := range routers {
		if ri.Role == "master" {
			masterRules, err := proxy.FetchFirewallRules(ctx, clients[ri.ID])
			if err != nil {
				return fmt.Errorf("firewall: fetch rules from master: %w", err)
			}
			refRule = findFirewallRuleByID(masterRules, ruleID)
			break
		}
	}
	if refRule == nil {
		return fmt.Errorf("firewall: rule %s not found on master router", ruleID)
	}

	ops := make([]operation.ExecuteOperation, 0, len(routers))
	for _, ri := range routers {
		var targetID string
		if ri.Role == "master" {
			targetID = ruleID
		} else {
			rules, err := proxy.FetchFirewallRules(ctx, clients[ri.ID])
			if err != nil {
				return fmt.Errorf("firewall: fetch rules from router %s: %w", ri.Name, err)
			}
			match := findMatchingFirewallRule(rules, *refRule)
			if match == nil {
				continue
			}
			targetID = match.ID
		}
		ops = append(ops, operation.ExecuteOperation{
			RouterID:      ri.ID,
			Module:        "firewall",
			OperationType: operation.OpDelete,
			ResourcePath:  "/ip/firewall/filter",
			ResourceID:    targetID,
		})
	}

	if len(ops) == 0 {
		return fmt.Errorf("firewall: rule not found on any router")
	}

	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Delete firewall rule %s", ruleID),
		Operations:  ops,
	}
	if _, err := s.operationSvc.Execute(ctx, tenantID, userID, execReq); err != nil {
		return fmt.Errorf("firewall: delete rule: %w", err)
	}

	return nil
}
```

- [ ] **Step 2: Create firewall HTTP handlers**

Create `backend/internal/tunnel/firewall_handler.go`:

```go
package tunnel

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/pobradovic08/kormos/backend/internal/middleware"
	"github.com/pobradovic08/kormos/backend/internal/proxy"
)

// ListFirewallRules handles GET /api/clusters/{clusterID}/firewall/filter.
func (h *Handler) ListFirewallRules(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")

	rules, err := h.service.ListFirewallRules(r.Context(), tenantID, clusterID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	if rules == nil {
		rules = []proxy.FirewallRule{}
	}
	writeJSON(w, http.StatusOK, rules)
}

// CreateFirewallRule handles POST /api/clusters/{clusterID}/firewall/filter.
func (h *Handler) CreateFirewallRule(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")

	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid token")
		return
	}

	var req CreateFirewallRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}
	if req.Chain == "" || req.Action == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "Chain and action are required")
		return
	}

	rules, err := h.service.CreateFirewallRule(r.Context(), tenantID, claims.UserID, clusterID, req)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, rules)
}

// UpdateFirewallRule handles PATCH /api/clusters/{clusterID}/firewall/filter/{ruleID}.
func (h *Handler) UpdateFirewallRule(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")
	ruleID := chi.URLParam(r, "ruleID")

	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid token")
		return
	}

	var req UpdateFirewallRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	rules, err := h.service.UpdateFirewallRule(r.Context(), tenantID, claims.UserID, clusterID, ruleID, req)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, rules)
}

// DeleteFirewallRule handles DELETE /api/clusters/{clusterID}/firewall/filter/{ruleID}.
func (h *Handler) DeleteFirewallRule(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")
	ruleID := chi.URLParam(r, "ruleID")

	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid token")
		return
	}

	if err := h.service.DeleteFirewallRule(r.Context(), tenantID, claims.UserID, clusterID, ruleID); err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
```

- [ ] **Step 3: Verify the build compiles**

Run: `cd /Users/pavle/speckit/kormos/backend && go build ./...`
Expected: clean build, no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/tunnel/firewall.go backend/internal/tunnel/firewall_handler.go
git commit -m "Add cluster-scoped firewall CRUD with content-based matching"
```

---

### Task 3: Cluster-Scoped Routes CRUD

**Files:**
- Create: `backend/internal/tunnel/routes.go`
- Create: `backend/internal/tunnel/routes_handler.go`

- [ ] **Step 1: Create routes service methods**

Create `backend/internal/tunnel/routes.go`:

```go
package tunnel

import (
	"context"
	"fmt"
	"strconv"

	"github.com/pobradovic08/kormos/backend/internal/operation"
	"github.com/pobradovic08/kormos/backend/internal/proxy"
)

// ─── Routes Request Types ─────────────────────────────────────────────────────

// CreateClusterRouteRequest is the payload for creating a route on all cluster routers.
type CreateClusterRouteRequest struct {
	Destination string `json:"destination"`
	Gateway     string `json:"gateway"`
	Distance    int    `json:"distance"`
	Comment     string `json:"comment,omitempty"`
}

func (r CreateClusterRouteRequest) toRouterOS() map[string]interface{} {
	m := map[string]interface{}{
		"dst-address": r.Destination,
		"gateway":     r.Gateway,
		"distance":    strconv.Itoa(r.Distance),
	}
	if r.Comment != "" {
		m["comment"] = r.Comment
	}
	return m
}

// UpdateClusterRouteRequest is the payload for updating a route on all cluster routers.
type UpdateClusterRouteRequest struct {
	Gateway  *string `json:"gateway,omitempty"`
	Distance *int    `json:"distance,omitempty"`
	Disabled *bool   `json:"disabled,omitempty"`
	Comment  *string `json:"comment,omitempty"`
}

func (r UpdateClusterRouteRequest) toRouterOS() map[string]interface{} {
	m := map[string]interface{}{}
	if r.Gateway != nil {
		m["gateway"] = *r.Gateway
	}
	if r.Distance != nil {
		m["distance"] = strconv.Itoa(*r.Distance)
	}
	if r.Disabled != nil {
		if *r.Disabled {
			m["disabled"] = "true"
		} else {
			m["disabled"] = "false"
		}
	}
	if r.Comment != nil {
		m["comment"] = *r.Comment
	}
	return m
}

// ─── Routes Service Methods ───────────────────────────────────────────────────

// ListRoutes fetches routes from the master router.
func (s *Service) ListRoutes(ctx context.Context, tenantID, clusterID string) ([]proxy.Route, error) {
	client, err := s.getMasterClient(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	return proxy.FetchRoutes(ctx, client)
}

// GetRoute fetches a single route by ID from the master router.
func (s *Service) GetRoute(ctx context.Context, tenantID, clusterID, routeID string) (*proxy.Route, error) {
	client, err := s.getMasterClient(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	return proxy.FetchRoute(ctx, client, routeID)
}

// CreateRoute creates a route on all routers in the cluster.
func (s *Service) CreateRoute(ctx context.Context, tenantID, userID, clusterID string, req CreateClusterRouteRequest) ([]proxy.Route, error) {
	routers, _, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	body := req.toRouterOS()
	ops := make([]operation.ExecuteOperation, 0, len(routers))
	for _, ri := range routers {
		ops = append(ops, operation.ExecuteOperation{
			RouterID:      ri.ID,
			Module:        "routes",
			OperationType: operation.OpAdd,
			ResourcePath:  "/ip/route",
			Body:          body,
		})
	}

	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Create route %s via %s", req.Destination, req.Gateway),
		Operations:  ops,
	}
	if _, err := s.operationSvc.Execute(ctx, tenantID, userID, execReq); err != nil {
		return nil, fmt.Errorf("routes: create route: %w", err)
	}

	return s.ListRoutes(ctx, tenantID, clusterID)
}

// findRouteByID finds a route by its RouterOS ID in a slice.
func findRouteByID(routes []proxy.Route, id string) *proxy.Route {
	for i := range routes {
		if routes[i].ID == id {
			return &routes[i]
		}
	}
	return nil
}

// findMatchingRoute finds a route on a target router that matches the reference route by content.
// Matches on destination + gateway + distance + comment.
func findMatchingRoute(routes []proxy.Route, ref proxy.Route) *proxy.Route {
	for i := range routes {
		r := &routes[i]
		if r.Destination == ref.Destination &&
			r.Gateway == ref.Gateway &&
			r.Distance == ref.Distance &&
			r.Comment == ref.Comment {
			return r
		}
	}
	return nil
}

// UpdateRoute updates a route on all routers in the cluster.
// The routeID is the master router's RouterOS ID; the matching route is found by content on other routers.
func (s *Service) UpdateRoute(ctx context.Context, tenantID, userID, clusterID, routeID string, req UpdateClusterRouteRequest) ([]proxy.Route, error) {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	// Fetch from master to get the canonical route for content matching.
	var refRoute *proxy.Route
	for _, ri := range routers {
		if ri.Role == "master" {
			masterRoutes, err := proxy.FetchRoutes(ctx, clients[ri.ID])
			if err != nil {
				return nil, fmt.Errorf("routes: fetch routes from master: %w", err)
			}
			refRoute = findRouteByID(masterRoutes, routeID)
			break
		}
	}
	if refRoute == nil {
		return nil, fmt.Errorf("routes: route %s not found on master router", routeID)
	}

	body := req.toRouterOS()
	ops := make([]operation.ExecuteOperation, 0, len(routers))
	for _, ri := range routers {
		var targetID string
		if ri.Role == "master" {
			targetID = routeID
		} else {
			routes, err := proxy.FetchRoutes(ctx, clients[ri.ID])
			if err != nil {
				return nil, fmt.Errorf("routes: fetch routes from router %s: %w", ri.Name, err)
			}
			match := findMatchingRoute(routes, *refRoute)
			if match == nil {
				continue
			}
			targetID = match.ID
		}
		ops = append(ops, operation.ExecuteOperation{
			RouterID:      ri.ID,
			Module:        "routes",
			OperationType: operation.OpModify,
			ResourcePath:  "/ip/route",
			ResourceID:    targetID,
			Body:          body,
		})
	}

	if len(ops) == 0 {
		return nil, fmt.Errorf("routes: route not found on any router")
	}

	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Update route %s", routeID),
		Operations:  ops,
	}
	if _, err := s.operationSvc.Execute(ctx, tenantID, userID, execReq); err != nil {
		return nil, fmt.Errorf("routes: update route: %w", err)
	}

	return s.ListRoutes(ctx, tenantID, clusterID)
}

// DeleteRoute deletes a route from all routers in the cluster.
func (s *Service) DeleteRoute(ctx context.Context, tenantID, userID, clusterID, routeID string) error {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return err
	}

	// Fetch from master to get the canonical route for content matching.
	var refRoute *proxy.Route
	for _, ri := range routers {
		if ri.Role == "master" {
			masterRoutes, err := proxy.FetchRoutes(ctx, clients[ri.ID])
			if err != nil {
				return fmt.Errorf("routes: fetch routes from master: %w", err)
			}
			refRoute = findRouteByID(masterRoutes, routeID)
			break
		}
	}
	if refRoute == nil {
		return fmt.Errorf("routes: route %s not found on master router", routeID)
	}

	ops := make([]operation.ExecuteOperation, 0, len(routers))
	for _, ri := range routers {
		var targetID string
		if ri.Role == "master" {
			targetID = routeID
		} else {
			routes, err := proxy.FetchRoutes(ctx, clients[ri.ID])
			if err != nil {
				return fmt.Errorf("routes: fetch routes from router %s: %w", ri.Name, err)
			}
			match := findMatchingRoute(routes, *refRoute)
			if match == nil {
				continue
			}
			targetID = match.ID
		}
		ops = append(ops, operation.ExecuteOperation{
			RouterID:      ri.ID,
			Module:        "routes",
			OperationType: operation.OpDelete,
			ResourcePath:  "/ip/route",
			ResourceID:    targetID,
		})
	}

	if len(ops) == 0 {
		return fmt.Errorf("routes: route not found on any router")
	}

	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Delete route %s", routeID),
		Operations:  ops,
	}
	if _, err := s.operationSvc.Execute(ctx, tenantID, userID, execReq); err != nil {
		return fmt.Errorf("routes: delete route: %w", err)
	}

	return nil
}
```

- [ ] **Step 2: Create routes HTTP handlers**

Create `backend/internal/tunnel/routes_handler.go`:

```go
package tunnel

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/pobradovic08/kormos/backend/internal/middleware"
	"github.com/pobradovic08/kormos/backend/internal/proxy"
)

// ListRoutes handles GET /api/clusters/{clusterID}/routes.
func (h *Handler) ListRoutes(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")

	routes, err := h.service.ListRoutes(r.Context(), tenantID, clusterID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	if routes == nil {
		routes = []proxy.Route{}
	}
	writeJSON(w, http.StatusOK, routes)
}

// GetRoute handles GET /api/clusters/{clusterID}/routes/{routeID}.
func (h *Handler) GetRoute(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")
	routeID := chi.URLParam(r, "routeID")

	route, err := h.service.GetRoute(r.Context(), tenantID, clusterID, routeID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	if route == nil {
		writeError(w, http.StatusNotFound, "not_found", "Route not found")
		return
	}
	writeJSON(w, http.StatusOK, route)
}

// CreateRoute handles POST /api/clusters/{clusterID}/routes.
func (h *Handler) CreateRoute(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")

	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid token")
		return
	}

	var req CreateClusterRouteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}
	if req.Destination == "" || req.Gateway == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "Destination and gateway are required")
		return
	}
	if req.Distance == 0 {
		req.Distance = 1
	}

	routes, err := h.service.CreateRoute(r.Context(), tenantID, claims.UserID, clusterID, req)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, routes)
}

// UpdateRoute handles PATCH /api/clusters/{clusterID}/routes/{routeID}.
func (h *Handler) UpdateRoute(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")
	routeID := chi.URLParam(r, "routeID")

	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid token")
		return
	}

	var req UpdateClusterRouteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	routes, err := h.service.UpdateRoute(r.Context(), tenantID, claims.UserID, clusterID, routeID, req)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, routes)
}

// DeleteRoute handles DELETE /api/clusters/{clusterID}/routes/{routeID}.
func (h *Handler) DeleteRoute(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")
	routeID := chi.URLParam(r, "routeID")

	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid token")
		return
	}

	if err := h.service.DeleteRoute(r.Context(), tenantID, claims.UserID, clusterID, routeID); err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
```

- [ ] **Step 3: Verify the build compiles**

Run: `cd /Users/pavle/speckit/kormos/backend && go build ./...`
Expected: clean build, no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/tunnel/routes.go backend/internal/tunnel/routes_handler.go
git commit -m "Add cluster-scoped routes CRUD with content-based matching"
```

---

### Task 4: Cluster-Scoped Address Lists CRUD

**Files:**
- Create: `backend/internal/tunnel/addresslists.go`
- Create: `backend/internal/tunnel/addresslists_handler.go`

- [ ] **Step 1: Create address lists service methods**

Create `backend/internal/tunnel/addresslists.go`:

```go
package tunnel

import (
	"context"
	"fmt"

	"github.com/pobradovic08/kormos/backend/internal/operation"
	"github.com/pobradovic08/kormos/backend/internal/proxy"
)

// ─── Address List Request Types ───────────────────────────────────────────────

// CreateAddressEntryRequest is the payload for creating an address list entry.
type CreateAddressEntryRequest struct {
	List     string `json:"list"`
	Address  string `json:"address"`
	Comment  string `json:"comment,omitempty"`
	Disabled bool   `json:"disabled"`
}

func (r CreateAddressEntryRequest) toRouterOS() map[string]interface{} {
	m := map[string]interface{}{
		"list":    r.List,
		"address": r.Address,
	}
	if r.Comment != "" {
		m["comment"] = r.Comment
	}
	if r.Disabled {
		m["disabled"] = "true"
	}
	return m
}

// UpdateAddressEntryRequest is the payload for updating an address list entry.
type UpdateAddressEntryRequest struct {
	Address  *string `json:"address,omitempty"`
	Comment  *string `json:"comment,omitempty"`
	Disabled *bool   `json:"disabled,omitempty"`
}

func (r UpdateAddressEntryRequest) toRouterOS() map[string]interface{} {
	m := map[string]interface{}{}
	if r.Address != nil {
		m["address"] = *r.Address
	}
	if r.Comment != nil {
		m["comment"] = *r.Comment
	}
	if r.Disabled != nil {
		if *r.Disabled {
			m["disabled"] = "true"
		} else {
			m["disabled"] = "false"
		}
	}
	return m
}

// ─── Address List Service Methods ─────────────────────────────────────────────

// ListAddressLists fetches address lists from the master router.
func (s *Service) ListAddressLists(ctx context.Context, tenantID, clusterID string) ([]proxy.AddressList, error) {
	client, err := s.getMasterClient(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	return proxy.FetchAddressLists(ctx, client)
}

// CreateAddressEntry creates an address list entry on all routers in the cluster.
func (s *Service) CreateAddressEntry(ctx context.Context, tenantID, userID, clusterID string, req CreateAddressEntryRequest) ([]proxy.AddressList, error) {
	routers, _, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	body := req.toRouterOS()
	ops := make([]operation.ExecuteOperation, 0, len(routers))
	for _, ri := range routers {
		ops = append(ops, operation.ExecuteOperation{
			RouterID:      ri.ID,
			Module:        "address-lists",
			OperationType: operation.OpAdd,
			ResourcePath:  "/ip/firewall/address-list",
			Body:          body,
		})
	}

	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Create address list entry: %s %s", req.List, req.Address),
		Operations:  ops,
	}
	if _, err := s.operationSvc.Execute(ctx, tenantID, userID, execReq); err != nil {
		return nil, fmt.Errorf("address-lists: create entry: %w", err)
	}

	return s.ListAddressLists(ctx, tenantID, clusterID)
}

// flattenAddressEntries returns all entries across all lists with their list name attached.
type flatEntry struct {
	ListName string
	Entry    proxy.AddressEntry
}

func flattenAddressEntries(lists []proxy.AddressList) []flatEntry {
	var result []flatEntry
	for _, list := range lists {
		for _, entry := range list.Entries {
			result = append(result, flatEntry{ListName: list.Name, Entry: entry})
		}
	}
	return result
}

// findAddressEntryByID finds an address entry by its RouterOS ID across all lists.
func findAddressEntryByID(lists []proxy.AddressList, id string) (*flatEntry, bool) {
	for _, list := range lists {
		for _, entry := range list.Entries {
			if entry.ID == id {
				return &flatEntry{ListName: list.Name, Entry: entry}, true
			}
		}
	}
	return nil, false
}

// findMatchingAddressEntry finds an entry on a target router that matches the reference by content.
// Matches on list name + prefix (address) + comment.
func findMatchingAddressEntry(flat []flatEntry, ref flatEntry) *flatEntry {
	for i := range flat {
		f := &flat[i]
		if f.ListName == ref.ListName &&
			f.Entry.Prefix == ref.Entry.Prefix &&
			f.Entry.Comment == ref.Entry.Comment {
			return f
		}
	}
	return nil
}

// UpdateAddressEntry updates an address list entry on all routers in the cluster.
func (s *Service) UpdateAddressEntry(ctx context.Context, tenantID, userID, clusterID, entryID string, req UpdateAddressEntryRequest) ([]proxy.AddressList, error) {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	// Fetch from master to get the canonical entry for content matching.
	var refEntry *flatEntry
	for _, ri := range routers {
		if ri.Role == "master" {
			masterLists, err := proxy.FetchAddressLists(ctx, clients[ri.ID])
			if err != nil {
				return nil, fmt.Errorf("address-lists: fetch from master: %w", err)
			}
			refEntry, _ = findAddressEntryByID(masterLists, entryID)
			break
		}
	}
	if refEntry == nil {
		return nil, fmt.Errorf("address-lists: entry %s not found on master router", entryID)
	}

	body := req.toRouterOS()
	ops := make([]operation.ExecuteOperation, 0, len(routers))
	for _, ri := range routers {
		var targetID string
		if ri.Role == "master" {
			targetID = entryID
		} else {
			lists, err := proxy.FetchAddressLists(ctx, clients[ri.ID])
			if err != nil {
				return nil, fmt.Errorf("address-lists: fetch from router %s: %w", ri.Name, err)
			}
			flat := flattenAddressEntries(lists)
			match := findMatchingAddressEntry(flat, *refEntry)
			if match == nil {
				continue
			}
			targetID = match.Entry.ID
		}
		ops = append(ops, operation.ExecuteOperation{
			RouterID:      ri.ID,
			Module:        "address-lists",
			OperationType: operation.OpModify,
			ResourcePath:  "/ip/firewall/address-list",
			ResourceID:    targetID,
			Body:          body,
		})
	}

	if len(ops) == 0 {
		return nil, fmt.Errorf("address-lists: entry not found on any router")
	}

	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Update address list entry %s", entryID),
		Operations:  ops,
	}
	if _, err := s.operationSvc.Execute(ctx, tenantID, userID, execReq); err != nil {
		return nil, fmt.Errorf("address-lists: update entry: %w", err)
	}

	return s.ListAddressLists(ctx, tenantID, clusterID)
}

// DeleteAddressEntry deletes an address list entry from all routers in the cluster.
func (s *Service) DeleteAddressEntry(ctx context.Context, tenantID, userID, clusterID, entryID string) error {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return err
	}

	// Fetch from master to get the canonical entry for content matching.
	var refEntry *flatEntry
	for _, ri := range routers {
		if ri.Role == "master" {
			masterLists, err := proxy.FetchAddressLists(ctx, clients[ri.ID])
			if err != nil {
				return fmt.Errorf("address-lists: fetch from master: %w", err)
			}
			refEntry, _ = findAddressEntryByID(masterLists, entryID)
			break
		}
	}
	if refEntry == nil {
		return fmt.Errorf("address-lists: entry %s not found on master router", entryID)
	}

	ops := make([]operation.ExecuteOperation, 0, len(routers))
	for _, ri := range routers {
		var targetID string
		if ri.Role == "master" {
			targetID = entryID
		} else {
			lists, err := proxy.FetchAddressLists(ctx, clients[ri.ID])
			if err != nil {
				return fmt.Errorf("address-lists: fetch from router %s: %w", ri.Name, err)
			}
			flat := flattenAddressEntries(lists)
			match := findMatchingAddressEntry(flat, *refEntry)
			if match == nil {
				continue
			}
			targetID = match.Entry.ID
		}
		ops = append(ops, operation.ExecuteOperation{
			RouterID:      ri.ID,
			Module:        "address-lists",
			OperationType: operation.OpDelete,
			ResourcePath:  "/ip/firewall/address-list",
			ResourceID:    targetID,
		})
	}

	if len(ops) == 0 {
		return fmt.Errorf("address-lists: entry not found on any router")
	}

	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Delete address list entry %s", entryID),
		Operations:  ops,
	}
	if _, err := s.operationSvc.Execute(ctx, tenantID, userID, execReq); err != nil {
		return fmt.Errorf("address-lists: delete entry: %w", err)
	}

	return nil
}
```

- [ ] **Step 2: Create address lists HTTP handlers**

Create `backend/internal/tunnel/addresslists_handler.go`:

```go
package tunnel

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/pobradovic08/kormos/backend/internal/middleware"
	"github.com/pobradovic08/kormos/backend/internal/proxy"
)

// ListAddressLists handles GET /api/clusters/{clusterID}/address-lists.
func (h *Handler) ListAddressLists(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")

	lists, err := h.service.ListAddressLists(r.Context(), tenantID, clusterID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	if lists == nil {
		lists = []proxy.AddressList{}
	}
	writeJSON(w, http.StatusOK, lists)
}

// CreateAddressEntry handles POST /api/clusters/{clusterID}/address-lists.
func (h *Handler) CreateAddressEntry(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")

	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid token")
		return
	}

	var req CreateAddressEntryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}
	if req.List == "" || req.Address == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "List and address are required")
		return
	}

	lists, err := h.service.CreateAddressEntry(r.Context(), tenantID, claims.UserID, clusterID, req)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, lists)
}

// UpdateAddressEntry handles PATCH /api/clusters/{clusterID}/address-lists/{entryID}.
func (h *Handler) UpdateAddressEntry(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")
	entryID := chi.URLParam(r, "entryID")

	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid token")
		return
	}

	var req UpdateAddressEntryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	lists, err := h.service.UpdateAddressEntry(r.Context(), tenantID, claims.UserID, clusterID, entryID, req)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, lists)
}

// DeleteAddressEntry handles DELETE /api/clusters/{clusterID}/address-lists/{entryID}.
func (h *Handler) DeleteAddressEntry(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")
	entryID := chi.URLParam(r, "entryID")

	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid token")
		return
	}

	if err := h.service.DeleteAddressEntry(r.Context(), tenantID, claims.UserID, clusterID, entryID); err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
```

- [ ] **Step 3: Verify the build compiles**

Run: `cd /Users/pavle/speckit/kormos/backend && go build ./...`
Expected: clean build, no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/tunnel/addresslists.go backend/internal/tunnel/addresslists_handler.go
git commit -m "Add cluster-scoped address lists CRUD with content-based matching"
```

---

### Task 5: Register Cluster-Scoped Routes and Fix CORS

**Files:**
- Modify: `backend/cmd/server/main.go`

- [ ] **Step 1: Add PATCH to CORS AllowedMethods**

In `backend/cmd/server/main.go`, change the `AllowedMethods` line from:

```go
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
```

to:

```go
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
```

- [ ] **Step 2: Register cluster-scoped firewall, routes, and address-list routes**

In `backend/cmd/server/main.go`, inside the `/api` route group, inside the `r.Route("/clusters", ...)` block, add the following routes after the existing `/{clusterID}/wireguard` block (after the closing `})` of the wireguard route block):

```go
			r.Route("/{clusterID}/firewall/filter", func(r chi.Router) {
				r.Get("/", tunnelHandler.ListFirewallRules)
				r.Post("/", tunnelHandler.CreateFirewallRule)
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
```

- [ ] **Step 3: Verify the build compiles**

Run: `cd /Users/pavle/speckit/kormos/backend && go build ./...`
Expected: clean build, no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/cmd/server/main.go
git commit -m "Register cluster-scoped firewall, routes, and address-list endpoints"
```

---

## Summary

| Task | Files | What |
|------|-------|------|
| 1 | `tunnel/service.go` | Add `getMasterClient` helper |
| 2 | `tunnel/firewall.go`, `tunnel/firewall_handler.go` | Firewall CRUD (list from master, create/update/delete fan-out) |
| 3 | `tunnel/routes.go`, `tunnel/routes_handler.go` | Routes CRUD (list/get from master, create/update/delete fan-out) |
| 4 | `tunnel/addresslists.go`, `tunnel/addresslists_handler.go` | Address lists CRUD (list from master, create/update/delete fan-out) |
| 5 | `cmd/server/main.go` | Register routes, fix CORS for PATCH |

**Key design patterns:**
- **Read from master only** -- `getMasterClient` returns a single client for the master router, avoiding unnecessary requests to backup routers for read operations.
- **Content-based matching for writes** -- update/delete operations fetch the resource from the master to get its canonical data, then find the matching resource on each backup router by content (chain+action+protocol+etc. for firewall, destination+gateway+distance+comment for routes, list+prefix+comment for address lists) rather than by RouterOS `*ID` which may differ across routers.
- **Operation fan-out** -- all mutations go through `operation.Service.Execute()` with one `ExecuteOperation` per router, supporting full undo/redo.
- **Existing proxy functions reused** -- `proxy.FetchFirewallRules`, `proxy.FetchRoutes`, `proxy.FetchAddressLists` are called directly from the tunnel service methods.
- **Existing router-scoped endpoints preserved** -- the `proxy.Handler` routes under `/routers/{routerID}/...` remain untouched for backward compatibility.
