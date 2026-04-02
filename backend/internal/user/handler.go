package user

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/pobradovic08/kormos/backend/internal/middleware"
)

// Handler provides HTTP handlers for the user management API.
type Handler struct {
	service *Service
}

// NewHandler creates a new user Handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// List handles GET /api/users and returns all users for the current tenant.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)

	users, err := h.service.List(r.Context(), tenantID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to list users")
		return
	}

	writeJSON(w, http.StatusOK, users)
}

// Create handles POST /api/users and creates a new user.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)

	var req CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if req.Email == "" || req.Name == "" || req.Password == "" || req.Role == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "Email, name, password, and role are required")
		return
	}

	resp, err := h.service.Create(r.Context(), tenantID, req)
	if err != nil {
		msg := err.Error()
		if strings.Contains(msg, "invalid role") {
			writeError(w, http.StatusBadRequest, "invalid_request", msg)
			return
		}
		if strings.Contains(msg, "duplicate key") || strings.Contains(msg, "unique") {
			writeError(w, http.StatusConflict, "conflict", "A user with this email already exists")
			return
		}
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to create user")
		return
	}

	writeJSON(w, http.StatusCreated, resp)
}

// Update handles PUT /api/users/{userID} and updates a user.
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	userID := chi.URLParam(r, "userID")

	var req UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	resp, err := h.service.Update(r.Context(), tenantID, userID, req)
	if err != nil {
		msg := err.Error()
		if strings.Contains(msg, "not found") {
			writeError(w, http.StatusNotFound, "not_found", "User not found")
			return
		}
		if strings.Contains(msg, "invalid role") {
			writeError(w, http.StatusBadRequest, "invalid_request", msg)
			return
		}
		if strings.Contains(msg, "cannot demote the last owner") {
			writeError(w, http.StatusConflict, "conflict", "Cannot demote the last owner")
			return
		}
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to update user")
		return
	}

	writeJSON(w, http.StatusOK, resp)
}

// Delete handles DELETE /api/users/{userID} and removes a user.
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	userID := chi.URLParam(r, "userID")

	err := h.service.Delete(r.Context(), tenantID, userID)
	if err != nil {
		msg := err.Error()
		if strings.Contains(msg, "not found") {
			writeError(w, http.StatusNotFound, "not_found", "User not found")
			return
		}
		if strings.Contains(msg, "cannot delete the last owner") {
			writeError(w, http.StatusConflict, "conflict", "Cannot delete the last owner")
			return
		}
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to delete user")
		return
	}

	w.WriteHeader(http.StatusNoContent)
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
