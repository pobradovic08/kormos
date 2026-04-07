package proxy

import (
	"encoding/json"
	"net/http"
	"regexp"

	"github.com/go-chi/chi/v5"

	"github.com/pobradovic08/kormos/backend/internal/middleware"
	"github.com/pobradovic08/kormos/backend/internal/router"
	"github.com/pobradovic08/kormos/backend/internal/routeros"
)

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
