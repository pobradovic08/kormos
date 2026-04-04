package middleware

import (
	"net/http"
	"strings"
	"sync/atomic"

	"github.com/pobradovic08/kormos/backend/internal/setup"
)

// SetupGuard returns a chi-compatible middleware that blocks all non-setup API
// requests until initial platform setup has been completed.
//
// Once setup is detected as complete, the result is cached permanently (setup
// completion is a one-way transition) using an atomic bool so subsequent
// requests skip the database check.
func SetupGuard(setupRepo *setup.Repository) func(http.Handler) http.Handler {
	var setupDone atomic.Bool

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Fast path: once setup is complete, never check again.
			if setupDone.Load() {
				next.ServeHTTP(w, r)
				return
			}

			// Allow setup routes through unconditionally.
			if strings.HasPrefix(r.URL.Path, "/api/setup") {
				next.ServeHTTP(w, r)
				return
			}

			// Check the database.
			complete, err := setupRepo.IsSetupComplete(r.Context())
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{
					"error":   "server_error",
					"message": "Failed to check setup status",
				})
				return
			}

			if !complete {
				writeJSON(w, http.StatusServiceUnavailable, map[string]interface{}{
					"error":     "setup_required",
					"message":   "Initial setup has not been completed",
					"setup_url": "/setup",
				})
				return
			}

			// Setup is complete — cache the result permanently.
			setupDone.Store(true)
			next.ServeHTTP(w, r)
		})
	}
}
