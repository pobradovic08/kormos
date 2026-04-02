package interfaces

import (
	"testing"
)

func TestTranslateCreateToRouterOS_VLAN(t *testing.T) {
	formData := map[string]interface{}{
		"name":            "vlan100",
		"vlanId":          100,
		"parentInterface": "ether1",
		"comment":         "Management VLAN",
	}

	method, path, body, err := TranslateCreateToRouterOS("vlan", formData)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if method != "PUT" {
		t.Errorf("expected PUT, got %s", method)
	}
	if path != "/rest/interface/vlan" {
		t.Errorf("expected /rest/interface/vlan, got %s", path)
	}
	if body["vlan-id"] != 100 {
		t.Errorf("expected vlan-id=100, got %v", body["vlan-id"])
	}
	if body["interface"] != "ether1" {
		t.Errorf("expected interface=ether1, got %v", body["interface"])
	}
	if body["name"] != "vlan100" {
		t.Errorf("expected name=vlan100, got %v", body["name"])
	}
}

func TestTranslateCreateToRouterOS_UnsupportedType(t *testing.T) {
	_, _, _, err := TranslateCreateToRouterOS("unknown", nil)
	if err == nil {
		t.Fatal("expected error for unsupported type")
	}
}

func TestTranslateDeleteToRouterOS(t *testing.T) {
	method, path, err := TranslateDeleteToRouterOS("vlan", "*1A")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if method != "DELETE" {
		t.Errorf("expected DELETE, got %s", method)
	}
	if path != "/rest/interface/vlan/*1A" {
		t.Errorf("expected /rest/interface/vlan/*1A, got %s", path)
	}
}

func TestTranslateDeleteToRouterOS_UnsupportedType(t *testing.T) {
	_, _, err := TranslateDeleteToRouterOS("unknown", "*1")
	if err == nil {
		t.Fatal("expected error for unsupported type")
	}
}

func TestTranslateCreateToRouterOS_Bridge(t *testing.T) {
	formData := map[string]interface{}{
		"name":       "bridge1",
		"stpEnabled": true,
	}

	method, path, body, err := TranslateCreateToRouterOS("bridge", formData)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if method != "PUT" {
		t.Errorf("expected PUT, got %s", method)
	}
	if path != "/rest/interface/bridge" {
		t.Errorf("expected /rest/interface/bridge, got %s", path)
	}
	if body["stp"] != true {
		t.Errorf("expected stp=true, got %v", body["stp"])
	}
}

func TestTranslateCreateToRouterOS_WireGuard(t *testing.T) {
	formData := map[string]interface{}{
		"name":                "wg0",
		"wireguardListenPort": 51820,
		"wireguardPrivateKey": "secret",
	}

	_, path, body, err := TranslateCreateToRouterOS("wireguard", formData)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if path != "/rest/interface/wireguard" {
		t.Errorf("expected /rest/interface/wireguard, got %s", path)
	}
	if body["listen-port"] != 51820 {
		t.Errorf("expected listen-port=51820, got %v", body["listen-port"])
	}
	if body["private-key"] != "secret" {
		t.Errorf("expected private-key=secret, got %v", body["private-key"])
	}
}

func TestTranslateCreateToRouterOS_GRE(t *testing.T) {
	formData := map[string]interface{}{
		"name":             "gre-tunnel1",
		"greLocalAddress":  "10.0.0.1",
		"greRemoteAddress": "10.0.0.2",
	}

	_, path, body, err := TranslateCreateToRouterOS("gre", formData)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if path != "/rest/interface/gre" {
		t.Errorf("expected /rest/interface/gre, got %s", path)
	}
	if body["local-address"] != "10.0.0.1" {
		t.Errorf("expected local-address=10.0.0.1, got %v", body["local-address"])
	}
	if body["remote-address"] != "10.0.0.2" {
		t.Errorf("expected remote-address=10.0.0.2, got %v", body["remote-address"])
	}
}

func TestTranslateCreateToRouterOS_EoIP(t *testing.T) {
	formData := map[string]interface{}{
		"name":             "eoip1",
		"greLocalAddress":  "10.0.0.1",
		"greRemoteAddress": "10.0.0.2",
		"tunnelId":         100,
	}

	_, path, body, err := TranslateCreateToRouterOS("eoip", formData)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if path != "/rest/interface/eoip" {
		t.Errorf("expected /rest/interface/eoip, got %s", path)
	}
	if body["tunnel-id"] != 100 {
		t.Errorf("expected tunnel-id=100, got %v", body["tunnel-id"])
	}
}

func TestTranslateCreateToRouterOS_Bonding(t *testing.T) {
	formData := map[string]interface{}{
		"name":        "bond0",
		"bondingMode": "802.3ad",
		"slaves":      "ether1,ether2",
	}

	_, path, body, err := TranslateCreateToRouterOS("bonding", formData)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if path != "/rest/interface/bonding" {
		t.Errorf("expected /rest/interface/bonding, got %s", path)
	}
	if body["mode"] != "802.3ad" {
		t.Errorf("expected mode=802.3ad, got %v", body["mode"])
	}
	if body["slaves"] != "ether1,ether2" {
		t.Errorf("expected slaves=ether1,ether2, got %v", body["slaves"])
	}
}
