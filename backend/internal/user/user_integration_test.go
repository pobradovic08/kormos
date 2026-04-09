//go:build integration

package user_test

import (
	"encoding/json"
	"net/http"
	"os"
	"testing"

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

func TestListUsers(t *testing.T) {
	resp, respBody := testutil.DoRequest(tc.Server, "GET", "/api/users/", nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var users []map[string]interface{}
	if err := json.Unmarshal(respBody, &users); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if len(users) < 1 {
		t.Fatal("expected at least 1 user (seeded owner)")
	}

	found := false
	for _, u := range users {
		if u["email"] == testutil.TestUserEmail {
			found = true
			if u["role"] != "owner" {
				t.Fatalf("expected owner role, got %v", u["role"])
			}
		}
	}
	if !found {
		t.Fatalf("seeded owner user %s not found in list", testutil.TestUserEmail)
	}
}

func TestCreateUser(t *testing.T) {
	body := map[string]string{
		"email":    "newuser@test.local",
		"name":     "New User",
		"password": "NewPass123",
		"role":     "operator",
	}

	resp, respBody := testutil.DoRequest(tc.Server, "POST", "/api/users/", body, tc.Token)

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if result["email"] != "newuser@test.local" {
		t.Fatalf("expected email newuser@test.local, got %v", result["email"])
	}
	if result["role"] != "operator" {
		t.Fatalf("expected role operator, got %v", result["role"])
	}

	// Clean up: delete the created user.
	userID := result["id"].(string)
	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", "/api/users/"+userID, nil, tc.Token)
	})
}

func TestCreateUser_DuplicateEmail(t *testing.T) {
	body := map[string]string{
		"email":    testutil.TestUserEmail,
		"name":     "Duplicate",
		"password": "DupPass123",
		"role":     "operator",
	}

	resp, _ := testutil.DoRequest(tc.Server, "POST", "/api/users/", body, tc.Token)

	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409, got %d", resp.StatusCode)
	}
}

func TestCreateUser_InvalidRole(t *testing.T) {
	body := map[string]string{
		"email":    "badrole@test.local",
		"name":     "Bad Role",
		"password": "BadRole123",
		"role":     "superuser",
	}

	resp, _ := testutil.DoRequest(tc.Server, "POST", "/api/users/", body, tc.Token)

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
}

func TestCreateUser_MissingFields(t *testing.T) {
	body := map[string]string{
		"email": "incomplete@test.local",
	}

	resp, _ := testutil.DoRequest(tc.Server, "POST", "/api/users/", body, tc.Token)

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
}

func TestUpdateUser(t *testing.T) {
	// Create a user to update.
	createBody := map[string]string{
		"email":    "updateme@test.local",
		"name":     "Update Me",
		"password": "UpdateMe123",
		"role":     "operator",
	}

	_, createResp := testutil.DoRequest(tc.Server, "POST", "/api/users/", createBody, tc.Token)
	var created map[string]interface{}
	if err := json.Unmarshal(createResp, &created); err != nil {
		t.Fatalf("unmarshal create response: %v\nbody: %s", err, string(createResp))
	}
	userID := created["id"].(string)

	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", "/api/users/"+userID, nil, tc.Token)
	})

	// Update the user.
	updateBody := map[string]interface{}{
		"name": "Updated Name",
	}

	resp, respBody := testutil.DoRequest(tc.Server, "PUT", "/api/users/"+userID, updateBody, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	if result["name"] != "Updated Name" {
		t.Fatalf("expected name 'Updated Name', got %v", result["name"])
	}
}

func TestUpdateUser_NotFound(t *testing.T) {
	updateBody := map[string]interface{}{
		"name": "Ghost",
	}

	resp, _ := testutil.DoRequest(tc.Server, "PUT", "/api/users/00000000-0000-0000-0000-000000000000", updateBody, tc.Token)

	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", resp.StatusCode)
	}
}

func TestDeleteUser(t *testing.T) {
	// Create a user to delete.
	createBody := map[string]string{
		"email":    "deleteme@test.local",
		"name":     "Delete Me",
		"password": "DeleteMe123",
		"role":     "operator",
	}

	_, createResp := testutil.DoRequest(tc.Server, "POST", "/api/users/", createBody, tc.Token)
	var created map[string]interface{}
	if err := json.Unmarshal(createResp, &created); err != nil {
		t.Fatalf("unmarshal create response: %v\nbody: %s", err, string(createResp))
	}
	userID := created["id"].(string)

	// Delete the user.
	resp, _ := testutil.DoRequest(tc.Server, "DELETE", "/api/users/"+userID, nil, tc.Token)

	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", resp.StatusCode)
	}
}

func TestDeleteUser_LastOwner(t *testing.T) {
	// Try to delete the seeded owner (the only one).
	resp, respBody := testutil.DoRequest(tc.Server, "DELETE", "/api/users/"+tc.UserID, nil, tc.Token)

	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409 (cannot delete last owner), got %d: %s", resp.StatusCode, string(respBody))
	}
}

func TestUsers_RequiresAdminRole(t *testing.T) {
	// Generate a viewer token.
	viewerToken := testutil.GenerateTokenForRole(tc, "viewer")

	resp, _ := testutil.DoRequest(tc.Server, "GET", "/api/users/", nil, viewerToken)

	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", resp.StatusCode)
	}
}
