# Tunnel & WireGuard Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement cluster-scoped backend endpoints for GRE, IPsec, and WireGuard with full CRUD, cross-router merge-by-name for tunnels, and operation/undo integration.

**Architecture:** A new `internal/tunnel` package provides a service layer that fetches from all routers in a cluster, merges GRE/IPsec tunnels by name, and fans out CRUD through the existing `operation.Service.Execute()`. Shared normalize helpers are extracted to `internal/normalize`. WireGuard stays per-router (no merge) but accessed via cluster endpoints.

**Tech Stack:** Go 1.22+, Chi v5, pgx, RouterOS REST API, existing operation/undo system.

---

## File Structure

```
internal/normalize/           — NEW: shared parsing helpers
  normalize.go                — parseBool, parseInt, parseInt64, splitCSV

internal/tunnel/              — NEW: cluster-scoped tunnel + wireguard
  types.go                    — all request/response structs
  gre.go                      — GRE fetch/normalize + payload builders
  ipsec.go                    — IPsec multi-resource fetch/assembly + payload builders
  wireguard.go                — WireGuard fetch/normalize + payload builders
  merge.go                    — cross-router merge-by-name logic
  service.go                  — TunnelService orchestrating cluster-level CRUD
  handler.go                  — HTTP handlers wired to chi routes

internal/proxy/               — MODIFIED: remove tunnel/wireguard code
  normalize.go                — replace implementations with imports from normalize pkg
  tunnels.go                  — DELETE (moved to tunnel/gre.go)
  wireguard.go                — DELETE (moved to tunnel/wireguard.go)
  handler.go                  — remove Tunnels, WireGuardInterfaces, WireGuardPeers handlers

internal/configure/
  dependency.go               — MODIFIED: add IPsec resources to createOrder

internal/operation/
  types.go                    — MODIFIED: add IPsec volatile fields

cmd/server/
  main.go                     — MODIFIED: wire tunnel service, register cluster-scoped routes
```

---

### Task 1: Extract Shared Normalize Helpers

**Files:**
- Create: `backend/internal/normalize/normalize.go`
- Modify: `backend/internal/proxy/normalize.go`
- Modify: `backend/internal/proxy/tunnels.go` (update imports)
- Modify: `backend/internal/proxy/firewall.go` (update imports)
- Modify: `backend/internal/proxy/routes.go` (update imports)
- Modify: `backend/internal/proxy/addresslists.go` (update imports)
- Modify: `backend/internal/proxy/wireguard.go` (update imports)

- [ ] **Step 1: Create the normalize package**

```go
// backend/internal/normalize/normalize.go
package normalize

import (
	"strconv"
	"strings"
)

// ParseBool converts RouterOS string booleans ("true"/"false") to Go bools.
func ParseBool(s string) bool {
	return s == "true"
}

// ParseInt converts a RouterOS string number to int, returning 0 on failure.
func ParseInt(s string) int {
	if s == "" {
		return 0
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	return v
}

// ParseInt64 converts a RouterOS string number to int64, returning 0 on failure.
func ParseInt64(s string) int64 {
	if s == "" {
		return 0
	}
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0
	}
	return v
}

// SplitCSV splits a comma-separated string into a slice, trimming whitespace.
// Returns an empty slice (not nil) for empty input.
func SplitCSV(s string) []string {
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

- [ ] **Step 2: Update proxy/normalize.go to delegate to the new package**

Replace the contents of `backend/internal/proxy/normalize.go` with thin wrappers so existing proxy code still compiles without mass renaming:

```go
package proxy

import "github.com/pobradovic08/kormos/backend/internal/normalize"

func parseBool(s string) bool    { return normalize.ParseBool(s) }
func parseInt(s string) int      { return normalize.ParseInt(s) }
func parseInt64(s string) int64  { return normalize.ParseInt64(s) }
func splitCSV(s string) []string { return normalize.SplitCSV(s) }
```

- [ ] **Step 3: Verify the build compiles**

Run: `cd /Users/pavle/speckit/kormos/backend && go build ./...`
Expected: clean build, no errors.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/normalize/normalize.go backend/internal/proxy/normalize.go
git commit -m "Extract shared normalize helpers to internal/normalize package"
```

---

### Task 2: Add IPsec Resources to Dependency Ordering & Volatile Fields

**Files:**
- Modify: `backend/internal/configure/dependency.go`
- Modify: `backend/internal/operation/types.go`

- [ ] **Step 1: Add IPsec resources to createOrder in dependency.go**

In `backend/internal/configure/dependency.go`, replace the `createOrder` slice with:

```go
var createOrder = []string{
	"interface/ethernet",
	"interface/bonding",
	"interface/bridge",
	"interface/bridge/port",
	"interface/vlan",
	"interface/wireguard",
	"interface/wireguard/peers",
	"interface/gre",
	"interface/eoip",
	"ip/ipsec/profile",
	"ip/ipsec/proposal",
	"ip/ipsec/peer",
	"ip/ipsec/identity",
	"ip/ipsec/policy",
	"ip/address",
	"ip/route",
}
```

- [ ] **Step 2: Add IPsec volatile fields to operation/types.go**

In `backend/internal/operation/types.go`, add these entries to the `VolatileFields` map:

```go
"last-handshake":    true,
"state":             true,
"uptime":            true,
"phase2-state":      true,
"active-peers":      true,
"established":       true,
"last-seen":         true,
"current-state":     true,
"rx":                true,
"tx":                true,
"last-handshake-ago": true,
```

- [ ] **Step 3: Verify the build compiles**

Run: `cd /Users/pavle/speckit/kormos/backend && go build ./...`
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/configure/dependency.go backend/internal/operation/types.go
git commit -m "Add IPsec resources to dependency ordering and volatile fields"
```

---

### Task 3: Define Tunnel Types

**Files:**
- Create: `backend/internal/tunnel/types.go`

- [ ] **Step 1: Create the types file**

```go
// backend/internal/tunnel/types.go
package tunnel

// --- GRE Types ---

// GREEndpoint holds per-router data for a GRE tunnel.
type GREEndpoint struct {
	RouterID     string `json:"routerId"`
	RouterName   string `json:"routerName"`
	Role         string `json:"role"`
	RosID        string `json:"rosId"`
	LocalAddress string `json:"localAddress"`
	RemoteAddress string `json:"remoteAddress"`
	Running      bool   `json:"running"`
}

// MergedGRETunnel is the cluster-level response for a GRE tunnel.
type MergedGRETunnel struct {
	Name              string        `json:"name"`
	TunnelType        string        `json:"tunnelType"`
	MTU               int           `json:"mtu"`
	KeepaliveInterval int           `json:"keepaliveInterval"`
	KeepaliveRetries  int           `json:"keepaliveRetries"`
	IpsecSecret       string        `json:"ipsecSecret,omitempty"`
	Disabled          bool          `json:"disabled"`
	Comment           string        `json:"comment,omitempty"`
	Endpoints         []GREEndpoint `json:"endpoints"`
}

// CreateGRERequest is the request body for POST /tunnels/gre.
type CreateGRERequest struct {
	Name              string                  `json:"name"`
	MTU               int                     `json:"mtu"`
	KeepaliveInterval int                     `json:"keepaliveInterval"`
	KeepaliveRetries  int                     `json:"keepaliveRetries"`
	IpsecSecret       string                  `json:"ipsecSecret,omitempty"`
	Disabled          bool                    `json:"disabled"`
	Comment           string                  `json:"comment,omitempty"`
	Endpoints         []CreateGREEndpointInput `json:"endpoints"`
}

// CreateGREEndpointInput holds per-router fields for a GRE create.
type CreateGREEndpointInput struct {
	RouterID      string `json:"routerId"`
	LocalAddress  string `json:"localAddress"`
	RemoteAddress string `json:"remoteAddress"`
}

// UpdateGRERequest is the request body for PATCH /tunnels/gre/{name}.
type UpdateGRERequest struct {
	MTU               *int    `json:"mtu,omitempty"`
	KeepaliveInterval *int    `json:"keepaliveInterval,omitempty"`
	KeepaliveRetries  *int    `json:"keepaliveRetries,omitempty"`
	IpsecSecret       *string `json:"ipsecSecret,omitempty"`
	Disabled          *bool   `json:"disabled,omitempty"`
	Comment           *string `json:"comment,omitempty"`
	Endpoints         []UpdateGREEndpointInput `json:"endpoints,omitempty"`
}

// UpdateGREEndpointInput holds per-router fields for a GRE update.
type UpdateGREEndpointInput struct {
	RouterID      string  `json:"routerId"`
	LocalAddress  *string `json:"localAddress,omitempty"`
	RemoteAddress *string `json:"remoteAddress,omitempty"`
}

// --- IPsec Types ---

// Phase1Config holds IKE (Phase 1) parameters.
type Phase1Config struct {
	Encryption string `json:"encryption"`
	Hash       string `json:"hash"`
	DHGroup    string `json:"dhGroup"`
	Lifetime   string `json:"lifetime"`
}

// Phase2Config holds ESP (Phase 2) parameters.
type Phase2Config struct {
	Encryption    string `json:"encryption"`
	AuthAlgorithm string `json:"authAlgorithm"`
	PFSGroup      string `json:"pfsGroup"`
	Lifetime      string `json:"lifetime"`
}

// IPsecRosIDs holds the RouterOS resource IDs for all IPsec sub-resources.
type IPsecRosIDs struct {
	Peer     string   `json:"peer"`
	Profile  string   `json:"profile"`
	Proposal string   `json:"proposal"`
	Identity string   `json:"identity"`
	Policies []string `json:"policies,omitempty"`
}

// IPsecEndpoint holds per-router data for an IPsec tunnel.
type IPsecEndpoint struct {
	RouterID      string      `json:"routerId"`
	RouterName    string      `json:"routerName"`
	Role          string      `json:"role"`
	RosIDs        IPsecRosIDs `json:"rosIds"`
	LocalAddress  string      `json:"localAddress"`
	RemoteAddress string      `json:"remoteAddress"`
	Established   bool        `json:"established"`
}

// MergedIPsecTunnel is the cluster-level response for an IPsec tunnel.
type MergedIPsecTunnel struct {
	Name           string          `json:"name"`
	TunnelType     string          `json:"tunnelType"`
	Mode           string          `json:"mode"`
	AuthMethod     string          `json:"authMethod"`
	IpsecSecret    string          `json:"ipsecSecret,omitempty"`
	Phase1         Phase1Config    `json:"phase1"`
	Phase2         Phase2Config    `json:"phase2"`
	LocalSubnets   []string        `json:"localSubnets"`
	RemoteSubnets  []string        `json:"remoteSubnets"`
	TunnelRoutes   []string        `json:"tunnelRoutes"`
	Disabled       bool            `json:"disabled"`
	Comment        string          `json:"comment,omitempty"`
	Endpoints      []IPsecEndpoint `json:"endpoints"`
}

// CreateIPsecRequest is the request body for POST /tunnels/ipsec.
type CreateIPsecRequest struct {
	Name          string                     `json:"name"`
	Mode          string                     `json:"mode"`
	AuthMethod    string                     `json:"authMethod"`
	IpsecSecret   string                     `json:"ipsecSecret,omitempty"`
	Phase1        Phase1Config               `json:"phase1"`
	Phase2        Phase2Config               `json:"phase2"`
	LocalSubnets  []string                   `json:"localSubnets,omitempty"`
	RemoteSubnets []string                   `json:"remoteSubnets,omitempty"`
	TunnelRoutes  []string                   `json:"tunnelRoutes,omitempty"`
	Disabled      bool                       `json:"disabled"`
	Comment       string                     `json:"comment,omitempty"`
	Endpoints     []CreateIPsecEndpointInput `json:"endpoints"`
}

// CreateIPsecEndpointInput holds per-router fields for an IPsec create.
type CreateIPsecEndpointInput struct {
	RouterID      string `json:"routerId"`
	LocalAddress  string `json:"localAddress"`
	RemoteAddress string `json:"remoteAddress"`
}

// UpdateIPsecRequest is the request body for PATCH /tunnels/ipsec/{name}.
type UpdateIPsecRequest struct {
	Mode          *string       `json:"mode,omitempty"`
	AuthMethod    *string       `json:"authMethod,omitempty"`
	IpsecSecret   *string       `json:"ipsecSecret,omitempty"`
	Phase1        *Phase1Config `json:"phase1,omitempty"`
	Phase2        *Phase2Config `json:"phase2,omitempty"`
	LocalSubnets  []string      `json:"localSubnets,omitempty"`
	RemoteSubnets []string      `json:"remoteSubnets,omitempty"`
	TunnelRoutes  []string      `json:"tunnelRoutes,omitempty"`
	Disabled      *bool         `json:"disabled,omitempty"`
	Comment       *string       `json:"comment,omitempty"`
	Endpoints     []UpdateIPsecEndpointInput `json:"endpoints,omitempty"`
}

// UpdateIPsecEndpointInput holds per-router fields for an IPsec update.
type UpdateIPsecEndpointInput struct {
	RouterID      string  `json:"routerId"`
	LocalAddress  *string `json:"localAddress,omitempty"`
	RemoteAddress *string `json:"remoteAddress,omitempty"`
}

// --- WireGuard Types ---

// WGInterface holds a normalized WireGuard interface from RouterOS.
type WGInterface struct {
	RosID      string `json:"rosId"`
	Name       string `json:"name"`
	ListenPort int    `json:"listenPort"`
	MTU        int    `json:"mtu"`
	PrivateKey string `json:"privateKey"`
	PublicKey  string `json:"publicKey"`
	Disabled   bool   `json:"disabled"`
	Running    bool   `json:"running"`
}

// WGPeer holds a normalized WireGuard peer from RouterOS.
type WGPeer struct {
	RosID               string `json:"rosId"`
	Interface           string `json:"interface"`
	Name                string `json:"name,omitempty"`
	PublicKey           string `json:"publicKey"`
	PresharedKey       string `json:"presharedKey,omitempty"`
	AllowedAddress     string `json:"allowedAddress"`
	EndpointAddress    string `json:"endpointAddress,omitempty"`
	EndpointPort       int    `json:"endpointPort,omitempty"`
	LastHandshake      string `json:"lastHandshake,omitempty"`
	Rx                 int64  `json:"rx"`
	Tx                 int64  `json:"tx"`
	PersistentKeepalive int   `json:"persistentKeepalive,omitempty"`
	Disabled           bool   `json:"disabled"`
	Comment            string `json:"comment,omitempty"`
}

// RouterWireGuard is the per-router WireGuard response (no merge).
type RouterWireGuard struct {
	RouterID   string      `json:"routerId"`
	RouterName string      `json:"routerName"`
	Role       string      `json:"role"`
	Interface  WGInterface `json:"interface"`
	Peers      []WGPeer    `json:"peers"`
}

// CreateWGInterfaceRequest is the request body for POST /wireguard.
type CreateWGInterfaceRequest struct {
	RouterID   string `json:"routerId"`
	Name       string `json:"name"`
	ListenPort int    `json:"listenPort"`
	MTU        int    `json:"mtu,omitempty"`
	Disabled   bool   `json:"disabled"`
	Comment    string `json:"comment,omitempty"`
}

// UpdateWGInterfaceRequest is the request body for PATCH /wireguard/{routerID}/{name}.
type UpdateWGInterfaceRequest struct {
	ListenPort *int    `json:"listenPort,omitempty"`
	MTU        *int    `json:"mtu,omitempty"`
	Disabled   *bool   `json:"disabled,omitempty"`
	Comment    *string `json:"comment,omitempty"`
}

// CreateWGPeerRequest is the request body for POST /wireguard/{routerID}/{name}/peers.
type CreateWGPeerRequest struct {
	PublicKey           string `json:"publicKey"`
	PresharedKey       string `json:"presharedKey,omitempty"`
	AllowedAddress     string `json:"allowedAddress"`
	EndpointAddress    string `json:"endpointAddress,omitempty"`
	EndpointPort       int    `json:"endpointPort,omitempty"`
	PersistentKeepalive int   `json:"persistentKeepalive,omitempty"`
	Disabled           bool   `json:"disabled"`
	Comment            string `json:"comment,omitempty"`
}

// UpdateWGPeerRequest is the request body for PATCH /wireguard/{routerID}/{name}/peers/{peerID}.
type UpdateWGPeerRequest struct {
	PublicKey           *string `json:"publicKey,omitempty"`
	PresharedKey       *string `json:"presharedKey,omitempty"`
	AllowedAddress     *string `json:"allowedAddress,omitempty"`
	EndpointAddress    *string `json:"endpointAddress,omitempty"`
	EndpointPort       *int    `json:"endpointPort,omitempty"`
	PersistentKeepalive *int   `json:"persistentKeepalive,omitempty"`
	Disabled           *bool   `json:"disabled,omitempty"`
	Comment            *string `json:"comment,omitempty"`
}

// --- Internal raw types (RouterOS JSON shapes) ---

// RawGRETunnel is the raw JSON shape from GET /interface/gre.
type RawGRETunnel struct {
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

// RawIPsecPeer is the raw JSON shape from GET /ip/ipsec/peer.
type RawIPsecPeer struct {
	ID           string `json:".id"`
	Name         string `json:"name"`
	Address      string `json:"address"`
	LocalAddress string `json:"local-address"`
	Profile      string `json:"profile"`
	Disabled     string `json:"disabled"`
	Comment      string `json:"comment"`
}

// RawIPsecProfile is the raw JSON shape from GET /ip/ipsec/profile.
type RawIPsecProfile struct {
	ID           string `json:".id"`
	Name         string `json:"name"`
	EncAlgorithm string `json:"enc-algorithm"`
	HashAlgorithm string `json:"hash-algorithm"`
	DHGroup      string `json:"dh-group"`
	Lifetime     string `json:"lifetime"`
}

// RawIPsecProposal is the raw JSON shape from GET /ip/ipsec/proposal.
type RawIPsecProposal struct {
	ID             string `json:".id"`
	Name           string `json:"name"`
	EncAlgorithms  string `json:"enc-algorithms"`
	AuthAlgorithms string `json:"auth-algorithms"`
	PFSGroup       string `json:"pfs-group"`
	Lifetime       string `json:"lifetime"`
}

// RawIPsecIdentity is the raw JSON shape from GET /ip/ipsec/identity.
type RawIPsecIdentity struct {
	ID         string `json:".id"`
	Peer       string `json:"peer"`
	AuthMethod string `json:"auth-method"`
	Secret     string `json:"secret"`
}

// RawIPsecPolicy is the raw JSON shape from GET /ip/ipsec/policy.
type RawIPsecPolicy struct {
	ID         string `json:".id"`
	Peer       string `json:"peer"`
	SrcAddress string `json:"src-address"`
	DstAddress string `json:"dst-address"`
	Disabled   string `json:"disabled"`
}

// RawIPsecActivePeer is the raw JSON shape from GET /ip/ipsec/active-peers.
type RawIPsecActivePeer struct {
	ID            string `json:".id"`
	State         string `json:"state"`
	RemoteAddress string `json:"remote-address"`
}

// RawWireGuardInterface is the raw JSON shape from GET /interface/wireguard.
type RawWireGuardInterface struct {
	ID         string `json:".id"`
	Name       string `json:"name"`
	ListenPort string `json:"listen-port"`
	MTU        string `json:"mtu"`
	PrivateKey string `json:"private-key"`
	PublicKey  string `json:"public-key"`
	Disabled   string `json:"disabled"`
	Running    string `json:"running"`
}

// RawWireGuardPeer is the raw JSON shape from GET /interface/wireguard/peers.
type RawWireGuardPeer struct {
	ID                  string `json:".id"`
	Interface           string `json:"interface"`
	Name                string `json:"name"`
	PublicKey           string `json:"public-key"`
	PresharedKey       string `json:"preshared-key"`
	AllowedAddress     string `json:"allowed-address"`
	EndpointAddress    string `json:"endpoint-address"`
	EndpointPort       string `json:"endpoint-port"`
	LastHandshake      string `json:"last-handshake"`
	Rx                 string `json:"rx"`
	Tx                 string `json:"tx"`
	PersistentKeepalive string `json:"persistent-keepalive"`
	Disabled           string `json:"disabled"`
	Comment            string `json:"comment"`
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/pavle/speckit/kormos/backend && go build ./...`
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/tunnel/types.go
git commit -m "Define tunnel and wireguard request/response types"
```

---

### Task 4: GRE Fetch, Normalize & Merge

**Files:**
- Create: `backend/internal/tunnel/gre.go`
- Create: `backend/internal/tunnel/merge.go`

- [ ] **Step 1: Create gre.go with fetch and payload builders**

```go
// backend/internal/tunnel/gre.go
package tunnel

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/pobradovic08/kormos/backend/internal/normalize"
	"github.com/pobradovic08/kormos/backend/internal/routeros"
)

// parseKeepalive parses RouterOS keepalive format "interval,retries" (e.g., "10s,10").
func parseKeepalive(s string) (interval, retries int) {
	if s == "" {
		return 10, 10
	}
	parts := strings.SplitN(s, ",", 2)
	if len(parts) >= 1 {
		intervalStr := strings.TrimSuffix(strings.TrimSpace(parts[0]), "s")
		interval = normalize.ParseInt(intervalStr)
	}
	if len(parts) >= 2 {
		retries = normalize.ParseInt(strings.TrimSpace(parts[1]))
	}
	return
}

// greTunnelFromRaw normalizes a single raw GRE tunnel.
func greTunnelFromRaw(r RawGRETunnel) GREEndpoint {
	return GREEndpoint{
		RosID:         r.ID,
		LocalAddress:  r.LocalAddress,
		RemoteAddress: r.RemoteAddress,
		Running:       normalize.ParseBool(r.Running),
	}
}

// greSharedFromRaw extracts shared fields from a raw GRE tunnel.
func greSharedFromRaw(r RawGRETunnel) (name string, mtu, keepaliveInterval, keepaliveRetries int, ipsecSecret, comment string, disabled bool) {
	interval, retries := parseKeepalive(r.Keepalive)
	m := normalize.ParseInt(r.ActualMTU)
	if m == 0 {
		m = normalize.ParseInt(r.MTU)
	}
	return r.Name, m, interval, retries, r.IpsecSecret, r.Comment, normalize.ParseBool(r.Disabled)
}

// FetchGRETunnels fetches raw GRE tunnels from a single RouterOS device.
func FetchGRETunnels(ctx context.Context, client *routeros.Client) ([]RawGRETunnel, error) {
	body, err := client.Get(ctx, "/interface/gre")
	if err != nil {
		return nil, fmt.Errorf("tunnel: fetch gre: %w", err)
	}
	var raw []RawGRETunnel
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("tunnel: parse gre: %w", err)
	}
	return raw, nil
}

// FindGREByName searches raw GRE tunnels for one matching the given name.
func FindGREByName(tunnels []RawGRETunnel, name string) *RawGRETunnel {
	for i := range tunnels {
		if tunnels[i].Name == name {
			return &tunnels[i]
		}
	}
	return nil
}

// BuildGRECreateBody builds the RouterOS request body for creating a GRE tunnel.
func BuildGRECreateBody(req CreateGRERequest, ep CreateGREEndpointInput) map[string]interface{} {
	body := map[string]interface{}{
		"name":           req.Name,
		"local-address":  ep.LocalAddress,
		"remote-address": ep.RemoteAddress,
	}
	if req.MTU > 0 {
		body["mtu"] = strconv.Itoa(req.MTU)
	}
	if req.KeepaliveInterval > 0 || req.KeepaliveRetries > 0 {
		interval := req.KeepaliveInterval
		if interval == 0 {
			interval = 10
		}
		retries := req.KeepaliveRetries
		if retries == 0 {
			retries = 10
		}
		body["keepalive"] = fmt.Sprintf("%ds,%d", interval, retries)
	}
	if req.IpsecSecret != "" {
		body["ipsec-secret"] = req.IpsecSecret
	}
	if req.Disabled {
		body["disabled"] = "true"
	}
	if req.Comment != "" {
		body["comment"] = req.Comment
	}
	return body
}

// BuildGREUpdateBody builds the RouterOS request body for updating a GRE tunnel.
func BuildGREUpdateBody(req UpdateGRERequest, ep *UpdateGREEndpointInput) map[string]interface{} {
	body := map[string]interface{}{}
	if req.MTU != nil {
		body["mtu"] = strconv.Itoa(*req.MTU)
	}
	if req.KeepaliveInterval != nil || req.KeepaliveRetries != nil {
		interval := 10
		retries := 10
		if req.KeepaliveInterval != nil {
			interval = *req.KeepaliveInterval
		}
		if req.KeepaliveRetries != nil {
			retries = *req.KeepaliveRetries
		}
		body["keepalive"] = fmt.Sprintf("%ds,%d", interval, retries)
	}
	if req.IpsecSecret != nil {
		body["ipsec-secret"] = *req.IpsecSecret
	}
	if req.Disabled != nil {
		if *req.Disabled {
			body["disabled"] = "true"
		} else {
			body["disabled"] = "false"
		}
	}
	if req.Comment != nil {
		body["comment"] = *req.Comment
	}
	if ep != nil {
		if ep.LocalAddress != nil {
			body["local-address"] = *ep.LocalAddress
		}
		if ep.RemoteAddress != nil {
			body["remote-address"] = *ep.RemoteAddress
		}
	}
	return body
}
```

- [ ] **Step 2: Create merge.go with cross-router merge logic**

```go
// backend/internal/tunnel/merge.go
package tunnel

// RouterInfo holds identifying info for a router in the cluster.
type RouterInfo struct {
	ID   string
	Name string
	Role string
}

// MergeGRETunnels merges raw GRE tunnels from multiple routers by name.
// The first router with role "master" provides shared fields.
func MergeGRETunnels(perRouter map[string][]RawGRETunnel, routers []RouterInfo) []MergedGRETunnel {
	// Collect all unique tunnel names, preserving master-first order.
	type tunnelEntry struct {
		shared   *RawGRETunnel
		masterRI *RouterInfo
		endpoints []GREEndpoint
	}
	byName := map[string]*tunnelEntry{}
	var orderedNames []string

	// Process master routers first, then backups.
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
		raws := perRouter[ri.ID]
		for _, raw := range raws {
			ep := greTunnelFromRaw(raw)
			ep.RouterID = ri.ID
			ep.RouterName = ri.Name
			ep.Role = ri.Role

			entry, exists := byName[raw.Name]
			if !exists {
				rawCopy := raw
				entry = &tunnelEntry{shared: &rawCopy, masterRI: &ri}
				byName[raw.Name] = entry
				orderedNames = append(orderedNames, raw.Name)
			}
			entry.endpoints = append(entry.endpoints, ep)
		}
	}

	result := make([]MergedGRETunnel, 0, len(orderedNames))
	for _, name := range orderedNames {
		entry := byName[name]
		n, mtu, kai, kar, secret, comment, disabled := greSharedFromRaw(*entry.shared)
		result = append(result, MergedGRETunnel{
			Name:              n,
			TunnelType:        "gre",
			MTU:               mtu,
			KeepaliveInterval: kai,
			KeepaliveRetries:  kar,
			IpsecSecret:       secret,
			Disabled:          disabled,
			Comment:           comment,
			Endpoints:         entry.endpoints,
		})
	}
	return result
}

// FindMergedGREByName finds a single merged GRE tunnel by name.
func FindMergedGREByName(tunnels []MergedGRETunnel, name string) *MergedGRETunnel {
	for i := range tunnels {
		if tunnels[i].Name == name {
			return &tunnels[i]
		}
	}
	return nil
}

// FindMergedIPsecByName finds a single merged IPsec tunnel by name.
func FindMergedIPsecByName(tunnels []MergedIPsecTunnel, name string) *MergedIPsecTunnel {
	for i := range tunnels {
		if tunnels[i].Name == name {
			return &tunnels[i]
		}
	}
	return nil
}
```

- [ ] **Step 3: Verify the build compiles**

Run: `cd /Users/pavle/speckit/kormos/backend && go build ./...`
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/tunnel/gre.go backend/internal/tunnel/merge.go
git commit -m "Add GRE fetch/normalize and cross-router merge logic"
```

---

### Task 5: IPsec Fetch, Assembly & Merge

**Files:**
- Create: `backend/internal/tunnel/ipsec.go`
- Modify: `backend/internal/tunnel/merge.go` (add IPsec merge)

- [ ] **Step 1: Create ipsec.go with multi-resource fetch and assembly**

```go
// backend/internal/tunnel/ipsec.go
package tunnel

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/pobradovic08/kormos/backend/internal/normalize"
	"github.com/pobradovic08/kormos/backend/internal/routeros"
)

// PerRouterIPsec holds all raw IPsec data fetched from a single router.
type PerRouterIPsec struct {
	Peers       []RawIPsecPeer
	Profiles    []RawIPsecProfile
	Proposals   []RawIPsecProposal
	Identities  []RawIPsecIdentity
	Policies    []RawIPsecPolicy
	ActivePeers []RawIPsecActivePeer
}

// FetchIPsecAll fetches all IPsec sub-resources from a single RouterOS device.
func FetchIPsecAll(ctx context.Context, client *routeros.Client) (*PerRouterIPsec, error) {
	result := &PerRouterIPsec{}

	// Peers
	body, err := client.Get(ctx, "/ip/ipsec/peer")
	if err != nil {
		return nil, fmt.Errorf("tunnel: fetch ipsec peers: %w", err)
	}
	if err := json.Unmarshal(body, &result.Peers); err != nil {
		return nil, fmt.Errorf("tunnel: parse ipsec peers: %w", err)
	}

	// Profiles
	body, err = client.Get(ctx, "/ip/ipsec/profile")
	if err != nil {
		return nil, fmt.Errorf("tunnel: fetch ipsec profiles: %w", err)
	}
	if err := json.Unmarshal(body, &result.Profiles); err != nil {
		return nil, fmt.Errorf("tunnel: parse ipsec profiles: %w", err)
	}

	// Proposals
	body, err = client.Get(ctx, "/ip/ipsec/proposal")
	if err != nil {
		return nil, fmt.Errorf("tunnel: fetch ipsec proposals: %w", err)
	}
	if err := json.Unmarshal(body, &result.Proposals); err != nil {
		return nil, fmt.Errorf("tunnel: parse ipsec proposals: %w", err)
	}

	// Identities
	body, err = client.Get(ctx, "/ip/ipsec/identity")
	if err != nil {
		return nil, fmt.Errorf("tunnel: fetch ipsec identities: %w", err)
	}
	if err := json.Unmarshal(body, &result.Identities); err != nil {
		return nil, fmt.Errorf("tunnel: parse ipsec identities: %w", err)
	}

	// Policies
	body, err = client.Get(ctx, "/ip/ipsec/policy")
	if err != nil {
		return nil, fmt.Errorf("tunnel: fetch ipsec policies: %w", err)
	}
	if err := json.Unmarshal(body, &result.Policies); err != nil {
		return nil, fmt.Errorf("tunnel: parse ipsec policies: %w", err)
	}

	// Active peers
	body, err = client.Get(ctx, "/ip/ipsec/active-peers")
	if err != nil {
		// Non-fatal: active-peers may be empty.
		result.ActivePeers = []RawIPsecActivePeer{}
	} else if err := json.Unmarshal(body, &result.ActivePeers); err != nil {
		result.ActivePeers = []RawIPsecActivePeer{}
	}

	return result, nil
}

// assembledIPsec holds the assembled data for one IPsec tunnel on one router.
type assembledIPsec struct {
	PeerName      string
	PeerID        string
	LocalAddress  string
	RemoteAddress string
	Disabled      bool
	Comment       string
	ProfileID     string
	ProposalID    string
	IdentityID    string
	PolicyIDs     []string
	Phase1        Phase1Config
	Phase2        Phase2Config
	AuthMethod    string
	Secret        string
	LocalSubnets  []string
	RemoteSubnets []string
	Mode          string
	Established   bool
}

// AssembleIPsec correlates all IPsec sub-resources into per-tunnel assembled objects.
func AssembleIPsec(data *PerRouterIPsec) []assembledIPsec {
	// Build lookup maps.
	profileByName := map[string]RawIPsecProfile{}
	for _, p := range data.Profiles {
		profileByName[p.Name] = p
	}
	proposalByName := map[string]RawIPsecProposal{}
	for _, p := range data.Proposals {
		proposalByName[p.Name] = p
	}
	identityByPeer := map[string]RawIPsecIdentity{}
	for _, id := range data.Identities {
		identityByPeer[id.Peer] = id
	}
	policiesByPeer := map[string][]RawIPsecPolicy{}
	for _, pol := range data.Policies {
		policiesByPeer[pol.Peer] = append(policiesByPeer[pol.Peer], pol)
	}
	activePeerByAddr := map[string]bool{}
	for _, ap := range data.ActivePeers {
		if ap.State == "established" {
			activePeerByAddr[ap.RemoteAddress] = true
		}
	}

	var result []assembledIPsec
	for _, peer := range data.Peers {
		a := assembledIPsec{
			PeerName:      peer.Name,
			PeerID:        peer.ID,
			LocalAddress:  peer.LocalAddress,
			RemoteAddress: peer.Address,
			Disabled:      normalize.ParseBool(peer.Disabled),
			Comment:       peer.Comment,
		}

		// Phase 1 from profile.
		if prof, ok := profileByName[peer.Profile]; ok {
			a.ProfileID = prof.ID
			a.Phase1 = Phase1Config{
				Encryption: prof.EncAlgorithm,
				Hash:       prof.HashAlgorithm,
				DHGroup:    prof.DHGroup,
				Lifetime:   prof.Lifetime,
			}
		}

		// Phase 2 from proposal (matched by tunnel name).
		if prop, ok := proposalByName[peer.Name]; ok {
			a.ProposalID = prop.ID
			a.Phase2 = Phase2Config{
				Encryption:    prop.EncAlgorithms,
				AuthAlgorithm: prop.AuthAlgorithms,
				PFSGroup:      prop.PFSGroup,
				Lifetime:      prop.Lifetime,
			}
		}

		// Identity.
		if ident, ok := identityByPeer[peer.Name]; ok {
			a.IdentityID = ident.ID
			a.AuthMethod = ident.AuthMethod
			a.Secret = ident.Secret
		}

		// Policies → determines mode.
		policies := policiesByPeer[peer.Name]
		if len(policies) > 0 {
			a.Mode = "policy-based"
			for _, pol := range policies {
				a.PolicyIDs = append(a.PolicyIDs, pol.ID)
				if pol.SrcAddress != "" && pol.SrcAddress != "0.0.0.0/0" {
					a.LocalSubnets = append(a.LocalSubnets, pol.SrcAddress)
				}
				if pol.DstAddress != "" && pol.DstAddress != "0.0.0.0/0" {
					a.RemoteSubnets = append(a.RemoteSubnets, pol.DstAddress)
				}
			}
		} else {
			a.Mode = "route-based"
		}

		// Established status from active peers.
		a.Established = activePeerByAddr[peer.Address]

		result = append(result, a)
	}
	return result
}

// BuildIPsecCreateOps builds the RouterOS operations for creating an IPsec tunnel on one router.
// Returns operations in dependency order: profile, proposal, peer, identity, policies.
func BuildIPsecCreateOps(req CreateIPsecRequest, routerID string, ep CreateIPsecEndpointInput) []ipsecOp {
	var ops []ipsecOp

	// 1. Profile (Phase 1)
	ops = append(ops, ipsecOp{
		RouterID:     routerID,
		ResourcePath: "/ip/ipsec/profile",
		Body: map[string]interface{}{
			"name":           req.Name,
			"enc-algorithm":  req.Phase1.Encryption,
			"hash-algorithm": req.Phase1.Hash,
			"dh-group":       req.Phase1.DHGroup,
			"lifetime":       req.Phase1.Lifetime,
		},
	})

	// 2. Proposal (Phase 2)
	ops = append(ops, ipsecOp{
		RouterID:     routerID,
		ResourcePath: "/ip/ipsec/proposal",
		Body: map[string]interface{}{
			"name":            req.Name,
			"enc-algorithms":  req.Phase2.Encryption,
			"auth-algorithms": req.Phase2.AuthAlgorithm,
			"pfs-group":       req.Phase2.PFSGroup,
			"lifetime":        req.Phase2.Lifetime,
		},
	})

	// 3. Peer
	peerBody := map[string]interface{}{
		"name":          req.Name,
		"address":       ep.RemoteAddress,
		"local-address": ep.LocalAddress,
		"profile":       req.Name,
	}
	if req.Disabled {
		peerBody["disabled"] = "true"
	}
	if req.Comment != "" {
		peerBody["comment"] = req.Comment
	}
	ops = append(ops, ipsecOp{
		RouterID:     routerID,
		ResourcePath: "/ip/ipsec/peer",
		Body:         peerBody,
	})

	// 4. Identity
	identBody := map[string]interface{}{
		"peer":        req.Name,
		"auth-method": req.AuthMethod,
	}
	if req.IpsecSecret != "" {
		identBody["secret"] = req.IpsecSecret
	}
	ops = append(ops, ipsecOp{
		RouterID:     routerID,
		ResourcePath: "/ip/ipsec/identity",
		Body:         identBody,
	})

	// 5. Policies (policy-based only)
	if req.Mode == "policy-based" {
		for i := range req.LocalSubnets {
			remoteSubnet := ""
			if i < len(req.RemoteSubnets) {
				remoteSubnet = req.RemoteSubnets[i]
			}
			ops = append(ops, ipsecOp{
				RouterID:     routerID,
				ResourcePath: "/ip/ipsec/policy",
				Body: map[string]interface{}{
					"peer":        req.Name,
					"src-address": req.LocalSubnets[i],
					"dst-address": remoteSubnet,
				},
			})
		}
	}

	return ops
}

// ipsecOp is an internal helper for building operation lists.
type ipsecOp struct {
	RouterID     string
	ResourcePath string
	ResourceID   string
	Body         map[string]interface{}
}

// BuildIPsecDeleteOps builds the RouterOS operations for deleting an IPsec tunnel.
// Returns operations in reverse dependency order.
func BuildIPsecDeleteOps(routerID string, a assembledIPsec) []ipsecOp {
	var ops []ipsecOp

	// 1. Policies first
	for _, pid := range a.PolicyIDs {
		ops = append(ops, ipsecOp{
			RouterID:     routerID,
			ResourcePath: "/ip/ipsec/policy",
			ResourceID:   pid,
		})
	}

	// 2. Identity
	if a.IdentityID != "" {
		ops = append(ops, ipsecOp{
			RouterID:     routerID,
			ResourcePath: "/ip/ipsec/identity",
			ResourceID:   a.IdentityID,
		})
	}

	// 3. Peer
	ops = append(ops, ipsecOp{
		RouterID:     routerID,
		ResourcePath: "/ip/ipsec/peer",
		ResourceID:   a.PeerID,
	})

	// 4. Proposal
	if a.ProposalID != "" {
		ops = append(ops, ipsecOp{
			RouterID:     routerID,
			ResourcePath: "/ip/ipsec/proposal",
			ResourceID:   a.ProposalID,
		})
	}

	// 5. Profile
	if a.ProfileID != "" {
		ops = append(ops, ipsecOp{
			RouterID:     routerID,
			ResourcePath: "/ip/ipsec/profile",
			ResourceID:   a.ProfileID,
		})
	}

	return ops
}

// buildIPsecEndpoint converts assembled data into an IPsecEndpoint response.
func buildIPsecEndpoint(ri RouterInfo, a assembledIPsec) IPsecEndpoint {
	return IPsecEndpoint{
		RouterID:      ri.ID,
		RouterName:    ri.Name,
		Role:          ri.Role,
		RosIDs: IPsecRosIDs{
			Peer:     a.PeerID,
			Profile:  a.ProfileID,
			Proposal: a.ProposalID,
			Identity: a.IdentityID,
			Policies: a.PolicyIDs,
		},
		LocalAddress:  a.LocalAddress,
		RemoteAddress: a.RemoteAddress,
		Established:   a.Established,
	}
}

// buildIPsecUpdateBody builds the RouterOS request body for updating an IPsec peer.
func buildIPsecUpdateBody(ep *UpdateIPsecEndpointInput, req UpdateIPsecRequest) map[string]interface{} {
	body := map[string]interface{}{}
	if ep != nil {
		if ep.LocalAddress != nil {
			body["local-address"] = *ep.LocalAddress
		}
		if ep.RemoteAddress != nil {
			body["address"] = *ep.RemoteAddress
		}
	}
	if req.Disabled != nil {
		if *req.Disabled {
			body["disabled"] = "true"
		} else {
			body["disabled"] = "false"
		}
	}
	if req.Comment != nil {
		body["comment"] = *req.Comment
	}
	return body
}

// buildProfileUpdateBody builds the RouterOS body for updating an IPsec profile.
func buildProfileUpdateBody(p1 *Phase1Config) map[string]interface{} {
	body := map[string]interface{}{}
	if p1 == nil {
		return body
	}
	if p1.Encryption != "" {
		body["enc-algorithm"] = p1.Encryption
	}
	if p1.Hash != "" {
		body["hash-algorithm"] = p1.Hash
	}
	if p1.DHGroup != "" {
		body["dh-group"] = p1.DHGroup
	}
	if p1.Lifetime != "" {
		body["lifetime"] = p1.Lifetime
	}
	return body
}

// buildProposalUpdateBody builds the RouterOS body for updating an IPsec proposal.
func buildProposalUpdateBody(p2 *Phase2Config) map[string]interface{} {
	body := map[string]interface{}{}
	if p2 == nil {
		return body
	}
	if p2.Encryption != "" {
		body["enc-algorithms"] = p2.Encryption
	}
	if p2.AuthAlgorithm != "" {
		body["auth-algorithms"] = p2.AuthAlgorithm
	}
	if p2.PFSGroup != "" {
		body["pfs-group"] = p2.PFSGroup
	}
	if p2.Lifetime != "" {
		body["lifetime"] = p2.Lifetime
	}
	return body
}

// Ensure strconv import is used
var _ = strconv.Itoa
```

- [ ] **Step 2: Add MergeIPsecTunnels to merge.go**

Append to `backend/internal/tunnel/merge.go`:

```go
// MergeIPsecTunnels merges assembled IPsec tunnels from multiple routers by peer name.
func MergeIPsecTunnels(perRouter map[string][]assembledIPsec, routers []RouterInfo) []MergedIPsecTunnel {
	type tunnelEntry struct {
		shared    *assembledIPsec
		endpoints []IPsecEndpoint
	}
	byName := map[string]*tunnelEntry{}
	var orderedNames []string

	// Process master routers first.
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
		assembled := perRouter[ri.ID]
		for _, a := range assembled {
			ep := buildIPsecEndpoint(ri, a)

			entry, exists := byName[a.PeerName]
			if !exists {
				aCopy := a
				entry = &tunnelEntry{shared: &aCopy}
				byName[a.PeerName] = entry
				orderedNames = append(orderedNames, a.PeerName)
			}
			entry.endpoints = append(entry.endpoints, ep)
		}
	}

	result := make([]MergedIPsecTunnel, 0, len(orderedNames))
	for _, name := range orderedNames {
		entry := byName[name]
		a := entry.shared
		localSubnets := a.LocalSubnets
		if localSubnets == nil {
			localSubnets = []string{}
		}
		remoteSubnets := a.RemoteSubnets
		if remoteSubnets == nil {
			remoteSubnets = []string{}
		}
		result = append(result, MergedIPsecTunnel{
			Name:          a.PeerName,
			TunnelType:    "ipsec",
			Mode:          a.Mode,
			AuthMethod:    a.AuthMethod,
			IpsecSecret:   a.Secret,
			Phase1:        a.Phase1,
			Phase2:        a.Phase2,
			LocalSubnets:  localSubnets,
			RemoteSubnets: remoteSubnets,
			TunnelRoutes:  []string{},
			Disabled:      a.Disabled,
			Comment:       a.Comment,
			Endpoints:     entry.endpoints,
		})
	}
	return result
}
```

- [ ] **Step 3: Verify the build compiles**

Run: `cd /Users/pavle/speckit/kormos/backend && go build ./...`
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/tunnel/ipsec.go backend/internal/tunnel/merge.go
git commit -m "Add IPsec multi-resource fetch, assembly, and merge logic"
```

---

### Task 6: WireGuard Fetch & Normalize

**Files:**
- Create: `backend/internal/tunnel/wireguard.go`

- [ ] **Step 1: Create wireguard.go with fetch, normalize, and payload builders**

```go
// backend/internal/tunnel/wireguard.go
package tunnel

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/pobradovic08/kormos/backend/internal/normalize"
	"github.com/pobradovic08/kormos/backend/internal/routeros"
)

// FetchWGInterfaces fetches WireGuard interfaces from a single RouterOS device.
func FetchWGInterfaces(ctx context.Context, client *routeros.Client) ([]WGInterface, error) {
	body, err := client.Get(ctx, "/interface/wireguard")
	if err != nil {
		return nil, fmt.Errorf("tunnel: fetch wireguard interfaces: %w", err)
	}
	var raw []RawWireGuardInterface
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("tunnel: parse wireguard interfaces: %w", err)
	}
	ifaces := make([]WGInterface, len(raw))
	for i, r := range raw {
		mtu := normalize.ParseInt(r.MTU)
		if mtu == 0 {
			mtu = 1420
		}
		ifaces[i] = WGInterface{
			RosID:      r.ID,
			Name:       r.Name,
			ListenPort: normalize.ParseInt(r.ListenPort),
			MTU:        mtu,
			PrivateKey: r.PrivateKey,
			PublicKey:  r.PublicKey,
			Disabled:   normalize.ParseBool(r.Disabled),
			Running:    normalize.ParseBool(r.Running),
		}
	}
	return ifaces, nil
}

// FetchWGPeers fetches WireGuard peers from a single RouterOS device.
func FetchWGPeers(ctx context.Context, client *routeros.Client) ([]WGPeer, error) {
	body, err := client.Get(ctx, "/interface/wireguard/peers")
	if err != nil {
		return nil, fmt.Errorf("tunnel: fetch wireguard peers: %w", err)
	}
	var raw []RawWireGuardPeer
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("tunnel: parse wireguard peers: %w", err)
	}
	peers := make([]WGPeer, len(raw))
	for i, r := range raw {
		peers[i] = WGPeer{
			RosID:               r.ID,
			Interface:           r.Interface,
			Name:                r.Name,
			PublicKey:           r.PublicKey,
			PresharedKey:       r.PresharedKey,
			AllowedAddress:     r.AllowedAddress,
			EndpointAddress:    r.EndpointAddress,
			EndpointPort:       normalize.ParseInt(r.EndpointPort),
			LastHandshake:      r.LastHandshake,
			Rx:                 normalize.ParseInt64(r.Rx),
			Tx:                 normalize.ParseInt64(r.Tx),
			PersistentKeepalive: normalize.ParseInt(r.PersistentKeepalive),
			Disabled:           normalize.ParseBool(r.Disabled),
			Comment:            r.Comment,
		}
	}
	return peers, nil
}

// FindWGInterfaceByName searches WireGuard interfaces for one matching the given name.
func FindWGInterfaceByName(ifaces []WGInterface, name string) *WGInterface {
	for i := range ifaces {
		if ifaces[i].Name == name {
			return &ifaces[i]
		}
	}
	return nil
}

// PeersForInterface returns all peers that belong to the given interface name.
func PeersForInterface(peers []WGPeer, ifaceName string) []WGPeer {
	var result []WGPeer
	for _, p := range peers {
		if p.Interface == ifaceName {
			result = append(result, p)
		}
	}
	if result == nil {
		result = []WGPeer{}
	}
	return result
}

// BuildWGInterfaceCreateBody builds the RouterOS request body for creating a WireGuard interface.
func BuildWGInterfaceCreateBody(req CreateWGInterfaceRequest) map[string]interface{} {
	body := map[string]interface{}{
		"name":        req.Name,
		"listen-port": strconv.Itoa(req.ListenPort),
	}
	if req.MTU > 0 {
		body["mtu"] = strconv.Itoa(req.MTU)
	}
	if req.Disabled {
		body["disabled"] = "true"
	}
	if req.Comment != "" {
		body["comment"] = req.Comment
	}
	return body
}

// BuildWGInterfaceUpdateBody builds the RouterOS request body for updating a WireGuard interface.
func BuildWGInterfaceUpdateBody(req UpdateWGInterfaceRequest) map[string]interface{} {
	body := map[string]interface{}{}
	if req.ListenPort != nil {
		body["listen-port"] = strconv.Itoa(*req.ListenPort)
	}
	if req.MTU != nil {
		body["mtu"] = strconv.Itoa(*req.MTU)
	}
	if req.Disabled != nil {
		if *req.Disabled {
			body["disabled"] = "true"
		} else {
			body["disabled"] = "false"
		}
	}
	if req.Comment != nil {
		body["comment"] = *req.Comment
	}
	return body
}

// BuildWGPeerCreateBody builds the RouterOS request body for creating a WireGuard peer.
func BuildWGPeerCreateBody(ifaceName string, req CreateWGPeerRequest) map[string]interface{} {
	body := map[string]interface{}{
		"interface":       ifaceName,
		"public-key":      req.PublicKey,
		"allowed-address": req.AllowedAddress,
	}
	if req.PresharedKey != "" {
		body["preshared-key"] = req.PresharedKey
	}
	if req.EndpointAddress != "" {
		body["endpoint-address"] = req.EndpointAddress
	}
	if req.EndpointPort > 0 {
		body["endpoint-port"] = strconv.Itoa(req.EndpointPort)
	}
	if req.PersistentKeepalive > 0 {
		body["persistent-keepalive"] = strconv.Itoa(req.PersistentKeepalive)
	}
	if req.Disabled {
		body["disabled"] = "true"
	}
	if req.Comment != "" {
		body["comment"] = req.Comment
	}
	return body
}

// BuildWGPeerUpdateBody builds the RouterOS request body for updating a WireGuard peer.
func BuildWGPeerUpdateBody(req UpdateWGPeerRequest) map[string]interface{} {
	body := map[string]interface{}{}
	if req.PublicKey != nil {
		body["public-key"] = *req.PublicKey
	}
	if req.PresharedKey != nil {
		body["preshared-key"] = *req.PresharedKey
	}
	if req.AllowedAddress != nil {
		body["allowed-address"] = *req.AllowedAddress
	}
	if req.EndpointAddress != nil {
		body["endpoint-address"] = *req.EndpointAddress
	}
	if req.EndpointPort != nil {
		body["endpoint-port"] = strconv.Itoa(*req.EndpointPort)
	}
	if req.PersistentKeepalive != nil {
		body["persistent-keepalive"] = strconv.Itoa(*req.PersistentKeepalive)
	}
	if req.Disabled != nil {
		if *req.Disabled {
			body["disabled"] = "true"
		} else {
			body["disabled"] = "false"
		}
	}
	if req.Comment != nil {
		body["comment"] = *req.Comment
	}
	return body
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/pavle/speckit/kormos/backend && go build ./...`
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/tunnel/wireguard.go
git commit -m "Add WireGuard fetch, normalize, and payload builders"
```

---

### Task 7: Tunnel Service — GRE CRUD

**Files:**
- Create: `backend/internal/tunnel/service.go`

- [ ] **Step 1: Create the service with GRE list, get, create, update, delete**

```go
// backend/internal/tunnel/service.go
package tunnel

import (
	"context"
	"fmt"

	"github.com/pobradovic08/kormos/backend/internal/cluster"
	"github.com/pobradovic08/kormos/backend/internal/operation"
	"github.com/pobradovic08/kormos/backend/internal/router"
	"github.com/pobradovic08/kormos/backend/internal/routeros"
)

// Service orchestrates cluster-level tunnel and WireGuard CRUD.
type Service struct {
	routerSvc    *router.Service
	clusterSvc   *cluster.Service
	operationSvc *operation.Service
}

// NewService creates a new tunnel Service.
func NewService(routerSvc *router.Service, clusterSvc *cluster.Service, operationSvc *operation.Service) *Service {
	return &Service{
		routerSvc:    routerSvc,
		clusterSvc:   clusterSvc,
		operationSvc: operationSvc,
	}
}

// getClusterRouters returns the router info and RouterOS clients for a cluster.
func (s *Service) getClusterRouters(ctx context.Context, tenantID, clusterID string) ([]RouterInfo, map[string]*routeros.Client, error) {
	cl, err := s.clusterSvc.GetByID(ctx, tenantID, clusterID)
	if err != nil {
		return nil, nil, fmt.Errorf("tunnel: get cluster: %w", err)
	}
	if cl == nil {
		return nil, nil, fmt.Errorf("tunnel: cluster not found")
	}

	routers := make([]RouterInfo, len(cl.Routers))
	clients := make(map[string]*routeros.Client)
	for i, r := range cl.Routers {
		routers[i] = RouterInfo{ID: r.ID, Name: r.Name, Role: r.Role}
		client, err := s.routerSvc.GetClientForRouter(ctx, tenantID, r.ID)
		if err != nil {
			return nil, nil, fmt.Errorf("tunnel: get client for router %s: %w", r.Name, err)
		}
		clients[r.ID] = client
	}
	return routers, clients, nil
}

// validateRouterIDs checks that all endpoint router IDs belong to the cluster.
func validateRouterIDs(endpoints []string, routers []RouterInfo) error {
	valid := map[string]bool{}
	for _, ri := range routers {
		valid[ri.ID] = true
	}
	for _, id := range endpoints {
		if !valid[id] {
			return fmt.Errorf("tunnel: router %s not in cluster", id)
		}
	}
	return nil
}

// --- GRE ---

// ListGRE fetches GRE tunnels from all routers and merges by name.
func (s *Service) ListGRE(ctx context.Context, tenantID, clusterID string) ([]MergedGRETunnel, error) {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	perRouter := make(map[string][]RawGRETunnel)
	for _, ri := range routers {
		raws, err := FetchGRETunnels(ctx, clients[ri.ID])
		if err != nil {
			return nil, fmt.Errorf("tunnel: fetch gre from %s: %w", ri.Name, err)
		}
		perRouter[ri.ID] = raws
	}

	return MergeGRETunnels(perRouter, routers), nil
}

// GetGRE fetches a single merged GRE tunnel by name.
func (s *Service) GetGRE(ctx context.Context, tenantID, clusterID, name string) (*MergedGRETunnel, error) {
	tunnels, err := s.ListGRE(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	return FindMergedGREByName(tunnels, name), nil
}

// CreateGRE creates a GRE tunnel on all specified routers via the operation system.
func (s *Service) CreateGRE(ctx context.Context, tenantID, userID, clusterID string, req CreateGRERequest) (*MergedGRETunnel, error) {
	routers, _, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	epRouterIDs := make([]string, len(req.Endpoints))
	for i, ep := range req.Endpoints {
		epRouterIDs[i] = ep.RouterID
	}
	if err := validateRouterIDs(epRouterIDs, routers); err != nil {
		return nil, err
	}

	ops := make([]operation.ExecuteOperation, len(req.Endpoints))
	for i, ep := range req.Endpoints {
		ops[i] = operation.ExecuteOperation{
			RouterID:      ep.RouterID,
			Module:        "tunnels",
			OperationType: operation.OpAdd,
			ResourcePath:  "/interface/gre",
			Body:          BuildGRECreateBody(req, ep),
		}
	}

	_, err = s.operationSvc.Execute(ctx, tenantID, userID, operation.ExecuteRequest{
		Description: fmt.Sprintf("Create GRE tunnel %s", req.Name),
		Operations:  ops,
	})
	if err != nil {
		return nil, fmt.Errorf("tunnel: create gre: %w", err)
	}

	return s.GetGRE(ctx, tenantID, clusterID, req.Name)
}

// UpdateGRE updates a GRE tunnel on all routers where it exists.
func (s *Service) UpdateGRE(ctx context.Context, tenantID, userID, clusterID, name string, req UpdateGRERequest) (*MergedGRETunnel, error) {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	// Find the tunnel on each router to get RouterOS IDs.
	var ops []operation.ExecuteOperation
	for _, ri := range routers {
		raws, err := FetchGRETunnels(ctx, clients[ri.ID])
		if err != nil {
			continue
		}
		raw := FindGREByName(raws, name)
		if raw == nil {
			continue
		}

		// Find matching endpoint update.
		var ep *UpdateGREEndpointInput
		for j := range req.Endpoints {
			if req.Endpoints[j].RouterID == ri.ID {
				ep = &req.Endpoints[j]
				break
			}
		}

		body := BuildGREUpdateBody(req, ep)
		if len(body) == 0 {
			continue
		}

		ops = append(ops, operation.ExecuteOperation{
			RouterID:      ri.ID,
			Module:        "tunnels",
			OperationType: operation.OpModify,
			ResourcePath:  "/interface/gre",
			ResourceID:    raw.ID,
			Body:          body,
		})
	}

	if len(ops) == 0 {
		return nil, fmt.Errorf("tunnel: gre tunnel %s not found", name)
	}

	_, err = s.operationSvc.Execute(ctx, tenantID, userID, operation.ExecuteRequest{
		Description: fmt.Sprintf("Update GRE tunnel %s", name),
		Operations:  ops,
	})
	if err != nil {
		return nil, fmt.Errorf("tunnel: update gre: %w", err)
	}

	return s.GetGRE(ctx, tenantID, clusterID, name)
}

// DeleteGRE deletes a GRE tunnel from all routers where it exists.
func (s *Service) DeleteGRE(ctx context.Context, tenantID, userID, clusterID, name string) error {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return err
	}

	var ops []operation.ExecuteOperation
	for _, ri := range routers {
		raws, err := FetchGRETunnels(ctx, clients[ri.ID])
		if err != nil {
			continue
		}
		raw := FindGREByName(raws, name)
		if raw == nil {
			continue
		}

		ops = append(ops, operation.ExecuteOperation{
			RouterID:      ri.ID,
			Module:        "tunnels",
			OperationType: operation.OpDelete,
			ResourcePath:  "/interface/gre",
			ResourceID:    raw.ID,
		})
	}

	if len(ops) == 0 {
		return fmt.Errorf("tunnel: gre tunnel %s not found", name)
	}

	_, err = s.operationSvc.Execute(ctx, tenantID, userID, operation.ExecuteRequest{
		Description: fmt.Sprintf("Delete GRE tunnel %s", name),
		Operations:  ops,
	})
	if err != nil {
		return fmt.Errorf("tunnel: delete gre: %w", err)
	}
	return nil
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/pavle/speckit/kormos/backend && go build ./...`
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/tunnel/service.go
git commit -m "Add tunnel service with GRE CRUD orchestration"
```

---

### Task 8: Tunnel Service — IPsec CRUD

**Files:**
- Modify: `backend/internal/tunnel/service.go`

- [ ] **Step 1: Add IPsec methods to service.go**

Append these methods to `backend/internal/tunnel/service.go`:

```go
// --- IPsec ---

// ListIPsec fetches IPsec tunnels from all routers, assembles, and merges by name.
func (s *Service) ListIPsec(ctx context.Context, tenantID, clusterID string) ([]MergedIPsecTunnel, error) {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	perRouter := make(map[string][]assembledIPsec)
	for _, ri := range routers {
		data, err := FetchIPsecAll(ctx, clients[ri.ID])
		if err != nil {
			return nil, fmt.Errorf("tunnel: fetch ipsec from %s: %w", ri.Name, err)
		}
		perRouter[ri.ID] = AssembleIPsec(data)
	}

	return MergeIPsecTunnels(perRouter, routers), nil
}

// GetIPsec fetches a single merged IPsec tunnel by name.
func (s *Service) GetIPsec(ctx context.Context, tenantID, clusterID, name string) (*MergedIPsecTunnel, error) {
	tunnels, err := s.ListIPsec(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	return FindMergedIPsecByName(tunnels, name), nil
}

// CreateIPsec creates an IPsec tunnel (multi-resource) on all specified routers.
func (s *Service) CreateIPsec(ctx context.Context, tenantID, userID, clusterID string, req CreateIPsecRequest) (*MergedIPsecTunnel, error) {
	routers, _, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	epRouterIDs := make([]string, len(req.Endpoints))
	for i, ep := range req.Endpoints {
		epRouterIDs[i] = ep.RouterID
	}
	if err := validateRouterIDs(epRouterIDs, routers); err != nil {
		return nil, err
	}

	var ops []operation.ExecuteOperation
	for _, ep := range req.Endpoints {
		ipsecOps := BuildIPsecCreateOps(req, ep.RouterID, ep)
		for _, iop := range ipsecOps {
			ops = append(ops, operation.ExecuteOperation{
				RouterID:      iop.RouterID,
				Module:        "tunnels",
				OperationType: operation.OpAdd,
				ResourcePath:  iop.ResourcePath,
				Body:          iop.Body,
			})
		}
	}

	_, err = s.operationSvc.Execute(ctx, tenantID, userID, operation.ExecuteRequest{
		Description: fmt.Sprintf("Create IPsec tunnel %s", req.Name),
		Operations:  ops,
	})
	if err != nil {
		return nil, fmt.Errorf("tunnel: create ipsec: %w", err)
	}

	return s.GetIPsec(ctx, tenantID, clusterID, req.Name)
}

// UpdateIPsec updates an IPsec tunnel on all routers where it exists.
func (s *Service) UpdateIPsec(ctx context.Context, tenantID, userID, clusterID, name string, req UpdateIPsecRequest) (*MergedIPsecTunnel, error) {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	var ops []operation.ExecuteOperation
	for _, ri := range routers {
		data, err := FetchIPsecAll(ctx, clients[ri.ID])
		if err != nil {
			continue
		}
		assembled := AssembleIPsec(data)
		var found *assembledIPsec
		for j := range assembled {
			if assembled[j].PeerName == name {
				found = &assembled[j]
				break
			}
		}
		if found == nil {
			continue
		}

		// Find matching endpoint update.
		var ep *UpdateIPsecEndpointInput
		for j := range req.Endpoints {
			if req.Endpoints[j].RouterID == ri.ID {
				ep = &req.Endpoints[j]
				break
			}
		}

		// Update peer.
		peerBody := buildIPsecUpdateBody(ep, req)
		if len(peerBody) > 0 {
			ops = append(ops, operation.ExecuteOperation{
				RouterID:      ri.ID,
				Module:        "tunnels",
				OperationType: operation.OpModify,
				ResourcePath:  "/ip/ipsec/peer",
				ResourceID:    found.PeerID,
				Body:          peerBody,
			})
		}

		// Update profile (Phase 1).
		if req.Phase1 != nil && found.ProfileID != "" {
			profileBody := buildProfileUpdateBody(req.Phase1)
			if len(profileBody) > 0 {
				ops = append(ops, operation.ExecuteOperation{
					RouterID:      ri.ID,
					Module:        "tunnels",
					OperationType: operation.OpModify,
					ResourcePath:  "/ip/ipsec/profile",
					ResourceID:    found.ProfileID,
					Body:          profileBody,
				})
			}
		}

		// Update proposal (Phase 2).
		if req.Phase2 != nil && found.ProposalID != "" {
			proposalBody := buildProposalUpdateBody(req.Phase2)
			if len(proposalBody) > 0 {
				ops = append(ops, operation.ExecuteOperation{
					RouterID:      ri.ID,
					Module:        "tunnels",
					OperationType: operation.OpModify,
					ResourcePath:  "/ip/ipsec/proposal",
					ResourceID:    found.ProposalID,
					Body:          proposalBody,
				})
			}
		}
	}

	if len(ops) == 0 {
		return nil, fmt.Errorf("tunnel: ipsec tunnel %s not found", name)
	}

	_, err = s.operationSvc.Execute(ctx, tenantID, userID, operation.ExecuteRequest{
		Description: fmt.Sprintf("Update IPsec tunnel %s", name),
		Operations:  ops,
	})
	if err != nil {
		return nil, fmt.Errorf("tunnel: update ipsec: %w", err)
	}

	return s.GetIPsec(ctx, tenantID, clusterID, name)
}

// DeleteIPsec deletes an IPsec tunnel (all sub-resources) from all routers.
func (s *Service) DeleteIPsec(ctx context.Context, tenantID, userID, clusterID, name string) error {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return err
	}

	var ops []operation.ExecuteOperation
	for _, ri := range routers {
		data, err := FetchIPsecAll(ctx, clients[ri.ID])
		if err != nil {
			continue
		}
		assembled := AssembleIPsec(data)
		var found *assembledIPsec
		for j := range assembled {
			if assembled[j].PeerName == name {
				found = &assembled[j]
				break
			}
		}
		if found == nil {
			continue
		}

		deleteOps := BuildIPsecDeleteOps(ri.ID, *found)
		for _, dop := range deleteOps {
			ops = append(ops, operation.ExecuteOperation{
				RouterID:      dop.RouterID,
				Module:        "tunnels",
				OperationType: operation.OpDelete,
				ResourcePath:  dop.ResourcePath,
				ResourceID:    dop.ResourceID,
			})
		}
	}

	if len(ops) == 0 {
		return fmt.Errorf("tunnel: ipsec tunnel %s not found", name)
	}

	_, err = s.operationSvc.Execute(ctx, tenantID, userID, operation.ExecuteRequest{
		Description: fmt.Sprintf("Delete IPsec tunnel %s", name),
		Operations:  ops,
	})
	if err != nil {
		return fmt.Errorf("tunnel: delete ipsec: %w", err)
	}
	return nil
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/pavle/speckit/kormos/backend && go build ./...`
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/tunnel/service.go
git commit -m "Add IPsec CRUD to tunnel service"
```

---

### Task 9: Tunnel Service — WireGuard CRUD

**Files:**
- Modify: `backend/internal/tunnel/service.go`

- [ ] **Step 1: Add WireGuard methods to service.go**

Append these methods to `backend/internal/tunnel/service.go`:

```go
// --- WireGuard ---

// ListWireGuard fetches WireGuard interfaces and peers from all routers (no merge).
func (s *Service) ListWireGuard(ctx context.Context, tenantID, clusterID string) ([]RouterWireGuard, error) {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	var result []RouterWireGuard
	for _, ri := range routers {
		ifaces, err := FetchWGInterfaces(ctx, clients[ri.ID])
		if err != nil {
			return nil, fmt.Errorf("tunnel: fetch wireguard from %s: %w", ri.Name, err)
		}
		peers, err := FetchWGPeers(ctx, clients[ri.ID])
		if err != nil {
			return nil, fmt.Errorf("tunnel: fetch wireguard peers from %s: %w", ri.Name, err)
		}

		for _, iface := range ifaces {
			result = append(result, RouterWireGuard{
				RouterID:   ri.ID,
				RouterName: ri.Name,
				Role:       ri.Role,
				Interface:  iface,
				Peers:      PeersForInterface(peers, iface.Name),
			})
		}
	}

	if result == nil {
		result = []RouterWireGuard{}
	}
	return result, nil
}

// GetWireGuard fetches a single WireGuard interface + peers from a specific router.
func (s *Service) GetWireGuard(ctx context.Context, tenantID, clusterID, routerID, name string) (*RouterWireGuard, error) {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	var ri *RouterInfo
	for i := range routers {
		if routers[i].ID == routerID {
			ri = &routers[i]
			break
		}
	}
	if ri == nil {
		return nil, fmt.Errorf("tunnel: router %s not in cluster", routerID)
	}

	client := clients[routerID]
	ifaces, err := FetchWGInterfaces(ctx, client)
	if err != nil {
		return nil, err
	}
	iface := FindWGInterfaceByName(ifaces, name)
	if iface == nil {
		return nil, nil
	}

	peers, err := FetchWGPeers(ctx, client)
	if err != nil {
		return nil, err
	}

	return &RouterWireGuard{
		RouterID:   ri.ID,
		RouterName: ri.Name,
		Role:       ri.Role,
		Interface:  *iface,
		Peers:      PeersForInterface(peers, name),
	}, nil
}

// CreateWGInterface creates a WireGuard interface on a specific router.
func (s *Service) CreateWGInterface(ctx context.Context, tenantID, userID, clusterID string, req CreateWGInterfaceRequest) (*RouterWireGuard, error) {
	routers, _, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	if err := validateRouterIDs([]string{req.RouterID}, routers); err != nil {
		return nil, err
	}

	_, err = s.operationSvc.Execute(ctx, tenantID, userID, operation.ExecuteRequest{
		Description: fmt.Sprintf("Create WireGuard interface %s", req.Name),
		Operations: []operation.ExecuteOperation{
			{
				RouterID:      req.RouterID,
				Module:        "wireguard",
				OperationType: operation.OpAdd,
				ResourcePath:  "/interface/wireguard",
				Body:          BuildWGInterfaceCreateBody(req),
			},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("tunnel: create wireguard interface: %w", err)
	}

	return s.GetWireGuard(ctx, tenantID, clusterID, req.RouterID, req.Name)
}

// UpdateWGInterface updates a WireGuard interface on a specific router.
func (s *Service) UpdateWGInterface(ctx context.Context, tenantID, userID, clusterID, routerID, name string, req UpdateWGInterfaceRequest) (*RouterWireGuard, error) {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	if err := validateRouterIDs([]string{routerID}, routers); err != nil {
		return nil, err
	}

	ifaces, err := FetchWGInterfaces(ctx, clients[routerID])
	if err != nil {
		return nil, err
	}
	iface := FindWGInterfaceByName(ifaces, name)
	if iface == nil {
		return nil, fmt.Errorf("tunnel: wireguard interface %s not found", name)
	}

	body := BuildWGInterfaceUpdateBody(req)
	if len(body) == 0 {
		return s.GetWireGuard(ctx, tenantID, clusterID, routerID, name)
	}

	_, err = s.operationSvc.Execute(ctx, tenantID, userID, operation.ExecuteRequest{
		Description: fmt.Sprintf("Update WireGuard interface %s", name),
		Operations: []operation.ExecuteOperation{
			{
				RouterID:      routerID,
				Module:        "wireguard",
				OperationType: operation.OpModify,
				ResourcePath:  "/interface/wireguard",
				ResourceID:    iface.RosID,
				Body:          body,
			},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("tunnel: update wireguard interface: %w", err)
	}

	return s.GetWireGuard(ctx, tenantID, clusterID, routerID, name)
}

// DeleteWGInterface deletes a WireGuard interface from a specific router.
func (s *Service) DeleteWGInterface(ctx context.Context, tenantID, userID, clusterID, routerID, name string) error {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return err
	}
	if err := validateRouterIDs([]string{routerID}, routers); err != nil {
		return err
	}

	ifaces, err := FetchWGInterfaces(ctx, clients[routerID])
	if err != nil {
		return err
	}
	iface := FindWGInterfaceByName(ifaces, name)
	if iface == nil {
		return fmt.Errorf("tunnel: wireguard interface %s not found", name)
	}

	_, err = s.operationSvc.Execute(ctx, tenantID, userID, operation.ExecuteRequest{
		Description: fmt.Sprintf("Delete WireGuard interface %s", name),
		Operations: []operation.ExecuteOperation{
			{
				RouterID:      routerID,
				Module:        "wireguard",
				OperationType: operation.OpDelete,
				ResourcePath:  "/interface/wireguard",
				ResourceID:    iface.RosID,
			},
		},
	})
	if err != nil {
		return fmt.Errorf("tunnel: delete wireguard interface: %w", err)
	}
	return nil
}

// CreateWGPeer creates a WireGuard peer on a specific router.
func (s *Service) CreateWGPeer(ctx context.Context, tenantID, userID, clusterID, routerID, ifaceName string, req CreateWGPeerRequest) (*RouterWireGuard, error) {
	routers, _, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	if err := validateRouterIDs([]string{routerID}, routers); err != nil {
		return nil, err
	}

	_, err = s.operationSvc.Execute(ctx, tenantID, userID, operation.ExecuteRequest{
		Description: fmt.Sprintf("Add WireGuard peer to %s", ifaceName),
		Operations: []operation.ExecuteOperation{
			{
				RouterID:      routerID,
				Module:        "wireguard",
				OperationType: operation.OpAdd,
				ResourcePath:  "/interface/wireguard/peers",
				Body:          BuildWGPeerCreateBody(ifaceName, req),
			},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("tunnel: create wireguard peer: %w", err)
	}

	return s.GetWireGuard(ctx, tenantID, clusterID, routerID, ifaceName)
}

// UpdateWGPeer updates a WireGuard peer on a specific router.
func (s *Service) UpdateWGPeer(ctx context.Context, tenantID, userID, clusterID, routerID, ifaceName, peerID string, req UpdateWGPeerRequest) (*RouterWireGuard, error) {
	routers, _, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	if err := validateRouterIDs([]string{routerID}, routers); err != nil {
		return nil, err
	}

	body := BuildWGPeerUpdateBody(req)
	if len(body) == 0 {
		return s.GetWireGuard(ctx, tenantID, clusterID, routerID, ifaceName)
	}

	_, err = s.operationSvc.Execute(ctx, tenantID, userID, operation.ExecuteRequest{
		Description: fmt.Sprintf("Update WireGuard peer on %s", ifaceName),
		Operations: []operation.ExecuteOperation{
			{
				RouterID:      routerID,
				Module:        "wireguard",
				OperationType: operation.OpModify,
				ResourcePath:  "/interface/wireguard/peers",
				ResourceID:    peerID,
				Body:          body,
			},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("tunnel: update wireguard peer: %w", err)
	}

	return s.GetWireGuard(ctx, tenantID, clusterID, routerID, ifaceName)
}

// DeleteWGPeer deletes a WireGuard peer from a specific router.
func (s *Service) DeleteWGPeer(ctx context.Context, tenantID, userID, clusterID, routerID, ifaceName, peerID string) error {
	routers, _, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return err
	}
	if err := validateRouterIDs([]string{routerID}, routers); err != nil {
		return err
	}

	_, err = s.operationSvc.Execute(ctx, tenantID, userID, operation.ExecuteRequest{
		Description: fmt.Sprintf("Delete WireGuard peer from %s", ifaceName),
		Operations: []operation.ExecuteOperation{
			{
				RouterID:      routerID,
				Module:        "wireguard",
				OperationType: operation.OpDelete,
				ResourcePath:  "/interface/wireguard/peers",
				ResourceID:    peerID,
			},
		},
	})
	if err != nil {
		return fmt.Errorf("tunnel: delete wireguard peer: %w", err)
	}
	return nil
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd /Users/pavle/speckit/kormos/backend && go build ./...`
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add backend/internal/tunnel/service.go
git commit -m "Add WireGuard CRUD to tunnel service"
```

---

### Task 10: HTTP Handler & Route Registration

**Files:**
- Create: `backend/internal/tunnel/handler.go`
- Modify: `backend/cmd/server/main.go`
- Modify: `backend/internal/proxy/handler.go`

- [ ] **Step 1: Create handler.go with all HTTP handlers**

```go
// backend/internal/tunnel/handler.go
package tunnel

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/pobradovic08/kormos/backend/internal/middleware"
)

// Handler provides HTTP handlers for tunnel and WireGuard endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new tunnel Handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// --- GRE handlers ---

// ListGRE handles GET /clusters/{clusterID}/tunnels/gre.
func (h *Handler) ListGRE(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")

	tunnels, err := h.service.ListGRE(r.Context(), tenantID, clusterID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	if tunnels == nil {
		tunnels = []MergedGRETunnel{}
	}
	writeJSON(w, http.StatusOK, tunnels)
}

// GetGRE handles GET /clusters/{clusterID}/tunnels/gre/{name}.
func (h *Handler) GetGRE(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")
	name := chi.URLParam(r, "name")

	tunnel, err := h.service.GetGRE(r.Context(), tenantID, clusterID, name)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	if tunnel == nil {
		writeError(w, http.StatusNotFound, "not_found", "GRE tunnel not found")
		return
	}
	writeJSON(w, http.StatusOK, tunnel)
}

// CreateGRE handles POST /clusters/{clusterID}/tunnels/gre.
func (h *Handler) CreateGRE(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")
	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid token")
		return
	}

	var req CreateGRERequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "Name is required")
		return
	}
	if len(req.Endpoints) == 0 {
		writeError(w, http.StatusBadRequest, "invalid_request", "At least one endpoint is required")
		return
	}

	tunnel, err := h.service.CreateGRE(r.Context(), tenantID, claims.UserID, clusterID, req)
	if err != nil {
		writeError(w, http.StatusBadRequest, "create_error", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, tunnel)
}

// UpdateGRE handles PATCH /clusters/{clusterID}/tunnels/gre/{name}.
func (h *Handler) UpdateGRE(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")
	name := chi.URLParam(r, "name")
	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid token")
		return
	}

	var req UpdateGRERequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	tunnel, err := h.service.UpdateGRE(r.Context(), tenantID, claims.UserID, clusterID, name, req)
	if err != nil {
		writeError(w, http.StatusBadRequest, "update_error", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, tunnel)
}

// DeleteGRE handles DELETE /clusters/{clusterID}/tunnels/gre/{name}.
func (h *Handler) DeleteGRE(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")
	name := chi.URLParam(r, "name")
	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid token")
		return
	}

	if err := h.service.DeleteGRE(r.Context(), tenantID, claims.UserID, clusterID, name); err != nil {
		writeError(w, http.StatusBadRequest, "delete_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- IPsec handlers ---

// ListIPsec handles GET /clusters/{clusterID}/tunnels/ipsec.
func (h *Handler) ListIPsec(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")

	tunnels, err := h.service.ListIPsec(r.Context(), tenantID, clusterID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	if tunnels == nil {
		tunnels = []MergedIPsecTunnel{}
	}
	writeJSON(w, http.StatusOK, tunnels)
}

// GetIPsec handles GET /clusters/{clusterID}/tunnels/ipsec/{name}.
func (h *Handler) GetIPsec(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")
	name := chi.URLParam(r, "name")

	tunnel, err := h.service.GetIPsec(r.Context(), tenantID, clusterID, name)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	if tunnel == nil {
		writeError(w, http.StatusNotFound, "not_found", "IPsec tunnel not found")
		return
	}
	writeJSON(w, http.StatusOK, tunnel)
}

// CreateIPsec handles POST /clusters/{clusterID}/tunnels/ipsec.
func (h *Handler) CreateIPsec(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")
	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid token")
		return
	}

	var req CreateIPsecRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "Name is required")
		return
	}
	if len(req.Endpoints) == 0 {
		writeError(w, http.StatusBadRequest, "invalid_request", "At least one endpoint is required")
		return
	}

	tunnel, err := h.service.CreateIPsec(r.Context(), tenantID, claims.UserID, clusterID, req)
	if err != nil {
		writeError(w, http.StatusBadRequest, "create_error", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, tunnel)
}

// UpdateIPsec handles PATCH /clusters/{clusterID}/tunnels/ipsec/{name}.
func (h *Handler) UpdateIPsec(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")
	name := chi.URLParam(r, "name")
	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid token")
		return
	}

	var req UpdateIPsecRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	tunnel, err := h.service.UpdateIPsec(r.Context(), tenantID, claims.UserID, clusterID, name, req)
	if err != nil {
		writeError(w, http.StatusBadRequest, "update_error", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, tunnel)
}

// DeleteIPsec handles DELETE /clusters/{clusterID}/tunnels/ipsec/{name}.
func (h *Handler) DeleteIPsec(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")
	name := chi.URLParam(r, "name")
	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid token")
		return
	}

	if err := h.service.DeleteIPsec(r.Context(), tenantID, claims.UserID, clusterID, name); err != nil {
		writeError(w, http.StatusBadRequest, "delete_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- WireGuard handlers ---

// ListWireGuard handles GET /clusters/{clusterID}/wireguard.
func (h *Handler) ListWireGuard(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")

	wgs, err := h.service.ListWireGuard(r.Context(), tenantID, clusterID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, wgs)
}

// GetWireGuard handles GET /clusters/{clusterID}/wireguard/{routerID}/{name}.
func (h *Handler) GetWireGuard(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")
	routerID := chi.URLParam(r, "routerID")
	name := chi.URLParam(r, "name")

	wg, err := h.service.GetWireGuard(r.Context(), tenantID, clusterID, routerID, name)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	if wg == nil {
		writeError(w, http.StatusNotFound, "not_found", "WireGuard interface not found")
		return
	}
	writeJSON(w, http.StatusOK, wg)
}

// CreateWGInterface handles POST /clusters/{clusterID}/wireguard.
func (h *Handler) CreateWGInterface(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")
	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid token")
		return
	}

	var req CreateWGInterfaceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}
	if req.Name == "" || req.RouterID == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "Name and routerId are required")
		return
	}

	wg, err := h.service.CreateWGInterface(r.Context(), tenantID, claims.UserID, clusterID, req)
	if err != nil {
		writeError(w, http.StatusBadRequest, "create_error", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, wg)
}

// UpdateWGInterface handles PATCH /clusters/{clusterID}/wireguard/{routerID}/{name}.
func (h *Handler) UpdateWGInterface(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")
	routerID := chi.URLParam(r, "routerID")
	name := chi.URLParam(r, "name")
	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid token")
		return
	}

	var req UpdateWGInterfaceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	wg, err := h.service.UpdateWGInterface(r.Context(), tenantID, claims.UserID, clusterID, routerID, name, req)
	if err != nil {
		writeError(w, http.StatusBadRequest, "update_error", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, wg)
}

// DeleteWGInterface handles DELETE /clusters/{clusterID}/wireguard/{routerID}/{name}.
func (h *Handler) DeleteWGInterface(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")
	routerID := chi.URLParam(r, "routerID")
	name := chi.URLParam(r, "name")
	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid token")
		return
	}

	if err := h.service.DeleteWGInterface(r.Context(), tenantID, claims.UserID, clusterID, routerID, name); err != nil {
		writeError(w, http.StatusBadRequest, "delete_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// CreateWGPeer handles POST /clusters/{clusterID}/wireguard/{routerID}/{name}/peers.
func (h *Handler) CreateWGPeer(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")
	routerID := chi.URLParam(r, "routerID")
	name := chi.URLParam(r, "name")
	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid token")
		return
	}

	var req CreateWGPeerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	wg, err := h.service.CreateWGPeer(r.Context(), tenantID, claims.UserID, clusterID, routerID, name, req)
	if err != nil {
		writeError(w, http.StatusBadRequest, "create_error", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, wg)
}

// UpdateWGPeer handles PATCH /clusters/{clusterID}/wireguard/{routerID}/{name}/peers/{peerID}.
func (h *Handler) UpdateWGPeer(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")
	routerID := chi.URLParam(r, "routerID")
	name := chi.URLParam(r, "name")
	peerID := chi.URLParam(r, "peerID")
	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid token")
		return
	}

	var req UpdateWGPeerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	wg, err := h.service.UpdateWGPeer(r.Context(), tenantID, claims.UserID, clusterID, routerID, name, peerID, req)
	if err != nil {
		writeError(w, http.StatusBadRequest, "update_error", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, wg)
}

// DeleteWGPeer handles DELETE /clusters/{clusterID}/wireguard/{routerID}/{name}/peers/{peerID}.
func (h *Handler) DeleteWGPeer(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")
	routerID := chi.URLParam(r, "routerID")
	name := chi.URLParam(r, "name")
	peerID := chi.URLParam(r, "peerID")
	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid token")
		return
	}

	if err := h.service.DeleteWGPeer(r.Context(), tenantID, claims.UserID, clusterID, routerID, name, peerID); err != nil {
		writeError(w, http.StatusBadRequest, "delete_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// --- helpers ---

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

- [ ] **Step 2: Wire up the tunnel service and routes in main.go**

In `backend/cmd/server/main.go`, add the tunnel import and service instantiation after the proxy handler:

```go
// Add import:
"github.com/pobradovic08/kormos/backend/internal/tunnel"

// After proxyHandler line, add:
tunnelService := tunnel.NewService(routerService, clusterService, operationService)
tunnelHandler := tunnel.NewHandler(tunnelService)
```

Add the cluster-scoped tunnel routes inside the `/api` protected route block, after the clusters routes:

```go
// Inside the /api/clusters route, after the Delete handler:
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
```

- [ ] **Step 3: Remove old router-scoped tunnel/wireguard proxy routes and handlers**

In `backend/cmd/server/main.go`, remove these lines from the `/api/routers` route block:

```go
// Remove:
r.Get("/{routerID}/tunnels", proxyHandler.Tunnels)
r.Route("/{routerID}/wireguard", func(r chi.Router) {
	r.Get("/", proxyHandler.WireGuardInterfaces)
	r.Get("/peers", proxyHandler.WireGuardPeers)
})
```

In `backend/internal/proxy/handler.go`, remove the `Tunnels`, `WireGuardInterfaces`, and `WireGuardPeers` handler methods.

- [ ] **Step 4: Delete old proxy tunnel and wireguard files**

Delete `backend/internal/proxy/tunnels.go` and `backend/internal/proxy/wireguard.go` since their logic has been moved to the tunnel package.

- [ ] **Step 5: Verify the build compiles**

Run: `cd /Users/pavle/speckit/kormos/backend && go build ./...`
Expected: clean build.

- [ ] **Step 6: Commit**

```bash
git add backend/internal/tunnel/handler.go backend/cmd/server/main.go backend/internal/proxy/handler.go
git rm backend/internal/proxy/tunnels.go backend/internal/proxy/wireguard.go
git commit -m "Add tunnel/wireguard HTTP handlers and register cluster-scoped routes"
```

---

### Task 11: Build & Smoke Test

**Files:** None (verification only)

- [ ] **Step 1: Build the entire backend**

Run: `cd /Users/pavle/speckit/kormos/backend && go build ./...`
Expected: clean build, no errors.

- [ ] **Step 2: Run go vet**

Run: `cd /Users/pavle/speckit/kormos/backend && go vet ./...`
Expected: no issues.

- [ ] **Step 3: Test GRE list endpoint against real routers**

Start the server and curl the GRE list endpoint for an existing cluster:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/clusters/$CLUSTER_ID/tunnels/gre | jq .
```

Expected: JSON array of merged GRE tunnels with `endpoints[]` per router.

- [ ] **Step 4: Test IPsec list endpoint**

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/clusters/$CLUSTER_ID/tunnels/ipsec | jq .
```

Expected: JSON array of assembled IPsec tunnels with phase1/phase2 populated.

- [ ] **Step 5: Test WireGuard list endpoint**

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/clusters/$CLUSTER_ID/wireguard | jq .
```

Expected: JSON array of per-router WireGuard interfaces with peers.

- [ ] **Step 6: Test GRE create**

```bash
curl -s -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "gre-test",
    "mtu": 1476,
    "keepaliveInterval": 10,
    "keepaliveRetries": 10,
    "endpoints": [
      {"routerId": "'$ROUTER1_ID'", "localAddress": "10.0.0.1", "remoteAddress": "192.168.1.1"},
      {"routerId": "'$ROUTER2_ID'", "localAddress": "10.0.0.2", "remoteAddress": "192.168.1.2"}
    ]
  }' \
  http://localhost:8080/api/clusters/$CLUSTER_ID/tunnels/gre | jq .
```

Expected: 201 with merged tunnel response.

- [ ] **Step 7: Test GRE delete (cleanup)**

```bash
curl -s -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/clusters/$CLUSTER_ID/tunnels/gre/gre-test
```

Expected: 204 No Content.

- [ ] **Step 8: Verify in operation history that create and delete were logged**

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/v1/operations/history | jq '.groups[0]'
```

Expected: operation group with GRE operations showing before/after state.
