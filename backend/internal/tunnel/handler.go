package tunnel

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/pobradovic08/kormos/backend/internal/middleware"
)

// Handler provides HTTP handlers for tunnel and WireGuard management.
type Handler struct {
	service *Service
}

// NewHandler creates a new tunnel Handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// ─── GRE Handlers ─────────────────────────────────────────────────────────────

// ListGRE handles GET /api/clusters/{clusterID}/tunnels/gre.
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

// GetGRE handles GET /api/clusters/{clusterID}/tunnels/gre/{name}.
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

// CreateGRE handles POST /api/clusters/{clusterID}/tunnels/gre.
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
	if req.Name == "" || len(req.Endpoints) == 0 {
		writeError(w, http.StatusBadRequest, "invalid_request", "Name and endpoints are required")
		return
	}

	tunnel, err := h.service.CreateGRE(r.Context(), tenantID, claims.UserID, clusterID, req)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, tunnel)
}

// UpdateGRE handles PATCH /api/clusters/{clusterID}/tunnels/gre/{name}.
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
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, tunnel)
}

// DeleteGRE handles DELETE /api/clusters/{clusterID}/tunnels/gre/{name}.
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
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ─── IPsec Handlers ───────────────────────────────────────────────────────────

// ListIPsec handles GET /api/clusters/{clusterID}/tunnels/ipsec.
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

// GetIPsec handles GET /api/clusters/{clusterID}/tunnels/ipsec/{name}.
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

// CreateIPsec handles POST /api/clusters/{clusterID}/tunnels/ipsec.
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
	if req.Name == "" || len(req.Endpoints) == 0 {
		writeError(w, http.StatusBadRequest, "invalid_request", "Name and endpoints are required")
		return
	}

	tunnel, err := h.service.CreateIPsec(r.Context(), tenantID, claims.UserID, clusterID, req)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, tunnel)
}

// UpdateIPsec handles PATCH /api/clusters/{clusterID}/tunnels/ipsec/{name}.
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
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, tunnel)
}

// DeleteIPsec handles DELETE /api/clusters/{clusterID}/tunnels/ipsec/{name}.
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
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ─── WireGuard Handlers ───────────────────────────────────────────────────────

// ListWireGuard handles GET /api/clusters/{clusterID}/wireguard.
func (h *Handler) ListWireGuard(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")

	wgs, err := h.service.ListWireGuard(r.Context(), tenantID, clusterID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	if wgs == nil {
		wgs = []RouterWireGuard{}
	}
	writeJSON(w, http.StatusOK, wgs)
}

// GetWireGuard handles GET /api/clusters/{clusterID}/wireguard/{routerID}/{name}.
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

// CreateWGInterface handles POST /api/clusters/{clusterID}/wireguard.
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
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, wg)
}

// UpdateWGInterface handles PATCH /api/clusters/{clusterID}/wireguard/{routerID}/{name}.
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
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, wg)
}

// DeleteWGInterface handles DELETE /api/clusters/{clusterID}/wireguard/{routerID}/{name}.
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
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// CreateWGPeer handles POST /api/clusters/{clusterID}/wireguard/{routerID}/{name}/peers.
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
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, wg)
}

// UpdateWGPeer handles PATCH /api/clusters/{clusterID}/wireguard/{routerID}/{name}/peers/{peerID}.
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
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, wg)
}

// DeleteWGPeer handles DELETE /api/clusters/{clusterID}/wireguard/{routerID}/{name}/peers/{peerID}.
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
		writeError(w, http.StatusBadGateway, "routeros_error", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
