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
