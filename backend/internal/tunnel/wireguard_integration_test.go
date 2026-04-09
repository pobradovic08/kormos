//go:build integration

package tunnel_test

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/pobradovic08/kormos/backend/internal/testutil"
)

func wgBasePath() string {
	return fmt.Sprintf("/api/clusters/%s/wireguard", tc.ClusterID)
}

// generateWGPublicKey generates a random 32-byte key and returns it as a base64 string,
// suitable for use as a WireGuard public key in tests.
func generateWGPublicKey() string {
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		panic("wireguard: generate key: " + err.Error())
	}
	return base64.StdEncoding.EncodeToString(key)
}

func TestListWireGuard_Empty(t *testing.T) {
	resp, respBody := testutil.DoRequest(tc.Server, "GET", wgBasePath(), nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var wgs []interface{}
	if err := json.Unmarshal(respBody, &wgs); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	// Verify no test-prefixed WireGuard interfaces exist.
	for _, wg := range wgs {
		wgMap := wg.(map[string]interface{})
		iface, ok := wgMap["interface"].(map[string]interface{})
		if !ok {
			continue
		}
		name, _ := iface["name"].(string)
		if name == "test-wg-basic" {
			t.Fatal("test-wg-basic should not exist yet")
		}
	}
}

func TestCreateWGInterface(t *testing.T) {
	body := map[string]interface{}{
		"routerId":   tc.Router1ID,
		"name":       "test-wg-basic",
		"listenPort": 51820,
	}

	resp, respBody := testutil.DoRequest(tc.Server, "POST", wgBasePath(), body, tc.Token)

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	iface, ok := result["interface"].(map[string]interface{})
	if !ok {
		t.Fatal("expected interface object in response")
	}
	if iface["name"] != "test-wg-basic" {
		t.Fatalf("expected name test-wg-basic, got %v", iface["name"])
	}
	if iface["publicKey"] == nil || iface["publicKey"] == "" {
		t.Fatal("expected publicKey to be populated")
	}

	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", wgBasePath()+"/"+tc.Router1ID+"/test-wg-basic", nil, tc.Token)
		ctx := context.Background()
		testutil.CleanupResourceByName(ctx, tc.Router1Client, "/interface/wireguard", "test-wg-basic")
	})
}

func TestCreateWGInterface_InvalidRouter(t *testing.T) {
	body := map[string]interface{}{
		"routerId":   "00000000-0000-0000-0000-000000000000",
		"name":       "test-wg-invalid",
		"listenPort": 51820,
	}

	resp, respBody := testutil.DoRequest(tc.Server, "POST", wgBasePath(), body, tc.Token)

	if resp.StatusCode != http.StatusBadGateway {
		t.Fatalf("expected 502 (router not found causes upstream error), got %d: %s", resp.StatusCode, string(respBody))
	}
}

func TestListWireGuard_AfterCreate(t *testing.T) {
	body := map[string]interface{}{
		"routerId":   tc.Router1ID,
		"name":       "test-wg-list",
		"listenPort": 51821,
	}
	testutil.DoRequest(tc.Server, "POST", wgBasePath(), body, tc.Token)

	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", wgBasePath()+"/"+tc.Router1ID+"/test-wg-list", nil, tc.Token)
		ctx := context.Background()
		testutil.CleanupResourceByName(ctx, tc.Router1Client, "/interface/wireguard", "test-wg-list")
	})

	resp, respBody := testutil.DoRequest(tc.Server, "GET", wgBasePath(), nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var wgs []map[string]interface{}
	if err := json.Unmarshal(respBody, &wgs); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	found := false
	for _, wg := range wgs {
		iface, ok := wg["interface"].(map[string]interface{})
		if !ok {
			continue
		}
		if iface["name"] == "test-wg-list" {
			found = true
			// Verify router info is present.
			if wg["routerId"] == nil || wg["routerId"] == "" {
				t.Fatal("expected routerId to be populated in list response")
			}
		}
	}
	if !found {
		t.Fatal("test-wg-list not found in list response")
	}
}

func TestGetWireGuard(t *testing.T) {
	body := map[string]interface{}{
		"routerId":   tc.Router1ID,
		"name":       "test-wg-get",
		"listenPort": 51822,
	}
	testutil.DoRequest(tc.Server, "POST", wgBasePath(), body, tc.Token)

	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", wgBasePath()+"/"+tc.Router1ID+"/test-wg-get", nil, tc.Token)
		ctx := context.Background()
		testutil.CleanupResourceByName(ctx, tc.Router1Client, "/interface/wireguard", "test-wg-get")
	})

	resp, respBody := testutil.DoRequest(tc.Server, "GET", wgBasePath()+"/"+tc.Router1ID+"/test-wg-get", nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	iface, ok := result["interface"].(map[string]interface{})
	if !ok {
		t.Fatal("expected interface object in response")
	}
	if iface["name"] != "test-wg-get" {
		t.Fatalf("expected name test-wg-get, got %v", iface["name"])
	}
}

func TestGetWireGuard_NotFound(t *testing.T) {
	resp, _ := testutil.DoRequest(tc.Server, "GET", wgBasePath()+"/"+tc.Router1ID+"/nonexistent-wg", nil, tc.Token)

	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", resp.StatusCode)
	}
}

func TestUpdateWGInterface(t *testing.T) {
	body := map[string]interface{}{
		"routerId":   tc.Router1ID,
		"name":       "test-wg-upd",
		"listenPort": 51823,
	}
	testutil.DoRequest(tc.Server, "POST", wgBasePath(), body, tc.Token)

	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", wgBasePath()+"/"+tc.Router1ID+"/test-wg-upd", nil, tc.Token)
		ctx := context.Background()
		testutil.CleanupResourceByName(ctx, tc.Router1Client, "/interface/wireguard", "test-wg-upd")
	})

	listenPort := 51824
	updateBody := map[string]interface{}{
		"listenPort": listenPort,
	}

	resp, respBody := testutil.DoRequest(tc.Server, "PATCH", wgBasePath()+"/"+tc.Router1ID+"/test-wg-upd", updateBody, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	iface, ok := result["interface"].(map[string]interface{})
	if !ok {
		t.Fatal("expected interface object in response")
	}
	gotPort, _ := iface["listenPort"].(float64)
	if int(gotPort) != listenPort {
		t.Fatalf("expected listenPort %d, got %v", listenPort, iface["listenPort"])
	}
}

func TestCreateWGPeer(t *testing.T) {
	// Create interface first.
	ifaceBody := map[string]interface{}{
		"routerId":   tc.Router1ID,
		"name":       "test-wg-peer",
		"listenPort": 51825,
	}
	testutil.DoRequest(tc.Server, "POST", wgBasePath(), ifaceBody, tc.Token)

	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", wgBasePath()+"/"+tc.Router1ID+"/test-wg-peer", nil, tc.Token)
		ctx := context.Background()
		testutil.CleanupResourceByName(ctx, tc.Router1Client, "/interface/wireguard", "test-wg-peer")
	})

	peerBody := map[string]interface{}{
		"publicKey":      generateWGPublicKey(),
		"allowedAddress": "10.0.0.0/24",
	}

	resp, respBody := testutil.DoRequest(tc.Server, "POST", wgBasePath()+"/"+tc.Router1ID+"/test-wg-peer/peers", peerBody, tc.Token)

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	peers, ok := result["peers"].([]interface{})
	if !ok || len(peers) < 1 {
		t.Fatal("expected at least 1 peer in response")
	}
}

func TestCreateWGPeer_MultiplePeers(t *testing.T) {
	// Create interface.
	ifaceBody := map[string]interface{}{
		"routerId":   tc.Router1ID,
		"name":       "test-wg-multi",
		"listenPort": 51826,
	}
	testutil.DoRequest(tc.Server, "POST", wgBasePath(), ifaceBody, tc.Token)

	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", wgBasePath()+"/"+tc.Router1ID+"/test-wg-multi", nil, tc.Token)
		ctx := context.Background()
		testutil.CleanupResourceByName(ctx, tc.Router1Client, "/interface/wireguard", "test-wg-multi")
	})

	// Add first peer.
	peer1Body := map[string]interface{}{
		"publicKey":      generateWGPublicKey(),
		"allowedAddress": "10.1.0.0/24",
	}
	testutil.DoRequest(tc.Server, "POST", wgBasePath()+"/"+tc.Router1ID+"/test-wg-multi/peers", peer1Body, tc.Token)

	// Add second peer.
	peer2Body := map[string]interface{}{
		"publicKey":      generateWGPublicKey(),
		"allowedAddress": "10.2.0.0/24",
	}
	testutil.DoRequest(tc.Server, "POST", wgBasePath()+"/"+tc.Router1ID+"/test-wg-multi/peers", peer2Body, tc.Token)

	// Verify both peers appear in GET response.
	resp, respBody := testutil.DoRequest(tc.Server, "GET", wgBasePath()+"/"+tc.Router1ID+"/test-wg-multi", nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	peers, ok := result["peers"].([]interface{})
	if !ok || len(peers) < 2 {
		t.Fatalf("expected at least 2 peers, got %d", len(peers))
	}
}

func TestUpdateWGPeer(t *testing.T) {
	// Create interface.
	ifaceBody := map[string]interface{}{
		"routerId":   tc.Router1ID,
		"name":       "test-wg-peer-upd",
		"listenPort": 51827,
	}
	testutil.DoRequest(tc.Server, "POST", wgBasePath(), ifaceBody, tc.Token)

	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", wgBasePath()+"/"+tc.Router1ID+"/test-wg-peer-upd", nil, tc.Token)
		ctx := context.Background()
		testutil.CleanupResourceByName(ctx, tc.Router1Client, "/interface/wireguard", "test-wg-peer-upd")
	})

	// Create peer.
	peerBody := map[string]interface{}{
		"publicKey":      generateWGPublicKey(),
		"allowedAddress": "10.3.0.0/24",
	}
	_, createRespBody := testutil.DoRequest(tc.Server, "POST", wgBasePath()+"/"+tc.Router1ID+"/test-wg-peer-upd/peers", peerBody, tc.Token)

	var createResult map[string]interface{}
	if err := json.Unmarshal(createRespBody, &createResult); err != nil {
		t.Fatalf("unmarshal create response: %v\nbody: %s", err, string(createRespBody))
	}

	peers, ok := createResult["peers"].([]interface{})
	if !ok || len(peers) < 1 {
		t.Fatal("expected at least 1 peer after create")
	}
	peer := peers[0].(map[string]interface{})
	peerID, _ := peer["rosId"].(string)
	if peerID == "" {
		t.Fatal("expected rosId to be populated for peer")
	}

	// Update peer allowed address.
	newAddr := "10.3.1.0/24"
	updateBody := map[string]interface{}{
		"allowedAddress": newAddr,
	}

	resp, respBody := testutil.DoRequest(tc.Server, "PATCH", wgBasePath()+"/"+tc.Router1ID+"/test-wg-peer-upd/peers/"+peerID, updateBody, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}
}

func TestDeleteWGPeer(t *testing.T) {
	// Create interface.
	ifaceBody := map[string]interface{}{
		"routerId":   tc.Router1ID,
		"name":       "test-wg-peer-del",
		"listenPort": 51828,
	}
	testutil.DoRequest(tc.Server, "POST", wgBasePath(), ifaceBody, tc.Token)

	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", wgBasePath()+"/"+tc.Router1ID+"/test-wg-peer-del", nil, tc.Token)
		ctx := context.Background()
		testutil.CleanupResourceByName(ctx, tc.Router1Client, "/interface/wireguard", "test-wg-peer-del")
	})

	// Create peer.
	peerBody := map[string]interface{}{
		"publicKey":      generateWGPublicKey(),
		"allowedAddress": "10.4.0.0/24",
	}
	_, createRespBody := testutil.DoRequest(tc.Server, "POST", wgBasePath()+"/"+tc.Router1ID+"/test-wg-peer-del/peers", peerBody, tc.Token)

	var createResult map[string]interface{}
	if err := json.Unmarshal(createRespBody, &createResult); err != nil {
		t.Fatalf("unmarshal create response: %v\nbody: %s", err, string(createRespBody))
	}

	peers, ok := createResult["peers"].([]interface{})
	if !ok || len(peers) < 1 {
		t.Fatal("expected at least 1 peer after create")
	}
	peer := peers[0].(map[string]interface{})
	peerID, _ := peer["rosId"].(string)
	if peerID == "" {
		t.Fatal("expected rosId to be populated for peer")
	}

	// Delete peer.
	resp, _ := testutil.DoRequest(tc.Server, "DELETE", wgBasePath()+"/"+tc.Router1ID+"/test-wg-peer-del/peers/"+peerID, nil, tc.Token)

	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", resp.StatusCode)
	}

	// Verify interface still exists after peer deletion.
	getResp, _ := testutil.DoRequest(tc.Server, "GET", wgBasePath()+"/"+tc.Router1ID+"/test-wg-peer-del", nil, tc.Token)
	if getResp.StatusCode != http.StatusOK {
		t.Fatalf("expected interface to still exist after peer deletion, got %d", getResp.StatusCode)
	}
}

func TestDeleteWGInterface(t *testing.T) {
	// Create interface.
	ifaceBody := map[string]interface{}{
		"routerId":   tc.Router1ID,
		"name":       "test-wg-del",
		"listenPort": 51829,
	}
	testutil.DoRequest(tc.Server, "POST", wgBasePath(), ifaceBody, tc.Token)

	// Create a peer on the interface.
	peerBody := map[string]interface{}{
		"publicKey":      generateWGPublicKey(),
		"allowedAddress": "10.5.0.0/24",
	}
	testutil.DoRequest(tc.Server, "POST", wgBasePath()+"/"+tc.Router1ID+"/test-wg-del/peers", peerBody, tc.Token)

	// Delete the interface (should also remove peers).
	resp, _ := testutil.DoRequest(tc.Server, "DELETE", wgBasePath()+"/"+tc.Router1ID+"/test-wg-del", nil, tc.Token)

	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", resp.StatusCode)
	}

	// Verify interface is gone.
	getResp, _ := testutil.DoRequest(tc.Server, "GET", wgBasePath()+"/"+tc.Router1ID+"/test-wg-del", nil, tc.Token)
	if getResp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404 after interface deletion, got %d", getResp.StatusCode)
	}

	t.Cleanup(func() {
		ctx := context.Background()
		testutil.CleanupResourceByName(ctx, tc.Router1Client, "/interface/wireguard", "test-wg-del")
	})
}
