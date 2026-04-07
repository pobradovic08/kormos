package proxy

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/pobradovic08/kormos/backend/internal/routeros"
)

// WireGuardInterface is the normalized representation of a RouterOS WireGuard interface.
type WireGuardInterface struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	ListenPort int    `json:"listenPort"`
	MTU        int    `json:"mtu"`
	PrivateKey string `json:"privateKey"`
	PublicKey  string `json:"publicKey"`
	Disabled   bool   `json:"disabled"`
	Running    bool   `json:"running"`
}

type rawWireGuardInterface struct {
	ID         string `json:".id"`
	Name       string `json:"name"`
	ListenPort string `json:"listen-port"`
	MTU        string `json:"mtu"`
	PrivateKey string `json:"private-key"`
	PublicKey  string `json:"public-key"`
	Disabled   string `json:"disabled"`
	Running    string `json:"running"`
}

// FetchWireGuardInterfaces fetches and normalizes WireGuard interfaces from a RouterOS device.
func FetchWireGuardInterfaces(ctx context.Context, client *routeros.Client) ([]WireGuardInterface, error) {
	body, err := client.Get(ctx, "/interface/wireguard")
	if err != nil {
		return nil, fmt.Errorf("proxy: fetch wireguard interfaces: %w", err)
	}

	var raw []rawWireGuardInterface
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("proxy: parse wireguard interfaces: %w", err)
	}

	ifaces := make([]WireGuardInterface, len(raw))
	for i, r := range raw {
		mtu := parseInt(r.MTU)
		if mtu == 0 {
			mtu = 1420
		}
		ifaces[i] = WireGuardInterface{
			ID:         r.ID,
			Name:       r.Name,
			ListenPort: parseInt(r.ListenPort),
			MTU:        mtu,
			PrivateKey: r.PrivateKey,
			PublicKey:  r.PublicKey,
			Disabled:   parseBool(r.Disabled),
			Running:    parseBool(r.Running),
		}
	}
	return ifaces, nil
}

// WireGuardPeer is the normalized representation of a RouterOS WireGuard peer.
type WireGuardPeer struct {
	ID                  string `json:"id"`
	Interface           string `json:"interface"`
	Name                string `json:"name,omitempty"`
	PublicKey           string `json:"publicKey"`
	PresharedKey        string `json:"presharedKey,omitempty"`
	AllowedAddress      string `json:"allowedAddress"`
	EndpointAddress     string `json:"endpointAddress,omitempty"`
	EndpointPort        int    `json:"endpointPort,omitempty"`
	LastHandshake       string `json:"lastHandshake,omitempty"`
	Rx                  int64  `json:"rx"`
	Tx                  int64  `json:"tx"`
	PersistentKeepalive int    `json:"persistentKeepalive,omitempty"`
	Disabled            bool   `json:"disabled"`
	Comment             string `json:"comment,omitempty"`
}

type rawWireGuardPeer struct {
	ID                  string `json:".id"`
	Interface           string `json:"interface"`
	Name                string `json:"name"`
	PublicKey           string `json:"public-key"`
	PresharedKey        string `json:"preshared-key"`
	AllowedAddress      string `json:"allowed-address"`
	EndpointAddress     string `json:"endpoint-address"`
	EndpointPort        string `json:"endpoint-port"`
	LastHandshake       string `json:"last-handshake"`
	Rx                  string `json:"rx"`
	Tx                  string `json:"tx"`
	PersistentKeepalive string `json:"persistent-keepalive"`
	Disabled            string `json:"disabled"`
	Comment             string `json:"comment"`
}

// FetchWireGuardPeers fetches and normalizes WireGuard peers from a RouterOS device.
func FetchWireGuardPeers(ctx context.Context, client *routeros.Client) ([]WireGuardPeer, error) {
	body, err := client.Get(ctx, "/interface/wireguard/peers")
	if err != nil {
		return nil, fmt.Errorf("proxy: fetch wireguard peers: %w", err)
	}

	var raw []rawWireGuardPeer
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("proxy: parse wireguard peers: %w", err)
	}

	peers := make([]WireGuardPeer, len(raw))
	for i, r := range raw {
		peers[i] = WireGuardPeer{
			ID:                  r.ID,
			Interface:           r.Interface,
			Name:                r.Name,
			PublicKey:           r.PublicKey,
			PresharedKey:        r.PresharedKey,
			AllowedAddress:      r.AllowedAddress,
			EndpointAddress:     r.EndpointAddress,
			EndpointPort:        parseInt(r.EndpointPort),
			LastHandshake:       r.LastHandshake,
			Rx:                  parseInt64(r.Rx),
			Tx:                  parseInt64(r.Tx),
			PersistentKeepalive: parseInt(r.PersistentKeepalive),
			Disabled:            parseBool(r.Disabled),
			Comment:             r.Comment,
		}
	}
	return peers, nil
}
