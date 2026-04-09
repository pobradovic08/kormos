package tunnel

import (
	"context"
	"fmt"

	"github.com/pobradovic08/kormos/backend/internal/operation"
	"github.com/pobradovic08/kormos/backend/internal/proxy"
)

// ─── Address List Request Types ───────────────────────────────────────────────

// CreateAddressEntryRequest is the payload for creating an address list entry.
type CreateAddressEntryRequest struct {
	List     string `json:"list"`
	Address  string `json:"address"`
	Comment  string `json:"comment,omitempty"`
	Disabled bool   `json:"disabled"`
}

func (r CreateAddressEntryRequest) toRouterOS() map[string]interface{} {
	m := map[string]interface{}{
		"list":    r.List,
		"address": r.Address,
	}
	if r.Comment != "" {
		m["comment"] = r.Comment
	}
	if r.Disabled {
		m["disabled"] = "true"
	}
	return m
}

// UpdateAddressEntryRequest is the payload for updating an address list entry.
type UpdateAddressEntryRequest struct {
	Address  *string `json:"address,omitempty"`
	Comment  *string `json:"comment,omitempty"`
	Disabled *bool   `json:"disabled,omitempty"`
}

func (r UpdateAddressEntryRequest) toRouterOS() map[string]interface{} {
	m := map[string]interface{}{}
	if r.Address != nil {
		m["address"] = *r.Address
	}
	if r.Comment != nil {
		m["comment"] = *r.Comment
	}
	if r.Disabled != nil {
		if *r.Disabled {
			m["disabled"] = "true"
		} else {
			m["disabled"] = "false"
		}
	}
	return m
}

// ─── Address List Service Methods ─────────────────────────────────────────────

// ListAddressLists fetches address lists from the master router.
func (s *Service) ListAddressLists(ctx context.Context, tenantID, clusterID string) ([]proxy.AddressList, error) {
	client, err := s.getMasterClient(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	return proxy.FetchAddressLists(ctx, client)
}

// CreateAddressEntry creates an address list entry on all routers in the cluster.
func (s *Service) CreateAddressEntry(ctx context.Context, tenantID, userID, clusterID string, req CreateAddressEntryRequest) ([]proxy.AddressList, error) {
	routers, _, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	body := req.toRouterOS()
	ops := make([]operation.ExecuteOperation, 0, len(routers))
	for _, ri := range routers {
		ops = append(ops, operation.ExecuteOperation{
			RouterID:      ri.ID,
			Module:        "address-lists",
			OperationType: operation.OpAdd,
			ResourcePath:  "/ip/firewall/address-list",
			Body:          body,
		})
	}

	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Create address list entry: %s %s", req.List, req.Address),
		Operations:  ops,
	}
	if _, err := s.operationSvc.Execute(ctx, tenantID, userID, execReq); err != nil {
		return nil, fmt.Errorf("address-lists: create entry: %w", err)
	}

	return s.ListAddressLists(ctx, tenantID, clusterID)
}

// flattenAddressEntries returns all entries across all lists with their list name attached.
type flatEntry struct {
	ListName string
	Entry    proxy.AddressEntry
}

func flattenAddressEntries(lists []proxy.AddressList) []flatEntry {
	var result []flatEntry
	for _, list := range lists {
		for _, entry := range list.Entries {
			result = append(result, flatEntry{ListName: list.Name, Entry: entry})
		}
	}
	return result
}

// findAddressEntryByID finds an address entry by its RouterOS ID across all lists.
func findAddressEntryByID(lists []proxy.AddressList, id string) (*flatEntry, bool) {
	for _, list := range lists {
		for _, entry := range list.Entries {
			if entry.ID == id {
				return &flatEntry{ListName: list.Name, Entry: entry}, true
			}
		}
	}
	return nil, false
}

// findMatchingAddressEntry finds an entry on a target router that matches the reference by content.
// Matches on list name + prefix (address) + comment.
func findMatchingAddressEntry(flat []flatEntry, ref flatEntry) *flatEntry {
	for i := range flat {
		f := &flat[i]
		if f.ListName == ref.ListName &&
			f.Entry.Prefix == ref.Entry.Prefix &&
			f.Entry.Comment == ref.Entry.Comment {
			return f
		}
	}
	return nil
}

// UpdateAddressEntry updates an address list entry on all routers in the cluster.
func (s *Service) UpdateAddressEntry(ctx context.Context, tenantID, userID, clusterID, entryID string, req UpdateAddressEntryRequest) ([]proxy.AddressList, error) {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	// Fetch from master to get the canonical entry for content matching.
	var refEntry *flatEntry
	for _, ri := range routers {
		if ri.Role == "master" {
			masterLists, err := proxy.FetchAddressLists(ctx, clients[ri.ID])
			if err != nil {
				return nil, fmt.Errorf("address-lists: fetch from master: %w", err)
			}
			refEntry, _ = findAddressEntryByID(masterLists, entryID)
			break
		}
	}
	if refEntry == nil {
		return nil, fmt.Errorf("address-lists: entry %s not found on master router", entryID)
	}

	body := req.toRouterOS()
	ops := make([]operation.ExecuteOperation, 0, len(routers))
	for _, ri := range routers {
		var targetID string
		if ri.Role == "master" {
			targetID = entryID
		} else {
			lists, err := proxy.FetchAddressLists(ctx, clients[ri.ID])
			if err != nil {
				return nil, fmt.Errorf("address-lists: fetch from router %s: %w", ri.Name, err)
			}
			flat := flattenAddressEntries(lists)
			match := findMatchingAddressEntry(flat, *refEntry)
			if match == nil {
				continue
			}
			targetID = match.Entry.ID
		}
		ops = append(ops, operation.ExecuteOperation{
			RouterID:      ri.ID,
			Module:        "address-lists",
			OperationType: operation.OpModify,
			ResourcePath:  "/ip/firewall/address-list",
			ResourceID:    targetID,
			Body:          body,
		})
	}

	if len(ops) == 0 {
		return nil, fmt.Errorf("address-lists: entry not found on any router")
	}

	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Update address list entry %s", entryID),
		Operations:  ops,
	}
	if _, err := s.operationSvc.Execute(ctx, tenantID, userID, execReq); err != nil {
		return nil, fmt.Errorf("address-lists: update entry: %w", err)
	}

	return s.ListAddressLists(ctx, tenantID, clusterID)
}

// DeleteAddressEntry deletes an address list entry from all routers in the cluster.
func (s *Service) DeleteAddressEntry(ctx context.Context, tenantID, userID, clusterID, entryID string) error {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return err
	}

	// Fetch from master to get the canonical entry for content matching.
	var refEntry *flatEntry
	for _, ri := range routers {
		if ri.Role == "master" {
			masterLists, err := proxy.FetchAddressLists(ctx, clients[ri.ID])
			if err != nil {
				return fmt.Errorf("address-lists: fetch from master: %w", err)
			}
			refEntry, _ = findAddressEntryByID(masterLists, entryID)
			break
		}
	}
	if refEntry == nil {
		return fmt.Errorf("address-lists: entry %s not found on master router", entryID)
	}

	ops := make([]operation.ExecuteOperation, 0, len(routers))
	for _, ri := range routers {
		var targetID string
		if ri.Role == "master" {
			targetID = entryID
		} else {
			lists, err := proxy.FetchAddressLists(ctx, clients[ri.ID])
			if err != nil {
				return fmt.Errorf("address-lists: fetch from router %s: %w", ri.Name, err)
			}
			flat := flattenAddressEntries(lists)
			match := findMatchingAddressEntry(flat, *refEntry)
			if match == nil {
				continue
			}
			targetID = match.Entry.ID
		}
		ops = append(ops, operation.ExecuteOperation{
			RouterID:      ri.ID,
			Module:        "address-lists",
			OperationType: operation.OpDelete,
			ResourcePath:  "/ip/firewall/address-list",
			ResourceID:    targetID,
		})
	}

	if len(ops) == 0 {
		return fmt.Errorf("address-lists: entry not found on any router")
	}

	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Delete address list entry %s", entryID),
		Operations:  ops,
	}
	if _, err := s.operationSvc.Execute(ctx, tenantID, userID, execReq); err != nil {
		return fmt.Errorf("address-lists: delete entry: %w", err)
	}

	return nil
}
