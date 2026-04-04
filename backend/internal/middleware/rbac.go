package middleware

import (
	"net/http"
)

// RequireRole returns a chi-compatible middleware that restricts access to
// requests whose JWT claims contain one of the specified roles. It must be
// placed after the Auth middleware in the middleware chain.
//
// If no claims are found in the context (Auth middleware did not run), it
// responds with 401. If the claims' role is not in the allowed list, it
// responds with 403.
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(roles))
	for _, r := range roles {
		allowed[r] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := GetClaims(r)
			if claims == nil {
				writeJSON(w, http.StatusUnauthorized, map[string]string{
					"error":   "unauthorized",
					"message": "Invalid or expired token",
				})
				return
			}

			if _, ok := allowed[claims.Role]; !ok {
				writeJSON(w, http.StatusForbidden, map[string]string{
					"error":   "forbidden",
					"message": "Insufficient permissions",
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
