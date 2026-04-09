//go:build integration

package tunnel_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/pobradovic08/kormos/backend/internal/testutil"
)

func addressListsBasePath() string {
	return fmt.Sprintf("/api/clusters/%s/address-lists", tc.ClusterID)
}

func TestListAddressLists(t *testing.T) {
	resp, respBody := testutil.DoRequest(tc.Server, "GET", addressListsBasePath(), nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var lists []interface{}
	if err := json.Unmarshal(respBody, &lists); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	// May be empty on fresh CHR -- verify it's a valid array.
	if lists == nil {
		t.Fatal("expected non-nil array")
	}
}

func TestCreateAddressEntry(t *testing.T) {
	body := map[string]interface{}{
		"list":    "test-addr-list",
		"address": "10.88.0.0/24",
		"comment": "test-addr-basic",
	}

	resp, respBody := testutil.DoRequest(tc.Server, "POST", addressListsBasePath(), body, tc.Token)

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", resp.StatusCode, string(respBody))
	}

	var lists []interface{}
	if err := json.Unmarshal(respBody, &lists); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if len(lists) < 1 {
		t.Fatal("expected at least 1 address list in response")
	}

	t.Cleanup(func() {
		ctx := context.Background()
		testutil.CleanupRouterOS(ctx, tc.Router1Client)
		testutil.CleanupRouterOS(ctx, tc.Router2Client)
	})
}

func TestCreateAddressEntry_MissingFields(t *testing.T) {
	// Missing both list and address.
	body := map[string]interface{}{
		"comment": "test-addr-missing",
	}

	resp, _ := testutil.DoRequest(tc.Server, "POST", addressListsBasePath(), body, tc.Token)

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
}

func TestUpdateAddressEntry(t *testing.T) {
	// Create an entry first.
	createBody := map[string]interface{}{
		"list":    "test-addr-update-list",
		"address": "10.87.0.0/24",
		"comment": "test-addr-to-update",
	}
	testutil.DoRequest(tc.Server, "POST", addressListsBasePath(), createBody, tc.Token)

	t.Cleanup(func() {
		ctx := context.Background()
		testutil.CleanupRouterOS(ctx, tc.Router1Client)
		testutil.CleanupRouterOS(ctx, tc.Router2Client)
	})

	// Find the entry ID from the list response.
	_, listBody := testutil.DoRequest(tc.Server, "GET", addressListsBasePath(), nil, tc.Token)

	var lists []map[string]interface{}
	if err := json.Unmarshal(listBody, &lists); err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}

	var entryID string
	for _, list := range lists {
		listName, _ := list["name"].(string)
		if listName != "test-addr-update-list" {
			continue
		}
		entries, _ := list["entries"].([]interface{})
		for _, e := range entries {
			entry, _ := e.(map[string]interface{})
			if entry["comment"] == "test-addr-to-update" {
				entryID, _ = entry["id"].(string)
				break
			}
		}
		if entryID != "" {
			break
		}
	}

	if entryID == "" {
		t.Fatal("could not find created address entry in list")
	}

	newComment := "test-addr-updated"
	patchBody := map[string]interface{}{
		"comment": newComment,
	}

	resp, respBody := testutil.DoRequest(tc.Server, "PATCH", addressListsBasePath()+"/"+entryID, patchBody, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var updatedLists []interface{}
	if err := json.Unmarshal(respBody, &updatedLists); err != nil {
		t.Fatalf("unmarshal updated: %v", err)
	}

	if len(updatedLists) < 1 {
		t.Fatal("expected at least 1 list in update response")
	}
}

func TestDeleteAddressEntry(t *testing.T) {
	// Create an entry first.
	createBody := map[string]interface{}{
		"list":    "test-addr-delete-list",
		"address": "10.86.0.0/24",
		"comment": "test-addr-to-delete",
	}
	testutil.DoRequest(tc.Server, "POST", addressListsBasePath(), createBody, tc.Token)

	t.Cleanup(func() {
		ctx := context.Background()
		testutil.CleanupRouterOS(ctx, tc.Router1Client)
		testutil.CleanupRouterOS(ctx, tc.Router2Client)
	})

	// Find the entry ID from the list response.
	_, listBody := testutil.DoRequest(tc.Server, "GET", addressListsBasePath(), nil, tc.Token)

	var lists []map[string]interface{}
	if err := json.Unmarshal(listBody, &lists); err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}

	var entryID string
	for _, list := range lists {
		listName, _ := list["name"].(string)
		if listName != "test-addr-delete-list" {
			continue
		}
		entries, _ := list["entries"].([]interface{})
		for _, e := range entries {
			entry, _ := e.(map[string]interface{})
			if entry["comment"] == "test-addr-to-delete" {
				entryID, _ = entry["id"].(string)
				break
			}
		}
		if entryID != "" {
			break
		}
	}

	if entryID == "" {
		t.Fatal("could not find created address entry in list")
	}

	resp, respBody := testutil.DoRequest(tc.Server, "DELETE", addressListsBasePath()+"/"+entryID, nil, tc.Token)

	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204, got %d: %s", resp.StatusCode, string(respBody))
	}
}
