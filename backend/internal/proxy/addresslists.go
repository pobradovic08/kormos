package proxy

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/pobradovic08/kormos/backend/internal/routeros"
)

// AddressList is a named group of address entries.
type AddressList struct {
	Name    string         `json:"name"`
	Entries []AddressEntry `json:"entries"`
}

// AddressEntry is a single entry in an address list.
type AddressEntry struct {
	ID       string `json:"id"`
	Prefix   string `json:"prefix"`
	Comment  string `json:"comment,omitempty"`
	Disabled bool   `json:"disabled"`
}

type rawAddressEntry struct {
	ID       string `json:".id"`
	List     string `json:"list"`
	Address  string `json:"address"`
	Comment  string `json:"comment"`
	Disabled string `json:"disabled"`
}

// FetchAddressLists fetches address list entries from RouterOS and groups them by list name.
func FetchAddressLists(ctx context.Context, client *routeros.Client) ([]AddressList, error) {
	body, err := client.Get(ctx, "/ip/firewall/address-list")
	if err != nil {
		return nil, fmt.Errorf("proxy: fetch address lists: %w", err)
	}

	var raw []rawAddressEntry
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("proxy: parse address lists: %w", err)
	}

	// Group entries by list name, preserving order of first appearance.
	listOrder := make([]string, 0)
	listMap := make(map[string][]AddressEntry)

	for _, r := range raw {
		entry := AddressEntry{
			ID:       r.ID,
			Prefix:   r.Address,
			Comment:  r.Comment,
			Disabled: parseBool(r.Disabled),
		}
		if _, exists := listMap[r.List]; !exists {
			listOrder = append(listOrder, r.List)
		}
		listMap[r.List] = append(listMap[r.List], entry)
	}

	lists := make([]AddressList, 0, len(listOrder))
	for _, name := range listOrder {
		lists = append(lists, AddressList{
			Name:    name,
			Entries: listMap[name],
		})
	}
	return lists, nil
}
