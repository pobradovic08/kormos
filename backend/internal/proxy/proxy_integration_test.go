//go:build integration

package proxy_test

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

func TestProxyFirewallRules(t *testing.T) {
	resp, respBody := testutil.DoRequest(tc.Server, "GET", "/api/routers/"+tc.Router1ID+"/firewall/filter", nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var rules []interface{}
	if err := json.Unmarshal(respBody, &rules); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	// Should return an array (possibly empty on fresh CHR).
	if rules == nil {
		t.Fatal("expected non-nil array")
	}
}

func TestProxyRoutes(t *testing.T) {
	resp, respBody := testutil.DoRequest(tc.Server, "GET", "/api/routers/"+tc.Router1ID+"/routes", nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var routes []interface{}
	if err := json.Unmarshal(respBody, &routes); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	// Every RouterOS device has at least a connected route.
	if len(routes) < 1 {
		t.Fatal("expected at least 1 route")
	}
}

func TestProxyAddressLists(t *testing.T) {
	resp, respBody := testutil.DoRequest(tc.Server, "GET", "/api/routers/"+tc.Router1ID+"/address-lists", nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var lists []interface{}
	if err := json.Unmarshal(respBody, &lists); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	// May be empty on fresh CHR -- just verify it's a valid array.
	if lists == nil {
		t.Fatal("expected non-nil array")
	}
}

func TestProxyTunnels(t *testing.T) {
	resp, respBody := testutil.DoRequest(tc.Server, "GET", "/api/routers/"+tc.Router1ID+"/tunnels", nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var tunnels []interface{}
	if err := json.Unmarshal(respBody, &tunnels); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	// May be empty -- just verify it's a valid array.
	if tunnels == nil {
		t.Fatal("expected non-nil array")
	}
}

func TestProxyInterfaces(t *testing.T) {
	resp, respBody := testutil.DoRequest(tc.Server, "GET", "/api/routers/"+tc.Router1ID+"/interfaces", nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var ifaces []interface{}
	if err := json.Unmarshal(respBody, &ifaces); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if len(ifaces) < 1 {
		t.Fatal("expected at least 1 interface")
	}
}
