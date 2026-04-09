package tunnel

type RouterInfo struct {
	ID   string
	Name string
	Role string
}

func MergeGRETunnels(perRouter map[string][]RawGRETunnel, routers []RouterInfo) []MergedGRETunnel {
	type tunnelEntry struct {
		shared    *RawGRETunnel
		endpoints []GREEndpoint
	}
	byName := map[string]*tunnelEntry{}
	var orderedNames []string

	sorted := make([]RouterInfo, 0, len(routers))
	for _, ri := range routers {
		if ri.Role == "master" {
			sorted = append(sorted, ri)
		}
	}
	for _, ri := range routers {
		if ri.Role != "master" {
			sorted = append(sorted, ri)
		}
	}

	for _, ri := range sorted {
		raws := perRouter[ri.ID]
		for _, raw := range raws {
			ep := greTunnelFromRaw(raw)
			ep.RouterID = ri.ID
			ep.RouterName = ri.Name
			ep.Role = ri.Role

			entry, exists := byName[raw.Name]
			if !exists {
				rawCopy := raw
				entry = &tunnelEntry{shared: &rawCopy}
				byName[raw.Name] = entry
				orderedNames = append(orderedNames, raw.Name)
			}
			entry.endpoints = append(entry.endpoints, ep)
		}
	}

	result := make([]MergedGRETunnel, 0, len(orderedNames))
	for _, name := range orderedNames {
		entry := byName[name]
		n, mtu, kai, kar, secret, comment, disabled := greSharedFromRaw(*entry.shared)
		result = append(result, MergedGRETunnel{
			Name:              n,
			TunnelType:        "gre",
			MTU:               mtu,
			KeepaliveInterval: kai,
			KeepaliveRetries:  kar,
			IpsecSecret:       secret,
			Disabled:          disabled,
			Comment:           comment,
			Endpoints:         entry.endpoints,
		})
	}
	return result
}

func FindMergedGREByName(tunnels []MergedGRETunnel, name string) *MergedGRETunnel {
	for i := range tunnels {
		if tunnels[i].Name == name {
			return &tunnels[i]
		}
	}
	return nil
}

func FindMergedIPsecByName(tunnels []MergedIPsecTunnel, name string) *MergedIPsecTunnel {
	for i := range tunnels {
		if tunnels[i].Name == name {
			return &tunnels[i]
		}
	}
	return nil
}

func MergeIPsecTunnels(perRouter map[string][]assembledIPsec, routers []RouterInfo) []MergedIPsecTunnel {
	type tunnelEntry struct {
		shared    *assembledIPsec
		endpoints []IPsecEndpoint
	}
	byName := map[string]*tunnelEntry{}
	var orderedNames []string

	sorted := make([]RouterInfo, 0, len(routers))
	for _, ri := range routers {
		if ri.Role == "master" {
			sorted = append(sorted, ri)
		}
	}
	for _, ri := range routers {
		if ri.Role != "master" {
			sorted = append(sorted, ri)
		}
	}

	for _, ri := range sorted {
		assembled := perRouter[ri.ID]
		for _, a := range assembled {
			ep := buildIPsecEndpoint(ri, a)
			entry, exists := byName[a.PeerName]
			if !exists {
				aCopy := a
				entry = &tunnelEntry{shared: &aCopy}
				byName[a.PeerName] = entry
				orderedNames = append(orderedNames, a.PeerName)
			}
			entry.endpoints = append(entry.endpoints, ep)
		}
	}

	result := make([]MergedIPsecTunnel, 0, len(orderedNames))
	for _, name := range orderedNames {
		entry := byName[name]
		a := entry.shared
		localSubnets := a.LocalSubnets
		if localSubnets == nil {
			localSubnets = []string{}
		}
		remoteSubnets := a.RemoteSubnets
		if remoteSubnets == nil {
			remoteSubnets = []string{}
		}
		tunnelRoutes := a.TunnelRoutes
		if tunnelRoutes == nil {
			tunnelRoutes = []string{}
		}
		result = append(result, MergedIPsecTunnel{
			Name:                a.PeerName,
			TunnelType:          "ipsec",
			Mode:                a.Mode,
			AuthMethod:          a.AuthMethod,
			IpsecSecret:         a.Secret,
			Phase1:              a.Phase1,
			Phase2:              a.Phase2,
			LocalSubnets:        localSubnets,
			RemoteSubnets:       remoteSubnets,
			TunnelRoutes:        tunnelRoutes,
			LocalTunnelAddress:  a.LocalTunnelAddress,
			RemoteTunnelAddress: a.RemoteTunnelAddress,
			Disabled:            a.Disabled,
			Comment:             a.Comment,
			Endpoints:           entry.endpoints,
		})
	}
	return result
}
