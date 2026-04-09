package tunnel

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/pobradovic08/kormos/backend/internal/normalize"
	"github.com/pobradovic08/kormos/backend/internal/routeros"
)

const ipsecRouteCommentPrefix = "ipsec:"
const ipsecLoopbackPrefix = "lo-ipsec-"
const ipsecLoopbackCommentPrefix = "ipsec-lo:"

// stripPrefix removes a CIDR prefix length (e.g. "/32") from an address.
func stripPrefix(addr string) string {
	if i := strings.IndexByte(addr, '/'); i >= 0 {
		return addr[:i]
	}
	return addr
}

type PerRouterIPsec struct {
	Peers       []RawIPsecPeer
	Profiles    []RawIPsecProfile
	Proposals   []RawIPsecProposal
	Identities  []RawIPsecIdentity
	Policies    []RawIPsecPolicy
	ActivePeers []RawIPsecActivePeer
	Routes      []RawRoute
	Loopbacks   []RawLoopback
	Addresses   []RawIPAddress
}

func FetchIPsecAll(ctx context.Context, client *routeros.Client) (*PerRouterIPsec, error) {
	result := &PerRouterIPsec{}

	body, err := client.Get(ctx, "/ip/ipsec/peer")
	if err != nil {
		return nil, fmt.Errorf("tunnel: fetch ipsec peers: %w", err)
	}
	if err := json.Unmarshal(body, &result.Peers); err != nil {
		return nil, fmt.Errorf("tunnel: parse ipsec peers: %w", err)
	}

	body, err = client.Get(ctx, "/ip/ipsec/profile")
	if err != nil {
		return nil, fmt.Errorf("tunnel: fetch ipsec profiles: %w", err)
	}
	if err := json.Unmarshal(body, &result.Profiles); err != nil {
		return nil, fmt.Errorf("tunnel: parse ipsec profiles: %w", err)
	}

	body, err = client.Get(ctx, "/ip/ipsec/proposal")
	if err != nil {
		return nil, fmt.Errorf("tunnel: fetch ipsec proposals: %w", err)
	}
	if err := json.Unmarshal(body, &result.Proposals); err != nil {
		return nil, fmt.Errorf("tunnel: parse ipsec proposals: %w", err)
	}

	body, err = client.Get(ctx, "/ip/ipsec/identity")
	if err != nil {
		return nil, fmt.Errorf("tunnel: fetch ipsec identities: %w", err)
	}
	if err := json.Unmarshal(body, &result.Identities); err != nil {
		return nil, fmt.Errorf("tunnel: parse ipsec identities: %w", err)
	}

	body, err = client.Get(ctx, "/ip/ipsec/policy")
	if err != nil {
		return nil, fmt.Errorf("tunnel: fetch ipsec policies: %w", err)
	}
	if err := json.Unmarshal(body, &result.Policies); err != nil {
		return nil, fmt.Errorf("tunnel: parse ipsec policies: %w", err)
	}

	body, err = client.Get(ctx, "/ip/ipsec/active-peers")
	if err != nil {
		result.ActivePeers = []RawIPsecActivePeer{}
	} else if err := json.Unmarshal(body, &result.ActivePeers); err != nil {
		result.ActivePeers = []RawIPsecActivePeer{}
	}

	// Fetch static routes tagged with the ipsec comment prefix.
	var allRoutes []RawRoute
	body, err = client.Get(ctx, "/ip/route")
	if err != nil {
		allRoutes = []RawRoute{}
	} else if err := json.Unmarshal(body, &allRoutes); err != nil {
		allRoutes = []RawRoute{}
	}
	for _, r := range allRoutes {
		if strings.HasPrefix(r.Comment, ipsecRouteCommentPrefix) {
			result.Routes = append(result.Routes, r)
		}
	}

	// Fetch loopback interfaces tagged with ipsec-lo: comment.
	var allLoopbacks []RawLoopback
	body, err = client.Get(ctx, "/interface/loopback")
	if err != nil {
		allLoopbacks = []RawLoopback{}
	} else if err := json.Unmarshal(body, &allLoopbacks); err != nil {
		allLoopbacks = []RawLoopback{}
	}
	for _, lo := range allLoopbacks {
		if strings.HasPrefix(lo.Comment, ipsecLoopbackCommentPrefix) {
			result.Loopbacks = append(result.Loopbacks, lo)
		}
	}

	// Fetch IP addresses on IPsec loopbacks.
	var allAddresses []RawIPAddress
	body, err = client.Get(ctx, "/ip/address")
	if err != nil {
		allAddresses = []RawIPAddress{}
	} else if err := json.Unmarshal(body, &allAddresses); err != nil {
		allAddresses = []RawIPAddress{}
	}
	for _, a := range allAddresses {
		if strings.HasPrefix(a.Interface, ipsecLoopbackPrefix) {
			result.Addresses = append(result.Addresses, a)
		}
	}

	return result, nil
}

type assembledIPsec struct {
	PeerName            string
	PeerID              string
	LocalAddress        string
	RemoteAddress       string
	Disabled            bool
	Comment             string
	ProfileID           string
	ProposalID          string
	IdentityID          string
	PolicyIDs           []string
	Phase1              Phase1Config
	Phase2              Phase2Config
	AuthMethod          string
	Secret              string
	LocalSubnets        []string
	RemoteSubnets       []string
	TunnelRoutes        []string
	RouteIDs            []string
	LocalTunnelAddress  string
	RemoteTunnelAddress string
	LoopbackID          string
	AddressID           string
	Mode                string
	Established         bool
}

func AssembleIPsec(data *PerRouterIPsec) []assembledIPsec {
	profileByName := map[string]RawIPsecProfile{}
	for _, p := range data.Profiles {
		profileByName[p.Name] = p
	}
	proposalByName := map[string]RawIPsecProposal{}
	for _, p := range data.Proposals {
		proposalByName[p.Name] = p
	}
	identityByPeer := map[string]RawIPsecIdentity{}
	for _, id := range data.Identities {
		identityByPeer[id.Peer] = id
	}
	policiesByPeer := map[string][]RawIPsecPolicy{}
	for _, pol := range data.Policies {
		policiesByPeer[pol.Peer] = append(policiesByPeer[pol.Peer], pol)
	}
	activePeerByAddr := map[string]bool{}
	for _, ap := range data.ActivePeers {
		if ap.State == "established" {
			activePeerByAddr[ap.RemoteAddress] = true
		}
	}
	// Group routes by tunnel name extracted from comment "ipsec:{name}".
	routesByTunnel := map[string][]RawRoute{}
	for _, r := range data.Routes {
		name := strings.TrimPrefix(r.Comment, ipsecRouteCommentPrefix)
		routesByTunnel[name] = append(routesByTunnel[name], r)
	}
	// Index loopbacks by tunnel name from comment "ipsec-lo:{name}:{remoteAddr}".
	loopbackByTunnel := map[string]RawLoopback{}
	loopbackRemoteAddr := map[string]string{}
	for _, lo := range data.Loopbacks {
		rest := strings.TrimPrefix(lo.Comment, ipsecLoopbackCommentPrefix)
		parts := strings.SplitN(rest, ":", 2)
		loopbackByTunnel[parts[0]] = lo
		if len(parts) > 1 {
			loopbackRemoteAddr[parts[0]] = parts[1]
		}
	}
	// Index addresses by loopback interface name.
	addressByInterface := map[string]RawIPAddress{}
	for _, a := range data.Addresses {
		addressByInterface[a.Interface] = a
	}

	var result []assembledIPsec
	for _, peer := range data.Peers {
		a := assembledIPsec{
			PeerName:      peer.Name,
			PeerID:        peer.ID,
			LocalAddress:  peer.LocalAddress,
			RemoteAddress: peer.Address,
			Disabled:      normalize.ParseBool(peer.Disabled),
			Comment:       peer.Comment,
		}

		if prof, ok := profileByName[peer.Profile]; ok {
			a.ProfileID = prof.ID
			a.Phase1 = Phase1Config{
				Encryption: prof.EncAlgorithm,
				Hash:       prof.HashAlgorithm,
				DHGroup:    prof.DHGroup,
				Lifetime:   prof.Lifetime,
			}
		}

		if prop, ok := proposalByName[peer.Name]; ok {
			a.ProposalID = prop.ID
			a.Phase2 = Phase2Config{
				Encryption:    prop.EncAlgorithms,
				AuthAlgorithm: prop.AuthAlgorithms,
				PFSGroup:      prop.PFSGroup,
				Lifetime:      prop.Lifetime,
			}
		}

		if ident, ok := identityByPeer[peer.Name]; ok {
			a.IdentityID = ident.ID
			a.AuthMethod = ident.AuthMethod
			a.Secret = ident.Secret
		}

		policies := policiesByPeer[peer.Name]
		hasTunnelPolicy := false
		hasTemplatePolicy := false
		hasRealPolicy := false
		for _, pol := range policies {
			a.PolicyIDs = append(a.PolicyIDs, pol.ID)
			if normalize.ParseBool(pol.Tunnel) {
				hasTunnelPolicy = true
			} else if normalize.ParseBool(pol.Template) {
				hasTemplatePolicy = true
			} else {
				hasRealPolicy = true
				if pol.SrcAddress != "" && pol.SrcAddress != "0.0.0.0/0" {
					a.LocalSubnets = append(a.LocalSubnets, pol.SrcAddress)
				}
				if pol.DstAddress != "" && pol.DstAddress != "0.0.0.0/0" {
					a.RemoteSubnets = append(a.RemoteSubnets, pol.DstAddress)
				}
			}
		}
		if hasRealPolicy {
			a.Mode = "policy-based"
		} else if hasTunnelPolicy || hasTemplatePolicy {
			a.Mode = "route-based"
		} else {
			a.Mode = "route-based"
		}

		// Attach loopback and address for route-based tunnels.
		if lo, ok := loopbackByTunnel[peer.Name]; ok {
			a.LoopbackID = lo.ID
			a.RemoteTunnelAddress = loopbackRemoteAddr[peer.Name]
			loName := ipsecLoopbackPrefix + peer.Name
			if addr, ok := addressByInterface[loName]; ok {
				a.AddressID = addr.ID
				a.LocalTunnelAddress = addr.Address
			}
		}

		// Attach tunnel routes from tagged static routes.
		for _, r := range routesByTunnel[peer.Name] {
			a.TunnelRoutes = append(a.TunnelRoutes, r.DstAddress)
			a.RouteIDs = append(a.RouteIDs, r.ID)
		}

		a.Established = activePeerByAddr[peer.Address]
		result = append(result, a)
	}
	return result
}

type ipsecOp struct {
	RouterID     string
	ResourcePath string
	ResourceID   string
	Body         map[string]interface{}
}

func BuildIPsecCreateOps(req CreateIPsecRequest, routerID string, ep CreateIPsecEndpointInput) []ipsecOp {
	var ops []ipsecOp

	ops = append(ops, ipsecOp{
		RouterID:     routerID,
		ResourcePath: "/ip/ipsec/profile",
		Body: map[string]interface{}{
			"name":           req.Name,
			"enc-algorithm":  req.Phase1.Encryption,
			"hash-algorithm": req.Phase1.Hash,
			"dh-group":       req.Phase1.DHGroup,
			"lifetime":       req.Phase1.Lifetime,
		},
	})

	ops = append(ops, ipsecOp{
		RouterID:     routerID,
		ResourcePath: "/ip/ipsec/proposal",
		Body: map[string]interface{}{
			"name":            req.Name,
			"enc-algorithms":  req.Phase2.Encryption,
			"auth-algorithms": req.Phase2.AuthAlgorithm,
			"pfs-group":       req.Phase2.PFSGroup,
			"lifetime":        req.Phase2.Lifetime,
		},
	})

	peerBody := map[string]interface{}{
		"name":          req.Name,
		"address":       ep.RemoteAddress,
		"local-address": ep.LocalAddress,
		"profile":       req.Name,
	}
	if req.Disabled {
		peerBody["disabled"] = "true"
	}
	if req.Comment != "" {
		peerBody["comment"] = req.Comment
	}
	ops = append(ops, ipsecOp{
		RouterID:     routerID,
		ResourcePath: "/ip/ipsec/peer",
		Body:         peerBody,
	})

	identBody := map[string]interface{}{
		"peer":        req.Name,
		"auth-method": req.AuthMethod,
	}
	if req.IpsecSecret != "" {
		identBody["secret"] = req.IpsecSecret
	}
	ops = append(ops, ipsecOp{
		RouterID:     routerID,
		ResourcePath: "/ip/ipsec/identity",
		Body:         identBody,
	})

	if req.Mode == "policy-based" {
		for i := range req.LocalSubnets {
			remoteSubnet := ""
			if i < len(req.RemoteSubnets) {
				remoteSubnet = req.RemoteSubnets[i]
			}
			ops = append(ops, ipsecOp{
				RouterID:     routerID,
				ResourcePath: "/ip/ipsec/policy",
				Body: map[string]interface{}{
					"peer":        req.Name,
					"src-address": req.LocalSubnets[i],
					"dst-address": remoteSubnet,
				},
			})
		}
	}

	// Route-based: create loopback + address + tunnel-mode policy + static routes.
	if req.Mode == "route-based" {
		if req.LocalTunnelAddress != "" && req.RemoteTunnelAddress != "" {
			// Create loopback interface for transit IP.
			ops = append(ops, ipsecOp{
				RouterID:     routerID,
				ResourcePath: "/interface/loopback",
				Body: map[string]interface{}{
					"name":    ipsecLoopbackPrefix + req.Name,
					"comment": ipsecLoopbackCommentPrefix + req.Name + ":" + stripPrefix(req.RemoteTunnelAddress),
				},
			})

			// Assign local tunnel address to the loopback.
			ops = append(ops, ipsecOp{
				RouterID:     routerID,
				ResourcePath: "/ip/address",
				Body: map[string]interface{}{
					"address":   req.LocalTunnelAddress,
					"interface": ipsecLoopbackPrefix + req.Name,
					"comment":   ipsecLoopbackCommentPrefix + req.Name,
				},
			})

			// Tunnel-mode policy: encrypts traffic between transit addresses.
			ops = append(ops, ipsecOp{
				RouterID:     routerID,
				ResourcePath: "/ip/ipsec/policy",
				Body: map[string]interface{}{
					"peer":           req.Name,
					"proposal":       req.Name,
					"tunnel":         "yes",
					"src-address":    req.LocalTunnelAddress,
					"dst-address":    req.RemoteTunnelAddress,
					"sa-src-address": stripPrefix(ep.LocalAddress),
					"sa-dst-address": stripPrefix(ep.RemoteAddress),
				},
			})
		} else {
			// Fallback: template policy when no tunnel addresses provided.
			ops = append(ops, ipsecOp{
				RouterID:     routerID,
				ResourcePath: "/ip/ipsec/policy",
				Body: map[string]interface{}{
					"peer":        req.Name,
					"proposal":    req.Name,
					"template":    "yes",
					"src-address": "0.0.0.0/0",
					"dst-address": "0.0.0.0/0",
				},
			})
		}

		// Static routes: gateway is remote tunnel IP if available, else remote peer IP.
		gw := stripPrefix(ep.RemoteAddress)
		if req.RemoteTunnelAddress != "" {
			gw = stripPrefix(req.RemoteTunnelAddress)
		}
		for _, dst := range req.TunnelRoutes {
			ops = append(ops, ipsecOp{
				RouterID:     routerID,
				ResourcePath: "/ip/route",
				Body: map[string]interface{}{
					"dst-address": dst,
					"gateway":     gw,
					"comment":     ipsecRouteCommentPrefix + req.Name,
				},
			})
		}
	}

	return ops
}

func BuildIPsecDeleteOps(routerID string, a assembledIPsec) []ipsecOp {
	var ops []ipsecOp

	// Delete routes first (before removing the peer/policy that references them).
	for _, rid := range a.RouteIDs {
		ops = append(ops, ipsecOp{RouterID: routerID, ResourcePath: "/ip/route", ResourceID: rid})
	}
	// Delete loopback address and interface.
	if a.AddressID != "" {
		ops = append(ops, ipsecOp{RouterID: routerID, ResourcePath: "/ip/address", ResourceID: a.AddressID})
	}
	if a.LoopbackID != "" {
		ops = append(ops, ipsecOp{RouterID: routerID, ResourcePath: "/interface/loopback", ResourceID: a.LoopbackID})
	}
	for _, pid := range a.PolicyIDs {
		ops = append(ops, ipsecOp{RouterID: routerID, ResourcePath: "/ip/ipsec/policy", ResourceID: pid})
	}
	if a.IdentityID != "" {
		ops = append(ops, ipsecOp{RouterID: routerID, ResourcePath: "/ip/ipsec/identity", ResourceID: a.IdentityID})
	}
	ops = append(ops, ipsecOp{RouterID: routerID, ResourcePath: "/ip/ipsec/peer", ResourceID: a.PeerID})
	if a.ProposalID != "" {
		ops = append(ops, ipsecOp{RouterID: routerID, ResourcePath: "/ip/ipsec/proposal", ResourceID: a.ProposalID})
	}
	if a.ProfileID != "" {
		ops = append(ops, ipsecOp{RouterID: routerID, ResourcePath: "/ip/ipsec/profile", ResourceID: a.ProfileID})
	}

	return ops
}

func buildIPsecEndpoint(ri RouterInfo, a assembledIPsec) IPsecEndpoint {
	return IPsecEndpoint{
		RouterID:   ri.ID,
		RouterName: ri.Name,
		Role:       ri.Role,
		RosIDs: IPsecRosIDs{
			Peer:     a.PeerID,
			Profile:  a.ProfileID,
			Proposal: a.ProposalID,
			Identity: a.IdentityID,
			Policies: a.PolicyIDs,
			Loopback: a.LoopbackID,
			Address:  a.AddressID,
		},
		LocalAddress:  a.LocalAddress,
		RemoteAddress: a.RemoteAddress,
		Established:   a.Established,
	}
}

func buildIPsecUpdateBody(ep *UpdateIPsecEndpointInput, req UpdateIPsecRequest) map[string]interface{} {
	body := map[string]interface{}{}
	if ep != nil {
		if ep.LocalAddress != nil {
			body["local-address"] = *ep.LocalAddress
		}
		if ep.RemoteAddress != nil {
			body["address"] = *ep.RemoteAddress
		}
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

func buildProfileUpdateBody(p1 *Phase1Config) map[string]interface{} {
	body := map[string]interface{}{}
	if p1 == nil {
		return body
	}
	if p1.Encryption != "" {
		body["enc-algorithm"] = p1.Encryption
	}
	if p1.Hash != "" {
		body["hash-algorithm"] = p1.Hash
	}
	if p1.DHGroup != "" {
		body["dh-group"] = p1.DHGroup
	}
	if p1.Lifetime != "" {
		body["lifetime"] = p1.Lifetime
	}
	return body
}

func buildProposalUpdateBody(p2 *Phase2Config) map[string]interface{} {
	body := map[string]interface{}{}
	if p2 == nil {
		return body
	}
	if p2.Encryption != "" {
		body["enc-algorithms"] = p2.Encryption
	}
	if p2.AuthAlgorithm != "" {
		body["auth-algorithms"] = p2.AuthAlgorithm
	}
	if p2.PFSGroup != "" {
		body["pfs-group"] = p2.PFSGroup
	}
	if p2.Lifetime != "" {
		body["lifetime"] = p2.Lifetime
	}
	return body
}
