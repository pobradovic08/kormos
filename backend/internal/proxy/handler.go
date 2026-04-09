package proxy

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/pobradovic08/kormos/backend/internal/middleware"
	"github.com/pobradovic08/kormos/backend/internal/router"
	"github.com/pobradovic08/kormos/backend/internal/routeros"
)

// rawGRETunnel is a local copy of the RouterOS GRE tunnel shape used only by the Tunnels handler.
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

func fetchGRETunnels(ctx context.Context, client *routeros.Client) ([]rawGRETunnel, error) {
	body, err := client.Get(ctx, "/interface/gre")
	if err != nil {
		return nil, fmt.Errorf("proxy: fetch gre tunnels: %w", err)
	}
	var raw []rawGRETunnel
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("proxy: parse gre tunnels: %w", err)
	}
	return raw, nil
}

// RouterOS IDs are hex strings prefixed with * (e.g., *1, *A, *80000001).
var routerOSIDPattern = regexp.MustCompile(`^\*[0-9a-fA-F]+$`)

func isValidRouterOSID(id string) bool {
	return routerOSIDPattern.MatchString(id)
}

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
	if !isValidRouterOSID(routeID) {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid route ID format")
		return
	}
	route, err := FetchRoute(r.Context(), client, routeID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", "Failed to fetch route")
		return
	}
	writeJSON(w, http.StatusOK, route)
}

// CreateRoute handles POST /routers/{routerID}/routes.
func (h *Handler) CreateRoute(w http.ResponseWriter, r *http.Request) {
	client, err := h.getClient(r)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", "Failed to connect to router")
		return
	}
	var req CreateRouteRequest
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
	route, err := CreateRoute(r.Context(), client, req)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", "Failed to create route")
		return
	}
	writeJSON(w, http.StatusCreated, route)
}

// UpdateRoute handles PATCH /routers/{routerID}/routes/{routeID}.
func (h *Handler) UpdateRoute(w http.ResponseWriter, r *http.Request) {
	client, err := h.getClient(r)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", "Failed to connect to router")
		return
	}
	routeID := chi.URLParam(r, "routeID")
	if !isValidRouterOSID(routeID) {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid route ID format")
		return
	}
	var req UpdateRouteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}
	if err := UpdateRoute(r.Context(), client, routeID, req); err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", "Failed to update route")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// DeleteRoute handles DELETE /routers/{routerID}/routes/{routeID}.
func (h *Handler) DeleteRoute(w http.ResponseWriter, r *http.Request) {
	client, err := h.getClient(r)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", "Failed to connect to router")
		return
	}
	routeID := chi.URLParam(r, "routeID")
	if !isValidRouterOSID(routeID) {
		writeError(w, http.StatusBadRequest, "invalid_id", "Invalid route ID format")
		return
	}
	if err := DeleteRoute(r.Context(), client, routeID); err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", "Failed to delete route")
		return
	}
	w.WriteHeader(http.StatusNoContent)
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

// Tunnels handles GET /routers/{routerID}/tunnels (legacy shim for frontend compatibility).
func (h *Handler) Tunnels(w http.ResponseWriter, r *http.Request) {
	client, err := h.getClient(r)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", "Failed to connect to router")
		return
	}
	tunnels, err := fetchGRETunnels(r.Context(), client)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", "Failed to fetch tunnels")
		return
	}
	// Normalize to the flat response shape the frontend expects.
	type tunnelResp struct {
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
	result := make([]tunnelResp, 0, len(tunnels))
	for _, raw := range tunnels {
		mtu := parseInt(raw.ActualMTU)
		if mtu == 0 {
			mtu = parseInt(raw.MTU)
		}
		interval, retries := 10, 10
		if raw.Keepalive != "" {
			parts := strings.SplitN(raw.Keepalive, ",", 2)
			if len(parts) >= 1 {
				interval = parseInt(strings.TrimSuffix(strings.TrimSpace(parts[0]), "s"))
			}
			if len(parts) >= 2 {
				retries = parseInt(strings.TrimSpace(parts[1]))
			}
		}
		result = append(result, tunnelResp{
			ID:                raw.ID,
			Name:              raw.Name,
			TunnelType:        "gre",
			LocalAddress:      raw.LocalAddress,
			RemoteAddress:     raw.RemoteAddress,
			MTU:               mtu,
			KeepaliveInterval: interval,
			KeepaliveRetries:  retries,
			IpsecSecret:       raw.IpsecSecret,
			Disabled:          parseBool(raw.Disabled),
			Running:           parseBool(raw.Running),
			Comment:           raw.Comment,
		})
	}
	writeJSON(w, http.StatusOK, result)
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
