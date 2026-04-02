package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/pobradovic08/kormos/backend/internal/auth"
)

// contextKey is an unexported type used for context keys in this package,
// preventing collisions with keys defined in other packages.
type contextKey string

// ClaimsKey is the context key under which the authenticated JWT claims are stored.
const ClaimsKey contextKey = "claims"

// Auth returns a chi-compatible middleware that validates Bearer tokens from
// the Authorization header. Valid claims are stored in the request context
// under ClaimsKey. Requests without a valid token receive a 401 JSON response.
func Auth(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if header == "" {
				writeJSON(w, http.StatusUnauthorized, map[string]string{
					"error":   "unauthorized",
					"message": "Invalid or expired token",
				})
				return
			}

			token, found := strings.CutPrefix(header, "Bearer ")
			if !found || token == "" {
				writeJSON(w, http.StatusUnauthorized, map[string]string{
					"error":   "unauthorized",
					"message": "Invalid or expired token",
				})
				return
			}

			claims, err := auth.ValidateAccessToken(token, jwtSecret)
			if err != nil {
				writeJSON(w, http.StatusUnauthorized, map[string]string{
					"error":   "unauthorized",
					"message": "Invalid or expired token",
				})
				return
			}

			ctx := context.WithValue(r.Context(), ClaimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetClaims extracts the authenticated JWT claims from the request context.
// It returns nil if the Auth middleware has not run or no claims are present.
func GetClaims(r *http.Request) *auth.Claims {
	claims, _ := r.Context().Value(ClaimsKey).(*auth.Claims)
	return claims
}

// writeJSON is a small helper that serialises v as JSON and writes it to w
// with the given HTTP status code.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v) //nolint:errcheck
}
