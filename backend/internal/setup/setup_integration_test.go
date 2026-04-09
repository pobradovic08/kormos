//go:build integration

package setup_test

import (
	"encoding/json"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/pobradovic08/kormos/backend/internal/config"
	"github.com/pobradovic08/kormos/backend/internal/testutil"
)

var tc *testutil.TestContext

// TestMain for the setup package uses a FRESH database without seed data
// for the first tests, then seeds for later tests.
func TestMain(m *testing.M) {
	pool, err := testutil.SetupTestDB()
	if err != nil {
		panic("setup db: " + err.Error())
	}

	// Create a minimal TestContext without seeding (for setup status tests).
	tc = &testutil.TestContext{
		Pool: pool,
		Config: &config.Config{
			DatabaseURL:   testutil.TestDBURL,
			EncryptionKey: testutil.TestEncKey,
			JWTSecret:     testutil.TestJWTSecret,
			JWTAccessTTL:  1 * time.Hour,
			JWTRefreshTTL: 24 * time.Hour,
			ListenAddr:    ":0",
			CORSOrigins:   []string{"*"},
		},
	}
	tc.Server = testutil.NewTestServer(pool, tc)
	defer tc.Server.Close()

	code := m.Run()

	testutil.CleanupTestDB(pool)
	os.Exit(code)
}

func TestSetupStatus_BeforeSetup(t *testing.T) {
	resp, respBody := testutil.DoRequest(tc.Server, "GET", "/api/setup/status", nil, "")

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if result["setup_complete"] != false {
		t.Fatalf("expected setup_complete=false, got %v", result["setup_complete"])
	}
}

func TestCompleteSetup(t *testing.T) {
	body := map[string]interface{}{
		"admin": map[string]string{
			"email":    "admin@setup-test.local",
			"name":     "Setup Admin",
			"password": "TestPass123",
		},
		"portal": map[string]string{
			"portal_name":      "Setup Test Portal",
			"default_timezone": "UTC",
			"support_email":    "support@setup-test.local",
		},
	}

	resp, respBody := testutil.DoRequest(tc.Server, "POST", "/api/setup/complete", body, "")

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if result["access_token"] == nil || result["access_token"] == "" {
		t.Fatal("expected access_token in response")
	}

	userMap, ok := result["user"].(map[string]interface{})
	if !ok {
		t.Fatal("expected user object in response")
	}
	if userMap["email"] != "admin@setup-test.local" {
		t.Fatalf("expected email admin@setup-test.local, got %v", userMap["email"])
	}
	if userMap["role"] != "owner" {
		t.Fatalf("expected role owner, got %v", userMap["role"])
	}

	// Store the token for subsequent tests.
	tc.Token = result["access_token"].(string)
	tc.UserID = userMap["id"].(string)
	if tenantMap, ok := userMap["tenant"].(map[string]interface{}); ok {
		tc.TenantID = tenantMap["id"].(string)
	}
}

func TestCompleteSetup_Duplicate(t *testing.T) {
	body := map[string]interface{}{
		"admin": map[string]string{
			"email":    "admin2@setup-test.local",
			"name":     "Another Admin",
			"password": "TestPass123",
		},
		"portal": map[string]string{
			"portal_name":      "Duplicate Portal",
			"default_timezone": "UTC",
			"support_email":    "support2@setup-test.local",
		},
	}

	resp, _ := testutil.DoRequest(tc.Server, "POST", "/api/setup/complete", body, "")

	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409, got %d", resp.StatusCode)
	}
}

func TestGetSettings(t *testing.T) {
	if tc.Token == "" {
		t.Skip("no token available, TestCompleteSetup may have failed")
	}

	resp, respBody := testutil.DoRequest(tc.Server, "GET", "/api/portal/settings", nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if result["portal_name"] != "Setup Test Portal" {
		t.Fatalf("expected portal_name 'Setup Test Portal', got %v", result["portal_name"])
	}
}

func TestUpdateSettings_AsOwner(t *testing.T) {
	if tc.Token == "" {
		t.Skip("no token available")
	}

	body := map[string]string{
		"portal_name":      "Updated Portal",
		"default_timezone": "US/Eastern",
		"support_email":    "updated@setup-test.local",
	}

	resp, respBody := testutil.DoRequest(tc.Server, "PUT", "/api/portal/settings", body, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if result["portal_name"] != "Updated Portal" {
		t.Fatalf("expected portal_name 'Updated Portal', got %v", result["portal_name"])
	}
}

func TestUpdateSettings_AsOperator(t *testing.T) {
	if tc.Token == "" {
		t.Skip("no token available")
	}

	// Generate operator-role token using the same user (role override in JWT).
	operatorToken := testutil.GenerateTokenForRole(tc, "operator")

	body := map[string]string{
		"portal_name":      "Hacked Portal",
		"default_timezone": "UTC",
		"support_email":    "hacker@test.local",
	}

	resp, _ := testutil.DoRequest(tc.Server, "PUT", "/api/portal/settings", body, operatorToken)

	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
}
