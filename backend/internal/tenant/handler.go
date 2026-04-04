package tenant

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/pobradovic08/kormos/backend/internal/middleware"
)

// Handler provides HTTP handlers for tenant management.
type Handler struct {
	pool *pgxpool.Pool
}

// NewHandler creates a new tenant Handler.
func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{pool: pool}
}

// tenantResponse is the JSON representation of a tenant.
type tenantResponse struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	CreatedAt time.Time `json:"created_at"`
}

// updateRequest is the expected JSON body for the Update endpoint.
type updateRequest struct {
	Name string `json:"name"`
}

// createTenantRequest is the expected JSON body for the CreateTenant endpoint.
type createTenantRequest struct {
	Name  string              `json:"name"`
	Slug  string              `json:"slug"`
	Owner createOwnerRequest  `json:"owner"`
}

// createOwnerRequest is the initial owner embedded in a create-tenant request.
type createOwnerRequest struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Password string `json:"password"`
}

// Get handles GET /api/tenant and returns the current tenant.
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "No tenant context")
		return
	}

	var resp tenantResponse
	err := h.pool.QueryRow(r.Context(),
		`SELECT id, name, slug, created_at FROM tenants WHERE id = $1`,
		tenantID,
	).Scan(&resp.ID, &resp.Name, &resp.Slug, &resp.CreatedAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Tenant not found")
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// Update handles PUT /api/tenant and updates the current tenant's name.
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "No tenant context")
		return
	}

	var req updateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "Name is required")
		return
	}

	var resp tenantResponse
	err := h.pool.QueryRow(r.Context(),
		`UPDATE tenants SET name = $1 WHERE id = $2
		 RETURNING id, name, slug, created_at`,
		req.Name, tenantID,
	).Scan(&resp.ID, &resp.Name, &resp.Slug, &resp.CreatedAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to update tenant")
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// ListAll handles GET /api/admin/tenants and returns all tenants (superadmin only).
func (h *Handler) ListAll(w http.ResponseWriter, r *http.Request) {
	rows, err := h.pool.Query(r.Context(),
		`SELECT id, name, slug, created_at FROM tenants ORDER BY created_at`)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to list tenants")
		return
	}
	defer rows.Close()

	tenants := make([]tenantResponse, 0)
	for rows.Next() {
		var t tenantResponse
		if err := rows.Scan(&t.ID, &t.Name, &t.Slug, &t.CreatedAt); err != nil {
			writeError(w, http.StatusInternalServerError, "server_error", "Failed to scan tenant")
			return
		}
		tenants = append(tenants, t)
	}
	if err := rows.Err(); err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to iterate tenants")
		return
	}

	writeJSON(w, http.StatusOK, tenants)
}

// CreateTenant handles POST /api/admin/tenants and creates a new tenant with
// an initial owner user (superadmin only).
func (h *Handler) CreateTenant(w http.ResponseWriter, r *http.Request) {
	var req createTenantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if req.Name == "" || req.Slug == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "Name and slug are required")
		return
	}
	if req.Owner.Email == "" || req.Owner.Password == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "Owner email and password are required")
		return
	}
	if req.Owner.Name == "" {
		req.Owner.Name = req.Owner.Email
	}

	// Hash the owner password.
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Owner.Password), bcrypt.DefaultCost)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to hash password")
		return
	}

	tx, err := h.pool.Begin(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to begin transaction")
		return
	}
	defer tx.Rollback(r.Context()) //nolint:errcheck

	// Create the tenant.
	var tenant tenantResponse
	err = tx.QueryRow(r.Context(),
		`INSERT INTO tenants (name, slug) VALUES ($1, $2)
		 RETURNING id, name, slug, created_at`,
		req.Name, req.Slug,
	).Scan(&tenant.ID, &tenant.Name, &tenant.Slug, &tenant.CreatedAt)
	if err != nil {
		writeError(w, http.StatusConflict, "conflict", "Tenant slug already exists")
		return
	}

	// Create the initial owner user.
	_, err = tx.Exec(r.Context(),
		`INSERT INTO users (tenant_id, email, password_hash, name, role)
		 VALUES ($1, $2, $3, $4, 'owner')`,
		tenant.ID, req.Owner.Email, string(passwordHash), req.Owner.Name,
	)
	if err != nil {
		writeError(w, http.StatusConflict, "conflict", "Owner email already exists")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to commit transaction")
		return
	}

	writeJSON(w, http.StatusCreated, tenant)
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
