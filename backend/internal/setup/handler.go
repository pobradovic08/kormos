package setup

import (
	"encoding/json"
	"net/http"
	"time"
)

// Handler provides HTTP handlers for the setup wizard and portal settings.
type Handler struct {
	service *Service
}

// NewHandler creates a new setup Handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// statusResponse is the JSON body for the GET /api/setup/status endpoint.
type statusResponse struct {
	SetupComplete bool `json:"setup_complete"`
}

// Status handles GET /api/setup/status and reports whether initial setup has
// been completed.
func (h *Handler) Status(w http.ResponseWriter, r *http.Request) {
	complete, err := h.service.IsSetupComplete(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to check setup status")
		return
	}
	writeJSON(w, http.StatusOK, statusResponse{SetupComplete: complete})
}

// Complete handles POST /api/setup/complete and performs the initial platform
// setup: creating portal settings, the system tenant, and the first admin user.
func (h *Handler) Complete(w http.ResponseWriter, r *http.Request) {
	var req CompleteSetupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	// Default timezone if not provided.
	if req.Portal.DefaultTimezone == "" {
		req.Portal.DefaultTimezone = "UTC"
	}

	resp, err := h.service.CompleteSetup(r.Context(), req)
	if err != nil {
		// Validation errors.
		if ve, ok := err.(ValidationErrors); ok {
			writeJSON(w, http.StatusUnprocessableEntity, map[string]interface{}{
				"error":  "validation_error",
				"fields": ve,
			})
			return
		}
		// Setup already complete.
		if err.Error() == "setup already complete" {
			writeError(w, http.StatusConflict, "setup_complete", "Setup has already been completed")
			return
		}
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to complete setup")
		return
	}

	// Set refresh token as HttpOnly secure cookie.
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    resp.RefreshToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
		Expires:  time.Now().Add(h.service.refreshTTL),
	})

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"access_token": resp.AccessToken,
		"user":         resp.User,
	})
}

// settingsResponse is the JSON body for portal settings endpoints.
type settingsResponse struct {
	PortalName      string `json:"portal_name"`
	DefaultTimezone string `json:"default_timezone"`
	SupportEmail    string `json:"support_email"`
	CreatedAt       string `json:"created_at"`
	UpdatedAt       string `json:"updated_at"`
}

// updateSettingsRequest is the expected JSON body for the PUT endpoint.
type updateSettingsRequest struct {
	PortalName      string `json:"portal_name"`
	DefaultTimezone string `json:"default_timezone"`
	SupportEmail    string `json:"support_email"`
}

// GetSettings handles GET /api/portal/settings and returns the current portal
// configuration. Requires authentication (handled by the route).
func (h *Handler) GetSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := h.service.repo.Get(r.Context())
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "Portal settings not found")
		return
	}

	writeJSON(w, http.StatusOK, settingsResponse{
		PortalName:      settings.PortalName,
		DefaultTimezone: settings.DefaultTimezone,
		SupportEmail:    settings.SupportEmail,
		CreatedAt:       settings.CreatedAt.Format(time.RFC3339),
		UpdatedAt:       settings.UpdatedAt.Format(time.RFC3339),
	})
}

// UpdateSettings handles PUT /api/portal/settings and updates the portal
// configuration. Requires authentication and owner role on the system tenant
// (handled by the route).
func (h *Handler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	var req updateSettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if req.PortalName == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "Portal name is required")
		return
	}

	settings := &PortalSettings{
		PortalName:      req.PortalName,
		DefaultTimezone: req.DefaultTimezone,
		SupportEmail:    req.SupportEmail,
	}
	if settings.DefaultTimezone == "" {
		settings.DefaultTimezone = "UTC"
	}

	if err := h.service.repo.Update(r.Context(), settings); err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to update settings")
		return
	}

	// Return the updated settings.
	updated, err := h.service.repo.Get(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to fetch updated settings")
		return
	}

	writeJSON(w, http.StatusOK, settingsResponse{
		PortalName:      updated.PortalName,
		DefaultTimezone: updated.DefaultTimezone,
		SupportEmail:    updated.SupportEmail,
		CreatedAt:       updated.CreatedAt.Format(time.RFC3339),
		UpdatedAt:       updated.UpdatedAt.Format(time.RFC3339),
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
