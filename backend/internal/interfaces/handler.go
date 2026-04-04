package interfaces

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/pobradovic08/kormos/backend/internal/middleware"
)

// Handler provides HTTP handlers for the interfaces API.
type Handler struct {
	fetcher *Fetcher
}

// NewHandler creates a new interfaces Handler.
func NewHandler(fetcher *Fetcher) *Handler {
	return &Handler{fetcher: fetcher}
}

// List handles GET /api/routers/{routerID}/interfaces and returns all
// interfaces for the specified router.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	routerID := chi.URLParam(r, "routerID")

	ifaces, err := h.fetcher.ListInterfaces(r.Context(), tenantID, routerID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", "Failed to fetch interfaces from router")
		return
	}

	writeJSON(w, http.StatusOK, ifaces)
}

// GetByName handles GET /api/routers/{routerID}/interfaces/{name} and returns
// a single interface by name.
func (h *Handler) GetByName(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	routerID := chi.URLParam(r, "routerID")
	name := chi.URLParam(r, "name")

	iface, err := h.fetcher.GetInterface(r.Context(), tenantID, routerID, name)
	if err != nil {
		writeError(w, http.StatusBadGateway, "routeros_error", "Failed to fetch interface from router")
		return
	}
	if iface == nil {
		writeError(w, http.StatusNotFound, "not_found", "Interface not found")
		return
	}

	writeJSON(w, http.StatusOK, iface)
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
