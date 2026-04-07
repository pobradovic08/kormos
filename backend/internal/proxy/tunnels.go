package proxy

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/pobradovic08/kormos/backend/internal/routeros"
)

// Tunnel is the normalized representation of a RouterOS GRE tunnel interface.
type Tunnel struct {
	ID                string `json:"id"`
	Name              string `json:"name"`
	TunnelType        string `json:"tunnelType"`
	LocalAddress      string `json:"localAddress"`
	RemoteAddress     string `json:"remoteAddress"`
	MTU               int    `json:"mtu"`
	KeepaliveInterval int    `json:"keepaliveInterval"`
	KeepaliveRetries  int    `json:"keepaliveRetries"`
	IpsecSecret       string `json:"ipsecSecret,omitempty"`
	Disabled          bool   `json:"disabled"`
	Running           bool   `json:"running"`
	Comment           string `json:"comment,omitempty"`
}

type rawGRETunnel struct {
	ID            string `json:".id"`
	Name          string `json:"name"`
	LocalAddress  string `json:"local-address"`
	RemoteAddress string `json:"remote-address"`
	MTU           string `json:"mtu"`
	ActualMTU     string `json:"actual-mtu"`
	Keepalive     string `json:"keepalive"`
	IpsecSecret   string `json:"ipsec-secret"`
	Disabled      string `json:"disabled"`
	Running       string `json:"running"`
	Comment       string `json:"comment"`
}

// parseKeepalive parses RouterOS keepalive format "interval,retries" (e.g., "10s,10").
func parseKeepalive(s string) (interval, retries int) {
	if s == "" {
		return 10, 10
	}
	parts := strings.SplitN(s, ",", 2)
	if len(parts) >= 1 {
		// Strip "s" suffix from interval
		intervalStr := strings.TrimSuffix(strings.TrimSpace(parts[0]), "s")
		interval = parseInt(intervalStr)
	}
	if len(parts) >= 2 {
		retries = parseInt(strings.TrimSpace(parts[1]))
	}
	return
}

// FetchTunnels fetches and normalizes GRE tunnels from a RouterOS device.
func FetchTunnels(ctx context.Context, client *routeros.Client) ([]Tunnel, error) {
	body, err := client.Get(ctx, "/interface/gre")
	if err != nil {
		return nil, fmt.Errorf("proxy: fetch tunnels: %w", err)
	}

	var raw []rawGRETunnel
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("proxy: parse tunnels: %w", err)
	}

	tunnels := make([]Tunnel, len(raw))
	for i, r := range raw {
		interval, retries := parseKeepalive(r.Keepalive)
		mtu := parseInt(r.ActualMTU)
		if mtu == 0 {
			mtu = parseInt(r.MTU)
		}
		tunnels[i] = Tunnel{
			ID:                r.ID,
			Name:              r.Name,
			TunnelType:        "gre",
			LocalAddress:      r.LocalAddress,
			RemoteAddress:     r.RemoteAddress,
			MTU:               mtu,
			KeepaliveInterval: interval,
			KeepaliveRetries:  retries,
			IpsecSecret:       r.IpsecSecret,
			Disabled:          parseBool(r.Disabled),
			Running:           parseBool(r.Running),
			Comment:           r.Comment,
		}
	}
	return tunnels, nil
}
