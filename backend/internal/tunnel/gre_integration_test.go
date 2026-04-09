//go:build integration

package tunnel_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"testing"

	"github.com/pobradovic08/kormos/backend/internal/testutil"
)

// NOTE: The tunnel package tests share a single TestMain (defined here).
// All other tunnel_integration_test.go files share this TestMain and the tc variable.

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

	// Clean up any leftover test resources on RouterOS before running tests.
	ctx := context.Background()
	testutil.CleanupRouterOS(ctx, tc.Router1Client)
	testutil.CleanupRouterOS(ctx, tc.Router2Client)

	code := m.Run()

	// Final cleanup.
	testutil.CleanupRouterOS(ctx, tc.Router1Client)
	testutil.CleanupRouterOS(ctx, tc.Router2Client)

	testutil.CleanupTestDB(pool)
	os.Exit(code)
}

func greBasePath() string {
	return fmt.Sprintf("/api/clusters/%s/tunnels/gre", tc.ClusterID)
}

func TestListGRE_Empty(t *testing.T) {
	resp, respBody := testutil.DoRequest(tc.Server, "GET", greBasePath(), nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var tunnels []interface{}
	if err := json.Unmarshal(respBody, &tunnels); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	// Should be empty or not contain test-prefixed tunnels.
	for _, tun := range tunnels {
		tunMap := tun.(map[string]interface{})
		name := tunMap["name"].(string)
		if name == "test-gre-basic" {
			t.Fatal("test-gre-basic should not exist yet")
		}
	}
}

func TestCreateGRE(t *testing.T) {
	body := map[string]interface{}{
		"name":              "test-gre-basic",
		"mtu":               1476,
		"keepaliveInterval": 10,
		"keepaliveRetries":  10,
		"comment":           "test-gre-basic",
		"endpoints": []map[string]interface{}{
			{"routerId": tc.Router1ID, "localAddress": "10.0.0.1", "remoteAddress": "10.0.0.2"},
			{"routerId": tc.Router2ID, "localAddress": "10.0.0.3", "remoteAddress": "10.0.0.4"},
		},
	}

	resp, respBody := testutil.DoRequest(tc.Server, "POST", greBasePath(), body, tc.Token)

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	if result["name"] != "test-gre-basic" {
		t.Fatalf("expected name test-gre-basic, got %v", result["name"])
	}

	endpoints := result["endpoints"].([]interface{})
	if len(endpoints) != 2 {
		t.Fatalf("expected 2 endpoints, got %d", len(endpoints))
	}

	// Verify the tunnel exists on RouterOS with correct remote-address.
	ctx := context.Background()
	res := testutil.AssertResourceExists(t, ctx, tc.Router1Client,
		"/interface/gre", "name", "test-gre-basic")
	if fmt.Sprint(res["remote-address"]) != "10.0.0.2" {
		t.Errorf("remote-address = %v, want 10.0.0.2", res["remote-address"])
	}

	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", greBasePath()+"/test-gre-basic", nil, tc.Token)
		ctx := context.Background()
		testutil.CleanupGREByName(ctx, tc.Router1Client, "test-gre-basic")
		testutil.CleanupGREByName(ctx, tc.Router2Client, "test-gre-basic")
	})
}

func TestCreateGRE_SingleEndpoint(t *testing.T) {
	body := map[string]interface{}{
		"name":              "test-gre-single",
		"mtu":               1476,
		"keepaliveInterval": 10,
		"keepaliveRetries":  10,
		"comment":           "test-gre-single",
		"endpoints": []map[string]interface{}{
			{"routerId": tc.Router1ID, "localAddress": "10.1.0.1", "remoteAddress": "10.1.0.2"},
		},
	}

	resp, respBody := testutil.DoRequest(tc.Server, "POST", greBasePath(), body, tc.Token)

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	endpoints := result["endpoints"].([]interface{})
	if len(endpoints) != 1 {
		t.Fatalf("expected 1 endpoint, got %d", len(endpoints))
	}

	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", greBasePath()+"/test-gre-single", nil, tc.Token)
		ctx := context.Background()
		testutil.CleanupGREByName(ctx, tc.Router1Client, "test-gre-single")
	})
}

func TestCreateGRE_InvalidRouterID(t *testing.T) {
	body := map[string]interface{}{
		"name":    "test-gre-invalid",
		"comment": "test-gre-invalid",
		"endpoints": []map[string]interface{}{
			{"routerId": "00000000-0000-0000-0000-000000000000", "localAddress": "10.2.0.1", "remoteAddress": "10.2.0.2"},
		},
	}

	resp, respBody := testutil.DoRequest(tc.Server, "POST", greBasePath(), body, tc.Token)

	if resp.StatusCode != http.StatusBadGateway {
		t.Fatalf("expected 502 (router not found causes upstream error), got %d: %s", resp.StatusCode, string(respBody))
	}
}

func TestCreateGRE_MissingName(t *testing.T) {
	body := map[string]interface{}{
		"endpoints": []map[string]interface{}{
			{"routerId": tc.Router1ID, "localAddress": "10.3.0.1", "remoteAddress": "10.3.0.2"},
		},
	}

	resp, _ := testutil.DoRequest(tc.Server, "POST", greBasePath(), body, tc.Token)

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
}

func TestListGRE_AfterCreate(t *testing.T) {
	// Create a GRE tunnel first.
	body := map[string]interface{}{
		"name":              "test-gre-list",
		"mtu":               1476,
		"keepaliveInterval": 10,
		"keepaliveRetries":  10,
		"comment":           "test-gre-list",
		"endpoints": []map[string]interface{}{
			{"routerId": tc.Router1ID, "localAddress": "10.4.0.1", "remoteAddress": "10.4.0.2"},
			{"routerId": tc.Router2ID, "localAddress": "10.4.0.3", "remoteAddress": "10.4.0.4"},
		},
	}
	testutil.DoRequest(tc.Server, "POST", greBasePath(), body, tc.Token)

	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", greBasePath()+"/test-gre-list", nil, tc.Token)
		ctx := context.Background()
		testutil.CleanupGREByName(ctx, tc.Router1Client, "test-gre-list")
		testutil.CleanupGREByName(ctx, tc.Router2Client, "test-gre-list")
	})

	// List.
	resp, respBody := testutil.DoRequest(tc.Server, "GET", greBasePath(), nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var tunnels []map[string]interface{}
	if err := json.Unmarshal(respBody, &tunnels); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	found := false
	for _, tun := range tunnels {
		if tun["name"] == "test-gre-list" {
			found = true
			endpoints := tun["endpoints"].([]interface{})
			if len(endpoints) != 2 {
				t.Fatalf("expected 2 endpoints, got %d", len(endpoints))
			}
		}
	}
	if !found {
		t.Fatal("test-gre-list not found in list response")
	}
}

func TestGetGRE(t *testing.T) {
	// Create tunnel.
	body := map[string]interface{}{
		"name":              "test-gre-get",
		"mtu":               1476,
		"keepaliveInterval": 10,
		"keepaliveRetries":  10,
		"comment":           "test-gre-get",
		"endpoints": []map[string]interface{}{
			{"routerId": tc.Router1ID, "localAddress": "10.5.0.1", "remoteAddress": "10.5.0.2"},
		},
	}
	testutil.DoRequest(tc.Server, "POST", greBasePath(), body, tc.Token)

	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", greBasePath()+"/test-gre-get", nil, tc.Token)
		ctx := context.Background()
		testutil.CleanupGREByName(ctx, tc.Router1Client, "test-gre-get")
	})

	resp, respBody := testutil.DoRequest(tc.Server, "GET", greBasePath()+"/test-gre-get", nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	if result["name"] != "test-gre-get" {
		t.Fatalf("expected name test-gre-get, got %v", result["name"])
	}
}

func TestGetGRE_NotFound(t *testing.T) {
	resp, _ := testutil.DoRequest(tc.Server, "GET", greBasePath()+"/nonexistent-gre", nil, tc.Token)

	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", resp.StatusCode)
	}
}

func TestUpdateGRE_SharedFields(t *testing.T) {
	// Create tunnel.
	createBody := map[string]interface{}{
		"name":              "test-gre-update",
		"mtu":               1476,
		"keepaliveInterval": 10,
		"keepaliveRetries":  10,
		"comment":           "test-gre-update",
		"endpoints": []map[string]interface{}{
			{"routerId": tc.Router1ID, "localAddress": "10.6.0.1", "remoteAddress": "10.6.0.2"},
			{"routerId": tc.Router2ID, "localAddress": "10.6.0.3", "remoteAddress": "10.6.0.4"},
		},
	}
	testutil.DoRequest(tc.Server, "POST", greBasePath(), createBody, tc.Token)

	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", greBasePath()+"/test-gre-update", nil, tc.Token)
		ctx := context.Background()
		testutil.CleanupGREByName(ctx, tc.Router1Client, "test-gre-update")
		testutil.CleanupGREByName(ctx, tc.Router2Client, "test-gre-update")
	})

	// Update shared fields.
	mtu := 1400
	comment := "test-gre-update-modified"
	updateBody := map[string]interface{}{
		"mtu":     mtu,
		"comment": comment,
	}

	resp, respBody := testutil.DoRequest(tc.Server, "PATCH", greBasePath()+"/test-gre-update", updateBody, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	if result["comment"] != "test-gre-update-modified" {
		t.Fatalf("expected updated comment, got %v", result["comment"])
	}
}

func TestUpdateGRE_PerEndpointFields(t *testing.T) {
	createBody := map[string]interface{}{
		"name":              "test-gre-ep-update",
		"mtu":               1476,
		"keepaliveInterval": 10,
		"keepaliveRetries":  10,
		"comment":           "test-gre-ep-update",
		"endpoints": []map[string]interface{}{
			{"routerId": tc.Router1ID, "localAddress": "10.7.0.1", "remoteAddress": "10.7.0.2"},
			{"routerId": tc.Router2ID, "localAddress": "10.7.0.3", "remoteAddress": "10.7.0.4"},
		},
	}
	testutil.DoRequest(tc.Server, "POST", greBasePath(), createBody, tc.Token)

	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", greBasePath()+"/test-gre-ep-update", nil, tc.Token)
		ctx := context.Background()
		testutil.CleanupGREByName(ctx, tc.Router1Client, "test-gre-ep-update")
		testutil.CleanupGREByName(ctx, tc.Router2Client, "test-gre-ep-update")
	})

	updateBody := map[string]interface{}{
		"endpoints": []map[string]interface{}{
			{"routerId": tc.Router1ID, "localAddress": "10.7.1.1"},
		},
	}

	resp, respBody := testutil.DoRequest(tc.Server, "PATCH", greBasePath()+"/test-gre-ep-update", updateBody, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}
}

func TestDeleteGRE(t *testing.T) {
	createBody := map[string]interface{}{
		"name":              "test-gre-delete",
		"mtu":               1476,
		"keepaliveInterval": 10,
		"keepaliveRetries":  10,
		"comment":           "test-gre-delete",
		"endpoints": []map[string]interface{}{
			{"routerId": tc.Router1ID, "localAddress": "10.8.0.1", "remoteAddress": "10.8.0.2"},
			{"routerId": tc.Router2ID, "localAddress": "10.8.0.3", "remoteAddress": "10.8.0.4"},
		},
	}
	testutil.DoRequest(tc.Server, "POST", greBasePath(), createBody, tc.Token)

	resp, _ := testutil.DoRequest(tc.Server, "DELETE", greBasePath()+"/test-gre-delete", nil, tc.Token)

	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", resp.StatusCode)
	}

	// Verify deleted via API.
	getResp, _ := testutil.DoRequest(tc.Server, "GET", greBasePath()+"/test-gre-delete", nil, tc.Token)
	if getResp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404 after delete, got %d", getResp.StatusCode)
	}

	// Verify the tunnel no longer exists on RouterOS.
	ctx := context.Background()
	testutil.AssertResourceNotExists(t, ctx, tc.Router1Client,
		"/interface/gre", "name", "test-gre-delete")
}

func TestDeleteGRE_NotFound(t *testing.T) {
	resp, respBody := testutil.DoRequest(tc.Server, "DELETE", greBasePath()+"/nonexistent-gre-del", nil, tc.Token)

	// The handler returns 502 (bad gateway) when the service returns an error for a nonexistent resource.
	if resp.StatusCode != http.StatusBadGateway {
		t.Fatalf("expected 502 (bad gateway) for nonexistent GRE tunnel, got %d: %s", resp.StatusCode, string(respBody))
	}
}

func TestGRE_OperationHistory(t *testing.T) {
	createBody := map[string]interface{}{
		"name":              "test-gre-history",
		"mtu":               1476,
		"keepaliveInterval": 10,
		"keepaliveRetries":  10,
		"comment":           "test-gre-history",
		"endpoints": []map[string]interface{}{
			{"routerId": tc.Router1ID, "localAddress": "10.9.0.1", "remoteAddress": "10.9.0.2"},
		},
	}
	testutil.DoRequest(tc.Server, "POST", greBasePath(), createBody, tc.Token)

	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", greBasePath()+"/test-gre-history", nil, tc.Token)
		ctx := context.Background()
		testutil.CleanupGREByName(ctx, tc.Router1Client, "test-gre-history")
	})

	// Check operation history.
	resp, respBody := testutil.DoRequest(tc.Server, "GET", "/api/v1/operations/history", nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var history map[string]interface{}
	if err := json.Unmarshal(respBody, &history); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	groups := history["groups"].([]interface{})
	found := false
	for _, g := range groups {
		group := g.(map[string]interface{})
		desc, _ := group["description"].(string)
		if desc == `Create GRE tunnel "test-gre-history"` {
			found = true
			if group["status"] != "applied" {
				t.Fatalf("expected status applied, got %v", group["status"])
			}
		}
	}
	if !found {
		t.Fatal("operation for test-gre-history not found in history")
	}
}

func TestGRE_Undo(t *testing.T) {
	createBody := map[string]interface{}{
		"name":              "test-gre-undo",
		"mtu":               1476,
		"keepaliveInterval": 10,
		"keepaliveRetries":  10,
		"comment":           "test-gre-undo",
		"endpoints": []map[string]interface{}{
			{"routerId": tc.Router1ID, "localAddress": "10.10.0.1", "remoteAddress": "10.10.0.2"},
			{"routerId": tc.Router2ID, "localAddress": "10.10.0.3", "remoteAddress": "10.10.0.4"},
		},
	}
	testutil.DoRequest(tc.Server, "POST", greBasePath(), createBody, tc.Token)

	t.Cleanup(func() {
		ctx := context.Background()
		testutil.CleanupGREByName(ctx, tc.Router1Client, "test-gre-undo")
		testutil.CleanupGREByName(ctx, tc.Router2Client, "test-gre-undo")
	})

	// Find the group ID from history.
	_, histBody := testutil.DoRequest(tc.Server, "GET", "/api/v1/operations/history", nil, tc.Token)
	var history map[string]interface{}
	if err := json.Unmarshal(histBody, &history); err != nil {
		t.Fatalf("unmarshal history response: %v\nbody: %s", err, string(histBody))
	}

	var groupID string
	for _, g := range history["groups"].([]interface{}) {
		group := g.(map[string]interface{})
		desc, _ := group["description"].(string)
		if desc == `Create GRE tunnel "test-gre-undo"` {
			groupID = group["id"].(string)
			break
		}
	}

	if groupID == "" {
		t.Fatal("could not find group ID for test-gre-undo")
	}

	// Undo.
	resp, respBody := testutil.DoRequest(tc.Server, "POST", "/api/v1/operations/undo/"+groupID, nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var undoResult map[string]interface{}
	if err := json.Unmarshal(respBody, &undoResult); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	if undoResult["status"] != "undone" {
		t.Fatalf("expected status undone, got %v", undoResult["status"])
	}

	// Verify tunnel is gone.
	getResp, _ := testutil.DoRequest(tc.Server, "GET", greBasePath()+"/test-gre-undo", nil, tc.Token)
	if getResp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404 after undo, got %d", getResp.StatusCode)
	}
}
