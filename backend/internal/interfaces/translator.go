package interfaces

import "fmt"

// interfaceTypeToPath maps the canonical interface type name to the RouterOS
// REST API path used for creating that type of interface.
var interfaceTypeToPath = map[string]string{
	"vlan":      "/rest/interface/vlan",
	"bonding":   "/rest/interface/bonding",
	"bridge":    "/rest/interface/bridge",
	"wireguard": "/rest/interface/wireguard",
	"gre":       "/rest/interface/gre",
	"eoip":      "/rest/interface/eoip",
	"loopback":  "/rest/interface/bridge",
}

// formFieldToRouterOS maps frontend form field names to the corresponding
// RouterOS REST API field names.
var formFieldToRouterOS = map[string]string{
	"name":                "name",
	"comment":             "comment",
	"mtu":                 "mtu",
	"disabled":            "disabled",
	"arp":                 "arp",
	"vlanId":              "vlan-id",
	"parentInterface":     "interface",
	"bondingMode":         "mode",
	"slaves":              "slaves",
	"bridgePorts":         "bridge-ports",
	"stpEnabled":          "stp",
	"wireguardPrivateKey": "private-key",
	"wireguardListenPort": "listen-port",
	"greLocalAddress":     "local-address",
	"greRemoteAddress":    "remote-address",
	"tunnelId":            "tunnel-id",
}

// TranslateCreateToRouterOS converts a frontend interface creation request
// into the HTTP method, RouterOS REST path, and body required to create
// the interface.
//
// The formData keys use the camelCase names from the frontend form. They
// are translated to the hyphenated RouterOS field names automatically.
func TranslateCreateToRouterOS(interfaceType string, formData map[string]interface{}) (method string, path string, body map[string]interface{}, err error) {
	p, ok := interfaceTypeToPath[interfaceType]
	if !ok {
		return "", "", nil, fmt.Errorf("translator: unsupported interface type %q", interfaceType)
	}

	body = make(map[string]interface{}, len(formData))
	for k, v := range formData {
		rosKey, mapped := formFieldToRouterOS[k]
		if mapped {
			body[rosKey] = v
		} else {
			// Pass through unknown keys as-is (allows extra RouterOS fields).
			body[k] = v
		}
	}

	return "PUT", p, body, nil
}

// TranslateDeleteToRouterOS returns the HTTP method and RouterOS REST path
// required to delete a specific interface resource identified by its
// RouterOS .id.
func TranslateDeleteToRouterOS(interfaceType, resourceID string) (method string, path string, err error) {
	p, ok := interfaceTypeToPath[interfaceType]
	if !ok {
		return "", "", fmt.Errorf("translator: unsupported interface type %q for deletion", interfaceType)
	}

	return "DELETE", fmt.Sprintf("%s/%s", p, resourceID), nil
}
