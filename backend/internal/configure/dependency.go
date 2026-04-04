package configure

import (
	"sort"
	"strings"
)

// createOrder defines the topological order in which RouterOS resources should
// be created. Resources earlier in the list are applied first because they may
// be dependencies of later ones (e.g., a bridge must exist before its ports).
var createOrder = []string{
	"interface/ethernet",
	"interface/bonding",
	"interface/bridge",
	"interface/bridge/port",
	"interface/vlan",
	"interface/wireguard",
	"interface/wireguard/peers",
	"interface/gre",
	"interface/eoip",
	"ip/address",
}

// createOrderIndex maps a resource type to its position in createOrder for O(1)
// lookup during sorting. Types not present in the map are placed after all
// known types.
var createOrderIndex map[string]int

func init() {
	createOrderIndex = make(map[string]int, len(createOrder))
	for i, rt := range createOrder {
		createOrderIndex[rt] = i
	}
}

// Operation describes a single configuration change to be applied to a
// RouterOS device.
type Operation struct {
	Index        int                    `json:"index"`
	Module       string                 `json:"module"`
	OpType       string                 `json:"operation"`
	ResourcePath string                 `json:"resource_path"`
	Method       string                 `json:"method"`
	Body         map[string]interface{} `json:"body"`
}

// extractResourceType strips the /rest prefix from a ResourcePath and returns
// the canonical resource type string used for dependency ordering.
// For example "/rest/interface/vlan" becomes "interface/vlan", and
// "/rest/interface/vlan/*12" becomes "interface/vlan".
func extractResourceType(resourcePath string) string {
	path := strings.TrimPrefix(resourcePath, "/rest/")
	path = strings.TrimPrefix(path, "/")

	// Remove any trailing resource ID segment (starts with '*').
	parts := strings.Split(path, "/")
	cleaned := make([]string, 0, len(parts))
	for _, p := range parts {
		if strings.HasPrefix(p, "*") {
			continue
		}
		cleaned = append(cleaned, p)
	}
	return strings.Join(cleaned, "/")
}

// orderOf returns the position of a resource type in createOrder. Unknown
// types receive a position past the end of the list so they sort last.
func orderOf(resourceType string) int {
	if idx, ok := createOrderIndex[resourceType]; ok {
		return idx
	}
	return len(createOrder)
}

// SortOperations performs a topological sort on the provided operations:
//   - Creates (PUT) are sorted by createOrder (dependencies first).
//   - Deletes (DELETE) are sorted by reverse createOrder (dependents first).
//   - Updates (PATCH) are left in their original order.
//
// The returned slice is ordered: creates, then updates, then deletes.
func SortOperations(ops []Operation) []Operation {
	var creates, updates, deletes []Operation

	for _, op := range ops {
		switch op.Method {
		case "PUT":
			creates = append(creates, op)
		case "DELETE":
			deletes = append(deletes, op)
		default:
			updates = append(updates, op)
		}
	}

	sort.SliceStable(creates, func(i, j int) bool {
		return orderOf(extractResourceType(creates[i].ResourcePath)) <
			orderOf(extractResourceType(creates[j].ResourcePath))
	})

	sort.SliceStable(deletes, func(i, j int) bool {
		return orderOf(extractResourceType(deletes[i].ResourcePath)) >
			orderOf(extractResourceType(deletes[j].ResourcePath))
	})

	result := make([]Operation, 0, len(ops))
	result = append(result, creates...)
	result = append(result, updates...)
	result = append(result, deletes...)
	return result
}
