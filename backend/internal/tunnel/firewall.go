package tunnel

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/pobradovic08/kormos/backend/internal/operation"
	"github.com/pobradovic08/kormos/backend/internal/proxy"
)

// ─── Firewall Request Types ───────────────────────────────────────────────────

// CreateFirewallRuleRequest is the payload for creating a firewall filter rule.
type CreateFirewallRuleRequest struct {
	Chain           string `json:"chain"`
	Action          string `json:"action"`
	Protocol        string `json:"protocol,omitempty"`
	SrcAddress      string `json:"srcAddress,omitempty"`
	DstAddress      string `json:"dstAddress,omitempty"`
	SrcAddressList  string `json:"srcAddressList,omitempty"`
	DstAddressList  string `json:"dstAddressList,omitempty"`
	SrcPort         string `json:"srcPort,omitempty"`
	DstPort         string `json:"dstPort,omitempty"`
	InInterface     string `json:"inInterface,omitempty"`
	OutInterface    string `json:"outInterface,omitempty"`
	ConnectionState string `json:"connectionState,omitempty"`
	Disabled        bool   `json:"disabled"`
	Comment         string `json:"comment,omitempty"`
}

func (r CreateFirewallRuleRequest) toRouterOS() map[string]interface{} {
	m := map[string]interface{}{
		"chain":  r.Chain,
		"action": r.Action,
	}
	if r.Protocol != "" {
		m["protocol"] = r.Protocol
	}
	if r.SrcAddress != "" {
		m["src-address"] = r.SrcAddress
	}
	if r.DstAddress != "" {
		m["dst-address"] = r.DstAddress
	}
	if r.SrcAddressList != "" {
		m["src-address-list"] = r.SrcAddressList
	}
	if r.DstAddressList != "" {
		m["dst-address-list"] = r.DstAddressList
	}
	if r.SrcPort != "" {
		m["src-port"] = r.SrcPort
	}
	if r.DstPort != "" {
		m["dst-port"] = r.DstPort
	}
	if r.InInterface != "" {
		m["in-interface"] = r.InInterface
	}
	if r.OutInterface != "" {
		m["out-interface"] = r.OutInterface
	}
	if r.ConnectionState != "" {
		m["connection-state"] = r.ConnectionState
	}
	if r.Disabled {
		m["disabled"] = "true"
	}
	if r.Comment != "" {
		m["comment"] = r.Comment
	}
	return m
}

// UpdateFirewallRuleRequest is the payload for updating a firewall filter rule.
type UpdateFirewallRuleRequest struct {
	Action          *string `json:"action,omitempty"`
	Protocol        *string `json:"protocol,omitempty"`
	SrcAddress      *string `json:"srcAddress,omitempty"`
	DstAddress      *string `json:"dstAddress,omitempty"`
	SrcAddressList  *string `json:"srcAddressList,omitempty"`
	DstAddressList  *string `json:"dstAddressList,omitempty"`
	SrcPort         *string `json:"srcPort,omitempty"`
	DstPort         *string `json:"dstPort,omitempty"`
	InInterface     *string `json:"inInterface,omitempty"`
	OutInterface    *string `json:"outInterface,omitempty"`
	ConnectionState *string `json:"connectionState,omitempty"`
	Disabled        *bool   `json:"disabled,omitempty"`
	Comment         *string `json:"comment,omitempty"`
}

func (r UpdateFirewallRuleRequest) toRouterOS() map[string]interface{} {
	m := map[string]interface{}{}
	if r.Action != nil {
		m["action"] = *r.Action
	}
	if r.Protocol != nil {
		m["protocol"] = *r.Protocol
	}
	if r.SrcAddress != nil {
		m["src-address"] = *r.SrcAddress
	}
	if r.DstAddress != nil {
		m["dst-address"] = *r.DstAddress
	}
	if r.SrcAddressList != nil {
		m["src-address-list"] = *r.SrcAddressList
	}
	if r.DstAddressList != nil {
		m["dst-address-list"] = *r.DstAddressList
	}
	if r.SrcPort != nil {
		m["src-port"] = *r.SrcPort
	}
	if r.DstPort != nil {
		m["dst-port"] = *r.DstPort
	}
	if r.InInterface != nil {
		m["in-interface"] = *r.InInterface
	}
	if r.OutInterface != nil {
		m["out-interface"] = *r.OutInterface
	}
	if r.ConnectionState != nil {
		m["connection-state"] = *r.ConnectionState
	}
	if r.Disabled != nil {
		if *r.Disabled {
			m["disabled"] = "true"
		} else {
			m["disabled"] = "false"
		}
	}
	if r.Comment != nil {
		m["comment"] = *r.Comment
	}
	return m
}

// ─── Firewall Service Methods ─────────────────────────────────────────────────

// ListFirewallRules fetches firewall filter rules from the master router.
func (s *Service) ListFirewallRules(ctx context.Context, tenantID, clusterID string) ([]proxy.FirewallRule, error) {
	client, err := s.getMasterClient(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	return proxy.FetchFirewallRules(ctx, client)
}

// CreateFirewallRule creates a firewall rule on all routers in the cluster.
func (s *Service) CreateFirewallRule(ctx context.Context, tenantID, userID, clusterID string, req CreateFirewallRuleRequest) ([]proxy.FirewallRule, error) {
	routers, _, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	body := req.toRouterOS()
	ops := make([]operation.ExecuteOperation, 0, len(routers))
	for _, ri := range routers {
		ops = append(ops, operation.ExecuteOperation{
			RouterID:      ri.ID,
			Module:        "firewall",
			OperationType: operation.OpAdd,
			ResourcePath:  "/ip/firewall/filter",
			Body:          body,
		})
	}

	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Create firewall rule: %s %s", req.Chain, req.Action),
		Operations:  ops,
	}
	if err := s.executeOps(ctx, tenantID, userID, execReq); err != nil {
		return nil, fmt.Errorf("firewall: create rule: %w", err)
	}

	return s.ListFirewallRules(ctx, tenantID, clusterID)
}

// findFirewallRuleByID finds a firewall rule by its RouterOS ID in a slice.
func findFirewallRuleByID(rules []proxy.FirewallRule, id string) *proxy.FirewallRule {
	for i := range rules {
		if rules[i].ID == id {
			return &rules[i]
		}
	}
	return nil
}

// sortedJoin sorts a copy of ss and returns a comma-separated string.
// Used to compare []string fields regardless of the order elements were returned.
func sortedJoin(ss []string) string {
	if len(ss) == 0 {
		return ""
	}
	cp := make([]string, len(ss))
	copy(cp, ss)
	sort.Strings(cp)
	return strings.Join(cp, ",")
}

// findMatchingFirewallRule finds a rule on a target router that matches the reference rule by content.
// Matches on chain + action + protocol + src/dst addresses + src/dst ports + connection-state + disabled + comment.
func findMatchingFirewallRule(rules []proxy.FirewallRule, ref proxy.FirewallRule) *proxy.FirewallRule {
	for i := range rules {
		r := &rules[i]
		if r.Chain == ref.Chain &&
			r.Action == ref.Action &&
			r.Protocol == ref.Protocol &&
			r.SrcAddress == ref.SrcAddress &&
			r.DstAddress == ref.DstAddress &&
			r.SrcAddressList == ref.SrcAddressList &&
			r.DstAddressList == ref.DstAddressList &&
			r.SrcPort == ref.SrcPort &&
			r.DstPort == ref.DstPort &&
			r.InInterface == ref.InInterface &&
			r.OutInterface == ref.OutInterface &&
			sortedJoin(r.ConnectionState) == sortedJoin(ref.ConnectionState) &&
			r.Disabled == ref.Disabled &&
			r.Comment == ref.Comment {
			return r
		}
	}
	return nil
}

// UpdateFirewallRule updates a firewall rule on all routers in the cluster.
// The ruleID is the master router's RouterOS ID; the matching rule is found by content on other routers.
func (s *Service) UpdateFirewallRule(ctx context.Context, tenantID, userID, clusterID, ruleID string, req UpdateFirewallRuleRequest) ([]proxy.FirewallRule, error) {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	// Fetch from master to get the canonical rule for content matching.
	var masterRules []proxy.FirewallRule
	var refRule *proxy.FirewallRule
	for _, ri := range routers {
		if ri.Role == "master" {
			masterRules, err = proxy.FetchFirewallRules(ctx, clients[ri.ID])
			if err != nil {
				return nil, fmt.Errorf("firewall: fetch rules from master: %w", err)
			}
			refRule = findFirewallRuleByID(masterRules, ruleID)
			break
		}
	}
	if refRule == nil {
		return nil, fmt.Errorf("firewall: rule %s not found on master router", ruleID)
	}

	body := req.toRouterOS()
	ops := make([]operation.ExecuteOperation, 0, len(routers))
	for _, ri := range routers {
		var targetID string
		if ri.Role == "master" {
			targetID = ruleID
		} else {
			rules, err := proxy.FetchFirewallRules(ctx, clients[ri.ID])
			if err != nil {
				return nil, fmt.Errorf("firewall: fetch rules from router %s: %w", ri.Name, err)
			}
			match := findMatchingFirewallRule(rules, *refRule)
			if match == nil {
				continue
			}
			targetID = match.ID
		}
		ops = append(ops, operation.ExecuteOperation{
			RouterID:      ri.ID,
			Module:        "firewall",
			OperationType: operation.OpModify,
			ResourcePath:  "/ip/firewall/filter",
			ResourceID:    targetID,
			Body:          body,
		})
	}

	if len(ops) == 0 {
		return nil, fmt.Errorf("firewall: rule not found on any router")
	}

	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Update firewall rule %s", ruleID),
		Operations:  ops,
	}
	if err := s.executeOps(ctx, tenantID, userID, execReq); err != nil {
		return nil, fmt.Errorf("firewall: update rule: %w", err)
	}

	return s.ListFirewallRules(ctx, tenantID, clusterID)
}

// DeleteFirewallRule deletes a firewall rule from all routers in the cluster.
func (s *Service) DeleteFirewallRule(ctx context.Context, tenantID, userID, clusterID, ruleID string) error {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return err
	}

	// Fetch from master to get the canonical rule for content matching.
	var refRule *proxy.FirewallRule
	for _, ri := range routers {
		if ri.Role == "master" {
			masterRules, err := proxy.FetchFirewallRules(ctx, clients[ri.ID])
			if err != nil {
				return fmt.Errorf("firewall: fetch rules from master: %w", err)
			}
			refRule = findFirewallRuleByID(masterRules, ruleID)
			break
		}
	}
	if refRule == nil {
		return fmt.Errorf("firewall: rule %s not found on master router", ruleID)
	}

	ops := make([]operation.ExecuteOperation, 0, len(routers))
	for _, ri := range routers {
		var targetID string
		if ri.Role == "master" {
			targetID = ruleID
		} else {
			rules, err := proxy.FetchFirewallRules(ctx, clients[ri.ID])
			if err != nil {
				return fmt.Errorf("firewall: fetch rules from router %s: %w", ri.Name, err)
			}
			match := findMatchingFirewallRule(rules, *refRule)
			if match == nil {
				continue
			}
			targetID = match.ID
		}
		ops = append(ops, operation.ExecuteOperation{
			RouterID:      ri.ID,
			Module:        "firewall",
			OperationType: operation.OpDelete,
			ResourcePath:  "/ip/firewall/filter",
			ResourceID:    targetID,
		})
	}

	if len(ops) == 0 {
		return fmt.Errorf("firewall: rule not found on any router")
	}

	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Delete firewall rule %s", ruleID),
		Operations:  ops,
	}
	if err := s.executeOps(ctx, tenantID, userID, execReq); err != nil {
		return fmt.Errorf("firewall: delete rule: %w", err)
	}

	return nil
}

// MoveFirewallRuleRequest is the payload for moving a firewall filter rule.
type MoveFirewallRuleRequest struct {
	ID          string `json:"id"`
	Destination string `json:"destination"`
}

// MoveFirewallRule moves a firewall rule to a new position on all routers in the cluster.
// The IDs are master router RouterOS IDs; matching rules are found by content on other routers.
func (s *Service) MoveFirewallRule(ctx context.Context, tenantID, userID, clusterID string, req MoveFirewallRuleRequest) ([]proxy.FirewallRule, error) {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	// Fetch from master to get the canonical rules for content matching.
	var masterRules []proxy.FirewallRule
	var srcRule, dstRule *proxy.FirewallRule
	for _, ri := range routers {
		if ri.Role == "master" {
			masterRules, err = proxy.FetchFirewallRules(ctx, clients[ri.ID])
			if err != nil {
				return nil, fmt.Errorf("firewall: fetch rules from master: %w", err)
			}
			srcRule = findFirewallRuleByID(masterRules, req.ID)
			dstRule = findFirewallRuleByID(masterRules, req.Destination)
			break
		}
	}
	if srcRule == nil {
		return nil, fmt.Errorf("firewall: rule %s not found on master router", req.ID)
	}
	if dstRule == nil {
		return nil, fmt.Errorf("firewall: destination rule %s not found on master router", req.Destination)
	}

	for _, ri := range routers {
		var srcID, dstID string
		if ri.Role == "master" {
			srcID = req.ID
			dstID = req.Destination
		} else {
			rules, err := proxy.FetchFirewallRules(ctx, clients[ri.ID])
			if err != nil {
				return nil, fmt.Errorf("firewall: fetch rules from router %s: %w", ri.Name, err)
			}
			src := findMatchingFirewallRule(rules, *srcRule)
			if src == nil {
				continue
			}
			dst := findMatchingFirewallRule(rules, *dstRule)
			if dst == nil {
				continue
			}
			srcID = src.ID
			dstID = dst.ID
		}

		_, err := clients[ri.ID].Post(ctx, "/ip/firewall/filter/move", map[string]string{
			"numbers":     srcID,
			"destination": dstID,
		})
		if err != nil {
			return nil, fmt.Errorf("firewall: move rule on router %s: %w", ri.Name, err)
		}
	}

	return s.ListFirewallRules(ctx, tenantID, clusterID)
}
