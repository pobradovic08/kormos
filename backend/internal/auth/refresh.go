package auth

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"net/http"
	"time"
)

// refreshResponse is the JSON body returned on successful token refresh.
type refreshResponse struct {
	AccessToken string `json:"access_token"`
}

// Refresh implements refresh token rotation. It validates the current refresh
// token from the cookie, revokes it, issues a new refresh token (stored in DB
// with replaced_by pointing to the old one), sets the new cookie, and returns
// a fresh access token.
//
// If a revoked token is presented (reuse detection), ALL tokens for that user
// are revoked and the request is rejected with 401.
func (h *Handler) Refresh(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(refreshTokenCookieName)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "missing_token", "Refresh token cookie not found")
		return
	}

	tokenHash := hashToken(cookie.Value)

	// Look up the refresh token in the database.
	var (
		tokenID   string
		userID    string
		expiresAt time.Time
		revoked   bool
	)

	err = h.pool.QueryRow(r.Context(),
		`SELECT id, user_id, expires_at, revoked
		   FROM refresh_tokens
		  WHERE token_hash = $1`,
		tokenHash,
	).Scan(&tokenID, &userID, &expiresAt, &revoked)
	if err != nil {
		writeError(w, http.StatusUnauthorized, "invalid_token", "Refresh token not found")
		return
	}

	// Reuse detection: if the token has already been revoked, an attacker may
	// have stolen it. Revoke ALL tokens for this user as a precaution.
	if revoked {
		_ = h.revokeAllUserTokens(r.Context(), userID)
		clearRefreshCookie(w)
		writeError(w, http.StatusUnauthorized, "token_reuse", "Token reuse detected; all sessions revoked")
		return
	}

	// Check expiry.
	if time.Now().After(expiresAt) {
		// Mark expired token as revoked for cleanliness.
		_, _ = h.pool.Exec(r.Context(),
			`UPDATE refresh_tokens SET revoked = true WHERE id = $1`,
			tokenID,
		)
		clearRefreshCookie(w)
		writeError(w, http.StatusUnauthorized, "token_expired", "Refresh token has expired")
		return
	}

	// Revoke the current token.
	_, err = h.pool.Exec(r.Context(),
		`UPDATE refresh_tokens SET revoked = true WHERE id = $1`,
		tokenID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to revoke token")
		return
	}

	// Generate a new refresh token.
	rawNewToken, err := generateRefreshToken()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to generate refresh token")
		return
	}

	newTokenHash := hashToken(rawNewToken)
	newExpiresAt := time.Now().Add(h.refreshTTL)

	_, err = h.pool.Exec(r.Context(),
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at, replaced_by)
		 VALUES ($1, $2, $3, $4)`,
		userID, newTokenHash, newExpiresAt, tokenID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to store refresh token")
		return
	}

	// Fetch user details needed for the new access token.
	var (
		tenantID string
		role     string
		email    string
	)

	err = h.pool.QueryRow(r.Context(),
		`SELECT tenant_id, role, email FROM users WHERE id = $1`,
		userID,
	).Scan(&tenantID, &role, &email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to look up user")
		return
	}

	// Generate a new access token.
	accessToken, err := GenerateAccessToken(userID, tenantID, role, email, h.jwtSecret, h.accessTTL)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "server_error", "Failed to generate access token")
		return
	}

	// Set the new refresh token cookie.
	http.SetCookie(w, &http.Cookie{
		Name:     refreshTokenCookieName,
		Value:    rawNewToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
		Expires:  newExpiresAt,
	})

	writeJSON(w, http.StatusOK, refreshResponse{
		AccessToken: accessToken,
	})
}

// generateRefreshToken produces a cryptographically random 32-byte token
// encoded as a URL-safe base64 string (no padding).
func generateRefreshToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("auth: generate refresh token: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// clearRefreshCookie removes the refresh token cookie from the client.
func clearRefreshCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     refreshTokenCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   -1,
	})
}
