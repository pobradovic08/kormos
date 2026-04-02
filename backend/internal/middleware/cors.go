package middleware

// CORS Configuration
//
// CORS is configured in cmd/server/main.go using github.com/go-chi/cors.
// It uses a strict origin whitelist loaded from the CORS_ORIGINS environment
// variable (comma-separated list of allowed origins) via config.Config.CORSOrigins.
//
// The current configuration:
//   - AllowedOrigins:   cfg.CORSOrigins  (strict whitelist from env)
//   - AllowedMethods:   GET, POST, PUT, DELETE, OPTIONS
//   - AllowedHeaders:   Accept, Authorization, Content-Type
//   - AllowCredentials: true
//   - MaxAge:           300 seconds (5 minutes preflight cache)
//
// No wildcard origins are used. When CORS_ORIGINS is unset, no origins are
// allowed by default, effectively blocking cross-origin requests.
//
// To add a new allowed origin, update the CORS_ORIGINS environment variable
// (e.g., CORS_ORIGINS="https://app.example.com,https://staging.example.com").
