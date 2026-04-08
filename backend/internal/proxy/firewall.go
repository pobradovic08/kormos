package proxy

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/pobradovic08/kormos/backend/internal/routeros"
)

// FirewallRule is the normalized representation of a RouterOS firewall filter rule.
type FirewallRule struct {
	ID              string   `json:"id"`
	Chain           string   `json:"chain"`
	Action          string   `json:"action"`
	Protocol        string   `json:"protocol,omitempty"`
	SrcAddress      string   `json:"srcAddress,omitempty"`
	DstAddress      string   `json:"dstAddress,omitempty"`
	SrcAddressList  string   `json:"srcAddressList,omitempty"`
	DstAddressList  string   `json:"dstAddressList,omitempty"`
	SrcPort         string   `json:"srcPort,omitempty"`
	DstPort         string   `json:"dstPort,omitempty"`
	InInterface     string   `json:"inInterface,omitempty"`
	OutInterface    string   `json:"outInterface,omitempty"`
	ConnectionState []string `json:"connectionState,omitempty"`
	Disabled        bool     `json:"disabled"`
	Comment         string   `json:"comment,omitempty"`
}

type rawFirewallRule struct {
	ID              string `json:".id"`
	Chain           string `json:"chain"`
	Action          string `json:"action"`
	Protocol        string `json:"protocol"`
	SrcAddress      string `json:"src-address"`
	DstAddress      string `json:"dst-address"`
	SrcAddressList  string `json:"src-address-list"`
	DstAddressList  string `json:"dst-address-list"`
	SrcPort         string `json:"src-port"`
	DstPort         string `json:"dst-port"`
	InInterface     string `json:"in-interface"`
	OutInterface    string `json:"out-interface"`
	ConnectionState string `json:"connection-state"`
	Disabled        string `json:"disabled"`
	Comment         string `json:"comment"`
}

// FetchFirewallRules fetches and normalizes firewall filter rules from a RouterOS device.
func FetchFirewallRules(ctx context.Context, client *routeros.Client) ([]FirewallRule, error) {
	body, err := client.Get(ctx, "/ip/firewall/filter")
	if err != nil {
		return nil, fmt.Errorf("proxy: fetch firewall rules: %w", err)
	}

	var raw []rawFirewallRule
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("proxy: parse firewall rules: %w", err)
	}

	rules := make([]FirewallRule, len(raw))
	for i, r := range raw {
		rules[i] = FirewallRule{
			ID:              r.ID,
			Chain:           r.Chain,
			Action:          r.Action,
			Protocol:        r.Protocol,
			SrcAddress:      r.SrcAddress,
			DstAddress:      r.DstAddress,
			SrcAddressList:  r.SrcAddressList,
			DstAddressList:  r.DstAddressList,
			SrcPort:         r.SrcPort,
			DstPort:         r.DstPort,
			InInterface:     r.InInterface,
			OutInterface:    r.OutInterface,
			ConnectionState: splitCSV(r.ConnectionState),
			Disabled:        parseBool(r.Disabled),
			Comment:         r.Comment,
		}
	}
	return rules, nil
}
