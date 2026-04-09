package tunnel

import (
	"testing"
)

func TestBuildGRECreateBody_Full(t *testing.T) {
	req := CreateGRERequest{
		Name:              "gre1",
		MTU:               1400,
		KeepaliveInterval: 10,
		KeepaliveRetries:  5,
		IpsecSecret:       "secret",
		Disabled:          true,
		Comment:           "test gre",
	}
	ep := CreateGREEndpointInput{
		LocalAddress:  "1.1.1.1",
		RemoteAddress: "2.2.2.2",
	}

	body := BuildGRECreateBody(req, ep)

	expected := map[string]interface{}{
		"name":           "gre1",
		"local-address":  "1.1.1.1",
		"remote-address": "2.2.2.2",
		"mtu":            "1400",
		"keepalive":      "10s,5",
		"ipsec-secret":   "secret",
		"disabled":       "true",
		"comment":        "test gre",
	}

	for key, want := range expected {
		got, ok := body[key]
		if !ok {
			t.Errorf("expected key %q in body, but it was absent", key)
			continue
		}
		if got != want {
			t.Errorf("body[%q] = %v, want %v", key, got, want)
		}
	}

	if len(body) != len(expected) {
		t.Errorf("body has %d keys, want %d", len(body), len(expected))
	}
}

func TestBuildGRECreateBody_NoOptionalFields(t *testing.T) {
	req := CreateGRERequest{
		Name: "gre-minimal",
	}
	ep := CreateGREEndpointInput{
		LocalAddress:  "1.1.1.1",
		RemoteAddress: "2.2.2.2",
	}

	body := BuildGRECreateBody(req, ep)

	for _, key := range []string{"ipsec-secret", "disabled", "comment"} {
		if _, ok := body[key]; ok {
			t.Errorf("expected key %q to be absent from body, but it was present", key)
		}
	}
}

func TestBuildGREUpdateBody_PartialMTU(t *testing.T) {
	mtu := 1500
	req := UpdateGRERequest{
		MTU: &mtu,
	}

	body := BuildGREUpdateBody(req, nil)

	if got, ok := body["mtu"]; !ok {
		t.Error("expected key \"mtu\" in body, but it was absent")
	} else if got != "1500" {
		t.Errorf("body[\"mtu\"] = %v, want \"1500\"", got)
	}

	if len(body) != 1 {
		t.Errorf("body has %d keys, want 1; body = %v", len(body), body)
	}
}

func TestBuildGREUpdateBody_EndpointAddresses(t *testing.T) {
	local := "3.3.3.3"
	remote := "4.4.4.4"
	ep := &UpdateGREEndpointInput{
		LocalAddress:  &local,
		RemoteAddress: &remote,
	}
	req := UpdateGRERequest{}

	body := BuildGREUpdateBody(req, ep)

	if got, ok := body["local-address"]; !ok {
		t.Error("expected key \"local-address\" in body, but it was absent")
	} else if got != "3.3.3.3" {
		t.Errorf("body[\"local-address\"] = %v, want \"3.3.3.3\"", got)
	}

	if got, ok := body["remote-address"]; !ok {
		t.Error("expected key \"remote-address\" in body, but it was absent")
	} else if got != "4.4.4.4" {
		t.Errorf("body[\"remote-address\"] = %v, want \"4.4.4.4\"", got)
	}
}

func TestBuildGREUpdateBody_Empty(t *testing.T) {
	req := UpdateGRERequest{}

	body := BuildGREUpdateBody(req, nil)

	if len(body) != 0 {
		t.Errorf("expected empty body, got %d keys: %v", len(body), body)
	}
}
