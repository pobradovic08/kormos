package tunnel

import (
	"context"
	"fmt"

	"github.com/pobradovic08/kormos/backend/internal/cluster"
	"github.com/pobradovic08/kormos/backend/internal/interfaces"
	"github.com/pobradovic08/kormos/backend/internal/operation"
	"github.com/pobradovic08/kormos/backend/internal/router"
	"github.com/pobradovic08/kormos/backend/internal/routeros"
)

// Service orchestrates tunnel CRUD operations across cluster routers.
type Service struct {
	routerSvc    *router.Service
	clusterSvc   *cluster.Service
	operationSvc *operation.Service
	ifaceFetcher *interfaces.Fetcher
}

// NewService creates a new tunnel Service.
func NewService(routerSvc *router.Service, clusterSvc *cluster.Service, operationSvc *operation.Service, ifaceFetcher *interfaces.Fetcher) *Service {
	return &Service{routerSvc: routerSvc, clusterSvc: clusterSvc, operationSvc: operationSvc, ifaceFetcher: ifaceFetcher}
}

// getClusterRouters returns router info and RouterOS clients for all routers in a cluster.
func (s *Service) getClusterRouters(ctx context.Context, tenantID, clusterID string) ([]RouterInfo, map[string]*routeros.Client, error) {
	cl, err := s.clusterSvc.GetByID(ctx, tenantID, clusterID)
	if err != nil {
		return nil, nil, fmt.Errorf("tunnel: get cluster: %w", err)
	}
	if cl == nil {
		return nil, nil, fmt.Errorf("tunnel: cluster not found")
	}

	routers := make([]RouterInfo, len(cl.Routers))
	clients := make(map[string]*routeros.Client)
	for i, r := range cl.Routers {
		routers[i] = RouterInfo{ID: r.ID, Name: r.Name, Role: r.Role}
		client, err := s.routerSvc.GetClientForRouter(ctx, tenantID, r.ID)
		if err != nil {
			return nil, nil, fmt.Errorf("tunnel: get client for router %s: %w", r.Name, err)
		}
		clients[r.ID] = client
	}
	return routers, clients, nil
}

// getMasterClient returns a RouterOS client for the master router in the cluster.
func (s *Service) getMasterClient(ctx context.Context, tenantID, clusterID string) (*routeros.Client, error) {
	cl, err := s.clusterSvc.GetByID(ctx, tenantID, clusterID)
	if err != nil {
		return nil, fmt.Errorf("cluster: get cluster: %w", err)
	}
	if cl == nil {
		return nil, fmt.Errorf("cluster: cluster not found")
	}

	for _, r := range cl.Routers {
		if r.Role == "master" {
			client, err := s.routerSvc.GetClientForRouter(ctx, tenantID, r.ID)
			if err != nil {
				return nil, fmt.Errorf("cluster: get client for master router %s: %w", r.Name, err)
			}
			return client, nil
		}
	}
	return nil, fmt.Errorf("cluster: no master router found in cluster")
}

// executeOps runs operations through the operation service and returns an error
// if any operation failed (the operation service returns nil error even on failure).
func (s *Service) executeOps(ctx context.Context, tenantID, userID string, req operation.ExecuteRequest) error {
	resp, err := s.operationSvc.Execute(ctx, tenantID, userID, req)
	if err != nil {
		return err
	}
	if resp.Status != operation.StatusApplied {
		// Collect first error from operations for a useful message.
		for _, op := range resp.Operations {
			if op.Error != "" {
				return fmt.Errorf("operation failed: %s", op.Error)
			}
		}
		return fmt.Errorf("operation group status: %s", resp.Status)
	}
	return nil
}

// validateRouterIDs verifies that all endpoint router IDs belong to the cluster.
func validateRouterIDs(endpoints []string, routers []RouterInfo) error {
	valid := map[string]bool{}
	for _, ri := range routers {
		valid[ri.ID] = true
	}
	for _, id := range endpoints {
		if !valid[id] {
			return fmt.Errorf("tunnel: router %s not in cluster", id)
		}
	}
	return nil
}

// ─── GRE CRUD ─────────────────────────────────────────────────────────────────

// ListGRE fetches GRE tunnels from all routers in the cluster and merges them.
func (s *Service) ListGRE(ctx context.Context, tenantID, clusterID string) ([]MergedGRETunnel, error) {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	perRouter := make(map[string][]RawGRETunnel)
	for _, ri := range routers {
		raw, err := FetchGRETunnels(ctx, clients[ri.ID])
		if err != nil {
			return nil, fmt.Errorf("tunnel: list gre from router %s: %w", ri.Name, err)
		}
		perRouter[ri.ID] = raw
	}

	return MergeGRETunnels(perRouter, routers), nil
}

// GetGRE returns a single merged GRE tunnel by name.
func (s *Service) GetGRE(ctx context.Context, tenantID, clusterID, name string) (*MergedGRETunnel, error) {
	tunnels, err := s.ListGRE(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	return FindMergedGREByName(tunnels, name), nil
}

// CreateGRE creates a GRE tunnel on each specified endpoint router.
func (s *Service) CreateGRE(ctx context.Context, tenantID, userID, clusterID string, req CreateGRERequest) (*MergedGRETunnel, error) {
	routers, _, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	endpointIDs := make([]string, len(req.Endpoints))
	for i, ep := range req.Endpoints {
		endpointIDs[i] = ep.RouterID
	}
	if err := validateRouterIDs(endpointIDs, routers); err != nil {
		return nil, err
	}

	ops := make([]operation.ExecuteOperation, 0, len(req.Endpoints))
	for _, ep := range req.Endpoints {
		body := BuildGRECreateBody(req, ep)
		ops = append(ops, operation.ExecuteOperation{
			RouterID:      ep.RouterID,
			Module:        "tunnels",
			OperationType: operation.OpAdd,
			ResourcePath:  "/interface/gre",
			Body:          body,
		})
	}

	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Create GRE tunnel %q", req.Name),
		Operations:  ops,
	}
	if err := s.executeOps(ctx, tenantID, userID, execReq); err != nil {
		return nil, fmt.Errorf("tunnel: create gre: %w", err)
	}

	return s.GetGRE(ctx, tenantID, clusterID, req.Name)
}

// UpdateGRE updates an existing GRE tunnel by name on each router that has it.
func (s *Service) UpdateGRE(ctx context.Context, tenantID, userID, clusterID, name string, req UpdateGRERequest) (*MergedGRETunnel, error) {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	ops := make([]operation.ExecuteOperation, 0, len(routers))
	for _, ri := range routers {
		raw, err := FetchGRETunnels(ctx, clients[ri.ID])
		if err != nil {
			return nil, fmt.Errorf("tunnel: fetch gre from router %s: %w", ri.Name, err)
		}
		t := FindGREByName(raw, name)
		if t == nil {
			continue
		}

		var epInput *UpdateGREEndpointInput
		for i := range req.Endpoints {
			if req.Endpoints[i].RouterID == ri.ID {
				epInput = &req.Endpoints[i]
				break
			}
		}

		body := BuildGREUpdateBody(req, epInput)
		ops = append(ops, operation.ExecuteOperation{
			RouterID:      ri.ID,
			Module:        "tunnels",
			OperationType: operation.OpModify,
			ResourcePath:  "/interface/gre",
			ResourceID:    t.ID,
			Body:          body,
		})
	}

	if len(ops) == 0 {
		return nil, fmt.Errorf("tunnel: gre tunnel %q not found on any router", name)
	}

	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Update GRE tunnel %q", name),
		Operations:  ops,
	}
	if err := s.executeOps(ctx, tenantID, userID, execReq); err != nil {
		return nil, fmt.Errorf("tunnel: update gre: %w", err)
	}

	return s.GetGRE(ctx, tenantID, clusterID, name)
}

// DeleteGRE removes a GRE tunnel by name from all routers that have it.
func (s *Service) DeleteGRE(ctx context.Context, tenantID, userID, clusterID, name string) error {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return err
	}

	ops := make([]operation.ExecuteOperation, 0, len(routers))
	for _, ri := range routers {
		raw, err := FetchGRETunnels(ctx, clients[ri.ID])
		if err != nil {
			return fmt.Errorf("tunnel: fetch gre from router %s: %w", ri.Name, err)
		}
		t := FindGREByName(raw, name)
		if t == nil {
			continue
		}

		ops = append(ops, operation.ExecuteOperation{
			RouterID:      ri.ID,
			Module:        "tunnels",
			OperationType: operation.OpDelete,
			ResourcePath:  "/interface/gre",
			ResourceID:    t.ID,
		})
	}

	if len(ops) == 0 {
		return fmt.Errorf("tunnel: gre tunnel %q not found on any router", name)
	}

	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Delete GRE tunnel %q", name),
		Operations:  ops,
	}
	if err := s.executeOps(ctx, tenantID, userID, execReq); err != nil {
		return fmt.Errorf("tunnel: delete gre: %w", err)
	}

	return nil
}

// ─── IPsec CRUD ────────────────────────────────────────────────────────────────

// ListIPsec fetches IPsec tunnels from all routers in the cluster and merges them.
func (s *Service) ListIPsec(ctx context.Context, tenantID, clusterID string) ([]MergedIPsecTunnel, error) {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	perRouter := make(map[string][]assembledIPsec)
	for _, ri := range routers {
		data, err := FetchIPsecAll(ctx, clients[ri.ID])
		if err != nil {
			return nil, fmt.Errorf("tunnel: list ipsec from router %s: %w", ri.Name, err)
		}
		perRouter[ri.ID] = AssembleIPsec(data)
	}

	return MergeIPsecTunnels(perRouter, routers), nil
}

// GetIPsec returns a single merged IPsec tunnel by name.
func (s *Service) GetIPsec(ctx context.Context, tenantID, clusterID, name string) (*MergedIPsecTunnel, error) {
	tunnels, err := s.ListIPsec(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	return FindMergedIPsecByName(tunnels, name), nil
}

// CreateIPsec creates an IPsec tunnel on each specified endpoint router.
func (s *Service) CreateIPsec(ctx context.Context, tenantID, userID, clusterID string, req CreateIPsecRequest) (*MergedIPsecTunnel, error) {
	routers, _, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	endpointIDs := make([]string, len(req.Endpoints))
	for i, ep := range req.Endpoints {
		endpointIDs[i] = ep.RouterID
	}
	if err := validateRouterIDs(endpointIDs, routers); err != nil {
		return nil, err
	}

	ops := make([]operation.ExecuteOperation, 0)
	for _, ep := range req.Endpoints {
		ipsecOps := BuildIPsecCreateOps(req, ep.RouterID, ep)
		for _, iop := range ipsecOps {
			ops = append(ops, operation.ExecuteOperation{
				RouterID:      iop.RouterID,
				Module:        "tunnels",
				OperationType: operation.OpAdd,
				ResourcePath:  iop.ResourcePath,
				Body:          iop.Body,
			})
		}
	}

	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Create IPsec tunnel %s", req.Name),
		Operations:  ops,
	}
	if err := s.executeOps(ctx, tenantID, userID, execReq); err != nil {
		return nil, fmt.Errorf("tunnel: create ipsec: %w", err)
	}

	return s.GetIPsec(ctx, tenantID, clusterID, req.Name)
}

// UpdateIPsec updates an existing IPsec tunnel by name on each router that has it.
func (s *Service) UpdateIPsec(ctx context.Context, tenantID, userID, clusterID, name string, req UpdateIPsecRequest) (*MergedIPsecTunnel, error) {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	ops := make([]operation.ExecuteOperation, 0, len(routers))
	for _, ri := range routers {
		data, err := FetchIPsecAll(ctx, clients[ri.ID])
		if err != nil {
			return nil, fmt.Errorf("tunnel: fetch ipsec from router %s: %w", ri.Name, err)
		}
		assembled := AssembleIPsec(data)

		var a *assembledIPsec
		for i := range assembled {
			if assembled[i].PeerName == name {
				a = &assembled[i]
				break
			}
		}
		if a == nil {
			continue
		}

		var epInput *UpdateIPsecEndpointInput
		for i := range req.Endpoints {
			if req.Endpoints[i].RouterID == ri.ID {
				epInput = &req.Endpoints[i]
				break
			}
		}

		peerBody := buildIPsecUpdateBody(epInput, req)
		ops = append(ops, operation.ExecuteOperation{
			RouterID:      ri.ID,
			Module:        "tunnels",
			OperationType: operation.OpModify,
			ResourcePath:  "/ip/ipsec/peer",
			ResourceID:    a.PeerID,
			Body:          peerBody,
		})

		if req.Phase1 != nil && a.ProfileID != "" {
			profileBody := buildProfileUpdateBody(req.Phase1)
			ops = append(ops, operation.ExecuteOperation{
				RouterID:      ri.ID,
				Module:        "tunnels",
				OperationType: operation.OpModify,
				ResourcePath:  "/ip/ipsec/profile",
				ResourceID:    a.ProfileID,
				Body:          profileBody,
			})
		}

		if req.Phase2 != nil && a.ProposalID != "" {
			proposalBody := buildProposalUpdateBody(req.Phase2)
			ops = append(ops, operation.ExecuteOperation{
				RouterID:      ri.ID,
				Module:        "tunnels",
				OperationType: operation.OpModify,
				ResourcePath:  "/ip/ipsec/proposal",
				ResourceID:    a.ProposalID,
				Body:          proposalBody,
			})
		}

		if (req.AuthMethod != nil || req.IpsecSecret != nil) && a.IdentityID != "" {
			identityBody := map[string]interface{}{}
			if req.AuthMethod != nil {
				identityBody["auth-method"] = *req.AuthMethod
			}
			if req.IpsecSecret != nil {
				identityBody["secret"] = *req.IpsecSecret
			}
			ops = append(ops, operation.ExecuteOperation{
				RouterID:      ri.ID,
				Module:        "tunnels",
				OperationType: operation.OpModify,
				ResourcePath:  "/ip/ipsec/identity",
				ResourceID:    a.IdentityID,
				Body:          identityBody,
			})
		}

		// Update loopback address and tunnel-mode policy if tunnel addresses changed.
		if epInput != nil && epInput.LocalTunnelAddress != nil && a.AddressID != "" {
			ops = append(ops, operation.ExecuteOperation{
				RouterID:      ri.ID,
				Module:        "tunnels",
				OperationType: operation.OpModify,
				ResourcePath:  "/ip/address",
				ResourceID:    a.AddressID,
				Body:          map[string]interface{}{"address": *epInput.LocalTunnelAddress},
			})
		}
		if epInput != nil && epInput.RemoteTunnelAddress != nil && a.LoopbackID != "" {
			ops = append(ops, operation.ExecuteOperation{
				RouterID:      ri.ID,
				Module:        "tunnels",
				OperationType: operation.OpModify,
				ResourcePath:  "/interface/loopback",
				ResourceID:    a.LoopbackID,
				Body: map[string]interface{}{
					"comment": ipsecLoopbackCommentPrefix + name + ":" + stripPrefix(*epInput.RemoteTunnelAddress),
				},
			})
		}
		// Update tunnel-mode policy src/dst addresses if tunnel addresses changed.
		if epInput != nil && (epInput.LocalTunnelAddress != nil || epInput.RemoteTunnelAddress != nil) && a.LoopbackID != "" {
			localTA := a.LocalTunnelAddress
			if epInput.LocalTunnelAddress != nil {
				localTA = *epInput.LocalTunnelAddress
			}
			remoteTA := a.RemoteTunnelAddress
			if epInput.RemoteTunnelAddress != nil {
				remoteTA = *epInput.RemoteTunnelAddress
			}
			policyBody := map[string]interface{}{
				"src-address": localTA,
				"dst-address": remoteTA,
			}
			if epInput.LocalAddress != nil {
				policyBody["sa-src-address"] = stripPrefix(*epInput.LocalAddress)
			}
			if epInput.RemoteAddress != nil {
				policyBody["sa-dst-address"] = stripPrefix(*epInput.RemoteAddress)
			}
			for _, pid := range a.PolicyIDs {
				ops = append(ops, operation.ExecuteOperation{
					RouterID:      ri.ID,
					Module:        "tunnels",
					OperationType: operation.OpModify,
					ResourcePath:  "/ip/ipsec/policy",
					ResourceID:    pid,
					Body:          policyBody,
				})
			}
		}

		// Diff tunnel routes: delete removed, add new.
		if len(req.TunnelRoutes) > 0 || len(a.RouteIDs) > 0 {
			existingRoutes := map[string]string{} // dst -> routeID
			for i, dst := range a.TunnelRoutes {
				if i < len(a.RouteIDs) {
					existingRoutes[dst] = a.RouteIDs[i]
				}
			}
			desiredRoutes := map[string]bool{}
			for _, dst := range req.TunnelRoutes {
				desiredRoutes[dst] = true
			}

			// Delete routes no longer desired.
			for dst, rid := range existingRoutes {
				if !desiredRoutes[dst] {
					ops = append(ops, operation.ExecuteOperation{
						RouterID:      ri.ID,
						Module:        "tunnels",
						OperationType: operation.OpDelete,
						ResourcePath:  "/ip/route",
						ResourceID:    rid,
					})
				}
			}

			// Determine gateway: prefer remote tunnel address, then endpoint, then existing peer.
			gateway := stripPrefix(a.RemoteAddress)
			if a.RemoteTunnelAddress != "" {
				gateway = stripPrefix(a.RemoteTunnelAddress)
			}
			if epInput != nil && epInput.RemoteTunnelAddress != nil {
				gateway = stripPrefix(*epInput.RemoteTunnelAddress)
			} else if epInput != nil && epInput.RemoteAddress != nil {
				gateway = stripPrefix(*epInput.RemoteAddress)
			}

			// Add new routes.
			for _, dst := range req.TunnelRoutes {
				if _, exists := existingRoutes[dst]; !exists {
					ops = append(ops, operation.ExecuteOperation{
						RouterID:      ri.ID,
						Module:        "tunnels",
						OperationType: operation.OpAdd,
						ResourcePath:  "/ip/route",
						Body: map[string]interface{}{
							"dst-address": dst,
							"gateway":     gateway,
							"comment":     ipsecRouteCommentPrefix + name,
						},
					})
				}
			}
		}
	}

	if len(ops) == 0 {
		return nil, fmt.Errorf("tunnel: ipsec tunnel %q not found on any router", name)
	}

	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Update IPsec tunnel %s", name),
		Operations:  ops,
	}
	if err := s.executeOps(ctx, tenantID, userID, execReq); err != nil {
		return nil, fmt.Errorf("tunnel: update ipsec: %w", err)
	}

	return s.GetIPsec(ctx, tenantID, clusterID, name)
}

// DeleteIPsec removes an IPsec tunnel by name from all routers that have it.
func (s *Service) DeleteIPsec(ctx context.Context, tenantID, userID, clusterID, name string) error {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return err
	}

	ops := make([]operation.ExecuteOperation, 0, len(routers))
	for _, ri := range routers {
		data, err := FetchIPsecAll(ctx, clients[ri.ID])
		if err != nil {
			return fmt.Errorf("tunnel: fetch ipsec from router %s: %w", ri.Name, err)
		}
		assembled := AssembleIPsec(data)

		var a *assembledIPsec
		for i := range assembled {
			if assembled[i].PeerName == name {
				a = &assembled[i]
				break
			}
		}
		if a == nil {
			continue
		}

		deleteOps := BuildIPsecDeleteOps(ri.ID, *a)
		for _, dop := range deleteOps {
			ops = append(ops, operation.ExecuteOperation{
				RouterID:      dop.RouterID,
				Module:        "tunnels",
				OperationType: operation.OpDelete,
				ResourcePath:  dop.ResourcePath,
				ResourceID:    dop.ResourceID,
			})
		}
	}

	if len(ops) == 0 {
		return fmt.Errorf("tunnel: ipsec tunnel %q not found on any router", name)
	}

	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Delete IPsec tunnel %s", name),
		Operations:  ops,
	}
	if err := s.executeOps(ctx, tenantID, userID, execReq); err != nil {
		return fmt.Errorf("tunnel: delete ipsec: %w", err)
	}

	return nil
}

// ─── WireGuard CRUD ────────────────────────────────────────────────────────────

// ListWireGuard fetches WireGuard interfaces and peers from all routers in the cluster.
// Returns one RouterWireGuard per interface per router (no merge).
func (s *Service) ListWireGuard(ctx context.Context, tenantID, clusterID string) ([]RouterWireGuard, error) {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	result := []RouterWireGuard{}
	for _, ri := range routers {
		ifaces, err := FetchWGInterfaces(ctx, clients[ri.ID])
		if err != nil {
			return nil, fmt.Errorf("tunnel: list wireguard interfaces from router %s: %w", ri.Name, err)
		}
		peers, err := FetchWGPeers(ctx, clients[ri.ID])
		if err != nil {
			return nil, fmt.Errorf("tunnel: list wireguard peers from router %s: %w", ri.Name, err)
		}
		for _, iface := range ifaces {
			result = append(result, RouterWireGuard{
				RouterID:   ri.ID,
				RouterName: ri.Name,
				Role:       ri.Role,
				Interface:  iface,
				Peers:      PeersForInterface(peers, iface.Name),
			})
		}
	}
	return result, nil
}

// GetWireGuard returns a single WireGuard interface (with peers) by router ID and interface name.
func (s *Service) GetWireGuard(ctx context.Context, tenantID, clusterID, routerID, name string) (*RouterWireGuard, error) {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	if err := validateRouterIDs([]string{routerID}, routers); err != nil {
		return nil, err
	}

	ifaces, err := FetchWGInterfaces(ctx, clients[routerID])
	if err != nil {
		return nil, fmt.Errorf("tunnel: get wireguard interfaces: %w", err)
	}
	iface := FindWGInterfaceByName(ifaces, name)
	if iface == nil {
		return nil, nil
	}

	peers, err := FetchWGPeers(ctx, clients[routerID])
	if err != nil {
		return nil, fmt.Errorf("tunnel: get wireguard peers: %w", err)
	}

	var ri RouterInfo
	for _, r := range routers {
		if r.ID == routerID {
			ri = r
			break
		}
	}

	return &RouterWireGuard{
		RouterID:   ri.ID,
		RouterName: ri.Name,
		Role:       ri.Role,
		Interface:  *iface,
		Peers:      PeersForInterface(peers, iface.Name),
	}, nil
}

// CreateWGInterface creates a WireGuard interface on the specified router.
func (s *Service) CreateWGInterface(ctx context.Context, tenantID, userID, clusterID string, req CreateWGInterfaceRequest) (*RouterWireGuard, error) {
	routers, _, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	if err := validateRouterIDs([]string{req.RouterID}, routers); err != nil {
		return nil, err
	}

	body := BuildWGInterfaceCreateBody(req)
	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Create WireGuard interface %s", req.Name),
		Operations: []operation.ExecuteOperation{
			{
				RouterID:      req.RouterID,
				Module:        "wireguard",
				OperationType: operation.OpAdd,
				ResourcePath:  "/interface/wireguard",
				Body:          body,
			},
		},
	}
	if err := s.executeOps(ctx, tenantID, userID, execReq); err != nil {
		return nil, fmt.Errorf("tunnel: create wireguard interface: %w", err)
	}

	return s.GetWireGuard(ctx, tenantID, clusterID, req.RouterID, req.Name)
}

// UpdateWGInterface updates an existing WireGuard interface by name on the specified router.
func (s *Service) UpdateWGInterface(ctx context.Context, tenantID, userID, clusterID, routerID, name string, req UpdateWGInterfaceRequest) (*RouterWireGuard, error) {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	if err := validateRouterIDs([]string{routerID}, routers); err != nil {
		return nil, err
	}

	ifaces, err := FetchWGInterfaces(ctx, clients[routerID])
	if err != nil {
		return nil, fmt.Errorf("tunnel: fetch wireguard interfaces: %w", err)
	}
	iface := FindWGInterfaceByName(ifaces, name)
	if iface == nil {
		return nil, fmt.Errorf("tunnel: wireguard interface %q not found", name)
	}

	body := BuildWGInterfaceUpdateBody(req)
	if len(body) == 0 {
		return s.GetWireGuard(ctx, tenantID, clusterID, routerID, name)
	}

	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Update WireGuard interface %s", name),
		Operations: []operation.ExecuteOperation{
			{
				RouterID:      routerID,
				Module:        "wireguard",
				OperationType: operation.OpModify,
				ResourcePath:  "/interface/wireguard",
				ResourceID:    iface.RosID,
				Body:          body,
			},
		},
	}
	if err := s.executeOps(ctx, tenantID, userID, execReq); err != nil {
		return nil, fmt.Errorf("tunnel: update wireguard interface: %w", err)
	}

	return s.GetWireGuard(ctx, tenantID, clusterID, routerID, name)
}

// DeleteWGInterface removes a WireGuard interface by name from the specified router.
func (s *Service) DeleteWGInterface(ctx context.Context, tenantID, userID, clusterID, routerID, name string) error {
	routers, clients, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return err
	}
	if err := validateRouterIDs([]string{routerID}, routers); err != nil {
		return err
	}

	ifaces, err := FetchWGInterfaces(ctx, clients[routerID])
	if err != nil {
		return fmt.Errorf("tunnel: fetch wireguard interfaces: %w", err)
	}
	iface := FindWGInterfaceByName(ifaces, name)
	if iface == nil {
		return fmt.Errorf("tunnel: wireguard interface %q not found", name)
	}

	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Delete WireGuard interface %s", name),
		Operations: []operation.ExecuteOperation{
			{
				RouterID:      routerID,
				Module:        "wireguard",
				OperationType: operation.OpDelete,
				ResourcePath:  "/interface/wireguard",
				ResourceID:    iface.RosID,
			},
		},
	}
	if err := s.executeOps(ctx, tenantID, userID, execReq); err != nil {
		return fmt.Errorf("tunnel: delete wireguard interface: %w", err)
	}

	return nil
}

// CreateWGPeer adds a WireGuard peer to the specified interface on the specified router.
func (s *Service) CreateWGPeer(ctx context.Context, tenantID, userID, clusterID, routerID, ifaceName string, req CreateWGPeerRequest) (*RouterWireGuard, error) {
	routers, _, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	if err := validateRouterIDs([]string{routerID}, routers); err != nil {
		return nil, err
	}

	body := BuildWGPeerCreateBody(ifaceName, req)
	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Add WireGuard peer to %s", ifaceName),
		Operations: []operation.ExecuteOperation{
			{
				RouterID:      routerID,
				Module:        "wireguard",
				OperationType: operation.OpAdd,
				ResourcePath:  "/interface/wireguard/peers",
				Body:          body,
			},
		},
	}
	if err := s.executeOps(ctx, tenantID, userID, execReq); err != nil {
		return nil, fmt.Errorf("tunnel: create wireguard peer: %w", err)
	}

	return s.GetWireGuard(ctx, tenantID, clusterID, routerID, ifaceName)
}

// UpdateWGPeer updates an existing WireGuard peer by ID on the specified router.
func (s *Service) UpdateWGPeer(ctx context.Context, tenantID, userID, clusterID, routerID, ifaceName, peerID string, req UpdateWGPeerRequest) (*RouterWireGuard, error) {
	routers, _, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	if err := validateRouterIDs([]string{routerID}, routers); err != nil {
		return nil, err
	}

	body := BuildWGPeerUpdateBody(req)
	if len(body) == 0 {
		return s.GetWireGuard(ctx, tenantID, clusterID, routerID, ifaceName)
	}

	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Update WireGuard peer on %s", ifaceName),
		Operations: []operation.ExecuteOperation{
			{
				RouterID:      routerID,
				Module:        "wireguard",
				OperationType: operation.OpModify,
				ResourcePath:  "/interface/wireguard/peers",
				ResourceID:    peerID,
				Body:          body,
			},
		},
	}
	if err := s.executeOps(ctx, tenantID, userID, execReq); err != nil {
		return nil, fmt.Errorf("tunnel: update wireguard peer: %w", err)
	}

	return s.GetWireGuard(ctx, tenantID, clusterID, routerID, ifaceName)
}

// DeleteWGPeer removes a WireGuard peer by ID from the specified router.
func (s *Service) DeleteWGPeer(ctx context.Context, tenantID, userID, clusterID, routerID, ifaceName, peerID string) error {
	routers, _, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return err
	}
	if err := validateRouterIDs([]string{routerID}, routers); err != nil {
		return err
	}

	execReq := operation.ExecuteRequest{
		Description: fmt.Sprintf("Delete WireGuard peer from %s", ifaceName),
		Operations: []operation.ExecuteOperation{
			{
				RouterID:      routerID,
				Module:        "wireguard",
				OperationType: operation.OpDelete,
				ResourcePath:  "/interface/wireguard/peers",
				ResourceID:    peerID,
			},
		},
	}
	if err := s.executeOps(ctx, tenantID, userID, execReq); err != nil {
		return fmt.Errorf("tunnel: delete wireguard peer: %w", err)
	}

	return nil
}

// ─── Interfaces (read-only, cluster-scoped) ────────────────────────────────────

// ListInterfaces fetches interfaces from all routers in the cluster and merges them by name.
func (s *Service) ListInterfaces(ctx context.Context, tenantID, clusterID string) ([]MergedInterface, error) {
	routers, _, err := s.getClusterRouters(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}

	perRouter := make(map[string][]interfaces.Interface)
	for _, ri := range routers {
		ifaces, err := s.ifaceFetcher.ListInterfaces(ctx, tenantID, ri.ID)
		if err != nil {
			return nil, fmt.Errorf("tunnel: list interfaces from router %s: %w", ri.Name, err)
		}
		perRouter[ri.ID] = ifaces
	}

	return MergeInterfaces(perRouter, routers), nil
}

// GetInterface returns a single merged interface by name.
func (s *Service) GetInterface(ctx context.Context, tenantID, clusterID, name string) (*MergedInterface, error) {
	ifaces, err := s.ListInterfaces(ctx, tenantID, clusterID)
	if err != nil {
		return nil, err
	}
	return FindMergedInterfaceByName(ifaces, name), nil
}
