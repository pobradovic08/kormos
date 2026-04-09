package tunnel

import (
	"testing"
)

// ─── helpers ─────────────────────────────────────────────────────────────────

// findOp returns the first ipsecOp whose ResourcePath matches path, or nil.
func findOp(ops []ipsecOp, path string) *ipsecOp {
	for i := range ops {
		if ops[i].ResourcePath == path {
			return &ops[i]
		}
	}
	return nil
}

// findAllOps returns every ipsecOp whose ResourcePath matches path.
func findAllOps(ops []ipsecOp, path string) []ipsecOp {
	var out []ipsecOp
	for _, op := range ops {
		if op.ResourcePath == path {
			out = append(out, op)
		}
	}
	return out
}

// assertContainsPath fails the test if no op with the given path exists.
func assertContainsPath(t *testing.T, ops []ipsecOp, path string) {
	t.Helper()
	if findOp(ops, path) == nil {
		t.Fatalf("expected op with ResourcePath %q, but none found", path)
	}
}

// ─── stripPrefix ─────────────────────────────────────────────────────────────

func TestStripPrefix(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{name: "with /32", input: "10.0.0.1/32", want: "10.0.0.1"},
		{name: "with /24", input: "192.168.1.0/24", want: "192.168.1.0"},
		{name: "no prefix", input: "10.0.0.1", want: "10.0.0.1"},
		{name: "empty string", input: "", want: ""},
		{name: "slash only", input: "/", want: ""},
		{name: "ipv6 with prefix", input: "fd00::1/128", want: "fd00::1"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := stripPrefix(tc.input)
			if got != tc.want {
				t.Errorf("stripPrefix(%q) = %q; want %q", tc.input, got, tc.want)
			}
		})
	}
}

// ─── BuildIPsecCreateOps ─────────────────────────────────────────────────────

// baseRequest returns a minimal CreateIPsecRequest with sensible defaults.
func baseRequest() CreateIPsecRequest {
	return CreateIPsecRequest{
		Name:       "tunnel-a",
		Mode:       "route-based",
		AuthMethod: "pre-shared-key",
		IpsecSecret: "s3cret",
		Phase1: Phase1Config{
			Encryption: "aes-256",
			Hash:       "sha256",
			DHGroup:    "modp2048",
			Lifetime:   "1d",
		},
		Phase2: Phase2Config{
			Encryption:    "aes-256-cbc",
			AuthAlgorithm: "sha256",
			PFSGroup:      "modp2048",
			Lifetime:      "8h",
		},
		TunnelRoutes: []string{"10.20.0.0/24"},
	}
}

// baseEndpoint returns a CreateIPsecEndpointInput with tunnel addresses set.
func baseEndpoint() CreateIPsecEndpointInput {
	return CreateIPsecEndpointInput{
		RouterID:            "router-1",
		LocalAddress:        "1.2.3.4/32",
		RemoteAddress:       "5.6.7.8/32",
		LocalTunnelAddress:  "172.16.0.1/30",
		RemoteTunnelAddress: "172.16.0.2/30",
	}
}

func TestBuildIPsecCreateOps_RouteBasedWithTunnelAddresses(t *testing.T) {
	req := baseRequest()
	ep := baseEndpoint()
	ops := BuildIPsecCreateOps(req, ep.RouterID, ep)

	// All ops must carry the correct RouterID.
	for i, op := range ops {
		if op.RouterID != "router-1" {
			t.Errorf("ops[%d].RouterID = %q; want %q", i, op.RouterID, "router-1")
		}
	}

	// Profile and proposal are always emitted.
	assertContainsPath(t, ops, "/ip/ipsec/profile")
	assertContainsPath(t, ops, "/ip/ipsec/proposal")
	assertContainsPath(t, ops, "/ip/ipsec/peer")
	assertContainsPath(t, ops, "/ip/ipsec/identity")

	// Loopback interface must exist.
	loOp := findOp(ops, "/interface/loopback")
	if loOp == nil {
		t.Fatal("expected /interface/loopback op for route-based with tunnel addresses")
	}
	if loOp.Body["name"] != "lo-ipsec-tunnel-a" {
		t.Errorf("loopback name = %v; want %q", loOp.Body["name"], "lo-ipsec-tunnel-a")
	}
	// Loopback comment should contain the remote tunnel address (stripped of prefix).
	wantLoComment := "ipsec-lo:tunnel-a:172.16.0.2"
	if loOp.Body["comment"] != wantLoComment {
		t.Errorf("loopback comment = %v; want %q", loOp.Body["comment"], wantLoComment)
	}

	// IP address assigned to the loopback.
	addrOp := findOp(ops, "/ip/address")
	if addrOp == nil {
		t.Fatal("expected /ip/address op")
	}
	if addrOp.Body["address"] != "172.16.0.1/30" {
		t.Errorf("address = %v; want %q", addrOp.Body["address"], "172.16.0.1/30")
	}
	if addrOp.Body["interface"] != "lo-ipsec-tunnel-a" {
		t.Errorf("address interface = %v; want %q", addrOp.Body["interface"], "lo-ipsec-tunnel-a")
	}

	// Tunnel-mode policy: src/dst should be tunnel addresses, sa-* should be stripped peer addresses.
	policyOps := findAllOps(ops, "/ip/ipsec/policy")
	if len(policyOps) != 1 {
		t.Fatalf("expected 1 policy op; got %d", len(policyOps))
	}
	pol := policyOps[0]
	if pol.Body["tunnel"] != "yes" {
		t.Errorf("policy tunnel = %v; want %q", pol.Body["tunnel"], "yes")
	}
	if pol.Body["src-address"] != "172.16.0.1/30" {
		t.Errorf("policy src-address = %v; want %q", pol.Body["src-address"], "172.16.0.1/30")
	}
	if pol.Body["dst-address"] != "172.16.0.2/30" {
		t.Errorf("policy dst-address = %v; want %q", pol.Body["dst-address"], "172.16.0.2/30")
	}
	if pol.Body["sa-src-address"] != "1.2.3.4" {
		t.Errorf("policy sa-src-address = %v; want %q", pol.Body["sa-src-address"], "1.2.3.4")
	}
	if pol.Body["sa-dst-address"] != "5.6.7.8" {
		t.Errorf("policy sa-dst-address = %v; want %q", pol.Body["sa-dst-address"], "5.6.7.8")
	}

	// Route gateway should use the remote tunnel IP (stripped).
	routeOps := findAllOps(ops, "/ip/route")
	if len(routeOps) != 1 {
		t.Fatalf("expected 1 route op; got %d", len(routeOps))
	}
	if routeOps[0].Body["gateway"] != "172.16.0.2" {
		t.Errorf("route gateway = %v; want %q", routeOps[0].Body["gateway"], "172.16.0.2")
	}
	if routeOps[0].Body["dst-address"] != "10.20.0.0/24" {
		t.Errorf("route dst-address = %v; want %q", routeOps[0].Body["dst-address"], "10.20.0.0/24")
	}
}

func TestBuildIPsecCreateOps_RouteBasedNoTunnelAddresses(t *testing.T) {
	req := baseRequest()
	ep := CreateIPsecEndpointInput{
		RouterID:      "router-2",
		LocalAddress:  "1.2.3.4/32",
		RemoteAddress: "5.6.7.8/32",
		// No tunnel addresses.
	}
	ops := BuildIPsecCreateOps(req, ep.RouterID, ep)

	// There should be NO loopback or address ops.
	if findOp(ops, "/interface/loopback") != nil {
		t.Error("unexpected /interface/loopback op when no tunnel addresses")
	}
	if findOp(ops, "/ip/address") != nil {
		t.Error("unexpected /ip/address op when no tunnel addresses")
	}

	// Should get a template policy fallback.
	policyOps := findAllOps(ops, "/ip/ipsec/policy")
	if len(policyOps) != 1 {
		t.Fatalf("expected 1 template policy op; got %d", len(policyOps))
	}
	pol := policyOps[0]
	if pol.Body["template"] != "yes" {
		t.Errorf("policy template = %v; want %q", pol.Body["template"], "yes")
	}
	if pol.Body["src-address"] != "0.0.0.0/0" {
		t.Errorf("policy src-address = %v; want %q", pol.Body["src-address"], "0.0.0.0/0")
	}
	if pol.Body["dst-address"] != "0.0.0.0/0" {
		t.Errorf("policy dst-address = %v; want %q", pol.Body["dst-address"], "0.0.0.0/0")
	}

	// Route gateway should fall back to remote peer address (stripped).
	routeOps := findAllOps(ops, "/ip/route")
	if len(routeOps) != 1 {
		t.Fatalf("expected 1 route op; got %d", len(routeOps))
	}
	if routeOps[0].Body["gateway"] != "5.6.7.8" {
		t.Errorf("route gateway = %v; want %q", routeOps[0].Body["gateway"], "5.6.7.8")
	}
}

func TestBuildIPsecCreateOps_PolicyBased(t *testing.T) {
	req := baseRequest()
	req.Mode = "policy-based"
	req.LocalSubnets = []string{"192.168.1.0/24", "192.168.2.0/24"}
	req.RemoteSubnets = []string{"10.0.1.0/24", "10.0.2.0/24"}
	req.TunnelRoutes = nil // No routes for policy-based.

	ep := CreateIPsecEndpointInput{
		RouterID:      "router-3",
		LocalAddress:  "1.2.3.4/32",
		RemoteAddress: "5.6.7.8/32",
	}
	ops := BuildIPsecCreateOps(req, ep.RouterID, ep)

	// Should have one policy per local subnet.
	policyOps := findAllOps(ops, "/ip/ipsec/policy")
	if len(policyOps) != 2 {
		t.Fatalf("expected 2 policy ops for policy-based; got %d", len(policyOps))
	}
	if policyOps[0].Body["src-address"] != "192.168.1.0/24" {
		t.Errorf("policy[0] src-address = %v; want %q", policyOps[0].Body["src-address"], "192.168.1.0/24")
	}
	if policyOps[0].Body["dst-address"] != "10.0.1.0/24" {
		t.Errorf("policy[0] dst-address = %v; want %q", policyOps[0].Body["dst-address"], "10.0.1.0/24")
	}
	if policyOps[1].Body["src-address"] != "192.168.2.0/24" {
		t.Errorf("policy[1] src-address = %v; want %q", policyOps[1].Body["src-address"], "192.168.2.0/24")
	}
	if policyOps[1].Body["dst-address"] != "10.0.2.0/24" {
		t.Errorf("policy[1] dst-address = %v; want %q", policyOps[1].Body["dst-address"], "10.0.2.0/24")
	}

	// No loopback, no address, no route ops for policy-based.
	if findOp(ops, "/interface/loopback") != nil {
		t.Error("unexpected /interface/loopback op for policy-based")
	}
	if findOp(ops, "/ip/address") != nil {
		t.Error("unexpected /ip/address op for policy-based")
	}
	if findOp(ops, "/ip/route") != nil {
		t.Error("unexpected /ip/route op for policy-based")
	}
}

func TestBuildIPsecCreateOps_DisabledAndComment(t *testing.T) {
	req := baseRequest()
	req.Disabled = true
	req.Comment = "maintenance window"
	ep := baseEndpoint()
	ops := BuildIPsecCreateOps(req, ep.RouterID, ep)

	peerOp := findOp(ops, "/ip/ipsec/peer")
	if peerOp == nil {
		t.Fatal("expected /ip/ipsec/peer op")
	}
	if peerOp.Body["disabled"] != "true" {
		t.Errorf("peer disabled = %v; want %q", peerOp.Body["disabled"], "true")
	}
	if peerOp.Body["comment"] != "maintenance window" {
		t.Errorf("peer comment = %v; want %q", peerOp.Body["comment"], "maintenance window")
	}

	// When not disabled and no comment, those keys should be absent.
	req.Disabled = false
	req.Comment = ""
	ops2 := BuildIPsecCreateOps(req, ep.RouterID, ep)
	peerOp2 := findOp(ops2, "/ip/ipsec/peer")
	if peerOp2 == nil {
		t.Fatal("expected /ip/ipsec/peer op")
	}
	if _, ok := peerOp2.Body["disabled"]; ok {
		t.Error("peer body should not contain 'disabled' key when Disabled=false")
	}
	if _, ok := peerOp2.Body["comment"]; ok {
		t.Error("peer body should not contain 'comment' key when Comment is empty")
	}
}

func TestBuildIPsecCreateOps_MultipleRoutes(t *testing.T) {
	req := baseRequest()
	req.TunnelRoutes = []string{"10.20.0.0/24", "10.30.0.0/16", "10.40.0.0/8"}
	ep := baseEndpoint()
	ops := BuildIPsecCreateOps(req, ep.RouterID, ep)

	routeOps := findAllOps(ops, "/ip/route")
	if len(routeOps) != 3 {
		t.Fatalf("expected 3 route ops; got %d", len(routeOps))
	}

	wantDsts := []string{"10.20.0.0/24", "10.30.0.0/16", "10.40.0.0/8"}
	for i, op := range routeOps {
		if op.Body["dst-address"] != wantDsts[i] {
			t.Errorf("route[%d] dst-address = %v; want %q", i, op.Body["dst-address"], wantDsts[i])
		}
		if op.Body["comment"] != "ipsec:tunnel-a" {
			t.Errorf("route[%d] comment = %v; want %q", i, op.Body["comment"], "ipsec:tunnel-a")
		}
		// All routes should use remote tunnel IP as gateway.
		if op.Body["gateway"] != "172.16.0.2" {
			t.Errorf("route[%d] gateway = %v; want %q", i, op.Body["gateway"], "172.16.0.2")
		}
	}
}
