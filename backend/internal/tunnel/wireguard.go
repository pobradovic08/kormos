package tunnel

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/pobradovic08/kormos/backend/internal/normalize"
	"github.com/pobradovic08/kormos/backend/internal/routeros"
)

func FetchWGInterfaces(ctx context.Context, client *routeros.Client) ([]WGInterface, error) {
	body, err := client.Get(ctx, "/interface/wireguard")
	if err != nil {
		return nil, fmt.Errorf("tunnel: fetch wireguard interfaces: %w", err)
	}
	var raw []RawWireGuardInterface
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("tunnel: parse wireguard interfaces: %w", err)
	}
	ifaces := make([]WGInterface, len(raw))
	for i, r := range raw {
		mtu := normalize.ParseInt(r.MTU)
		if mtu == 0 {
			mtu = 1420
		}
		ifaces[i] = WGInterface{
			RosID:      r.ID,
			Name:       r.Name,
			ListenPort: normalize.ParseInt(r.ListenPort),
			MTU:        mtu,
			PrivateKey: r.PrivateKey,
			PublicKey:  r.PublicKey,
			Disabled:   normalize.ParseBool(r.Disabled),
			Running:    normalize.ParseBool(r.Running),
		}
	}
	return ifaces, nil
}

func FetchWGPeers(ctx context.Context, client *routeros.Client) ([]WGPeer, error) {
	body, err := client.Get(ctx, "/interface/wireguard/peers")
	if err != nil {
		return nil, fmt.Errorf("tunnel: fetch wireguard peers: %w", err)
	}
	var raw []RawWireGuardPeer
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("tunnel: parse wireguard peers: %w", err)
	}
	peers := make([]WGPeer, len(raw))
	for i, r := range raw {
		peers[i] = WGPeer{
			RosID:               r.ID,
			Interface:           r.Interface,
			Name:                r.Name,
			PublicKey:           r.PublicKey,
			PresharedKey:        r.PresharedKey,
			AllowedAddress:      r.AllowedAddress,
			EndpointAddress:     r.EndpointAddress,
			EndpointPort:        normalize.ParseInt(r.EndpointPort),
			LastHandshake:       r.LastHandshake,
			Rx:                  normalize.ParseInt64(r.Rx),
			Tx:                  normalize.ParseInt64(r.Tx),
			PersistentKeepalive: normalize.ParseInt(r.PersistentKeepalive),
			Disabled:            normalize.ParseBool(r.Disabled),
			Comment:             r.Comment,
		}
	}
	return peers, nil
}

func FindWGInterfaceByName(ifaces []WGInterface, name string) *WGInterface {
	for i := range ifaces {
		if ifaces[i].Name == name {
			return &ifaces[i]
		}
	}
	return nil
}

func PeersForInterface(peers []WGPeer, ifaceName string) []WGPeer {
	var result []WGPeer
	for _, p := range peers {
		if p.Interface == ifaceName {
			result = append(result, p)
		}
	}
	if result == nil {
		result = []WGPeer{}
	}
	return result
}

func BuildWGInterfaceCreateBody(req CreateWGInterfaceRequest) map[string]interface{} {
	body := map[string]interface{}{
		"name":        req.Name,
		"listen-port": strconv.Itoa(req.ListenPort),
	}
	if req.MTU > 0 {
		body["mtu"] = strconv.Itoa(req.MTU)
	}
	if req.Disabled {
		body["disabled"] = "true"
	}
	if req.Comment != "" {
		body["comment"] = req.Comment
	}
	return body
}

func BuildWGInterfaceUpdateBody(req UpdateWGInterfaceRequest) map[string]interface{} {
	body := map[string]interface{}{}
	if req.ListenPort != nil {
		body["listen-port"] = strconv.Itoa(*req.ListenPort)
	}
	if req.MTU != nil {
		body["mtu"] = strconv.Itoa(*req.MTU)
	}
	if req.Disabled != nil {
		if *req.Disabled {
			body["disabled"] = "true"
		} else {
			body["disabled"] = "false"
		}
	}
	if req.Comment != nil {
		body["comment"] = *req.Comment
	}
	return body
}

func BuildWGPeerCreateBody(ifaceName string, req CreateWGPeerRequest) map[string]interface{} {
	body := map[string]interface{}{
		"interface":       ifaceName,
		"public-key":      req.PublicKey,
		"allowed-address": req.AllowedAddress,
	}
	if req.PresharedKey != "" {
		body["preshared-key"] = req.PresharedKey
	}
	if req.EndpointAddress != "" {
		body["endpoint-address"] = req.EndpointAddress
	}
	if req.EndpointPort > 0 {
		body["endpoint-port"] = strconv.Itoa(req.EndpointPort)
	}
	if req.PersistentKeepalive > 0 {
		body["persistent-keepalive"] = strconv.Itoa(req.PersistentKeepalive)
	}
	if req.Disabled {
		body["disabled"] = "true"
	}
	if req.Comment != "" {
		body["comment"] = req.Comment
	}
	return body
}

func BuildWGPeerUpdateBody(req UpdateWGPeerRequest) map[string]interface{} {
	body := map[string]interface{}{}
	if req.PublicKey != nil {
		body["public-key"] = *req.PublicKey
	}
	if req.PresharedKey != nil {
		body["preshared-key"] = *req.PresharedKey
	}
	if req.AllowedAddress != nil {
		body["allowed-address"] = *req.AllowedAddress
	}
	if req.EndpointAddress != nil {
		body["endpoint-address"] = *req.EndpointAddress
	}
	if req.EndpointPort != nil {
		body["endpoint-port"] = strconv.Itoa(*req.EndpointPort)
	}
	if req.PersistentKeepalive != nil {
		body["persistent-keepalive"] = strconv.Itoa(*req.PersistentKeepalive)
	}
	if req.Disabled != nil {
		if *req.Disabled {
			body["disabled"] = "true"
		} else {
			body["disabled"] = "false"
		}
	}
	if req.Comment != nil {
		body["comment"] = *req.Comment
	}
	return body
}
