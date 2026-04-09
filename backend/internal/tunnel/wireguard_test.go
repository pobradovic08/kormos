package tunnel

import (
	"testing"
)

func intPtr(i int) *int { return &i }

func TestBuildWGInterfaceCreateBody_Full(t *testing.T) {
	req := CreateWGInterfaceRequest{
		Name:       "wg1",
		ListenPort: 51820,
		MTU:        1420,
		Disabled:   true,
		Comment:    "test wg",
	}
	body := BuildWGInterfaceCreateBody(req)

	assertBodyStr(t, body, "name", "wg1")
	assertBodyStr(t, body, "listen-port", "51820")
	assertBodyStr(t, body, "mtu", "1420")
	assertBodyStr(t, body, "disabled", "true")
	assertBodyStr(t, body, "comment", "test wg")
}

func TestBuildWGInterfaceCreateBody_NoMTU(t *testing.T) {
	req := CreateWGInterfaceRequest{
		Name:       "wg2",
		ListenPort: 51821,
		MTU:        0,
	}
	body := BuildWGInterfaceCreateBody(req)

	if _, ok := body["mtu"]; ok {
		t.Error("expected mtu key to be absent when MTU is 0")
	}
}

func TestBuildWGInterfaceUpdateBody_Partial(t *testing.T) {
	req := UpdateWGInterfaceRequest{
		ListenPort: intPtr(51830),
	}
	body := BuildWGInterfaceUpdateBody(req)

	assertBodyStr(t, body, "listen-port", "51830")

	if len(body) != 1 {
		t.Errorf("expected body length 1, got %d", len(body))
	}
}

func TestBuildWGInterfaceUpdateBody_Empty(t *testing.T) {
	req := UpdateWGInterfaceRequest{}
	body := BuildWGInterfaceUpdateBody(req)

	if len(body) != 0 {
		t.Errorf("expected body length 0, got %d", len(body))
	}
}

func TestBuildWGPeerCreateBody_Full(t *testing.T) {
	req := CreateWGPeerRequest{
		PublicKey:           "dGVzdC1rZXk=",
		PresharedKey:        "cHNrLWtleQ==",
		AllowedAddress:      "10.0.0.0/24",
		EndpointAddress:     "5.5.5.5",
		EndpointPort:        51820,
		PersistentKeepalive: 25,
		Disabled:            true,
		Comment:             "test peer",
	}
	body := BuildWGPeerCreateBody("wg1", req)

	assertBodyStr(t, body, "interface", "wg1")
	assertBodyStr(t, body, "public-key", "dGVzdC1rZXk=")
	assertBodyStr(t, body, "preshared-key", "cHNrLWtleQ==")
	assertBodyStr(t, body, "allowed-address", "10.0.0.0/24")
	assertBodyStr(t, body, "endpoint-address", "5.5.5.5")
	assertBodyStr(t, body, "endpoint-port", "51820")
	assertBodyStr(t, body, "persistent-keepalive", "25")
	assertBodyStr(t, body, "disabled", "true")
	assertBodyStr(t, body, "comment", "test peer")
}

func TestBuildWGPeerUpdateBody_Partial(t *testing.T) {
	req := UpdateWGPeerRequest{
		AllowedAddress: strPtr("10.1.0.0/24"),
	}
	body := BuildWGPeerUpdateBody(req)

	assertBodyStr(t, body, "allowed-address", "10.1.0.0/24")

	if len(body) != 1 {
		t.Errorf("expected body length 1, got %d", len(body))
	}
}

func TestBuildWGPeerUpdateBody_DisabledToggle(t *testing.T) {
	req := UpdateWGPeerRequest{
		Disabled: boolPtr(false),
	}
	body := BuildWGPeerUpdateBody(req)

	assertBodyStr(t, body, "disabled", "false")
}

// assertBodyStr checks that body[key] equals the expected string value.
func assertBodyStr(t *testing.T, body map[string]interface{}, key, expected string) {
	t.Helper()
	val, ok := body[key]
	if !ok {
		t.Errorf("expected key %q to be present in body", key)
		return
	}
	s, ok := val.(string)
	if !ok {
		t.Errorf("expected key %q to be a string, got %T", key, val)
		return
	}
	if s != expected {
		t.Errorf("key %q: expected %q, got %q", key, expected, s)
	}
}
