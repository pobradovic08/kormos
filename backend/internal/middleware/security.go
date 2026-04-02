package middleware

import (
	"net/http"
)

// SecurityHeaders returns a chi-compatible middleware that sets standard
// security headers on every response. These headers help mitigate common
// web security risks including XSS, clickjacking, MIME-type sniffing,
// and downgrade attacks.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()

		// Content-Security-Policy restricts resource loading to same-origin
		// with exceptions for inline styles (required by Mantine) and
		// Google Fonts for font loading.
		h.Set("Content-Security-Policy",
			"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' fonts.gstatic.com; connect-src 'self'")

		// Prevent browsers from MIME-sniffing a response away from the
		// declared Content-Type.
		h.Set("X-Content-Type-Options", "nosniff")

		// Prevent the page from being rendered inside a frame or iframe,
		// mitigating clickjacking attacks.
		h.Set("X-Frame-Options", "DENY")

		// Enable the browser's built-in XSS filter and instruct it to
		// block the page if an attack is detected.
		h.Set("X-XSS-Protection", "1; mode=block")

		// Enforce HTTPS for the domain and all subdomains for one year.
		h.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")

		// Only send the origin (not the full URL) as referrer when
		// navigating cross-origin, preserving privacy while allowing
		// basic analytics.
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")

		next.ServeHTTP(w, r)
	})
}
