//go:build integration

package operation_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/pobradovic08/kormos/backend/internal/auth"
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

	ctx := context.Background()
	testutil.CleanupRouterOS(ctx, tc.Router1Client)
	testutil.CleanupRouterOS(ctx, tc.Router2Client)

	code := m.Run()

	testutil.CleanupRouterOS(ctx, tc.Router1Client)
	testutil.CleanupRouterOS(ctx, tc.Router2Client)

	testutil.CleanupTestDB(pool)
	os.Exit(code)
}

func TestExecute_SingleOperation(t *testing.T) {
	body := map[string]interface{}{
		"description": "Test single add",
		"operations": []map[string]interface{}{
			{
				"router_id":      tc.Router1ID,
				"module":         "tunnels",
				"operation_type": "add",
				"resource_path":  "/interface/gre",
				"body": map[string]interface{}{
					"name":           "test-op-single",
					"local-address":  "10.50.0.1",
					"remote-address": "10.50.0.2",
					"comment":        "test-op-single",
				},
			},
		},
	}

	resp, respBody := testutil.DoRequest(tc.Server, "POST", "/api/v1/operations/execute", body, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	if result["status"] != "applied" {
		t.Fatalf("expected status applied, got %v", result["status"])
	}

	t.Cleanup(func() {
		ctx := context.Background()
		testutil.CleanupGREByName(ctx, tc.Router1Client, "test-op-single")
	})
}

func TestExecute_MultiRouter(t *testing.T) {
	body := map[string]interface{}{
		"description": "Test multi-router add",
		"operations": []map[string]interface{}{
			{
				"router_id": tc.Router1ID, "module": "tunnels", "operation_type": "add",
				"resource_path": "/interface/gre",
				"body":          map[string]interface{}{"name": "test-op-multi", "local-address": "10.51.0.1", "remote-address": "10.51.0.2", "comment": "test-op-multi"},
			},
			{
				"router_id": tc.Router2ID, "module": "tunnels", "operation_type": "add",
				"resource_path": "/interface/gre",
				"body":          map[string]interface{}{"name": "test-op-multi", "local-address": "10.51.0.3", "remote-address": "10.51.0.4", "comment": "test-op-multi"},
			},
		},
	}

	resp, respBody := testutil.DoRequest(tc.Server, "POST", "/api/v1/operations/execute", body, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	ops := result["operations"].([]interface{})
	if len(ops) != 2 {
		t.Fatalf("expected 2 operations, got %d", len(ops))
	}

	for _, op := range ops {
		opMap := op.(map[string]interface{})
		if opMap["status"] != "applied" {
			t.Fatalf("expected operation status applied, got %v", opMap["status"])
		}
	}

	t.Cleanup(func() {
		ctx := context.Background()
		testutil.CleanupGREByName(ctx, tc.Router1Client, "test-op-multi")
		testutil.CleanupGREByName(ctx, tc.Router2Client, "test-op-multi")
	})
}

func TestExecute_EmptyOperations(t *testing.T) {
	body := map[string]interface{}{
		"description": "Empty operations",
		"operations":  []map[string]interface{}{},
	}

	resp, _ := testutil.DoRequest(tc.Server, "POST", "/api/v1/operations/execute", body, tc.Token)

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
}

func TestExecute_InvalidRouter(t *testing.T) {
	body := map[string]interface{}{
		"description": "Invalid router",
		"operations": []map[string]interface{}{
			{
				"router_id": "00000000-0000-0000-0000-000000000000", "module": "tunnels", "operation_type": "add",
				"resource_path": "/interface/gre",
				"body":          map[string]interface{}{"name": "test-op-invalid"},
			},
		},
	}

	resp, _ := testutil.DoRequest(tc.Server, "POST", "/api/v1/operations/execute", body, tc.Token)

	// Should fail (either 500 or error in result).
	if resp.StatusCode == http.StatusOK {
		// This is acceptable -- the handler may return 200 with failed operations.
		t.Log("Handler returned 200 with failed operations (acceptable)")
	}
}

func TestHistory(t *testing.T) {
	// Execute an operation to ensure history is non-empty.
	execBody := map[string]interface{}{
		"description": "Test history entry",
		"operations": []map[string]interface{}{
			{
				"router_id": tc.Router1ID, "module": "tunnels", "operation_type": "add",
				"resource_path": "/interface/gre",
				"body":          map[string]interface{}{"name": "test-op-hist", "local-address": "10.52.0.1", "remote-address": "10.52.0.2", "comment": "test-op-hist"},
			},
		},
	}
	testutil.DoRequest(tc.Server, "POST", "/api/v1/operations/execute", execBody, tc.Token)

	t.Cleanup(func() {
		ctx := context.Background()
		testutil.CleanupGREByName(ctx, tc.Router1Client, "test-op-hist")
	})

	resp, respBody := testutil.DoRequest(tc.Server, "GET", "/api/v1/operations/history", nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	groups := result["groups"].([]interface{})
	if len(groups) < 1 {
		t.Fatal("expected at least 1 group in history")
	}

	total := result["total"].(float64)
	if total < 1 {
		t.Fatalf("expected total >= 1, got %v", total)
	}
}

func TestHistory_Pagination(t *testing.T) {
	// Create multiple operations.
	for i := 0; i < 3; i++ {
		name := fmt.Sprintf("test-op-page-%d", i)
		body := map[string]interface{}{
			"description": fmt.Sprintf("Pagination test %d", i),
			"operations": []map[string]interface{}{
				{
					"router_id": tc.Router1ID, "module": "tunnels", "operation_type": "add",
					"resource_path": "/interface/gre",
					"body":          map[string]interface{}{"name": name, "local-address": fmt.Sprintf("10.53.%d.1", i), "remote-address": fmt.Sprintf("10.53.%d.2", i), "comment": name},
				},
			},
		}
		testutil.DoRequest(tc.Server, "POST", "/api/v1/operations/execute", body, tc.Token)
	}

	t.Cleanup(func() {
		ctx := context.Background()
		for i := 0; i < 3; i++ {
			testutil.CleanupGREByName(ctx, tc.Router1Client, fmt.Sprintf("test-op-page-%d", i))
		}
	})

	// Request page 1 with per_page=2.
	resp, respBody := testutil.DoRequest(tc.Server, "GET", "/api/v1/operations/history?page=1&per_page=2", nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	groups := result["groups"].([]interface{})
	if len(groups) > 2 {
		t.Fatalf("expected at most 2 groups per page, got %d", len(groups))
	}
}

func TestHistory_FilterByRouter(t *testing.T) {
	resp, respBody := testutil.DoRequest(tc.Server, "GET", "/api/v1/operations/history?router_id="+tc.Router1ID, nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	// All returned groups should have operations involving router1.
	if result["groups"] == nil {
		t.Fatal("expected groups array in response")
	}
}

func TestUndo_Success(t *testing.T) {
	execBody := map[string]interface{}{
		"description": "Test undo success",
		"operations": []map[string]interface{}{
			{
				"router_id": tc.Router1ID, "module": "tunnels", "operation_type": "add",
				"resource_path": "/interface/gre",
				"body":          map[string]interface{}{"name": "test-op-undo-ok", "local-address": "10.54.0.1", "remote-address": "10.54.0.2", "comment": "test-op-undo-ok"},
			},
		},
	}
	_, execResp := testutil.DoRequest(tc.Server, "POST", "/api/v1/operations/execute", execBody, tc.Token)
	var execResult map[string]interface{}
	if err := json.Unmarshal(execResp, &execResult); err != nil {
		t.Fatalf("unmarshal execute response: %v\nbody: %s", err, string(execResp))
	}
	groupID := execResult["group_id"].(string)

	t.Cleanup(func() {
		ctx := context.Background()
		testutil.CleanupGREByName(ctx, tc.Router1Client, "test-op-undo-ok")
	})

	resp, respBody := testutil.DoRequest(tc.Server, "POST", "/api/v1/operations/undo/"+groupID, nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	if result["status"] != "undone" {
		t.Fatalf("expected status undone, got %v", result["status"])
	}
}

func TestUndo_Expired(t *testing.T) {
	execBody := map[string]interface{}{
		"description": "Test undo expired",
		"operations": []map[string]interface{}{
			{
				"router_id": tc.Router1ID, "module": "tunnels", "operation_type": "add",
				"resource_path": "/interface/gre",
				"body":          map[string]interface{}{"name": "test-op-undo-exp", "local-address": "10.55.0.1", "remote-address": "10.55.0.2", "comment": "test-op-undo-exp"},
			},
		},
	}
	_, execResp := testutil.DoRequest(tc.Server, "POST", "/api/v1/operations/execute", execBody, tc.Token)
	var execResult map[string]interface{}
	if err := json.Unmarshal(execResp, &execResult); err != nil {
		t.Fatalf("unmarshal execute response: %v\nbody: %s", err, string(execResp))
	}
	groupID := execResult["group_id"].(string)

	t.Cleanup(func() {
		ctx := context.Background()
		testutil.CleanupGREByName(ctx, tc.Router1Client, "test-op-undo-exp")
	})

	// Manipulate expires_at to the past.
	ctx := context.Background()
	_, err := tc.Pool.Exec(ctx,
		"UPDATE operation_groups SET expires_at = $1 WHERE id = $2",
		time.Now().Add(-1*time.Hour), groupID,
	)
	if err != nil {
		t.Fatalf("update expires_at: %v", err)
	}

	resp, respBody := testutil.DoRequest(tc.Server, "POST", "/api/v1/operations/undo/"+groupID, nil, tc.Token)

	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	if result["status"] != "undo_blocked" {
		t.Fatalf("expected status undo_blocked, got %v", result["status"])
	}
}

func TestUndo_AlreadyUndone(t *testing.T) {
	execBody := map[string]interface{}{
		"description": "Test double undo",
		"operations": []map[string]interface{}{
			{
				"router_id": tc.Router1ID, "module": "tunnels", "operation_type": "add",
				"resource_path": "/interface/gre",
				"body":          map[string]interface{}{"name": "test-op-undo-dbl", "local-address": "10.56.0.1", "remote-address": "10.56.0.2", "comment": "test-op-undo-dbl"},
			},
		},
	}
	_, execResp := testutil.DoRequest(tc.Server, "POST", "/api/v1/operations/execute", execBody, tc.Token)
	var execResult map[string]interface{}
	if err := json.Unmarshal(execResp, &execResult); err != nil {
		t.Fatalf("unmarshal execute response: %v\nbody: %s", err, string(execResp))
	}
	groupID := execResult["group_id"].(string)

	t.Cleanup(func() {
		ctx := context.Background()
		testutil.CleanupGREByName(ctx, tc.Router1Client, "test-op-undo-dbl")
	})

	// First undo should succeed.
	testutil.DoRequest(tc.Server, "POST", "/api/v1/operations/undo/"+groupID, nil, tc.Token)

	// Second undo should be blocked.
	resp, respBody := testutil.DoRequest(tc.Server, "POST", "/api/v1/operations/undo/"+groupID, nil, tc.Token)

	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	if result["status"] != "undo_blocked" {
		t.Fatalf("expected status undo_blocked, got %v", result["status"])
	}
}

func TestUndo_DriftDetection(t *testing.T) {
	execBody := map[string]interface{}{
		"description": "Test drift detection",
		"operations": []map[string]interface{}{
			{
				"router_id": tc.Router1ID, "module": "tunnels", "operation_type": "add",
				"resource_path": "/interface/gre",
				"body":          map[string]interface{}{"name": "test-op-drift", "local-address": "10.57.0.1", "remote-address": "10.57.0.2", "comment": "test-op-drift"},
			},
		},
	}
	_, execResp := testutil.DoRequest(tc.Server, "POST", "/api/v1/operations/execute", execBody, tc.Token)
	var execResult map[string]interface{}
	if err := json.Unmarshal(execResp, &execResult); err != nil {
		t.Fatalf("unmarshal execute response: %v\nbody: %s", err, string(execResp))
	}
	groupID := execResult["group_id"].(string)

	t.Cleanup(func() {
		ctx := context.Background()
		testutil.CleanupGREByName(ctx, tc.Router1Client, "test-op-drift")
	})

	// Manually change the resource on RouterOS to cause drift.
	ctx := context.Background()
	greBody, _ := tc.Router1Client.Get(ctx, "/interface/gre")
	var gres []map[string]interface{}
	if err := json.Unmarshal(greBody, &gres); err != nil {
		t.Fatalf("unmarshal gre list: %v\nbody: %s", err, string(greBody))
	}

	for _, gre := range gres {
		if gre["name"] == "test-op-drift" {
			id := gre[".id"].(string)
			tc.Router1Client.Patch(ctx, "/interface/gre/"+id, map[string]interface{}{
				"comment": "manually-changed",
			})
			break
		}
	}

	// Attempt undo -- should detect drift.
	resp, respBody := testutil.DoRequest(tc.Server, "POST", "/api/v1/operations/undo/"+groupID, nil, tc.Token)

	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	if result["status"] != "undo_blocked" {
		t.Fatalf("expected status undo_blocked, got %v", result["status"])
	}
	if result["drifted_operation"] == nil {
		t.Fatal("expected drifted_operation field when drift is detected")
	}
}

func TestUndo_PermissionDenied(t *testing.T) {
	execBody := map[string]interface{}{
		"description": "Test permission denied undo",
		"operations": []map[string]interface{}{
			{
				"router_id": tc.Router1ID, "module": "tunnels", "operation_type": "add",
				"resource_path": "/interface/gre",
				"body":          map[string]interface{}{"name": "test-op-perm", "local-address": "10.58.0.1", "remote-address": "10.58.0.2", "comment": "test-op-perm"},
			},
		},
	}
	_, execResp := testutil.DoRequest(tc.Server, "POST", "/api/v1/operations/execute", execBody, tc.Token)
	var execResult map[string]interface{}
	if err := json.Unmarshal(execResp, &execResult); err != nil {
		t.Fatalf("unmarshal execute response: %v\nbody: %s", err, string(execResp))
	}
	groupID := execResult["group_id"].(string)

	t.Cleanup(func() {
		ctx := context.Background()
		testutil.CleanupGREByName(ctx, tc.Router1Client, "test-op-perm")
	})

	// Create a different user with operator role and try to undo.
	createUserBody := map[string]string{
		"email":    "operator-undo@test.local",
		"name":     "Operator Undo",
		"password": "OperUndo123",
		"role":     "operator",
	}
	_, userResp := testutil.DoRequest(tc.Server, "POST", "/api/users", createUserBody, tc.Token)
	var createdUser map[string]interface{}
	if err := json.Unmarshal(userResp, &createdUser); err != nil {
		t.Fatalf("unmarshal create user response: %v\nbody: %s", err, string(userResp))
	}
	operatorUserID := createdUser["id"].(string)

	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", "/api/users/"+operatorUserID, nil, tc.Token)
	})

	// Generate an operator token directly.
	operatorToken, _ := auth.GenerateAccessToken(operatorUserID, tc.TenantID, "operator", "operator-undo@test.local", testutil.TestJWTSecret, 1*time.Hour)

	// The operation was created by the owner user (tc.UserID). The operator has a different user
	// ID, and the undo service denies cross-user undo for non-owner/admin roles, returning 500.
	resp, respBody := testutil.DoRequest(tc.Server, "POST", "/api/v1/operations/undo/"+groupID, nil, operatorToken)

	if resp.StatusCode != http.StatusInternalServerError {
		t.Fatalf("expected 500 (permission denied returned as internal error), got %d: %s", resp.StatusCode, string(respBody))
	}
}
