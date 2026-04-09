package tunnel

import "github.com/pobradovic08/kormos/backend/internal/interfaces"

// MergeInterfaces groups per-router normalised interfaces by name, master first.
// Shared fields (type, MTU, disabled, comment, defaultName) come from the master
// router's copy. Per-router fields (rosId, macAddress, running, addresses) go
// into the endpoints array.
func MergeInterfaces(perRouter map[string][]interfaces.Interface, routers []RouterInfo) []MergedInterface {
	type ifaceEntry struct {
		shared    *interfaces.Interface
		endpoints []InterfaceEndpoint
	}
	byName := map[string]*ifaceEntry{}
	var orderedNames []string

	// Sort master first so shared fields come from master.
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
		ifaces := perRouter[ri.ID]
		for _, iface := range ifaces {
			addrs := make([]InterfaceAddress, len(iface.Addresses))
			for j, a := range iface.Addresses {
				addrs[j] = InterfaceAddress{
					ID:      a.ID,
					Address: a.Address,
					Network: a.Network,
				}
			}

			ep := InterfaceEndpoint{
				RouterID:   ri.ID,
				RouterName: ri.Name,
				Role:       ri.Role,
				RosID:      iface.ID,
				MACAddress: iface.MACAddress,
				Running:    iface.Running,
				Addresses:  addrs,
			}
			if ep.Addresses == nil {
				ep.Addresses = []InterfaceAddress{}
			}

			entry, exists := byName[iface.Name]
			if !exists {
				ifaceCopy := iface
				entry = &ifaceEntry{shared: &ifaceCopy}
				byName[iface.Name] = entry
				orderedNames = append(orderedNames, iface.Name)
			}
			entry.endpoints = append(entry.endpoints, ep)
		}
	}

	result := make([]MergedInterface, 0, len(orderedNames))
	for _, name := range orderedNames {
		entry := byName[name]
		s := entry.shared
		result = append(result, MergedInterface{
			Name:        s.Name,
			DefaultName: s.DefaultName,
			Type:        s.Type,
			MTU:         s.MTU,
			Disabled:    s.Disabled,
			Comment:     s.Comment,
			Endpoints:   entry.endpoints,
		})
	}
	return result
}

// FindMergedInterfaceByName returns a pointer to the merged interface with the
// given name, or nil if not found.
func FindMergedInterfaceByName(ifaces []MergedInterface, name string) *MergedInterface {
	for i := range ifaces {
		if ifaces[i].Name == name {
			return &ifaces[i]
		}
	}
	return nil
}
