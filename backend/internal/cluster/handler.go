package cluster

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/pobradovic08/kormos/backend/internal/middleware"
)

// Handler provides HTTP handlers for the cluster management API.
type Handler struct {
	service *Service
}

// NewHandler creates a new cluster Handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// List handles GET /api/clusters and returns all clusters for the current tenant.
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

// Create handles POST /api/clusters and creates a new cluster.
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

// GetByID handles GET /api/clusters/{clusterID} and returns a single cluster.
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

// Update handles PUT /api/clusters/{clusterID} and updates an existing cluster.
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
	if resp == nil {
		writeError(w, http.StatusNotFound, "not_found", "Cluster not found")
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// Delete handles DELETE /api/clusters/{clusterID} and removes a cluster.
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	clusterID := chi.URLParam(r, "clusterID")

	err := h.service.Delete(r.Context(), tenantID, clusterID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to delete cluster")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// TestConnection handles POST /api/clusters/test-connection and checks RouterOS connectivity.
func (h *Handler) TestConnection(w http.ResponseWriter, r *http.Request) {
	var req TestConnectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	resp, err := h.service.TestConnection(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to test connection")
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
