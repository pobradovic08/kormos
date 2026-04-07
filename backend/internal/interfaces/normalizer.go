package interfaces

import (
	"encoding/json"
	"fmt"
	"strconv"
)

// Interface represents a normalised RouterOS network interface with its
// associated IP addresses.
type Interface struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	DefaultName string                 `json:"default_name,omitempty"`
	Type        string                 `json:"type"`
	Running     bool                   `json:"running"`
	Disabled    bool                   `json:"disabled"`
	Comment     string                 `json:"comment"`
	MTU         int                    `json:"mtu"`
	MACAddress  string                 `json:"mac_address"`
	Addresses   []Address              `json:"addresses"`
	Properties  map[string]interface{} `json:"properties"`
}

// Address represents an IP address assigned to a RouterOS interface.
type Address struct {
	ID        string `json:"id"`
	Address   string `json:"address"`
	Network   string `json:"network"`
	Interface string `json:"interface"`
}

// rawInterface mirrors the JSON structure returned by RouterOS GET /interface.
type rawInterface struct {
	ID          string `json:".id"`
	Name        string `json:"name"`
	DefaultName string `json:"default-name"`
	Type        string `json:"type"`
	Running     string `json:"running"`
	Disabled    string `json:"disabled"`
	Comment     string `json:"comment"`
	ActualMTU   string `json:"actual-mtu"`
	MTU         string `json:"mtu"`
	MACAddr     string `json:"mac-address"`
}

// rawAddress mirrors the JSON structure returned by RouterOS GET /ip/address.
type rawAddress struct {
	ID        string `json:".id"`
	Address   string `json:"address"`
	Network   string `json:"network"`
	Interface string `json:"interface"`
}

// NormalizeInterfaces parses the raw JSON arrays returned by RouterOS for
// /interface and /ip/address, converts them into the canonical Interface
// representation, and merges addresses into their parent interfaces by
// matching the "interface" field.
func NormalizeInterfaces(rawInterfaces []byte, rawAddresses []byte) ([]Interface, error) {
	var ris []rawInterface
	if err := json.Unmarshal(rawInterfaces, &ris); err != nil {
		return nil, fmt.Errorf("interfaces: parse interfaces JSON: %w", err)
	}

	var ras []rawAddress
	if err := json.Unmarshal(rawAddresses, &ras); err != nil {
		return nil, fmt.Errorf("interfaces: parse addresses JSON: %w", err)
	}

	// Build a lookup from interface name to slice of Address.
	addrMap := make(map[string][]Address, len(ras))
	for _, ra := range ras {
		addrMap[ra.Interface] = append(addrMap[ra.Interface], Address{
			ID:        ra.ID,
			Address:   ra.Address,
			Network:   ra.Network,
			Interface: ra.Interface,
		})
	}

	// Also parse each raw interface into a generic map so we can capture
	// extra properties that are not part of the normalised struct.
	var rawMaps []map[string]interface{}
	if err := json.Unmarshal(rawInterfaces, &rawMaps); err != nil {
		return nil, fmt.Errorf("interfaces: parse interfaces JSON for properties: %w", err)
	}

	// Known keys that are mapped to first-class fields — excluded from Properties.
	knownKeys := map[string]struct{}{
		".id": {}, "name": {}, "default-name": {}, "type": {}, "running": {}, "disabled": {},
		"comment": {}, "actual-mtu": {}, "mtu": {}, "mac-address": {},
	}

	result := make([]Interface, 0, len(ris))
	for i, ri := range ris {
		mtu := parseMTU(ri.ActualMTU)
		if mtu == 0 {
			mtu = parseMTU(ri.MTU)
		}

		iface := Interface{
			ID:          ri.ID,
			Name:        ri.Name,
			DefaultName: ri.DefaultName,
			Type:        ri.Type,
			Running:    ri.Running == "true",
			Disabled:   ri.Disabled == "true",
			Comment:    ri.Comment,
			MTU:        mtu,
			MACAddress: ri.MACAddr,
			Addresses:  addrMap[ri.Name],
		}

		if iface.Addresses == nil {
			iface.Addresses = []Address{}
		}

		// Collect extra properties.
		props := make(map[string]interface{})
		if i < len(rawMaps) {
			for k, v := range rawMaps[i] {
				if _, known := knownKeys[k]; !known {
					props[k] = v
				}
			}
		}
		iface.Properties = props

		result = append(result, iface)
	}

	return result, nil
}

// parseMTU converts a string MTU value to int, returning 0 on failure.
func parseMTU(s string) int {
	if s == "" {
		return 0
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return 0
	}
	return v
}
