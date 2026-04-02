package middleware

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

// RequireSuperAdmin returns a chi-compatible middleware that restricts access
// to superadmin users. A user is considered a superadmin if:
//   - their email is "admin@localhost", OR
//   - they belong to a tenant with slug "system" AND have the role "owner"
//
// This middleware does NOT set a tenant scope — superadmin operates across tenants.
// It must be placed after the Auth middleware in the chain.
func RequireSuperAdmin(pool *pgxpool.Pool) func(http.Handler) http.Handler {
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

			// Fast path: check if the email is admin@localhost.
			if claims.Email == "admin@localhost" {
				next.ServeHTTP(w, r)
				return
			}

			// Check if the user belongs to the "system" tenant and has the "owner" role.
			if claims.Role == "owner" && claims.TenantID != "" {
				var slug string
				err := pool.QueryRow(r.Context(),
					`SELECT slug FROM tenants WHERE id = $1`,
					claims.TenantID,
				).Scan(&slug)
				if err == nil && slug == "system" {
					next.ServeHTTP(w, r)
					return
				}
			}

			writeJSON(w, http.StatusForbidden, map[string]string{
				"error":   "forbidden",
				"message": "Superadmin access required",
			})
		})
	}
}
