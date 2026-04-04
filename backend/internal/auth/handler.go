package auth

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

const refreshTokenCookieName = "refresh_token"

// Handler provides HTTP handlers for authentication endpoints.
type Handler struct {
	pool          *pgxpool.Pool
	jwtSecret     string
	accessTTL     time.Duration
	refreshTTL    time.Duration
	encryptionKey string
}

// NewHandler creates a new auth Handler with the given dependencies.
func NewHandler(pool *pgxpool.Pool, jwtSecret string, accessTTL, refreshTTL time.Duration, encryptionKey string) *Handler {
	return &Handler{
		pool:          pool,
		jwtSecret:     jwtSecret,
		accessTTL:     accessTTL,
		refreshTTL:    refreshTTL,
		encryptionKey: encryptionKey,
	}
}

// loginRequest is the expected JSON body for the Login endpoint.
type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// loginResponse is the JSON response returned on successful login.
type loginResponse struct {
	AccessToken string       `json:"access_token"`
	User        userResponse `json:"user"`
}

type userResponse struct {
	ID     string         `json:"id"`
	Email  string         `json:"email"`
	Name   string         `json:"name"`
	Role   string         `json:"role"`
	Tenant tenantResponse `json:"tenant"`
}

type tenantResponse struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

// Login authenticates a user with email and password, returning an access token
// in the response body and setting a refresh token as an HttpOnly cookie.
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "invalid_request", "Email and password are required")
		return
	}

	// Query user by email, joining with tenants to get tenant details.
	var (
		userID       string
		tenantID     string
		email        string
		passwordHash string
		name         string
		role         string
		isActive     bool
		tenantName   string
		tenantSlug   string
	)

	err := h.pool.QueryRow(r.Context(),
		`SELECT u.id, u.tenant_id, u.email, u.password_hash, u.name, u.role, u.is_active,
		        t.name, t.slug
		   FROM users u
		   JOIN tenants t ON t.id = u.tenant_id
		  WHERE u.email = $1`,
		req.Email,
	).Scan(&userID, &tenantID, &email, &passwordHash, &name, &role, &isActive, &tenantName, &tenantSlug)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "Invalid email or password")
		return
	}

	if !isActive {
		writeError(w, http.StatusUnauthorized, "account_disabled", "Account is disabled")
		return
	}

	// Verify the bcrypt password hash.
	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(req.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "invalid_credentials", "Invalid email or password")
		return
	}

	// Generate access token.
	accessToken, err := GenerateAccessToken(userID, tenantID, role, email, h.jwtSecret, h.accessTTL)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to generate access token")
		return
	}

	// Create and store refresh token.
	rawRefreshToken, err := generateRefreshToken()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to generate refresh token")
		return
	}

	tokenHash := hashToken(rawRefreshToken)
	expiresAt := time.Now().Add(h.refreshTTL)

	_, err = h.pool.Exec(r.Context(),
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
		 VALUES ($1, $2, $3)`,
		userID, tokenHash, expiresAt,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to store refresh token")
		return
	}

	// Update last_login timestamp.
	_, _ = h.pool.Exec(r.Context(),
		`UPDATE users SET last_login = now() WHERE id = $1`,
		userID,
	)

	// Set refresh token as HttpOnly secure cookie.
	http.SetCookie(w, &http.Cookie{
		Name:     refreshTokenCookieName,
		Value:    rawRefreshToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
		Expires:  expiresAt,
	})

	writeJSON(w, http.StatusOK, loginResponse{
		AccessToken: accessToken,
		User: userResponse{
			ID:    userID,
			Email: email,
			Name:  name,
			Role:  role,
			Tenant: tenantResponse{
				ID:   tenantID,
				Name: tenantName,
				Slug: tenantSlug,
			},
		},
	})
}

// Logout revokes the current refresh token and clears the cookie.
func (h *Handler) Logout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(refreshTokenCookieName)
	if err != nil {
		// No cookie present; nothing to revoke.
		w.WriteHeader(http.StatusNoContent)
		return
	}

	tokenHash := hashToken(cookie.Value)

	// Mark the refresh token as revoked in the database.
	_, _ = h.pool.Exec(r.Context(),
		`UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1`,
		tokenHash,
	)

	// Clear the cookie.
	http.SetCookie(w, &http.Cookie{
		Name:     refreshTokenCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   -1,
	})

	w.WriteHeader(http.StatusNoContent)
}

// revokeAllUserTokens revokes every refresh token belonging to the given user.
func (h *Handler) revokeAllUserTokens(ctx context.Context, userID string) error {
	_, err := h.pool.Exec(ctx,
		`UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND revoked = false`,
		userID,
	)
	return err
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

// hashToken returns the hex-encoded SHA-256 hash of a token string.
func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return fmt.Sprintf("%x", h)
}
