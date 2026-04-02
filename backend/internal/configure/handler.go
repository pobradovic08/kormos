package configure

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/pobradovic08/kormos/backend/internal/audit"
	"github.com/pobradovic08/kormos/backend/internal/middleware"
	"github.com/pobradovic08/kormos/backend/internal/router"
)

// ConfigureRequest is the JSON body accepted by the Configure endpoint.
type ConfigureRequest struct {
	Operations    []Operation `json:"operations"`
	CommitMessage string      `json:"commit_message"`
}

// ConfigureResponse wraps the commit result with the audit log entry ID.
type ConfigureResponse struct {
	*CommitResult
	AuditID string `json:"audit_id"`
}

// Handler provides the HTTP handler for the configure endpoint.
type Handler struct {
	engine    *Engine
	routerSvc *router.Service
	auditRepo *audit.Repository
	pool      *pgxpool.Pool
}

// NewHandler creates a new configure Handler.
func NewHandler(engine *Engine, routerSvc *router.Service, auditRepo *audit.Repository, pool *pgxpool.Pool) *Handler {
	return &Handler{
		engine:    engine,
		routerSvc: routerSvc,
		auditRepo: auditRepo,
		pool:      pool,
	}
}

// Configure handles POST /api/routers/{routerID}/configure. It applies the
// provided operations to the target RouterOS device in dependency order and
// records an audit log entry.
func (h *Handler) Configure(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	routerID := chi.URLParam(r, "routerID")
	claims := middleware.GetClaims(r)
	if claims == nil {
		writeError(w, http.StatusUnauthorized, "unauthorized", "Invalid or expired token")
		return
	}

	var req ConfigureRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if len(req.Operations) == 0 {
		writeError(w, http.StatusBadRequest, "invalid_request", "At least one operation is required")
		return
	}

	// Obtain a RouterOS client for the target device.
	client, err := h.routerSvc.GetClientForRouter(r.Context(), tenantID, routerID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			writeError(w, http.StatusNotFound, "not_found", "Router not found")
			return
		}
		writeError(w, http.StatusServiceUnavailable, "router_unreachable", "Unable to connect to router")
		return
	}

	// Sort operations in dependency order and execute them.
	sorted := SortOperations(req.Operations)
	result := h.engine.Execute(r.Context(), client, sorted)

	// Derive a module name from the operations for the audit entry.
	module := deriveModule(req.Operations)

	// Serialise operations and results for storage.
	opsJSON, _ := json.Marshal(req.Operations)
	var errorDetails string
	if result.Status != "success" {
		errParts := make([]string, 0)
		for _, res := range result.Results {
			if res.Error != "" {
				errParts = append(errParts, res.Error)
			}
		}
		errorDetails = strings.Join(errParts, "; ")
	}

	entry := &audit.Entry{
		TenantID:      tenantID,
		RouterID:      routerID,
		UserID:        claims.UserID,
		Module:        module,
		Action:        "configure",
		Operations:    string(opsJSON),
		CommitMessage: req.CommitMessage,
		Status:        result.Status,
		ErrorDetails:  errorDetails,
	}

	if createErr := h.auditRepo.Create(r.Context(), entry); createErr != nil {
		// Log the error but still return the commit result to the caller.
		// The configuration was already applied to the device.
	}

	resp := ConfigureResponse{
		CommitResult: result,
		AuditID:      entry.ID,
	}

	switch result.Status {
	case "success":
		writeJSON(w, http.StatusOK, resp)
	case "partial":
		writeJSON(w, http.StatusMultiStatus, resp)
	default:
		writeJSON(w, http.StatusOK, resp)
	}
}

// AuditList handles GET /api/audit-log and returns paginated audit entries.
func (h *Handler) AuditList(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)

	filters := audit.ListFilters{
		RouterID: r.URL.Query().Get("router_id"),
		UserID:   r.URL.Query().Get("user_id"),
		Module:   r.URL.Query().Get("module"),
	}

	if v := r.URL.Query().Get("from_date"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			filters.FromDate = &t
		}
	}
	if v := r.URL.Query().Get("to_date"); v != "" {
		if t, err := time.Parse(time.RFC3339, v); err == nil {
			filters.ToDate = &t
		}
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

	entries, total, err := h.auditRepo.List(r.Context(), tenantID, filters)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to list audit log")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"data":     entries,
		"total":    total,
		"page":     filters.Page,
		"per_page": filters.PerPage,
	})
}

// deriveModule inspects the operations to produce a short module label for the
// audit entry (e.g., "interface/vlan" or "mixed").
func deriveModule(ops []Operation) string {
	if len(ops) == 0 {
		return "unknown"
	}
	if len(ops) == 1 {
		if ops[0].Module != "" {
			return ops[0].Module
		}
		return extractResourceType(ops[0].ResourcePath)
	}

	// Check if all operations share the same module.
	first := ops[0].Module
	if first == "" {
		first = extractResourceType(ops[0].ResourcePath)
	}
	for _, op := range ops[1:] {
		m := op.Module
		if m == "" {
			m = extractResourceType(op.ResourcePath)
		}
		if m != first {
			return "mixed"
		}
	}
	return first
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
