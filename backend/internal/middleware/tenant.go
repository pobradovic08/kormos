package middleware

import (
	"context"
	"fmt"
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
)

// TenantIDKey is the context key under which the current tenant ID is stored.
const TenantIDKey contextKey = "tenant_id"

// TenantScope returns a chi-compatible middleware that extracts the tenant ID
// from the authenticated claims and stores it in the request context under
// TenantIDKey. It must be placed after the Auth middleware in the chain.
func TenantScope() func(http.Handler) http.Handler {
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

			if claims.TenantID == "" {
				writeJSON(w, http.StatusForbidden, map[string]string{
					"error":   "forbidden",
					"message": "No tenant association",
				})
				return
			}

			ctx := context.WithValue(r.Context(), TenantIDKey, claims.TenantID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetTenantID extracts the tenant ID from the request context.
// It returns an empty string if TenantScope middleware has not run.
func GetTenantID(r *http.Request) string {
	tid, _ := r.Context().Value(TenantIDKey).(string)
	return tid
}

// WithTenantScope acquires a connection from pool, sets the PostgreSQL
// session variable app.current_tenant_id to tenantID within a transaction-
// local scope, and then invokes fn with that connection. The SET LOCAL
// ensures the tenant scope is automatically cleared when the surrounding
// transaction ends.
//
// Callers are expected to begin a transaction on the connection inside fn
// for SET LOCAL to be meaningful, or use the connection for a single
// statement where the session variable is read by an RLS policy.
func WithTenantScope(ctx context.Context, pool *pgxpool.Pool, tenantID string, fn func(conn *pgxpool.Conn) error) error {
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire connection: %w", err)
	}
	defer conn.Release()

	// SET LOCAL is scoped to the current transaction. We start a transaction,
	// set the variable, call the user function, then commit.
	tx, err := conn.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// Use a parameterised-style safe interpolation. SET LOCAL does not support
	// $1 placeholders, so we use fmt.Sprintf with the value quoted to prevent
	// SQL injection. Tenant IDs are UUIDs validated upstream, but we still
	// quote conservatively.
	setSQL := fmt.Sprintf("SET LOCAL app.current_tenant_id = '%s'", sanitizeTenantID(tenantID))
	if _, err := tx.Exec(ctx, setSQL); err != nil {
		return fmt.Errorf("set tenant scope: %w", err)
	}

	if err := fn(conn); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}

// sanitizeTenantID strips any characters that are not alphanumeric or hyphens,
// protecting against SQL injection in the SET LOCAL statement.
func sanitizeTenantID(id string) string {
	buf := make([]byte, 0, len(id))
	for i := 0; i < len(id); i++ {
		c := id[i]
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' {
			buf = append(buf, c)
		}
	}
	return string(buf)
}
