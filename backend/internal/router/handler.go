package router

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/pobradovic08/kormos/backend/internal/middleware"
)

// Handler provides HTTP handlers for the router management API.
type Handler struct {
	service *Service
}

// NewHandler creates a new router Handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// List handles GET /api/routers and returns all routers for the current tenant.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)

	routers, err := h.service.List(r.Context(), tenantID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to list routers")
		return
	}

	if routers == nil {
		routers = []RouterResponse{}
	}
	writeJSON(w, http.StatusOK, routers)
}

// Create handles POST /api/routers and creates a new router.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)

	var req CreateRouterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if req.Name == "" || req.Host == "" || req.Username == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "Name, host, username, and password are required")
		return
	}
	if req.Port == 0 {
		req.Port = 443
	}

	resp, err := h.service.Create(r.Context(), tenantID, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to create router")
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

// GetByID handles GET /api/routers/{routerID} and returns a single router.
func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	routerID := chi.URLParam(r, "routerID")

	resp, err := h.service.GetByID(r.Context(), tenantID, routerID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to get router")
		return
	}
	if resp == nil {
		writeError(w, http.StatusNotFound, "not_found", "Router not found")
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// Update handles PUT /api/routers/{routerID} and updates an existing router.
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	routerID := chi.URLParam(r, "routerID")

	var req UpdateRouterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	resp, err := h.service.Update(r.Context(), tenantID, routerID, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to update router")
		return
	}
	if resp == nil {
		writeError(w, http.StatusNotFound, "not_found", "Router not found")
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// Delete handles DELETE /api/routers/{routerID} and removes a router.
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	routerID := chi.URLParam(r, "routerID")

	err := h.service.Delete(r.Context(), tenantID, routerID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to delete router")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// CheckStatus handles GET /api/routers/{routerID}/status and performs a live
// reachability check against the RouterOS device.
func (h *Handler) CheckStatus(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	routerID := chi.URLParam(r, "routerID")

	resp, err := h.service.CheckReachability(r.Context(), tenantID, routerID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to check router status")
		return
	}
	if resp == nil {
		writeError(w, http.StatusNotFound, "not_found", "Router not found")
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// writeJSON serialises data as JSON and writes it with the given status code.
func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

// writeError writes a standardised JSON error response.
func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]string{
		"error":   code,
		"message": message,
	})
}
