package operation

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/pobradovic08/kormos/backend/internal/middleware"
)

// Handler provides HTTP handlers for operation endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new operation Handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// Execute handles POST /api/v1/operations/execute.
func (h *Handler) Execute(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid or expired token")
		return
	}

	var req ExecuteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if len(req.Operations) == 0 {
		writeError(w, http.StatusBadRequest, "invalid_request", "At least one operation is required")
		return
	}
	if req.Description == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "Description is required")
		return
	}

	resp, err := h.service.Execute(r.Context(), tenantID, claims.UserID, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "execution_error", err.Error())
		return
	}

	status := http.StatusOK
	if resp.Status == StatusFailed || resp.Status == StatusRequiresAttention {
		status = http.StatusMultiStatus
	}
	writeJSON(w, status, resp)
}

// Undo handles POST /api/v1/operations/undo/{groupID}.
func (h *Handler) Undo(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid or expired token")
		return
	}

	groupID := chi.URLParam(r, "groupID")
	if groupID == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "Group ID is required")
		return
	}

	resp, err := h.service.Undo(r.Context(), tenantID, claims.UserID, claims.Role, groupID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "undo_error", err.Error())
		return
	}

	if resp.Status == StatusUndoBlocked {
		writeJSON(w, http.StatusConflict, resp)
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// History handles GET /api/v1/operations/history.
func (h *Handler) History(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid or expired token")
		return
	}

	filters := HistoryFilters{
		RouterID: r.URL.Query().Get("router_id"),
	}
	if v := r.URL.Query().Get("page"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			filters.Page = n
		}
	}
	if v := r.URL.Query().Get("per_page"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			filters.PerPage = n
		}
	}

	groups, total, err := h.service.ListHistory(r.Context(), tenantID, filters)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to list operation history")
		return
	}

	if groups == nil {
		groups = []Group{}
	}

	// Compute can_undo for each group.
	for i := range groups {
		g := &groups[i]
		g.CanUndo = g.Status == StatusApplied &&
			!g.ExpiresAt.Before(time.Now()) &&
			(g.UserID == claims.UserID || claims.Role == "owner" || claims.Role == "admin")
	}

	writeJSON(w, http.StatusOK, HistoryResponse{
		Groups: groups,
		Total:  total,
	})
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
