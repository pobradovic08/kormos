# Backend Read Endpoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add backend GET endpoints that proxy and normalize RouterOS REST API responses for firewall, routes, tunnels, address lists, and wireguard modules.

**Architecture:** Single `proxy` package with shared normalization helpers. One file per module containing a fetch function that calls the RouterOS client, parses the JSON response using raw structs with `.id`/kebab-case tags, and returns normalized Go structs with camelCase JSON tags. One handler.go registers all routes under `/api/routers/{routerID}/...`.

**Tech Stack:** Go 1.22+ (encoding/json, strconv), chi router, existing routeros.Client

---

## File Structure

### Backend (new files)

| File | Responsibility |
|------|---------------|
| `backend/internal/proxy/normalize.go` | Shared helpers: parseBool, parseInt, parseIntDefault, splitCSV |
| `backend/internal/proxy/firewall.go` | FetchFirewallRules — normalize /ip/firewall/filter |
| `backend/internal/proxy/routes.go` | FetchRoutes, FetchRoute — normalize /ip/route |
| `backend/internal/proxy/tunnels.go` | FetchTunnels — normalize /interface/gre |
| `backend/internal/proxy/addresslists.go` | FetchAddressLists — normalize /ip/firewall/address-list, group by list name |
| `backend/internal/proxy/wireguard.go` | FetchWireGuardInterfaces, FetchWireGuardPeers — normalize /interface/wireguard and /peers |
| `backend/internal/proxy/handler.go` | HTTP handlers + route registration helper |

### Backend (modified files)

| File | Change |
|------|--------|
| `backend/cmd/server/main.go` | Create proxy handler, register routes under /routers/{routerID}/ |

---

## Task 1: Shared normalization helpers

**Files:**
- Create: `backend/internal/proxy/normalize.go`

- [ ] **Step 1: Create the normalize helpers**

Create `backend/internal/proxy/normalize.go`:

```go
package proxy

import (
	"strconv"
	"strings"
)

// parseBool converts RouterOS string booleans ("true"/"false") to Go bools.
func parseBool(s string) bool {
	return s == "true"
}

// parseInt converts a RouterOS string number to int, returning 0 on failure.
func parseInt(s string) int {
	if s == "" {
		return 0
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	return v
}

// parseInt64 converts a RouterOS string number to int64, returning 0 on failure.
func parseInt64(s string) int64 {
	if s == "" {
		return 0
	}
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0
	}
	return v
}

// splitCSV splits a comma-separated string into a slice, trimming whitespace.
// Returns an empty slice (not nil) for empty input.
func splitCSV(s string) []string {
	if s == "" {
		return []string{}
	}
	parts := strings.Split(s, ",")
	result := make([]string, 0, len(parts))
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd backend && go build ./internal/proxy/
```

- [ ] **Step 3: Commit**

```bash
git add backend/internal/proxy/normalize.go
git commit -m "Add shared normalization helpers for RouterOS field conversion"
```

---

## Task 2: Firewall rules

**Files:**
- Create: `backend/internal/proxy/firewall.go`

- [ ] **Step 1: Create the firewall fetch/normalize**

Create `backend/internal/proxy/firewall.go`:

```go
package proxy

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/pobradovic08/kormos/backend/internal/routeros"
)

// FirewallRule is the normalized representation of a RouterOS firewall filter rule.
type FirewallRule struct {
	ID              string   `json:"id"`
	Chain           string   `json:"chain"`
	Action          string   `json:"action"`
	Protocol        string   `json:"protocol,omitempty"`
	SrcAddress      string   `json:"srcAddress,omitempty"`
	DstAddress      string   `json:"dstAddress,omitempty"`
	SrcAddressList  string   `json:"srcAddressList,omitempty"`
	DstAddressList  string   `json:"dstAddressList,omitempty"`
	SrcPort         string   `json:"srcPort,omitempty"`
	DstPort         string   `json:"dstPort,omitempty"`
	InInterface     string   `json:"inInterface,omitempty"`
	OutInterface    string   `json:"outInterface,omitempty"`
	ConnectionState []string `json:"connectionState,omitempty"`
	Disabled        bool     `json:"disabled"`
	Comment         string   `json:"comment,omitempty"`
}

type rawFirewallRule struct {
	ID              string `json:".id"`
	Chain           string `json:"chain"`
	Action          string `json:"action"`
	Protocol        string `json:"protocol"`
	SrcAddress      string `json:"src-address"`
	DstAddress      string `json:"dst-address"`
	SrcAddressList  string `json:"src-address-list"`
	DstAddressList  string `json:"dst-address-list"`
	SrcPort         string `json:"src-port"`
	DstPort         string `json:"dst-port"`
	InInterface     string `json:"in-interface"`
	OutInterface    string `json:"out-interface"`
	ConnectionState string `json:"connection-state"`
	Disabled        string `json:"disabled"`
	Comment         string `json:"comment"`
}

// FetchFirewallRules fetches and normalizes firewall filter rules from a RouterOS device.
func FetchFirewallRules(ctx context.Context, client *routeros.Client) ([]FirewallRule, error) {
	body, err := client.Get(ctx, "/ip/firewall/filter")
	if err != nil {
		return nil, fmt.Errorf("proxy: fetch firewall rules: %w", err)
	}

	var raw []rawFirewallRule
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("proxy: parse firewall rules: %w", err)
	}

	rules := make([]FirewallRule, len(raw))
	for i, r := range raw {
		rules[i] = FirewallRule{
			ID:              r.ID,
			Chain:           r.Chain,
			Action:          r.Action,
			Protocol:        r.Protocol,
			SrcAddress:      r.SrcAddress,
			DstAddress:      r.DstAddress,
			SrcAddressList:  r.SrcAddressList,
			DstAddressList:  r.DstAddressList,
			SrcPort:         r.SrcPort,
			DstPort:         r.DstPort,
			InInterface:     r.InInterface,
			OutInterface:    r.OutInterface,
			ConnectionState: splitCSV(r.ConnectionState),
			Disabled:        parseBool(r.Disabled),
			Comment:         r.Comment,
		}
	}
	return rules, nil
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd backend && go build ./internal/proxy/
```

- [ ] **Step 3: Commit**

```bash
git add backend/internal/proxy/firewall.go
git commit -m "Add firewall rules fetch and normalization"
```

---

## Task 3: Routes

**Files:**
- Create: `backend/internal/proxy/routes.go`

- [ ] **Step 1: Create the routes fetch/normalize**

Create `backend/internal/proxy/routes.go`:

```go
package proxy

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/pobradovic08/kormos/backend/internal/routeros"
)

// Route is the normalized representation of a RouterOS IP route.
type Route struct {
	ID          string `json:"id"`
	Destination string `json:"destination"`
	Gateway     string `json:"gateway"`
	Interface   string `json:"interface,omitempty"`
	Distance    int    `json:"distance"`
	RouteType   string `json:"routeType"`
	RoutingMark string `json:"routingMark,omitempty"`
	Disabled    bool   `json:"disabled"`
	Active      bool   `json:"active"`
	Comment     string `json:"comment,omitempty"`
}

type rawRoute struct {
	ID           string `json:".id"`
	DstAddress   string `json:"dst-address"`
	Gateway      string `json:"gateway"`
	Interface    string `json:"interface"`
	Distance     string `json:"distance"`
	RoutingMark  string `json:"routing-mark"`
	Disabled     string `json:"disabled"`
	Active       string `json:"active"`
	Static       string `json:"static"`
	Connect      string `json:"connect"`
	Comment      string `json:"comment"`
	BlackholeStr string `json:"blackhole"`
}

// deriveRouteType determines the route type from RouterOS flags.
func deriveRouteType(r rawRoute) string {
	if parseBool(r.BlackholeStr) {
		return "blackhole"
	}
	if parseBool(r.Connect) {
		return "connected"
	}
	return "static"
}

// FetchRoutes fetches and normalizes all routes from a RouterOS device.
func FetchRoutes(ctx context.Context, client *routeros.Client) ([]Route, error) {
	body, err := client.Get(ctx, "/ip/route")
	if err != nil {
		return nil, fmt.Errorf("proxy: fetch routes: %w", err)
	}

	var raw []rawRoute
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("proxy: parse routes: %w", err)
	}

	routes := make([]Route, len(raw))
	for i, r := range raw {
		routes[i] = Route{
			ID:          r.ID,
			Destination: r.DstAddress,
			Gateway:     r.Gateway,
			Interface:   r.Interface,
			Distance:    parseInt(r.Distance),
			RouteType:   deriveRouteType(r),
			RoutingMark: r.RoutingMark,
			Disabled:    parseBool(r.Disabled),
			Active:      parseBool(r.Active),
			Comment:     r.Comment,
		}
	}
	return routes, nil
}

// FetchRoute fetches a single route by ID from a RouterOS device.
func FetchRoute(ctx context.Context, client *routeros.Client, id string) (*Route, error) {
	body, err := client.Get(ctx, "/ip/route/"+id)
	if err != nil {
		return nil, fmt.Errorf("proxy: fetch route %s: %w", id, err)
	}

	var r rawRoute
	if err := json.Unmarshal(body, &r); err != nil {
		return nil, fmt.Errorf("proxy: parse route: %w", err)
	}

	route := Route{
		ID:          r.ID,
		Destination: r.DstAddress,
		Gateway:     r.Gateway,
		Interface:   r.Interface,
		Distance:    parseInt(r.Distance),
		RouteType:   deriveRouteType(r),
		RoutingMark: r.RoutingMark,
		Disabled:    parseBool(r.Disabled),
		Active:      parseBool(r.Active),
		Comment:     r.Comment,
	}
	return &route, nil
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd backend && go build ./internal/proxy/
```

- [ ] **Step 3: Commit**

```bash
git add backend/internal/proxy/routes.go
git commit -m "Add routes fetch and normalization"
```

---

## Task 4: GRE Tunnels

**Files:**
- Create: `backend/internal/proxy/tunnels.go`

- [ ] **Step 1: Create the tunnels fetch/normalize**

Create `backend/internal/proxy/tunnels.go`:

```go
package proxy

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/pobradovic08/kormos/backend/internal/routeros"
)

// Tunnel is the normalized representation of a RouterOS GRE tunnel interface.
type Tunnel struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	TunnelType        string `json:"tunnelType"`
	LocalAddress      string `json:"localAddress"`
	RemoteAddress     string `json:"remoteAddress"`
	MTU               int    `json:"mtu"`
	KeepaliveInterval int    `json:"keepaliveInterval"`
	KeepaliveRetries  int    `json:"keepaliveRetries"`
	IpsecSecret       string `json:"ipsecSecret,omitempty"`
	Disabled          bool   `json:"disabled"`
	Running           bool   `json:"running"`
	Comment           string `json:"comment,omitempty"`
}

type rawGRETunnel struct {
	ID            string `json:".id"`
	Name          string `json:"name"`
	LocalAddress  string `json:"local-address"`
	RemoteAddress string `json:"remote-address"`
	MTU           string `json:"mtu"`
	ActualMTU     string `json:"actual-mtu"`
	Keepalive     string `json:"keepalive"`
	IpsecSecret   string `json:"ipsec-secret"`
	Disabled      string `json:"disabled"`
	Running       string `json:"running"`
	Comment       string `json:"comment"`
}

// parseKeepalive parses RouterOS keepalive format "interval,retries" (e.g., "10s,10").
func parseKeepalive(s string) (interval, retries int) {
	if s == "" {
		return 10, 10
	}
	parts := strings.SplitN(s, ",", 2)
	if len(parts) >= 1 {
		// Strip "s" suffix from interval
		intervalStr := strings.TrimSuffix(strings.TrimSpace(parts[0]), "s")
		interval = parseInt(intervalStr)
	}
	if len(parts) >= 2 {
		retries = parseInt(strings.TrimSpace(parts[1]))
	}
	return
}

// FetchTunnels fetches and normalizes GRE tunnels from a RouterOS device.
func FetchTunnels(ctx context.Context, client *routeros.Client) ([]Tunnel, error) {
	body, err := client.Get(ctx, "/interface/gre")
	if err != nil {
		return nil, fmt.Errorf("proxy: fetch tunnels: %w", err)
	}

	var raw []rawGRETunnel
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("proxy: parse tunnels: %w", err)
	}

	tunnels := make([]Tunnel, len(raw))
	for i, r := range raw {
		interval, retries := parseKeepalive(r.Keepalive)
		mtu := parseInt(r.ActualMTU)
		if mtu == 0 {
			mtu = parseInt(r.MTU)
		}
		tunnels[i] = Tunnel{
			ID:                r.ID,
			Name:              r.Name,
			TunnelType:        "gre",
			LocalAddress:      r.LocalAddress,
			RemoteAddress:     r.RemoteAddress,
			MTU:               mtu,
			KeepaliveInterval: interval,
			KeepaliveRetries:  retries,
			IpsecSecret:       r.IpsecSecret,
			Disabled:          parseBool(r.Disabled),
			Running:           parseBool(r.Running),
			Comment:           r.Comment,
		}
	}
	return tunnels, nil
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd backend && go build ./internal/proxy/
```

- [ ] **Step 3: Commit**

```bash
git add backend/internal/proxy/tunnels.go
git commit -m "Add GRE tunnels fetch and normalization"
```

---

## Task 5: Address lists

**Files:**
- Create: `backend/internal/proxy/addresslists.go`

- [ ] **Step 1: Create the address lists fetch/normalize**

RouterOS returns a flat list of entries. The backend groups them by list name.

Create `backend/internal/proxy/addresslists.go`:

```go
package proxy

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/pobradovic08/kormos/backend/internal/routeros"
)

// AddressList is a named group of address entries.
type AddressList struct {
	Name    string         `json:"name"`
	Entries []AddressEntry `json:"entries"`
}

// AddressEntry is a single entry in an address list.
type AddressEntry struct {
	ID       string `json:"id"`
	Prefix   string `json:"prefix"`
	Comment  string `json:"comment,omitempty"`
	Disabled bool   `json:"disabled"`
}

type rawAddressEntry struct {
	ID       string `json:".id"`
	List     string `json:"list"`
	Address  string `json:"address"`
	Comment  string `json:"comment"`
	Disabled string `json:"disabled"`
}

// FetchAddressLists fetches address list entries from RouterOS and groups them by list name.
func FetchAddressLists(ctx context.Context, client *routeros.Client) ([]AddressList, error) {
	body, err := client.Get(ctx, "/ip/firewall/address-list")
	if err != nil {
		return nil, fmt.Errorf("proxy: fetch address lists: %w", err)
	}

	var raw []rawAddressEntry
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("proxy: parse address lists: %w", err)
	}

	// Group entries by list name, preserving order of first appearance.
	listOrder := make([]string, 0)
	listMap := make(map[string][]AddressEntry)

	for _, r := range raw {
		entry := AddressEntry{
			ID:       r.ID,
			Prefix:   r.Address,
			Comment:  r.Comment,
			Disabled: parseBool(r.Disabled),
		}
		if _, exists := listMap[r.List]; !exists {
			listOrder = append(listOrder, r.List)
		}
		listMap[r.List] = append(listMap[r.List], entry)
	}

	lists := make([]AddressList, 0, len(listOrder))
	for _, name := range listOrder {
		lists = append(lists, AddressList{
			Name:    name,
			Entries: listMap[name],
		})
	}
	return lists, nil
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd backend && go build ./internal/proxy/
```

- [ ] **Step 3: Commit**

```bash
git add backend/internal/proxy/addresslists.go
git commit -m "Add address lists fetch and normalization with grouping"
```

---

## Task 6: WireGuard

**Files:**
- Create: `backend/internal/proxy/wireguard.go`

- [ ] **Step 1: Create the wireguard fetch/normalize**

Create `backend/internal/proxy/wireguard.go`:

```go
package proxy

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/pobradovic08/kormos/backend/internal/routeros"
)

// WireGuardInterface is the normalized representation of a RouterOS WireGuard interface.
type WireGuardInterface struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	ListenPort int    `json:"listenPort"`
	MTU        int    `json:"mtu"`
	PrivateKey string `json:"privateKey"`
	PublicKey  string `json:"publicKey"`
	Disabled   bool   `json:"disabled"`
	Running    bool   `json:"running"`
}

type rawWireGuardInterface struct {
	ID         string `json:".id"`
	Name       string `json:"name"`
	ListenPort string `json:"listen-port"`
	MTU        string `json:"mtu"`
	PrivateKey string `json:"private-key"`
	PublicKey  string `json:"public-key"`
	Disabled   string `json:"disabled"`
	Running    string `json:"running"`
}

// FetchWireGuardInterfaces fetches and normalizes WireGuard interfaces from a RouterOS device.
func FetchWireGuardInterfaces(ctx context.Context, client *routeros.Client) ([]WireGuardInterface, error) {
	body, err := client.Get(ctx, "/interface/wireguard")
	if err != nil {
		return nil, fmt.Errorf("proxy: fetch wireguard interfaces: %w", err)
	}

	var raw []rawWireGuardInterface
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("proxy: parse wireguard interfaces: %w", err)
	}

	ifaces := make([]WireGuardInterface, len(raw))
	for i, r := range raw {
		mtu := parseInt(r.MTU)
		if mtu == 0 {
			mtu = 1420
		}
		ifaces[i] = WireGuardInterface{
			ID:         r.ID,
			Name:       r.Name,
			ListenPort: parseInt(r.ListenPort),
			MTU:        mtu,
			PrivateKey: r.PrivateKey,
			PublicKey:  r.PublicKey,
			Disabled:   parseBool(r.Disabled),
			Running:    parseBool(r.Running),
		}
	}
	return ifaces, nil
}

// WireGuardPeer is the normalized representation of a RouterOS WireGuard peer.
type WireGuardPeer struct {
	ID                  string `json:"id"`
	Interface           string `json:"interface"`
	Name                string `json:"name,omitempty"`
	PublicKey           string `json:"publicKey"`
	PresharedKey        string `json:"presharedKey,omitempty"`
	AllowedAddress      string `json:"allowedAddress"`
	EndpointAddress     string `json:"endpointAddress,omitempty"`
	EndpointPort        int    `json:"endpointPort,omitempty"`
	LastHandshake       string `json:"lastHandshake,omitempty"`
	Rx                  int64  `json:"rx"`
	Tx                  int64  `json:"tx"`
	PersistentKeepalive int    `json:"persistentKeepalive,omitempty"`
	Disabled            bool   `json:"disabled"`
	Comment             string `json:"comment,omitempty"`
}

type rawWireGuardPeer struct {
	ID                  string `json:".id"`
	Interface           string `json:"interface"`
	Name                string `json:"name"`
	PublicKey           string `json:"public-key"`
	PresharedKey        string `json:"preshared-key"`
	AllowedAddress      string `json:"allowed-address"`
	EndpointAddress     string `json:"endpoint-address"`
	EndpointPort        string `json:"endpoint-port"`
	LastHandshake       string `json:"last-handshake"`
	Rx                  string `json:"rx"`
	Tx                  string `json:"tx"`
	PersistentKeepalive string `json:"persistent-keepalive"`
	Disabled            string `json:"disabled"`
	Comment             string `json:"comment"`
}

// FetchWireGuardPeers fetches and normalizes WireGuard peers from a RouterOS device.
func FetchWireGuardPeers(ctx context.Context, client *routeros.Client) ([]WireGuardPeer, error) {
	body, err := client.Get(ctx, "/interface/wireguard/peers")
	if err != nil {
		return nil, fmt.Errorf("proxy: fetch wireguard peers: %w", err)
	}

	var raw []rawWireGuardPeer
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("proxy: parse wireguard peers: %w", err)
	}

	peers := make([]WireGuardPeer, len(raw))
	for i, r := range raw {
		peers[i] = WireGuardPeer{
			ID:                  r.ID,
			Interface:           r.Interface,
			Name:                r.Name,
			PublicKey:           r.PublicKey,
			PresharedKey:        r.PresharedKey,
			AllowedAddress:      r.AllowedAddress,
			EndpointAddress:     r.EndpointAddress,
			EndpointPort:        parseInt(r.EndpointPort),
			LastHandshake:       r.LastHandshake,
			Rx:                  parseInt64(r.Rx),
			Tx:                  parseInt64(r.Tx),
			PersistentKeepalive: parseInt(r.PersistentKeepalive),
			Disabled:            parseBool(r.Disabled),
			Comment:             r.Comment,
		}
	}
	return peers, nil
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd backend && go build ./internal/proxy/
```

- [ ] **Step 3: Commit**

```bash
git add backend/internal/proxy/wireguard.go
git commit -m "Add WireGuard interfaces and peers fetch and normalization"
```

---

## Task 7: HTTP handler and route registration

**Files:**
- Create: `backend/internal/proxy/handler.go`

- [ ] **Step 1: Create the handler**

Create `backend/internal/proxy/handler.go`:

```go
package proxy

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/pobradovic08/kormos/backend/internal/middleware"
	"github.com/pobradovic08/kormos/backend/internal/router"
)

// Handler provides HTTP handlers for proxied RouterOS read endpoints.
type Handler struct {
	routerSvc *router.Service
}

// NewHandler creates a new proxy Handler.
func NewHandler(routerSvc *router.Service) *Handler {
	return &Handler{routerSvc: routerSvc}
}

// getClient is a shared helper that extracts tenant/router IDs and returns a RouterOS client.
func (h *Handler) getClient(r *http.Request) (*routeros.Client, error) {
	tenantID := middleware.GetTenantID(r)
	routerID := chi.URLParam(r, "routerID")
	return h.routerSvc.GetClientForRouter(r.Context(), tenantID, routerID)
}

// FirewallRules handles GET /routers/{routerID}/firewall/filter.
func (h *Handler) FirewallRules(w http.ResponseWriter, r *http.Request) {
	client, err := h.getClient(r)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", "Failed to connect to router")
		return
	}
	rules, err := FetchFirewallRules(r.Context(), client)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", "Failed to fetch firewall rules")
		return
	}
	if rules == nil {
		rules = []FirewallRule{}
	}
	writeJSON(w, http.StatusOK, rules)
}

// Routes handles GET /routers/{routerID}/routes.
func (h *Handler) Routes(w http.ResponseWriter, r *http.Request) {
	client, err := h.getClient(r)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", "Failed to connect to router")
		return
	}
	routes, err := FetchRoutes(r.Context(), client)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", "Failed to fetch routes")
		return
	}
	if routes == nil {
		routes = []Route{}
	}
	writeJSON(w, http.StatusOK, routes)
}

// RouteByID handles GET /routers/{routerID}/routes/{routeID}.
func (h *Handler) RouteByID(w http.ResponseWriter, r *http.Request) {
	client, err := h.getClient(r)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", "Failed to connect to router")
		return
	}
	routeID := chi.URLParam(r, "routeID")
	route, err := FetchRoute(r.Context(), client, routeID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", "Failed to fetch route")
		return
	}
	writeJSON(w, http.StatusOK, route)
}

// Tunnels handles GET /routers/{routerID}/tunnels.
func (h *Handler) Tunnels(w http.ResponseWriter, r *http.Request) {
	client, err := h.getClient(r)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", "Failed to connect to router")
		return
	}
	tunnels, err := FetchTunnels(r.Context(), client)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", "Failed to fetch tunnels")
		return
	}
	if tunnels == nil {
		tunnels = []Tunnel{}
	}
	writeJSON(w, http.StatusOK, tunnels)
}

// AddressLists handles GET /routers/{routerID}/address-lists.
func (h *Handler) AddressLists(w http.ResponseWriter, r *http.Request) {
	client, err := h.getClient(r)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", "Failed to connect to router")
		return
	}
	lists, err := FetchAddressLists(r.Context(), client)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", "Failed to fetch address lists")
		return
	}
	if lists == nil {
		lists = []AddressList{}
	}
	writeJSON(w, http.StatusOK, lists)
}

// WireGuardInterfaces handles GET /routers/{routerID}/wireguard.
func (h *Handler) WireGuardInterfaces(w http.ResponseWriter, r *http.Request) {
	client, err := h.getClient(r)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", "Failed to connect to router")
		return
	}
	ifaces, err := FetchWireGuardInterfaces(r.Context(), client)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", "Failed to fetch WireGuard interfaces")
		return
	}
	if ifaces == nil {
		ifaces = []WireGuardInterface{}
	}
	writeJSON(w, http.StatusOK, ifaces)
}

// WireGuardPeers handles GET /routers/{routerID}/wireguard/peers.
func (h *Handler) WireGuardPeers(w http.ResponseWriter, r *http.Request) {
	client, err := h.getClient(r)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", "Failed to connect to router")
		return
	}
	peers, err := FetchWireGuardPeers(r.Context(), client)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", "Failed to fetch WireGuard peers")
		return
	}
	if peers == nil {
		peers = []WireGuardPeer{}
	}
	writeJSON(w, http.StatusOK, peers)
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

Note: the `getClient` helper imports `routeros` from the parent package. Add this import:

```go
"github.com/pobradovic08/kormos/backend/internal/routeros"
```

- [ ] **Step 2: Verify it compiles**

```bash
cd backend && go build ./internal/proxy/
```

- [ ] **Step 3: Commit**

```bash
git add backend/internal/proxy/handler.go
git commit -m "Add proxy HTTP handlers for all read endpoints"
```

---

## Task 8: Wire up routes in main.go

**Files:**
- Modify: `backend/cmd/server/main.go`

- [ ] **Step 1: Add proxy handler initialization and routes**

Read `backend/cmd/server/main.go`. Add import:

```go
"github.com/pobradovic08/kormos/backend/internal/proxy"
```

After the cluster handler initialization, add:

```go
proxyHandler := proxy.NewHandler(routerService)
```

Inside the `/routers/{routerID}` route group (after the interfaces routes, before the configure route), add:

```go
r.Get("/{routerID}/firewall/filter", proxyHandler.FirewallRules)
r.Get("/{routerID}/routes", proxyHandler.Routes)
r.Get("/{routerID}/routes/{routeID}", proxyHandler.RouteByID)
r.Get("/{routerID}/tunnels", proxyHandler.Tunnels)
r.Get("/{routerID}/address-lists", proxyHandler.AddressLists)
r.Route("/{routerID}/wireguard", func(r chi.Router) {
	r.Get("/", proxyHandler.WireGuardInterfaces)
	r.Get("/peers", proxyHandler.WireGuardPeers)
})
```

- [ ] **Step 2: Verify it compiles**

```bash
cd backend && go build ./cmd/server/
```

- [ ] **Step 3: Restart backend and test against real CHR**

```bash
kill $(lsof -t -i :15480) 2>/dev/null
sleep 1
cd backend && export $(cat .env | grep -v '^#' | xargs) && nohup go run ./cmd/server/ > /tmp/kormos-backend.log 2>&1 &
sleep 3

# Test routes endpoint (should return real routes from CHR)
# Need a valid router ID from the database first:
ROUTER_ID=$(docker exec kormos-postgres-1 psql -U kormos -d kormos -t -c "SELECT id FROM routers WHERE name='pavle-chr-1-1' LIMIT 1" | tr -d ' ')
echo "Router ID: $ROUTER_ID"

# These need auth — test via curl with a token, or just check backend logs
# to confirm the endpoints are registered
curl -s http://localhost:15480/api/routers/$ROUTER_ID/routes 2>&1 | head -5
```

The endpoint should return either real route data (with auth) or a 401 (without auth, which confirms the route is registered).

- [ ] **Step 4: Commit**

```bash
git add backend/cmd/server/main.go
git commit -m "Wire up proxy read endpoints for all modules"
```

---

## Task 9: Disable mock mode and test end-to-end

**Files:**
- Verify: `frontend/.env.development` has `VITE_MOCK_MODE=false`

- [ ] **Step 1: Verify mock mode is off**

Check `frontend/.env.development` — it should already have `VITE_MOCK_MODE=false` from earlier in this session.

- [ ] **Step 2: Test in browser**

Open the app, navigate to a router's configure page, and verify:
- Routes page shows real routes from the CHR (at minimum the default route and connected routes)
- Firewall page shows empty (no rules configured yet, returns `[]`)
- Tunnels page shows empty (no GRE tunnels configured)
- Address lists page shows empty (no address lists configured)
- WireGuard page shows empty (no WireGuard interfaces configured)
- Interfaces page still works (was already implemented)

- [ ] **Step 3: Check backend logs for successful proxied requests**

```bash
tail -20 /tmp/kormos-backend.log
```

Should show 200 responses for the new endpoints.
