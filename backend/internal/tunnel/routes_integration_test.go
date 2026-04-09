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

func routesBasePath() string {
	return fmt.Sprintf("/api/clusters/%s/routes", tc.ClusterID)
}

func TestListRoutes(t *testing.T) {
	resp, respBody := testutil.DoRequest(tc.Server, "GET", routesBasePath(), nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var routes []interface{}
	if err := json.Unmarshal(respBody, &routes); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	// Should be a valid array (possibly non-empty -- CHR always has connected routes).
	if routes == nil {
		t.Fatal("expected non-nil array")
	}
}

func TestCreateRoute(t *testing.T) {
	body := map[string]interface{}{
		"destination": "10.99.0.0/24",
		"gateway":     "10.0.0.1",
		"distance":    1,
		"comment":     "test-route-basic",
	}

	resp, respBody := testutil.DoRequest(tc.Server, "POST", routesBasePath(), body, tc.Token)

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", resp.StatusCode, string(respBody))
	}

	var routes []interface{}
	if err := json.Unmarshal(respBody, &routes); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	// The response is the full list; verify at least one route exists.
	if len(routes) < 1 {
		t.Fatal("expected at least 1 route in response")
	}

	t.Cleanup(func() {
		ctx := context.Background()
		testutil.CleanupRouterOS(ctx, tc.Router1Client)
		testutil.CleanupRouterOS(ctx, tc.Router2Client)
	})
}

func TestCreateRoute_MissingDestination(t *testing.T) {
	body := map[string]interface{}{
		"gateway":  "10.0.0.1",
		"distance": 1,
		"comment":  "test-route-missing-dst",
	}

	resp, _ := testutil.DoRequest(tc.Server, "POST", routesBasePath(), body, tc.Token)

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
}

func TestGetRoute(t *testing.T) {
	// Create a route first.
	createBody := map[string]interface{}{
		"destination": "10.98.0.0/24",
		"gateway":     "10.0.0.1",
		"distance":    1,
		"comment":     "test-route-get",
	}
	_, createResp := testutil.DoRequest(tc.Server, "POST", routesBasePath(), createBody, tc.Token)

	t.Cleanup(func() {
		ctx := context.Background()
		testutil.CleanupRouterOS(ctx, tc.Router1Client)
		testutil.CleanupRouterOS(ctx, tc.Router2Client)
	})

	// Find the route ID from the list.
	listResp, listBody := testutil.DoRequest(tc.Server, "GET", routesBasePath(), nil, tc.Token)
	if listResp.StatusCode != http.StatusOK {
		t.Fatalf("list routes: expected 200, got %d: %s", listResp.StatusCode, string(listBody))
	}

	_ = createResp

	var routes []map[string]interface{}
	if err := json.Unmarshal(listBody, &routes); err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}

	var routeID string
	for _, r := range routes {
		if r["comment"] == "test-route-get" {
			routeID, _ = r["id"].(string)
			break
		}
	}

	if routeID == "" {
		t.Fatal("could not find created route in list")
	}

	resp, respBody := testutil.DoRequest(tc.Server, "GET", routesBasePath()+"/"+routeID, nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var route map[string]interface{}
	if err := json.Unmarshal(respBody, &route); err != nil {
		t.Fatalf("unmarshal route: %v", err)
	}

	if route["id"] != routeID {
		t.Fatalf("expected route id %s, got %v", routeID, route["id"])
	}
}

func TestUpdateRoute(t *testing.T) {
	// Create a route first.
	createBody := map[string]interface{}{
		"destination": "10.97.0.0/24",
		"gateway":     "10.0.0.1",
		"distance":    1,
		"comment":     "test-route-update",
	}
	testutil.DoRequest(tc.Server, "POST", routesBasePath(), createBody, tc.Token)

	t.Cleanup(func() {
		ctx := context.Background()
		testutil.CleanupRouterOS(ctx, tc.Router1Client)
		testutil.CleanupRouterOS(ctx, tc.Router2Client)
	})

	// Find the route ID from the list.
	_, listBody := testutil.DoRequest(tc.Server, "GET", routesBasePath(), nil, tc.Token)

	var routes []map[string]interface{}
	if err := json.Unmarshal(listBody, &routes); err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}

	var routeID string
	for _, r := range routes {
		if r["comment"] == "test-route-update" {
			routeID, _ = r["id"].(string)
			break
		}
	}

	if routeID == "" {
		t.Fatal("could not find created route in list")
	}

	dist := 5
	patchBody := map[string]interface{}{
		"distance": dist,
	}

	resp, respBody := testutil.DoRequest(tc.Server, "PATCH", routesBasePath()+"/"+routeID, patchBody, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var updatedRoutes []interface{}
	if err := json.Unmarshal(respBody, &updatedRoutes); err != nil {
		t.Fatalf("unmarshal updated: %v", err)
	}

	if len(updatedRoutes) < 1 {
		t.Fatal("expected at least 1 route in update response")
	}
}

func TestDeleteRoute(t *testing.T) {
	// Create a route first.
	createBody := map[string]interface{}{
		"destination": "10.96.0.0/24",
		"gateway":     "10.0.0.1",
		"distance":    1,
		"comment":     "test-route-delete",
	}
	testutil.DoRequest(tc.Server, "POST", routesBasePath(), createBody, tc.Token)

	t.Cleanup(func() {
		ctx := context.Background()
		testutil.CleanupRouterOS(ctx, tc.Router1Client)
		testutil.CleanupRouterOS(ctx, tc.Router2Client)
	})

	// Find the route ID from the list.
	_, listBody := testutil.DoRequest(tc.Server, "GET", routesBasePath(), nil, tc.Token)

	var routes []map[string]interface{}
	if err := json.Unmarshal(listBody, &routes); err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}

	var routeID string
	for _, r := range routes {
		if r["comment"] == "test-route-delete" {
			routeID, _ = r["id"].(string)
			break
		}
	}

	if routeID == "" {
		t.Fatal("could not find created route in list")
	}

	resp, respBody := testutil.DoRequest(tc.Server, "DELETE", routesBasePath()+"/"+routeID, nil, tc.Token)

	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204, got %d: %s", resp.StatusCode, string(respBody))
	}
}
