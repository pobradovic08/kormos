//go:build integration

package tunnel_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/pobradovic08/kormos/backend/internal/testutil"
)

func fwBasePath() string {
	return fmt.Sprintf("/api/clusters/%s/firewall/filter", tc.ClusterID)
}

func TestListFirewallRules(t *testing.T) {
	resp, respBody := testutil.DoRequest(tc.Server, "GET", fwBasePath(), nil, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	// Response must be a JSON array.
	var rules []interface{}
	if err := json.Unmarshal(respBody, &rules); err != nil {
		t.Fatalf("expected JSON array, got error: %v", err)
	}
}

func TestCreateFirewallRule(t *testing.T) {
	body := map[string]interface{}{
		"chain":    "forward",
		"action":   "accept",
		"protocol": "tcp",
		"dstPort":  "8080",
		"comment":  "test-fw-basic",
	}

	resp, respBody := testutil.DoRequest(tc.Server, "POST", fwBasePath(), body, tc.Token)

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", resp.StatusCode, string(respBody))
	}

	var rules []map[string]interface{}
	if err := json.Unmarshal(respBody, &rules); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	var createdID string
	for _, r := range rules {
		if r["comment"] == "test-fw-basic" {
			createdID, _ = r["id"].(string)
		}
	}

	t.Cleanup(func() {
		if createdID != "" {
			testutil.DoRequest(tc.Server, "DELETE", fwBasePath()+"/"+createdID, nil, tc.Token)
		}
	})

	found := false
	for _, r := range rules {
		if r["comment"] == "test-fw-basic" {
			found = true
			if r["chain"] != "forward" {
				t.Fatalf("expected chain forward, got %v", r["chain"])
			}
			if r["action"] != "accept" {
				t.Fatalf("expected action accept, got %v", r["action"])
			}
		}
	}
	if !found {
		t.Fatal("test-fw-basic rule not found in create response")
	}
}

func TestCreateFirewallRule_WithConnectionState(t *testing.T) {
	body := map[string]interface{}{
		"chain":           "forward",
		"action":          "accept",
		"connectionState": "established,related",
		"comment":         "test-fw-connstate",
	}

	resp, respBody := testutil.DoRequest(tc.Server, "POST", fwBasePath(), body, tc.Token)

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", resp.StatusCode, string(respBody))
	}

	var rules []map[string]interface{}
	if err := json.Unmarshal(respBody, &rules); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	var createdID string
	for _, r := range rules {
		if r["comment"] == "test-fw-connstate" {
			createdID, _ = r["id"].(string)
		}
	}

	t.Cleanup(func() {
		if createdID != "" {
			testutil.DoRequest(tc.Server, "DELETE", fwBasePath()+"/"+createdID, nil, tc.Token)
		}
	})

	found := false
	for _, r := range rules {
		if r["comment"] == "test-fw-connstate" {
			found = true
			connState, _ := r["connectionState"].([]interface{})
			if len(connState) == 0 {
				t.Fatal("expected connectionState to be populated")
			}
		}
	}
	if !found {
		t.Fatal("test-fw-connstate rule not found in create response")
	}
}

func TestCreateFirewallRule_MissingChain(t *testing.T) {
	body := map[string]interface{}{
		"action":  "accept",
		"comment": "test-fw-no-chain",
	}

	resp, _ := testutil.DoRequest(tc.Server, "POST", fwBasePath(), body, tc.Token)

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", resp.StatusCode)
	}
}

func TestUpdateFirewallRule(t *testing.T) {
	// Create a rule first.
	createBody := map[string]interface{}{
		"chain":   "forward",
		"action":  "accept",
		"comment": "test-fw-update",
	}
	_, createRespBody := testutil.DoRequest(tc.Server, "POST", fwBasePath(), createBody, tc.Token)

	var createRules []map[string]interface{}
	if err := json.Unmarshal(createRespBody, &createRules); err != nil {
		t.Fatalf("unmarshal create response: %v\nbody: %s", err, string(createRespBody))
	}

	var ruleID string
	for _, r := range createRules {
		if r["comment"] == "test-fw-update" {
			ruleID, _ = r["id"].(string)
		}
	}
	if ruleID == "" {
		t.Fatal("could not find created rule ID")
	}

	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", fwBasePath()+"/"+ruleID, nil, tc.Token)
	})

	// Update the rule action.
	action := "drop"
	updateBody := map[string]interface{}{
		"action": action,
	}

	resp, respBody := testutil.DoRequest(tc.Server, "PATCH", fwBasePath()+"/"+ruleID, updateBody, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var updatedRules []map[string]interface{}
	if err := json.Unmarshal(respBody, &updatedRules); err != nil {
		t.Fatalf("unmarshal response: %v\nbody: %s", err, string(respBody))
	}

	found := false
	for _, r := range updatedRules {
		if r["comment"] == "test-fw-update" {
			found = true
			if r["action"] != "drop" {
				t.Fatalf("expected action drop after update, got %v", r["action"])
			}
		}
	}
	if !found {
		t.Fatal("test-fw-update rule not found in update response")
	}
}

func TestMoveFirewallRule(t *testing.T) {
	// Create two rules.
	body1 := map[string]interface{}{
		"chain":   "forward",
		"action":  "accept",
		"comment": "test-fw-move-1",
	}
	_, resp1Body := testutil.DoRequest(tc.Server, "POST", fwBasePath(), body1, tc.Token)

	var rules1 []map[string]interface{}
	if err := json.Unmarshal(resp1Body, &rules1); err != nil {
		t.Fatalf("unmarshal resp1: %v\nbody: %s", err, string(resp1Body))
	}

	var rule1ID string
	for _, r := range rules1 {
		if r["comment"] == "test-fw-move-1" {
			rule1ID, _ = r["id"].(string)
		}
	}

	body2 := map[string]interface{}{
		"chain":   "forward",
		"action":  "drop",
		"comment": "test-fw-move-2",
	}
	_, resp2Body := testutil.DoRequest(tc.Server, "POST", fwBasePath(), body2, tc.Token)

	var rules2 []map[string]interface{}
	if err := json.Unmarshal(resp2Body, &rules2); err != nil {
		t.Fatalf("unmarshal resp2: %v\nbody: %s", err, string(resp2Body))
	}

	var rule2ID string
	for _, r := range rules2 {
		if r["comment"] == "test-fw-move-2" {
			rule2ID, _ = r["id"].(string)
		}
	}

	if rule1ID == "" || rule2ID == "" {
		t.Fatalf("could not find rule IDs: rule1=%s rule2=%s", rule1ID, rule2ID)
	}

	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", fwBasePath()+"/"+rule1ID, nil, tc.Token)
		testutil.DoRequest(tc.Server, "DELETE", fwBasePath()+"/"+rule2ID, nil, tc.Token)
	})

	// Move rule1 to position of rule2.
	moveBody := map[string]interface{}{
		"id":          rule1ID,
		"destination": rule2ID,
	}

	resp, respBody := testutil.DoRequest(tc.Server, "POST", fwBasePath()+"/move", moveBody, tc.Token)

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, string(respBody))
	}

	var movedRules []interface{}
	if err := json.Unmarshal(respBody, &movedRules); err != nil {
		t.Fatalf("expected JSON array in move response: %v", err)
	}
}

func TestDeleteFirewallRule(t *testing.T) {
	// Create a rule.
	createBody := map[string]interface{}{
		"chain":   "forward",
		"action":  "accept",
		"comment": "test-fw-delete",
	}
	_, createRespBody := testutil.DoRequest(tc.Server, "POST", fwBasePath(), createBody, tc.Token)

	var createRules []map[string]interface{}
	if err := json.Unmarshal(createRespBody, &createRules); err != nil {
		t.Fatalf("unmarshal create response: %v\nbody: %s", err, string(createRespBody))
	}

	var ruleID string
	for _, r := range createRules {
		if r["comment"] == "test-fw-delete" {
			ruleID, _ = r["id"].(string)
		}
	}
	if ruleID == "" {
		t.Fatal("could not find created rule ID for delete test")
	}

	// Delete the rule.
	resp, _ := testutil.DoRequest(tc.Server, "DELETE", fwBasePath()+"/"+ruleID, nil, tc.Token)

	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", resp.StatusCode)
	}
}

func TestFirewallRule_ContentMatching(t *testing.T) {
	// Create a rule on the cluster; it should be applied to both routers.
	createBody := map[string]interface{}{
		"chain":    "forward",
		"action":   "accept",
		"protocol": "udp",
		"dstPort":  "53",
		"comment":  "test-fw-content-match",
	}
	_, createRespBody := testutil.DoRequest(tc.Server, "POST", fwBasePath(), createBody, tc.Token)

	var createRules []map[string]interface{}
	if err := json.Unmarshal(createRespBody, &createRules); err != nil {
		t.Fatalf("unmarshal create response: %v\nbody: %s", err, string(createRespBody))
	}

	var ruleID string
	for _, r := range createRules {
		if r["comment"] == "test-fw-content-match" {
			ruleID, _ = r["id"].(string)
		}
	}
	if ruleID == "" {
		t.Fatal("could not find created rule ID for content matching test")
	}

	t.Cleanup(func() {
		testutil.DoRequest(tc.Server, "DELETE", fwBasePath()+"/"+ruleID, nil, tc.Token)
	})

	// List rules and verify the rule exists with matching content.
	_, listRespBody := testutil.DoRequest(tc.Server, "GET", fwBasePath(), nil, tc.Token)

	var listRules []map[string]interface{}
	if err := json.Unmarshal(listRespBody, &listRules); err != nil {
		t.Fatalf("unmarshal list response: %v\nbody: %s", err, string(listRespBody))
	}

	found := false
	for _, r := range listRules {
		if r["comment"] == "test-fw-content-match" {
			found = true
			if r["chain"] != "forward" {
				t.Fatalf("expected chain forward, got %v", r["chain"])
			}
			if r["action"] != "accept" {
				t.Fatalf("expected action accept, got %v", r["action"])
			}
			if r["protocol"] != "udp" {
				t.Fatalf("expected protocol udp, got %v", r["protocol"])
			}
		}
	}
	if !found {
		t.Fatal("test-fw-content-match rule not found in list response after create")
	}
}
