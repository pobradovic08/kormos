//go:build integration

package cluster_test

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

func TestCreateCluster_HA(t *testing.T) {
	chr1IP := os.Getenv("CHR1_IP")
	chr2IP := os.Getenv("CHR2_IP")
	chrUser := os.Getenv("CHR_USER")
	chrPass := os.Getenv("CHR_PASSWORD")

	body := map[string]interface{}{
		"name": "test-ha-cluster",
		"routers": []map[string]interface{}{
			{"name": "test-master", "hostname": chr1IP, "host": chr1IP, "port": 443, "username": chrUser, "password": chrPass, "role": "master"},
			{"name": "test-backup", "hostname": chr2IP, "host": chr2IP, "port": 443, "username": chrUser, "password": chrPass, "role": "backup"},
		},
	}

	resp, respBody := testutil.DoRequest(tc.Server, "POST", "/api/clusters/", body, tc.Token)

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	if result["mode"] != "ha" {
		t.Fatalf("expected mode ha, got %v", result["mode"])
	}

	routers, ok := result["routers"].([]interface{})
	if !ok || len(routers) != 2 {
		t.Fatalf("expected 2 routers, got %v", result["routers"])
	}

	clusterID := result["id"].(string)
	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", "/api/clusters/"+clusterID, nil, tc.Token)
	})
}

func TestCreateCluster_Standalone(t *testing.T) {
	chr1IP := os.Getenv("CHR1_IP")
	chrUser := os.Getenv("CHR_USER")
	chrPass := os.Getenv("CHR_PASSWORD")

	body := map[string]interface{}{
		"name": "test-standalone",
		"routers": []map[string]interface{}{
			{"name": "test-solo", "hostname": chr1IP, "host": chr1IP, "port": 443, "username": chrUser, "password": chrPass, "role": "master"},
		},
	}

	resp, respBody := testutil.DoRequest(tc.Server, "POST", "/api/clusters/", body, tc.Token)

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	if result["mode"] != "standalone" {
		t.Fatalf("expected mode standalone, got %v", result["mode"])
	}

	clusterID := result["id"].(string)
	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", "/api/clusters/"+clusterID, nil, tc.Token)
	})
}

func TestCreateCluster_NoMaster(t *testing.T) {
	chr1IP := os.Getenv("CHR1_IP")
	chr2IP := os.Getenv("CHR2_IP")
	chrUser := os.Getenv("CHR_USER")
	chrPass := os.Getenv("CHR_PASSWORD")

	body := map[string]interface{}{
		"name": "test-no-master",
		"routers": []map[string]interface{}{
			{"name": "test-b1", "hostname": chr1IP, "host": chr1IP, "port": 443, "username": chrUser, "password": chrPass, "role": "backup"},
			{"name": "test-b2", "hostname": chr2IP, "host": chr2IP, "port": 443, "username": chrUser, "password": chrPass, "role": "backup"},
		},
	}

	resp, _ := testutil.DoRequest(tc.Server, "POST", "/api/clusters/", body, tc.Token)

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
}

func TestCreateCluster_TooManyRouters(t *testing.T) {
	chr1IP := os.Getenv("CHR1_IP")
	chrUser := os.Getenv("CHR_USER")
	chrPass := os.Getenv("CHR_PASSWORD")

	body := map[string]interface{}{
		"name": "test-too-many",
		"routers": []map[string]interface{}{
			{"name": "r1", "hostname": chr1IP, "host": chr1IP, "port": 443, "username": chrUser, "password": chrPass, "role": "master"},
			{"name": "r2", "hostname": chr1IP, "host": chr1IP, "port": 443, "username": chrUser, "password": chrPass, "role": "backup"},
			{"name": "r3", "hostname": chr1IP, "host": chr1IP, "port": 443, "username": chrUser, "password": chrPass, "role": "backup"},
		},
	}

	resp, _ := testutil.DoRequest(tc.Server, "POST", "/api/clusters/", body, tc.Token)

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
}

func TestCreateCluster_MissingFields(t *testing.T) {
	body := map[string]interface{}{
		"name":    "",
		"routers": []map[string]interface{}{},
	}

	resp, _ := testutil.DoRequest(tc.Server, "POST", "/api/clusters/", body, tc.Token)

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
}

func TestListClusters(t *testing.T) {
	resp, respBody := testutil.DoRequest(tc.Server, "GET", "/api/clusters/", nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var clusters []map[string]interface{}
	if err := json.Unmarshal(respBody, &clusters); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	if len(clusters) < 1 {
		t.Fatal("expected at least 1 cluster (seeded)")
	}
}

func TestGetCluster(t *testing.T) {
	resp, respBody := testutil.DoRequest(tc.Server, "GET", "/api/clusters/"+tc.ClusterID, nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	if result["id"] != tc.ClusterID {
		t.Fatalf("expected cluster ID %s, got %v", tc.ClusterID, result["id"])
	}

	routers, ok := result["routers"].([]interface{})
	if !ok || len(routers) < 1 {
		t.Fatal("expected routers array in cluster response")
	}
}

func TestGetCluster_NotFound(t *testing.T) {
	resp, _ := testutil.DoRequest(tc.Server, "GET", "/api/clusters/00000000-0000-0000-0000-000000000000", nil, tc.Token)

	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", resp.StatusCode)
	}
}

func TestUpdateCluster_Rename(t *testing.T) {
	// Use the seeded cluster for rename.
	body := map[string]interface{}{
		"name": "Renamed HA Cluster",
		"routers": []map[string]interface{}{
			{"id": tc.Router1ID, "name": "chr1-master", "hostname": os.Getenv("CHR1_IP"), "host": os.Getenv("CHR1_IP"), "port": 443, "username": os.Getenv("CHR_USER"), "password": os.Getenv("CHR_PASSWORD"), "role": "master"},
			{"id": tc.Router2ID, "name": "chr2-backup", "hostname": os.Getenv("CHR2_IP"), "host": os.Getenv("CHR2_IP"), "port": 443, "username": os.Getenv("CHR_USER"), "password": os.Getenv("CHR_PASSWORD"), "role": "backup"},
		},
	}

	resp, respBody := testutil.DoRequest(tc.Server, "PUT", "/api/clusters/"+tc.ClusterID, body, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	if result["name"] != "Renamed HA Cluster" {
		t.Fatalf("expected name 'Renamed HA Cluster', got %v", result["name"])
	}

	// Restore original name.
	t.Cleanup(func() {
		restoreBody := map[string]interface{}{
			"name": "Test HA Cluster",
			"routers": []map[string]interface{}{
				{"id": tc.Router1ID, "name": "chr1-master", "hostname": os.Getenv("CHR1_IP"), "host": os.Getenv("CHR1_IP"), "port": 443, "username": os.Getenv("CHR_USER"), "password": os.Getenv("CHR_PASSWORD"), "role": "master"},
				{"id": tc.Router2ID, "name": "chr2-backup", "hostname": os.Getenv("CHR2_IP"), "host": os.Getenv("CHR2_IP"), "port": 443, "username": os.Getenv("CHR_USER"), "password": os.Getenv("CHR_PASSWORD"), "role": "backup"},
			},
		}
		testutil.DoRequest(tc.Server, "PUT", "/api/clusters/"+tc.ClusterID, restoreBody, tc.Token)
	})
}

func TestUpdateCluster_AddRouter(t *testing.T) {
	// Create a standalone cluster first.
	chr1IP := os.Getenv("CHR1_IP")
	chr2IP := os.Getenv("CHR2_IP")
	chrUser := os.Getenv("CHR_USER")
	chrPass := os.Getenv("CHR_PASSWORD")

	createBody := map[string]interface{}{
		"name": "test-add-router",
		"routers": []map[string]interface{}{
			{"name": "test-solo-add", "hostname": chr1IP, "host": chr1IP, "port": 443, "username": chrUser, "password": chrPass, "role": "master"},
		},
	}

	_, createResp := testutil.DoRequest(tc.Server, "POST", "/api/clusters/", createBody, tc.Token)
	var created map[string]interface{}
	if err := json.Unmarshal(createResp, &created); err != nil {
		t.Fatalf("unmarshal create response: %v\nbody: %s", err, string(createResp))
	}
	clusterID := created["id"].(string)
	masterID := created["routers"].([]interface{})[0].(map[string]interface{})["id"].(string)

	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", "/api/clusters/"+clusterID, nil, tc.Token)
	})

	// Add a backup router.
	updateBody := map[string]interface{}{
		"name": "test-add-router",
		"routers": []map[string]interface{}{
			{"id": masterID, "name": "test-solo-add", "hostname": chr1IP, "host": chr1IP, "port": 443, "username": chrUser, "password": chrPass, "role": "master"},
			{"name": "test-new-backup", "hostname": chr2IP, "host": chr2IP, "port": 443, "username": chrUser, "password": chrPass, "role": "backup"},
		},
	}

	resp, respBody := testutil.DoRequest(tc.Server, "PUT", "/api/clusters/"+clusterID, updateBody, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	routers := result["routers"].([]interface{})
	if len(routers) != 2 {
		t.Fatalf("expected 2 routers after add, got %d", len(routers))
	}
}

func TestUpdateCluster_RemoveRouter(t *testing.T) {
	chr1IP := os.Getenv("CHR1_IP")
	chr2IP := os.Getenv("CHR2_IP")
	chrUser := os.Getenv("CHR_USER")
	chrPass := os.Getenv("CHR_PASSWORD")

	// Create HA cluster.
	createBody := map[string]interface{}{
		"name": "test-remove-router",
		"routers": []map[string]interface{}{
			{"name": "test-rm-master", "hostname": chr1IP, "host": chr1IP, "port": 443, "username": chrUser, "password": chrPass, "role": "master"},
			{"name": "test-rm-backup", "hostname": chr2IP, "host": chr2IP, "port": 443, "username": chrUser, "password": chrPass, "role": "backup"},
		},
	}

	_, createResp := testutil.DoRequest(tc.Server, "POST", "/api/clusters/", createBody, tc.Token)
	var created map[string]interface{}
	if err := json.Unmarshal(createResp, &created); err != nil {
		t.Fatalf("unmarshal create response: %v\nbody: %s", err, string(createResp))
	}
	clusterID := created["id"].(string)
	masterID := created["routers"].([]interface{})[0].(map[string]interface{})["id"].(string)

	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", "/api/clusters/"+clusterID, nil, tc.Token)
	})

	// Remove backup, keep only master.
	updateBody := map[string]interface{}{
		"name": "test-remove-router",
		"routers": []map[string]interface{}{
			{"id": masterID, "name": "test-rm-master", "hostname": chr1IP, "host": chr1IP, "port": 443, "username": chrUser, "password": chrPass, "role": "master"},
		},
	}

	resp, respBody := testutil.DoRequest(tc.Server, "PUT", "/api/clusters/"+clusterID, updateBody, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	routers := result["routers"].([]interface{})
	if len(routers) != 1 {
		t.Fatalf("expected 1 router after remove, got %d", len(routers))
	}
}

func TestDeleteCluster(t *testing.T) {
	chr1IP := os.Getenv("CHR1_IP")
	chrUser := os.Getenv("CHR_USER")
	chrPass := os.Getenv("CHR_PASSWORD")

	createBody := map[string]interface{}{
		"name": "test-delete-cluster",
		"routers": []map[string]interface{}{
			{"name": "test-del-master", "hostname": chr1IP, "host": chr1IP, "port": 443, "username": chrUser, "password": chrPass, "role": "master"},
		},
	}

	_, createResp := testutil.DoRequest(tc.Server, "POST", "/api/clusters/", createBody, tc.Token)
	var created map[string]interface{}
	if err := json.Unmarshal(createResp, &created); err != nil {
		t.Fatalf("unmarshal create response: %v\nbody: %s", err, string(createResp))
	}
	clusterID := created["id"].(string)

	resp, _ := testutil.DoRequest(tc.Server, "DELETE", "/api/clusters/"+clusterID, nil, tc.Token)

	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", resp.StatusCode)
	}

	// Verify it's gone.
	getResp, _ := testutil.DoRequest(tc.Server, "GET", "/api/clusters/"+clusterID, nil, tc.Token)
	if getResp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404 after delete, got %d", getResp.StatusCode)
	}
}

func TestTestConnection_Reachable(t *testing.T) {
	body := map[string]interface{}{
		"host":     os.Getenv("CHR1_IP"),
		"port":     443,
		"username": os.Getenv("CHR_USER"),
		"password": os.Getenv("CHR_PASSWORD"),
	}

	resp, respBody := testutil.DoRequest(tc.Server, "POST", "/api/clusters/test-connection", body, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	if result["success"] != true {
		t.Fatalf("expected success=true, got %v", result["success"])
	}
	if result["routeros_version"] == nil || result["routeros_version"] == "" {
		t.Fatal("expected routeros_version to be populated")
	}
}

func TestTestConnection_Unreachable(t *testing.T) {
	body := map[string]interface{}{
		"host":     "192.0.2.1",
		"port":     443,
		"username": "fake",
		"password": "fake",
	}

	resp, respBody := testutil.DoRequest(tc.Server, "POST", "/api/clusters/test-connection", body, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	if result["success"] != false {
		t.Fatalf("expected success=false, got %v", result["success"])
	}
}
