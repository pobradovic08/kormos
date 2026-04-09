//go:build integration

package tunnel_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/pobradovic08/kormos/backend/internal/testutil"
)

func ipsecBasePath() string {
	return fmt.Sprintf("/api/clusters/%s/tunnels/ipsec", tc.ClusterID)
}

func TestListIPsec_Empty(t *testing.T) {
	resp, respBody := testutil.DoRequest(tc.Server, "GET", ipsecBasePath(), nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var tunnels []interface{}
	if err := json.Unmarshal(respBody, &tunnels); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	for _, tun := range tunnels {
		tunMap := tun.(map[string]interface{})
		name := tunMap["name"].(string)
		if name == "test-ipsec-basic" {
			t.Fatal("test-ipsec-basic should not exist yet")
		}
	}
}

func TestCreateIPsec_RouteBased(t *testing.T) {
	body := map[string]interface{}{
		"name":        "test-ipsec-route",
		"mode":        "route-based",
		"authMethod":  "pre-shared-key",
		"ipsecSecret": "test-secret-123",
		"phase1": map[string]string{
			"encryption": "aes-256",
			"hash":       "sha256",
			"dhGroup":    "modp2048",
			"lifetime":   "1d",
		},
		"phase2": map[string]string{
			"encryption":    "aes-256-cbc",
			"authAlgorithm": "sha256",
			"pfsGroup":      "modp2048",
			"lifetime":      "30m",
		},
		"comment": "test-ipsec-route",
		"endpoints": []map[string]interface{}{
			{"routerId": tc.Router1ID, "localAddress": "10.20.0.1", "remoteAddress": "10.20.0.2"},
		},
	}

	resp, respBody := testutil.DoRequest(tc.Server, "POST", ipsecBasePath(), body, tc.Token)

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	if result["name"] != "test-ipsec-route" {
		t.Fatalf("expected name test-ipsec-route, got %v", result["name"])
	}
	if result["mode"] != "route-based" {
		t.Fatalf("expected mode route-based, got %v", result["mode"])
	}

	phase1 := result["phase1"].(map[string]interface{})
	if phase1["encryption"] == nil {
		t.Fatal("expected phase1 encryption to be populated")
	}

	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", ipsecBasePath()+"/test-ipsec-route", nil, tc.Token)
		ctx := context.Background()
		testutil.CleanupRouterOS(ctx, tc.Router1Client)
	})
}

func TestCreateIPsec_PolicyBased(t *testing.T) {
	body := map[string]interface{}{
		"name":          "test-ipsec-policy",
		"mode":          "policy-based",
		"authMethod":    "pre-shared-key",
		"ipsecSecret":   "test-secret-456",
		"localSubnets":  []string{"192.168.1.0/24"},
		"remoteSubnets": []string{"192.168.2.0/24"},
		"phase1": map[string]string{
			"encryption": "aes-128",
			"hash":       "sha1",
			"dhGroup":    "modp1024",
			"lifetime":   "1d",
		},
		"phase2": map[string]string{
			"encryption":    "aes-128-cbc",
			"authAlgorithm": "sha1",
			"pfsGroup":      "modp1024",
			"lifetime":      "30m",
		},
		"comment": "test-ipsec-policy",
		"endpoints": []map[string]interface{}{
			{"routerId": tc.Router1ID, "localAddress": "10.21.0.1", "remoteAddress": "10.21.0.2"},
		},
	}

	resp, respBody := testutil.DoRequest(tc.Server, "POST", ipsecBasePath(), body, tc.Token)

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	if result["name"] != "test-ipsec-policy" {
		t.Fatalf("expected name test-ipsec-policy, got %v", result["name"])
	}

	localSubnets := result["localSubnets"]
	if localSubnets == nil {
		t.Fatal("expected localSubnets to be populated for policy-based tunnel")
	}

	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", ipsecBasePath()+"/test-ipsec-policy", nil, tc.Token)
		ctx := context.Background()
		testutil.CleanupRouterOS(ctx, tc.Router1Client)
	})
}

func TestCreateIPsec_MissingName(t *testing.T) {
	body := map[string]interface{}{
		"mode": "route-based",
		"endpoints": []map[string]interface{}{
			{"routerId": tc.Router1ID, "localAddress": "10.22.0.1", "remoteAddress": "10.22.0.2"},
		},
	}

	resp, _ := testutil.DoRequest(tc.Server, "POST", ipsecBasePath(), body, tc.Token)

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
}

func TestListIPsec_AfterCreate(t *testing.T) {
	body := map[string]interface{}{
		"name":        "test-ipsec-list",
		"mode":        "route-based",
		"authMethod":  "pre-shared-key",
		"ipsecSecret": "test-secret-list",
		"phase1":      map[string]string{"encryption": "aes-256", "hash": "sha256", "dhGroup": "modp2048", "lifetime": "1d"},
		"phase2":      map[string]string{"encryption": "aes-256-cbc", "authAlgorithm": "sha256", "pfsGroup": "modp2048", "lifetime": "30m"},
		"comment":     "test-ipsec-list",
		"endpoints": []map[string]interface{}{
			{"routerId": tc.Router1ID, "localAddress": "10.23.0.1", "remoteAddress": "10.23.0.2"},
		},
	}
	testutil.DoRequest(tc.Server, "POST", ipsecBasePath(), body, tc.Token)

	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", ipsecBasePath()+"/test-ipsec-list", nil, tc.Token)
		ctx := context.Background()
		testutil.CleanupRouterOS(ctx, tc.Router1Client)
	})

	resp, respBody := testutil.DoRequest(tc.Server, "GET", ipsecBasePath(), nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var tunnels []map[string]interface{}
	if err := json.Unmarshal(respBody, &tunnels); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	found := false
	for _, tun := range tunnels {
		if tun["name"] == "test-ipsec-list" {
			found = true
		}
	}
	if !found {
		t.Fatal("test-ipsec-list not found in list response")
	}
}

func TestGetIPsec(t *testing.T) {
	body := map[string]interface{}{
		"name":        "test-ipsec-get",
		"mode":        "route-based",
		"authMethod":  "pre-shared-key",
		"ipsecSecret": "test-secret-get",
		"phase1":      map[string]string{"encryption": "aes-256", "hash": "sha256", "dhGroup": "modp2048", "lifetime": "1d"},
		"phase2":      map[string]string{"encryption": "aes-256-cbc", "authAlgorithm": "sha256", "pfsGroup": "modp2048", "lifetime": "30m"},
		"comment":     "test-ipsec-get",
		"endpoints": []map[string]interface{}{
			{"routerId": tc.Router1ID, "localAddress": "10.24.0.1", "remoteAddress": "10.24.0.2"},
		},
	}
	testutil.DoRequest(tc.Server, "POST", ipsecBasePath(), body, tc.Token)

	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", ipsecBasePath()+"/test-ipsec-get", nil, tc.Token)
		ctx := context.Background()
		testutil.CleanupRouterOS(ctx, tc.Router1Client)
	})

	resp, respBody := testutil.DoRequest(tc.Server, "GET", ipsecBasePath()+"/test-ipsec-get", nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	if result["name"] != "test-ipsec-get" {
		t.Fatalf("expected name test-ipsec-get, got %v", result["name"])
	}

	endpoints := result["endpoints"].([]interface{})
	if len(endpoints) < 1 {
		t.Fatal("expected at least 1 endpoint")
	}

	ep := endpoints[0].(map[string]interface{})
	rosIds := ep["rosIds"].(map[string]interface{})
	if rosIds["peer"] == nil || rosIds["peer"] == "" {
		t.Fatal("expected rosIds.peer to be populated")
	}
	if rosIds["profile"] == nil || rosIds["profile"] == "" {
		t.Fatal("expected rosIds.profile to be populated")
	}
	if rosIds["proposal"] == nil || rosIds["proposal"] == "" {
		t.Fatal("expected rosIds.proposal to be populated")
	}
	if rosIds["identity"] == nil || rosIds["identity"] == "" {
		t.Fatal("expected rosIds.identity to be populated")
	}
}

func TestGetIPsec_NotFound(t *testing.T) {
	resp, _ := testutil.DoRequest(tc.Server, "GET", ipsecBasePath()+"/nonexistent-ipsec", nil, tc.Token)

	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", resp.StatusCode)
	}
}

func TestUpdateIPsec_Phase1(t *testing.T) {
	body := map[string]interface{}{
		"name":        "test-ipsec-up1",
		"mode":        "route-based",
		"authMethod":  "pre-shared-key",
		"ipsecSecret": "test-secret-up1",
		"phase1":      map[string]string{"encryption": "aes-256", "hash": "sha256", "dhGroup": "modp2048", "lifetime": "1d"},
		"phase2":      map[string]string{"encryption": "aes-256-cbc", "authAlgorithm": "sha256", "pfsGroup": "modp2048", "lifetime": "30m"},
		"comment":     "test-ipsec-up1",
		"endpoints":   []map[string]interface{}{{"routerId": tc.Router1ID, "localAddress": "10.25.0.1", "remoteAddress": "10.25.0.2"}},
	}
	testutil.DoRequest(tc.Server, "POST", ipsecBasePath(), body, tc.Token)
	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", ipsecBasePath()+"/test-ipsec-up1", nil, tc.Token)
		ctx := context.Background()
		testutil.CleanupRouterOS(ctx, tc.Router1Client)
	})

	updateBody := map[string]interface{}{
		"phase1": map[string]string{"encryption": "aes-128", "hash": "sha1", "dhGroup": "modp1024", "lifetime": "8h"},
	}

	resp, respBody := testutil.DoRequest(tc.Server, "PATCH", ipsecBasePath()+"/test-ipsec-up1", updateBody, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}
}

func TestUpdateIPsec_Phase2(t *testing.T) {
	body := map[string]interface{}{
		"name":        "test-ipsec-up2",
		"mode":        "route-based",
		"authMethod":  "pre-shared-key",
		"ipsecSecret": "test-secret-up2",
		"phase1":      map[string]string{"encryption": "aes-256", "hash": "sha256", "dhGroup": "modp2048", "lifetime": "1d"},
		"phase2":      map[string]string{"encryption": "aes-256-cbc", "authAlgorithm": "sha256", "pfsGroup": "modp2048", "lifetime": "30m"},
		"comment":     "test-ipsec-up2",
		"endpoints":   []map[string]interface{}{{"routerId": tc.Router1ID, "localAddress": "10.26.0.1", "remoteAddress": "10.26.0.2"}},
	}
	testutil.DoRequest(tc.Server, "POST", ipsecBasePath(), body, tc.Token)
	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", ipsecBasePath()+"/test-ipsec-up2", nil, tc.Token)
		ctx := context.Background()
		testutil.CleanupRouterOS(ctx, tc.Router1Client)
	})

	updateBody := map[string]interface{}{
		"phase2": map[string]string{"encryption": "aes-128", "authAlgorithm": "sha1", "pfsGroup": "modp1024", "lifetime": "15m"},
	}

	resp, respBody := testutil.DoRequest(tc.Server, "PATCH", ipsecBasePath()+"/test-ipsec-up2", updateBody, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}
}

func TestUpdateIPsec_Identity(t *testing.T) {
	body := map[string]interface{}{
		"name":        "test-ipsec-up3",
		"mode":        "route-based",
		"authMethod":  "pre-shared-key",
		"ipsecSecret": "test-secret-up3",
		"phase1":      map[string]string{"encryption": "aes-256", "hash": "sha256", "dhGroup": "modp2048", "lifetime": "1d"},
		"phase2":      map[string]string{"encryption": "aes-256-cbc", "authAlgorithm": "sha256", "pfsGroup": "modp2048", "lifetime": "30m"},
		"comment":     "test-ipsec-up3",
		"endpoints":   []map[string]interface{}{{"routerId": tc.Router1ID, "localAddress": "10.27.0.1", "remoteAddress": "10.27.0.2"}},
	}
	testutil.DoRequest(tc.Server, "POST", ipsecBasePath(), body, tc.Token)
	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", ipsecBasePath()+"/test-ipsec-up3", nil, tc.Token)
		ctx := context.Background()
		testutil.CleanupRouterOS(ctx, tc.Router1Client)
	})

	updateBody := map[string]interface{}{
		"ipsecSecret": "updated-secret-789",
	}

	resp, respBody := testutil.DoRequest(tc.Server, "PATCH", ipsecBasePath()+"/test-ipsec-up3", updateBody, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}
}

func TestUpdateIPsec_Endpoint(t *testing.T) {
	body := map[string]interface{}{
		"name":        "test-ipsec-up4",
		"mode":        "route-based",
		"authMethod":  "pre-shared-key",
		"ipsecSecret": "test-secret-up4",
		"phase1":      map[string]string{"encryption": "aes-256", "hash": "sha256", "dhGroup": "modp2048", "lifetime": "1d"},
		"phase2":      map[string]string{"encryption": "aes-256-cbc", "authAlgorithm": "sha256", "pfsGroup": "modp2048", "lifetime": "30m"},
		"comment":     "test-ipsec-up4",
		"endpoints":   []map[string]interface{}{{"routerId": tc.Router1ID, "localAddress": "10.28.0.1", "remoteAddress": "10.28.0.2"}},
	}
	testutil.DoRequest(tc.Server, "POST", ipsecBasePath(), body, tc.Token)
	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", ipsecBasePath()+"/test-ipsec-up4", nil, tc.Token)
		ctx := context.Background()
		testutil.CleanupRouterOS(ctx, tc.Router1Client)
	})

	updateBody := map[string]interface{}{
		"endpoints": []map[string]interface{}{
			{"routerId": tc.Router1ID, "localAddress": "10.28.1.1"},
		},
	}

	resp, respBody := testutil.DoRequest(tc.Server, "PATCH", ipsecBasePath()+"/test-ipsec-up4", updateBody, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}
}

func TestDeleteIPsec(t *testing.T) {
	body := map[string]interface{}{
		"name":        "test-ipsec-del",
		"mode":        "route-based",
		"authMethod":  "pre-shared-key",
		"ipsecSecret": "test-secret-del",
		"phase1":      map[string]string{"encryption": "aes-256", "hash": "sha256", "dhGroup": "modp2048", "lifetime": "1d"},
		"phase2":      map[string]string{"encryption": "aes-256-cbc", "authAlgorithm": "sha256", "pfsGroup": "modp2048", "lifetime": "30m"},
		"comment":     "test-ipsec-del",
		"endpoints":   []map[string]interface{}{{"routerId": tc.Router1ID, "localAddress": "10.29.0.1", "remoteAddress": "10.29.0.2"}},
	}
	testutil.DoRequest(tc.Server, "POST", ipsecBasePath(), body, tc.Token)

	resp, _ := testutil.DoRequest(tc.Server, "DELETE", ipsecBasePath()+"/test-ipsec-del", nil, tc.Token)

	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", resp.StatusCode)
	}

	t.Cleanup(func() {
		ctx := context.Background()
		testutil.CleanupRouterOS(ctx, tc.Router1Client)
	})
}

func TestDeleteIPsec_VerifyCleanup(t *testing.T) {
	body := map[string]interface{}{
		"name":        "test-ipsec-clean",
		"mode":        "route-based",
		"authMethod":  "pre-shared-key",
		"ipsecSecret": "test-secret-clean",
		"phase1":      map[string]string{"encryption": "aes-256", "hash": "sha256", "dhGroup": "modp2048", "lifetime": "1d"},
		"phase2":      map[string]string{"encryption": "aes-256-cbc", "authAlgorithm": "sha256", "pfsGroup": "modp2048", "lifetime": "30m"},
		"comment":     "test-ipsec-clean",
		"endpoints":   []map[string]interface{}{{"routerId": tc.Router1ID, "localAddress": "10.30.0.1", "remoteAddress": "10.30.0.2"}},
	}
	testutil.DoRequest(tc.Server, "POST", ipsecBasePath(), body, tc.Token)
	testutil.DoRequest(tc.Server, "DELETE", ipsecBasePath()+"/test-ipsec-clean", nil, tc.Token)

	t.Cleanup(func() {
		ctx := context.Background()
		testutil.CleanupRouterOS(ctx, tc.Router1Client)
	})

	// Verify no orphaned resources on RouterOS.
	ctx := context.Background()

	peersBody, _ := tc.Router1Client.Get(ctx, "/ip/ipsec/peer")
	var peers []map[string]interface{}
	if err := json.Unmarshal(peersBody, &peers); err != nil {
		t.Fatalf("unmarshal peers: %v\nbody: %s", err, string(peersBody))
	}
	for _, p := range peers {
		if p["name"] == "test-ipsec-clean" {
			t.Fatal("orphaned IPsec peer found after delete")
		}
	}

	profilesBody, _ := tc.Router1Client.Get(ctx, "/ip/ipsec/profile")
	var profiles []map[string]interface{}
	if err := json.Unmarshal(profilesBody, &profiles); err != nil {
		t.Fatalf("unmarshal profiles: %v\nbody: %s", err, string(profilesBody))
	}
	for _, p := range profiles {
		if p["name"] == "test-ipsec-clean" {
			t.Fatal("orphaned IPsec profile found after delete")
		}
	}

	proposalsBody, _ := tc.Router1Client.Get(ctx, "/ip/ipsec/proposal")
	var proposals []map[string]interface{}
	if err := json.Unmarshal(proposalsBody, &proposals); err != nil {
		t.Fatalf("unmarshal proposals: %v\nbody: %s", err, string(proposalsBody))
	}
	for _, p := range proposals {
		if p["name"] == "test-ipsec-clean" {
			t.Fatal("orphaned IPsec proposal found after delete")
		}
	}
}

func TestIPsec_Undo(t *testing.T) {
	body := map[string]interface{}{
		"name":        "test-ipsec-undo",
		"mode":        "route-based",
		"authMethod":  "pre-shared-key",
		"ipsecSecret": "test-secret-undo",
		"phase1":      map[string]string{"encryption": "aes-256", "hash": "sha256", "dhGroup": "modp2048", "lifetime": "1d"},
		"phase2":      map[string]string{"encryption": "aes-256-cbc", "authAlgorithm": "sha256", "pfsGroup": "modp2048", "lifetime": "30m"},
		"comment":     "test-ipsec-undo",
		"endpoints":   []map[string]interface{}{{"routerId": tc.Router1ID, "localAddress": "10.31.0.1", "remoteAddress": "10.31.0.2"}},
	}
	testutil.DoRequest(tc.Server, "POST", ipsecBasePath(), body, tc.Token)

	t.Cleanup(func() {
		ctx := context.Background()
		testutil.CleanupRouterOS(ctx, tc.Router1Client)
	})

	// Find group ID.
	_, histBody := testutil.DoRequest(tc.Server, "GET", "/api/v1/operations/history", nil, tc.Token)
	var history map[string]interface{}
	if err := json.Unmarshal(histBody, &history); err != nil {
		t.Fatalf("unmarshal history response: %v\nbody: %s", err, string(histBody))
	}

	var groupID string
	for _, g := range history["groups"].([]interface{}) {
		group := g.(map[string]interface{})
		desc, _ := group["description"].(string)
		if desc == "Create IPsec tunnel test-ipsec-undo" {
			groupID = group["id"].(string)
			break
		}
	}
	if groupID == "" {
		t.Fatal("could not find group ID for test-ipsec-undo")
	}

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
}
