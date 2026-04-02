package middleware

import (
	"net/http"
	"sync"
	"time"
)

// bucket tracks token-bucket state for a single user.
type bucket struct {
	mu       sync.Mutex
	tokens   float64
	maxRate  float64
	last     time.Time
	interval time.Duration // refill interval (e.g., 1 minute)
}

// allow checks whether a request is allowed under the rate limit. It refills
// tokens based on elapsed time since the last request and then attempts to
// consume one token.
func (b *bucket) allow(now time.Time) bool {
	b.mu.Lock()
	defer b.mu.Unlock()

	// Refill tokens based on elapsed time.
	elapsed := now.Sub(b.last)
	b.tokens += b.maxRate * (float64(elapsed) / float64(b.interval))
	if b.tokens > b.maxRate {
		b.tokens = b.maxRate
	}
	b.last = now

	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

// rateLimiter stores per-user buckets.
type rateLimiter struct {
	buckets  sync.Map // map[string]*bucket
	maxRate  float64
	interval time.Duration
}

func newRateLimiter(maxRequests int, interval time.Duration) *rateLimiter {
	return &rateLimiter{
		maxRate:  float64(maxRequests),
		interval: interval,
	}
}

func (rl *rateLimiter) getBucket(userID string) *bucket {
	if v, ok := rl.buckets.Load(userID); ok {
		return v.(*bucket)
	}

	b := &bucket{
		tokens:   rl.maxRate,
		maxRate:  rl.maxRate,
		last:     time.Now(),
		interval: rl.interval,
	}
	actual, _ := rl.buckets.LoadOrStore(userID, b)
	return actual.(*bucket)
}

// RateLimit returns a chi-compatible middleware that enforces an in-memory,
// per-user rate limit using a token-bucket algorithm. The user is identified
// by the UserID field from JWT claims (requires the Auth middleware to run
// first). Unauthenticated requests pass through without rate-limiting.
//
// Default configuration: 100 requests per minute per user.
// When the limit is exceeded, the middleware responds with 429 Too Many Requests.
func RateLimit(maxRequests int, interval time.Duration) func(http.Handler) http.Handler {
	rl := newRateLimiter(maxRequests, interval)

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims := GetClaims(r)
			if claims == nil {
				// No authenticated user — skip rate limiting (Auth middleware
				// will reject the request downstream if needed).
				next.ServeHTTP(w, r)
				return
			}

			b := rl.getBucket(claims.UserID)
			if !b.allow(time.Now()) {
				w.Header().Set("Retry-After", "60")
				writeJSON(w, http.StatusTooManyRequests, map[string]string{
					"error":   "rate_limited",
					"message": "Too many requests. Please try again later.",
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// DefaultRateLimit returns a rate-limit middleware configured with the default
// policy of 100 requests per minute per user.
func DefaultRateLimit() func(http.Handler) http.Handler {
	return RateLimit(100, time.Minute)
}
