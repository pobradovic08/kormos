//go:build integration

package tunnel_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/pobradovic08/kormos/backend/internal/testutil"
)

func interfacesBasePath() string {
	return fmt.Sprintf("/api/clusters/%s/interfaces", tc.ClusterID)
}

func TestListInterfaces_Merged(t *testing.T) {
	resp, respBody := testutil.DoRequest(tc.Server, "GET", interfacesBasePath(), nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var ifaces []map[string]interface{}
	if err := json.Unmarshal(respBody, &ifaces); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if len(ifaces) < 1 {
		t.Fatal("expected at least 1 merged interface")
	}

	// Verify each merged interface has an endpoints array.
	for _, iface := range ifaces {
		endpoints, ok := iface["endpoints"].([]interface{})
		if !ok {
			t.Fatalf("interface %v missing endpoints field", iface["name"])
		}
		if len(endpoints) < 1 {
			t.Fatalf("interface %v has no endpoints", iface["name"])
		}
	}
}

func TestListInterfaces_EndpointFields(t *testing.T) {
	resp, respBody := testutil.DoRequest(tc.Server, "GET", interfacesBasePath(), nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var ifaces []map[string]interface{}
	if err := json.Unmarshal(respBody, &ifaces); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	// Find an interface that has exactly 2 endpoints (one per router -- common on HA clusters).
	var found bool
	for _, iface := range ifaces {
		endpoints, _ := iface["endpoints"].([]interface{})
		if len(endpoints) < 2 {
			continue
		}
		found = true

		// Verify required per-router fields are present.
		for _, ep := range endpoints {
			epMap, _ := ep.(map[string]interface{})
			if epMap["routerId"] == nil {
				t.Fatalf("endpoint missing routerId in interface %v", iface["name"])
			}
			if epMap["routerName"] == nil {
				t.Fatalf("endpoint missing routerName in interface %v", iface["name"])
			}
			if epMap["role"] == nil {
				t.Fatalf("endpoint missing role in interface %v", iface["name"])
			}
			if epMap["rosId"] == nil {
				t.Fatalf("endpoint missing rosId in interface %v", iface["name"])
			}
			if _, ok := epMap["macAddress"]; !ok {
				t.Fatalf("endpoint missing macAddress in interface %v", iface["name"])
			}
			if _, ok := epMap["running"]; !ok {
				t.Fatalf("endpoint missing running in interface %v", iface["name"])
			}
		}
		break
	}

	if !found {
		// Single-router setups may not have 2 endpoints; skip gracefully.
		t.Log("No interface with 2 endpoints found -- may be single-router setup")
	}
}

func TestGetInterface(t *testing.T) {
	// First list all interfaces to find a known name.
	_, listBody := testutil.DoRequest(tc.Server, "GET", interfacesBasePath(), nil, tc.Token)

	var ifaces []map[string]interface{}
	if err := json.Unmarshal(listBody, &ifaces); err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}

	if len(ifaces) == 0 {
		t.Skip("no interfaces available to test GetInterface")
	}

	// Use the first interface name.
	ifaceName, _ := ifaces[0]["name"].(string)
	if ifaceName == "" {
		t.Fatal("first interface has no name")
	}

	resp, respBody := testutil.DoRequest(tc.Server, "GET", interfacesBasePath()+"/"+ifaceName, nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var iface map[string]interface{}
	if err := json.Unmarshal(respBody, &iface); err != nil {
		t.Fatalf("unmarshal iface: %v", err)
	}

	if iface["name"] != ifaceName {
		t.Fatalf("expected name %s, got %v", ifaceName, iface["name"])
	}

	// Verify endpoints are present.
	endpoints, ok := iface["endpoints"].([]interface{})
	if !ok || len(endpoints) < 1 {
		t.Fatal("expected at least 1 endpoint in GetInterface response")
	}
}

func TestGetInterface_NotFound(t *testing.T) {
	resp, respBody := testutil.DoRequest(tc.Server, "GET", interfacesBasePath()+"/nonexistent-iface-xyz", nil, tc.Token)

	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", resp.StatusCode, string(respBody))
	}

	var result map[string]interface{}
	if err := json.Unmarshal(respBody, &result); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if result["error"] == nil {
		t.Fatal("expected error field in 404 response")
	}
}
