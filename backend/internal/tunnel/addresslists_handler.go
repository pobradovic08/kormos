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
