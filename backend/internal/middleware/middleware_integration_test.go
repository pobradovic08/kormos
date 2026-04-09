//go:build integration

package middleware_test

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/pobradovic08/kormos/backend/internal/auth"
	"github.com/pobradovic08/kormos/backend/internal/middleware"
	"github.com/pobradovic08/kormos/backend/internal/testutil"
)

var tc *testutil.TestContext

func TestMain(m *testing.M) {
	pool, err := testutil.SetupTestDB()
	if err != nil {
		panic("setup db: " + err.Error())
	}

	tc, err = testutil.SeedTestData(pool)
	if err != nil {
		panic("seed data: " + err.Error())
	}

	tc.Server = testutil.NewTestServer(pool, tc)
	defer tc.Server.Close()

	code := m.Run()

	testutil.CleanupTestDB(pool)
	os.Exit(code)
}

func TestAuth_NoToken(t *testing.T) {
	resp, respBody := testutil.DoRequest(tc.Server, "GET", "/api/users", nil, "")

	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	if result["error"] != "unauthorized" {
		t.Fatalf("expected error 'unauthorized', got %v", result["error"])
	}
}

func TestAuth_InvalidToken(t *testing.T) {
	resp, _ := testutil.DoRequest(tc.Server, "GET", "/api/users", nil, "garbage-token-value")

	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

func TestAuth_ExpiredToken(t *testing.T) {
	expiredToken := testutil.GenerateExpiredToken(tc)

	resp, _ := testutil.DoRequest(tc.Server, "GET", "/api/users", nil, expiredToken)

	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

func TestTenantScope(t *testing.T) {
	// A valid token should allow access to tenant-scoped endpoints.
	resp, _ := testutil.DoRequest(tc.Server, "GET", "/api/clusters", nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}

func TestRequireRole_Allowed(t *testing.T) {
	// Owner accessing owner-required endpoint.
	body := map[string]string{
		"portal_name":      "Role Test Portal",
		"default_timezone": "UTC",
		"support_email":    "role@test.local",
	}

	resp, _ := testutil.DoRequest(tc.Server, "PUT", "/api/portal/settings", body, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}

func TestRequireRole_Denied(t *testing.T) {
	// Viewer accessing owner-required endpoint.
	viewerToken := testutil.GenerateTokenForRole(tc, "viewer")

	body := map[string]string{
		"portal_name":      "Hacked",
		"default_timezone": "UTC",
		"support_email":    "hacked@test.local",
	}

	resp, _ := testutil.DoRequest(tc.Server, "PUT", "/api/portal/settings", body, viewerToken)

	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
}

func TestRateLimit(t *testing.T) {
	// Create a user with operator role.
	createBody := map[string]string{
		"email":    "ratelimit@test.local",
		"name":     "Rate Limit User",
		"password": "RateLimit123",
		"role":     "operator",
	}
	_, userResp := testutil.DoRequest(tc.Server, "POST", "/api/users", createBody, tc.Token)
	var created map[string]interface{}
	if err := json.Unmarshal(userResp, &created); err != nil {
		t.Fatalf("unmarshal create user response: %v\nbody: %s", err, string(userResp))
	}
	ratelimitUserID := created["id"].(string)

	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", "/api/users/"+ratelimitUserID, nil, tc.Token)
	})

	ratelimitToken, _ := auth.GenerateAccessToken(ratelimitUserID, tc.TenantID, "operator", "ratelimit@test.local", testutil.TestJWTSecret, 1*time.Hour)

	// The default rate limit is 10000/min on the test server.
	// Send a few requests to verify they succeed (no 429).
	for i := 0; i < 5; i++ {
		resp, _ := testutil.DoRequest(tc.Server, "GET", "/api/clusters", nil, ratelimitToken)
		if resp.StatusCode == http.StatusTooManyRequests {
			// With 10000/min limit, this should not happen with just 5 requests.
			t.Fatal("rate limited after only 5 requests with 10000/min limit")
		}
	}

	t.Log("Rate limiting basic validation passed (no false 429s)")
}

func TestRateLimit_Triggered(t *testing.T) {
	// Build a minimal router with Auth + a very low rate limit (3 req/min).
	// This allows us to verify that the 4th request gets 429 without touching
	// the shared test server's high-limit configuration.
	r := chi.NewRouter()
	r.Use(middleware.Auth(testutil.TestJWTSecret))
	r.Use(middleware.RateLimit(3, time.Minute))
	r.Get("/ping", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	srv := httptest.NewServer(r)
	defer srv.Close()

	doReq := func() *http.Response {
		req, err := http.NewRequest(http.MethodGet, srv.URL+"/ping", nil)
		if err != nil {
			t.Fatalf("create request: %v", err)
		}
		req.Header.Set("Authorization", "Bearer "+tc.Token)
		// Discard body to avoid resource leaks.
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("do request: %v", err)
		}
		io.Copy(bytes.NewBuffer(nil), resp.Body)
		resp.Body.Close()
		return resp
	}

	// First 3 requests should succeed.
	for i := 1; i <= 3; i++ {
		resp := doReq()
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("request %d: expected 200, got %d", i, resp.StatusCode)
		}
	}

	// 4th request must be rate-limited.
	resp := doReq()
	if resp.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("expected 429 on 4th request, got %d", resp.StatusCode)
	}
}
