package tunnel

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/pobradovic08/kormos/backend/internal/normalize"
	"github.com/pobradovic08/kormos/backend/internal/routeros"
)

func parseKeepalive(s string) (interval, retries int) {
	if s == "" {
		return 10, 10
	}
	parts := strings.SplitN(s, ",", 2)
	if len(parts) >= 1 {
		intervalStr := strings.TrimSuffix(strings.TrimSpace(parts[0]), "s")
		interval = normalize.ParseInt(intervalStr)
	}
	if len(parts) >= 2 {
		retries = normalize.ParseInt(strings.TrimSpace(parts[1]))
	}
	return
}

func greTunnelFromRaw(r RawGRETunnel) GREEndpoint {
	return GREEndpoint{
		RosID:         r.ID,
		LocalAddress:  r.LocalAddress,
		RemoteAddress: r.RemoteAddress,
		Running:       normalize.ParseBool(r.Running),
	}
}

func greSharedFromRaw(r RawGRETunnel) (name string, mtu, keepaliveInterval, keepaliveRetries int, ipsecSecret, comment string, disabled bool) {
	interval, retries := parseKeepalive(r.Keepalive)
	m := normalize.ParseInt(r.ActualMTU)
	if m == 0 {
		m = normalize.ParseInt(r.MTU)
	}
	return r.Name, m, interval, retries, r.IpsecSecret, r.Comment, normalize.ParseBool(r.Disabled)
}

func FetchGRETunnels(ctx context.Context, client *routeros.Client) ([]RawGRETunnel, error) {
	body, err := client.Get(ctx, "/interface/gre")
	if err != nil {
		return nil, fmt.Errorf("tunnel: fetch gre: %w", err)
	}
	var raw []RawGRETunnel
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("tunnel: parse gre: %w", err)
	}
	return raw, nil
}

func FindGREByName(tunnels []RawGRETunnel, name string) *RawGRETunnel {
	for i := range tunnels {
		if tunnels[i].Name == name {
			return &tunnels[i]
		}
	}
	return nil
}

func BuildGRECreateBody(req CreateGRERequest, ep CreateGREEndpointInput) map[string]interface{} {
	body := map[string]interface{}{
		"name":           req.Name,
		"local-address":  ep.LocalAddress,
		"remote-address": ep.RemoteAddress,
	}
	if req.MTU > 0 {
		body["mtu"] = strconv.Itoa(req.MTU)
	}
	if req.KeepaliveInterval > 0 || req.KeepaliveRetries > 0 {
		interval := req.KeepaliveInterval
		if interval == 0 {
			interval = 10
		}
		retries := req.KeepaliveRetries
		if retries == 0 {
			retries = 10
		}
		body["keepalive"] = fmt.Sprintf("%ds,%d", interval, retries)
	}
	if req.IpsecSecret != "" {
		body["ipsec-secret"] = req.IpsecSecret
	}
	if req.Disabled {
		body["disabled"] = "true"
	}
	if req.Comment != "" {
		body["comment"] = req.Comment
	}
	return body
}

func BuildGREUpdateBody(req UpdateGRERequest, ep *UpdateGREEndpointInput) map[string]interface{} {
	body := map[string]interface{}{}
	if req.MTU != nil {
		body["mtu"] = strconv.Itoa(*req.MTU)
	}
	if req.KeepaliveInterval != nil || req.KeepaliveRetries != nil {
		interval := 10
		retries := 10
		if req.KeepaliveInterval != nil {
			interval = *req.KeepaliveInterval
		}
		if req.KeepaliveRetries != nil {
			retries = *req.KeepaliveRetries
		}
		body["keepalive"] = fmt.Sprintf("%ds,%d", interval, retries)
	}
	if req.IpsecSecret != nil {
		body["ipsec-secret"] = *req.IpsecSecret
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
	if ep != nil {
		if ep.LocalAddress != nil {
			body["local-address"] = *ep.LocalAddress
		}
		if ep.RemoteAddress != nil {
			body["remote-address"] = *ep.RemoteAddress
		}
	}
	return body
}
