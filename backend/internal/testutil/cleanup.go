//go:build integration

package testutil

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/pobradovic08/kormos/backend/internal/routeros"
)

// CleanupRouterOS removes all test-created resources from a RouterOS device.
// It looks for resources with names matching the "test-" prefix.
func CleanupRouterOS(ctx context.Context, client *routeros.Client) {
	// 1. Delete GRE tunnels with "test-" prefix.
	cleanupByName(ctx, client, "/interface/gre", "test-")

	// 2. Delete WireGuard peers on "test-" interfaces.
	cleanupWGPeers(ctx, client, "test-")

	// 3. Delete WireGuard interfaces with "test-" prefix.
	cleanupByName(ctx, client, "/interface/wireguard", "test-")

	// 4. Delete IPsec identities referencing "test-" peers.
	cleanupIPsecIdentities(ctx, client, "test-")

	// 5. Delete IPsec policies referencing "test-" peers.
	cleanupIPsecPolicies(ctx, client, "test-")

	// 6. Delete IPsec peers with "test-" prefix.
	cleanupByName(ctx, client, "/ip/ipsec/peer", "test-")

	// 7. Delete IPsec profiles with "test-" prefix.
	cleanupByName(ctx, client, "/ip/ipsec/profile", "test-")

	// 8. Delete IPsec proposals with "test-" prefix.
	cleanupByName(ctx, client, "/ip/ipsec/proposal", "test-")

	// 9. Delete firewall rules with "test-" in comment.
	cleanupFirewallByComment(ctx, client, "test-")

	// 10. Delete routes with "test-" in comment.
	cleanupRoutesByComment(ctx, client, "test-")

	// 11. Delete address-list entries in "test-" lists.
	cleanupAddressListEntries(ctx, client, "test-")
}

// cleanupByName deletes all resources at the given path whose "name" field starts with prefix.
func cleanupByName(ctx context.Context, client *routeros.Client, path, prefix string) {
	body, err := client.Get(ctx, path)
	if err != nil {
		return
	}

	var items []map[string]interface{}
	if err := json.Unmarshal(body, &items); err != nil {
		return
	}

	for _, item := range items {
		name, _ := item["name"].(string)
		id, _ := item[".id"].(string)
		if strings.HasPrefix(name, prefix) && id != "" {
			_ = client.Delete(ctx, path+"/"+id)
		}
	}
}

// cleanupWGPeers deletes WireGuard peers whose interface name starts with prefix.
func cleanupWGPeers(ctx context.Context, client *routeros.Client, prefix string) {
	body, err := client.Get(ctx, "/interface/wireguard/peers")
	if err != nil {
		return
	}

	var items []map[string]interface{}
	if err := json.Unmarshal(body, &items); err != nil {
		return
	}

	for _, item := range items {
		iface, _ := item["interface"].(string)
		id, _ := item[".id"].(string)
		if strings.HasPrefix(iface, prefix) && id != "" {
			_ = client.Delete(ctx, "/interface/wireguard/peers/"+id)
		}
	}
}

// cleanupIPsecIdentities deletes IPsec identities referencing peers with the given prefix.
func cleanupIPsecIdentities(ctx context.Context, client *routeros.Client, prefix string) {
	body, err := client.Get(ctx, "/ip/ipsec/identity")
	if err != nil {
		return
	}

	var items []map[string]interface{}
	if err := json.Unmarshal(body, &items); err != nil {
		return
	}

	for _, item := range items {
		peer, _ := item["peer"].(string)
		id, _ := item[".id"].(string)
		if strings.HasPrefix(peer, prefix) && id != "" {
			_ = client.Delete(ctx, "/ip/ipsec/identity/"+id)
		}
	}
}

// cleanupIPsecPolicies deletes IPsec policies referencing peers with the given prefix.
func cleanupIPsecPolicies(ctx context.Context, client *routeros.Client, prefix string) {
	body, err := client.Get(ctx, "/ip/ipsec/policy")
	if err != nil {
		return
	}

	var items []map[string]interface{}
	if err := json.Unmarshal(body, &items); err != nil {
		return
	}

	for _, item := range items {
		peer, _ := item["peer"].(string)
		id, _ := item[".id"].(string)
		dynamic, _ := item["dynamic"].(string)
		if strings.HasPrefix(peer, prefix) && id != "" && dynamic != "true" {
			_ = client.Delete(ctx, "/ip/ipsec/policy/"+id)
		}
	}
}

// cleanupFirewallByComment deletes firewall filter rules whose comment starts with prefix.
func cleanupFirewallByComment(ctx context.Context, client *routeros.Client, prefix string) {
	body, err := client.Get(ctx, "/ip/firewall/filter")
	if err != nil {
		return
	}

	var items []map[string]interface{}
	if err := json.Unmarshal(body, &items); err != nil {
		return
	}

	for _, item := range items {
		comment, _ := item["comment"].(string)
		id, _ := item[".id"].(string)
		if strings.HasPrefix(comment, prefix) && id != "" {
			_ = client.Delete(ctx, "/ip/firewall/filter/"+id)
		}
	}
}

// cleanupRoutesByComment deletes static routes whose comment starts with prefix.
func cleanupRoutesByComment(ctx context.Context, client *routeros.Client, prefix string) {
	body, err := client.Get(ctx, "/ip/route")
	if err != nil {
		return
	}

	var items []map[string]interface{}
	if err := json.Unmarshal(body, &items); err != nil {
		return
	}

	for _, item := range items {
		comment, _ := item["comment"].(string)
		id, _ := item[".id"].(string)
		dynamic, _ := item["dynamic"].(string)
		if strings.HasPrefix(comment, prefix) && id != "" && dynamic != "true" {
			_ = client.Delete(ctx, "/ip/route/"+id)
		}
	}
}

// cleanupAddressListEntries deletes address-list entries whose list name starts with prefix.
func cleanupAddressListEntries(ctx context.Context, client *routeros.Client, prefix string) {
	body, err := client.Get(ctx, "/ip/firewall/address-list")
	if err != nil {
		return
	}

	var items []map[string]interface{}
	if err := json.Unmarshal(body, &items); err != nil {
		return
	}

	for _, item := range items {
		list, _ := item["list"].(string)
		id, _ := item[".id"].(string)
		if strings.HasPrefix(list, prefix) && id != "" {
			_ = client.Delete(ctx, "/ip/firewall/address-list/"+id)
		}
	}
}

// CleanupGREByName deletes a specific GRE tunnel by name from a RouterOS device.
func CleanupGREByName(ctx context.Context, client *routeros.Client, name string) {
	body, err := client.Get(ctx, "/interface/gre")
	if err != nil {
		return
	}

	var items []map[string]interface{}
	if err := json.Unmarshal(body, &items); err != nil {
		return
	}

	for _, item := range items {
		n, _ := item["name"].(string)
		id, _ := item[".id"].(string)
		if n == name && id != "" {
			_ = client.Delete(ctx, "/interface/gre/"+id)
		}
	}
}

// CleanupResourceByName is a generic helper that deletes a RouterOS resource by name at a given path.
func CleanupResourceByName(ctx context.Context, client *routeros.Client, path, name string) {
	body, err := client.Get(ctx, path)
	if err != nil {
		return
	}

	var items []map[string]interface{}
	if err := json.Unmarshal(body, &items); err != nil {
		return
	}

	for _, item := range items {
		n, _ := item["name"].(string)
		id, _ := item[".id"].(string)
		if n == name && id != "" {
			_ = client.Delete(ctx, fmt.Sprintf("%s/%s", path, id))
		}
	}
}
