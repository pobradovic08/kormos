//go:build integration

package auth_test

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"

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

func TestLogin_ValidCredentials(t *testing.T) {
	body := map[string]string{
		"email":    testutil.TestUserEmail,
		"password": testutil.TestUserPass,
	}

	resp, respBody := testutil.DoRequest(tc.Server, "POST", "/api/auth/login", body, "")

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}

	if result["access_token"] == nil || result["access_token"] == "" {
		t.Fatal("expected access_token in response")
	}

	userMap, ok := result["user"].(map[string]interface{})
	if !ok {
		t.Fatal("expected user object in response")
	}
	if userMap["email"] != testutil.TestUserEmail {
		t.Fatalf("expected email %s, got %v", testutil.TestUserEmail, userMap["email"])
	}
	if userMap["role"] != "owner" {
		t.Fatalf("expected role owner, got %v", userMap["role"])
	}

	// Verify refresh token cookie is set.
	var hasRefreshCookie bool
	for _, c := range resp.Cookies() {
		if c.Name == "refresh_token" && c.Value != "" {
			hasRefreshCookie = true
		}
	}
	if !hasRefreshCookie {
		t.Fatal("expected refresh_token cookie to be set")
	}
}

func TestLogin_InvalidPassword(t *testing.T) {
	body := map[string]string{
		"email":    testutil.TestUserEmail,
		"password": "wrongpassword",
	}

	resp, _ := testutil.DoRequest(tc.Server, "POST", "/api/auth/login", body, "")

	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

func TestLogin_NonexistentUser(t *testing.T) {
	body := map[string]string{
		"email":    "nobody@test.local",
		"password": "whatever",
	}

	resp, _ := testutil.DoRequest(tc.Server, "POST", "/api/auth/login", body, "")

	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

func TestLogin_EmptyBody(t *testing.T) {
	body := map[string]string{}

	resp, _ := testutil.DoRequest(tc.Server, "POST", "/api/auth/login", body, "")

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
}

func TestRefresh_ValidToken(t *testing.T) {
	// First login to get a refresh token cookie.
	loginBody := map[string]string{
		"email":    testutil.TestUserEmail,
		"password": testutil.TestUserPass,
	}
	loginResp, _ := testutil.DoRequestWithCookie(tc.Server, "POST", "/api/auth/login", loginBody, "", nil)

	if loginResp.StatusCode != http.StatusOK {
		t.Fatalf("login failed with status %d", loginResp.StatusCode)
	}

	// Extract refresh token cookie.
	var refreshCookie *http.Cookie
	for _, c := range loginResp.Cookies() {
		if c.Name == "refresh_token" {
			refreshCookie = c
		}
	}
	if refreshCookie == nil {
		t.Fatal("no refresh_token cookie from login")
	}

	// Use the refresh token to get a new access token.
	resp, respBody := testutil.DoRequestWithCookie(tc.Server, "POST", "/api/auth/refresh", nil, "", []*http.Cookie{refreshCookie})

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}

	if result["access_token"] == nil || result["access_token"] == "" {
		t.Fatal("expected access_token in refresh response")
	}
}

func TestRefresh_InvalidToken(t *testing.T) {
	badCookie := &http.Cookie{
		Name:  "refresh_token",
		Value: "not-a-real-token",
	}

	resp, _ := testutil.DoRequestWithCookie(tc.Server, "POST", "/api/auth/refresh", nil, "", []*http.Cookie{badCookie})

	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

func TestRefresh_ExpiredToken(t *testing.T) {
	// Insert a refresh token that's already expired into the DB.
	ctx := context.Background()
	rawToken := "expired-test-token-value-12345"
	tokenHash := sha256Hex(rawToken)
	_, err := tc.Pool.Exec(ctx,
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
		tc.UserID, tokenHash, time.Now().Add(-1*time.Hour),
	)
	if err != nil {
		t.Fatalf("insert expired token: %v", err)
	}

	expiredCookie := &http.Cookie{
		Name:  "refresh_token",
		Value: rawToken,
	}

	resp, _ := testutil.DoRequestWithCookie(tc.Server, "POST", "/api/auth/refresh", nil, "", []*http.Cookie{expiredCookie})

	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}
}

func TestLogout(t *testing.T) {
	// Login to get a fresh refresh token.
	loginBody := map[string]string{
		"email":    testutil.TestUserEmail,
		"password": testutil.TestUserPass,
	}
	loginResp, _ := testutil.DoRequestWithCookie(tc.Server, "POST", "/api/auth/login", loginBody, "", nil)

	var refreshCookie *http.Cookie
	for _, c := range loginResp.Cookies() {
		if c.Name == "refresh_token" {
			refreshCookie = c
		}
	}
	if refreshCookie == nil {
		t.Fatal("no refresh_token cookie from login")
	}

	// Logout.
	resp, _ := testutil.DoRequestWithCookie(tc.Server, "POST", "/api/auth/logout", nil, "", []*http.Cookie{refreshCookie})

	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 204 or 200, got %d", resp.StatusCode)
	}

	// Attempt refresh with the same token -- should fail.
	resp2, _ := testutil.DoRequestWithCookie(tc.Server, "POST", "/api/auth/refresh", nil, "", []*http.Cookie{refreshCookie})

	if resp2.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401 after logout, got %d", resp2.StatusCode)
	}
}

// sha256Hex is a test helper to compute the hex SHA-256 of a string.
func sha256Hex(s string) string {
	h := sha256.Sum256([]byte(s))
	return fmt.Sprintf("%x", h)
}
