import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import type { WireGuardInterface, WireGuardPeer, RouterWireGuard } from '../../api/types';
import { useMockMode } from '../../mocks/useMockMode';
import {
  listWireGuardInterfaces,
  createWireGuardInterface,
  updateWireGuardInterface,
  deleteWireGuardInterface,
  listPeers,
  addPeer,
  updatePeer,
  deletePeer,
} from '../../mocks/mockWireGuardData';

// Encode a composite key so the rest of the UI can treat WireGuard interfaces
// and peers as having a flat `id`, regardless of the backend's {routerID}/{name}
// path structure.
//
// Interface id format:  "{routerId}/{name}"
// Peer id format:       "{routerId}/{interfaceName}/{peerRosId}"

function encodeIfaceId(routerId: string, name: string): string {
  return `${routerId}/${name}`;
}

function decodeIfaceId(id: string): { routerId: string; name: string } {
  const slash = id.indexOf('/');
  return { routerId: id.slice(0, slash), name: id.slice(slash + 1) };
}

function encodePeerId(routerId: string, ifaceName: string, peerRosId: string): string {
  return `${routerId}/${ifaceName}/${peerRosId}`;
}

function decodePeerId(id: string): { routerId: string; ifaceName: string; peerRosId: string } {
  const parts = id.split('/');
  return { routerId: parts[0], ifaceName: parts[1], peerRosId: parts.slice(2).join('/') };
}

// Flatten the backend's RouterWireGuard[] into a WireGuardInterface[] the UI
// can consume, encoding composite keys as the `id` field.
function flattenInterfaces(data: RouterWireGuard[]): WireGuardInterface[] {
  return data.map((rw) => ({
    id: encodeIfaceId(rw.routerId, rw.interface.name),
    name: rw.interface.name,
    listenPort: rw.interface.listenPort,
    mtu: rw.interface.mtu,
    privateKey: rw.interface.privateKey,
    publicKey: rw.interface.publicKey,
    gatewayAddress: '',
    dns: '',
    clientAllowedIPs: '',
    disabled: rw.interface.disabled,
  }));
}

// Flatten peers out of RouterWireGuard[] into WireGuardPeer[].
function flattenPeers(data: RouterWireGuard[]): WireGuardPeer[] {
  const result: WireGuardPeer[] = [];
  for (const rw of data) {
    for (const peer of rw.peers ?? []) {
      result.push({
        id: encodePeerId(rw.routerId, rw.interface.name, peer.rosId),
        interface: peer.interface,
        name: peer.name,
        publicKey: peer.publicKey,
        presharedKey: peer.presharedKey,
        allowedAddress: peer.allowedAddress,
        endpointAddress: peer.endpointAddress,
        endpointPort: peer.endpointPort,
        lastHandshake: peer.lastHandshake,
        rx: peer.rx,
        tx: peer.tx,
        persistentKeepalive: peer.persistentKeepalive,
        disabled: peer.disabled,
        comment: peer.comment,
      });
    }
  }
  return result;
}

// ─── Read hooks ──────────────────────────────────────────────────────────────

export function useWireGuardInterfaces(clusterId: string | null) {
  const isMock = useMockMode();
  return useQuery<WireGuardInterface[]>({
    queryKey: ['wireguard', clusterId],
    queryFn: async () => {
      if (isMock) return listWireGuardInterfaces(clusterId!);
      const response = await apiClient.get<RouterWireGuard[]>(`/clusters/${clusterId}/wireguard`);
      return flattenInterfaces(response.data);
    },
    enabled: !!clusterId,
  });
}

export function useWireGuardPeers(clusterId: string | null) {
  const isMock = useMockMode();
  return useQuery<WireGuardPeer[]>({
    queryKey: ['wireguard-peers', clusterId],
    queryFn: async () => {
      if (isMock) return listPeers(clusterId!);
      // Peers are embedded in the same list endpoint — no separate peers endpoint.
      const response = await apiClient.get<RouterWireGuard[]>(`/clusters/${clusterId}/wireguard`);
      return flattenPeers(response.data);
    },
    enabled: !!clusterId,
  });
}

// ─── WireGuard Interface mutations ───────────────────────────────────────────

export function useCreateWireGuardInterface(clusterId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ routerId, ...data }: Omit<WireGuardInterface, 'id' | 'publicKey' | 'privateKey'> & { routerId: string }) => {
      if (isMock) return createWireGuardInterface(clusterId!, data);
      const response = await apiClient.post<RouterWireGuard>(
        `/clusters/${clusterId}/wireguard`,
        {
          routerId,
          name: data.name,
          listenPort: data.listenPort,
          mtu: data.mtu,
          disabled: data.disabled,
        },
      );
      return flattenInterfaces([response.data])[0];
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wireguard', clusterId] });
    },
  });
}

export function useUpdateWireGuardInterface(clusterId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<WireGuardInterface> }) => {
      if (isMock) return updateWireGuardInterface(clusterId!, id, updates);
      const { routerId, name } = decodeIfaceId(id);
      await apiClient.patch(
        `/clusters/${clusterId}/wireguard/${routerId}/${encodeURIComponent(name)}`,
        {
          listenPort: updates.listenPort,
          mtu: updates.mtu,
          disabled: updates.disabled,
        },
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wireguard', clusterId] });
    },
  });
}

export function useDeleteWireGuardInterface(clusterId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (isMock) return deleteWireGuardInterface(clusterId!, id);
      const { routerId, name } = decodeIfaceId(id);
      await apiClient.delete(
        `/clusters/${clusterId}/wireguard/${routerId}/${encodeURIComponent(name)}`,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wireguard', clusterId] });
      void queryClient.invalidateQueries({ queryKey: ['wireguard-peers', clusterId] });
    },
  });
}

// ─── WireGuard Peer mutations ────────────────────────────────────────────────

export function useAddPeer(clusterId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (peer: Omit<WireGuardPeer, 'id'>) => {
      if (isMock) return addPeer(clusterId!, peer);
      // In real mode, the interface `id` in context isn't available here, but
      // peer.interface holds the interface name.  We need a routerId — use the
      // clusterId as the single-router fallback, or look it up from the cache.
      const cached = queryClient.getQueryData<WireGuardInterface[]>(['wireguard', clusterId]);
      const matched = cached?.find((i) => i.name === peer.interface);
      const { routerId, name: ifaceName } = matched
        ? decodeIfaceId(matched.id)
        : { routerId: clusterId!, name: peer.interface };
      const response = await apiClient.post<RouterWireGuard>(
        `/clusters/${clusterId}/wireguard/${routerId}/${encodeURIComponent(ifaceName)}/peers`,
        {
          publicKey: peer.publicKey,
          presharedKey: peer.presharedKey,
          allowedAddress: peer.allowedAddress,
          endpointAddress: peer.endpointAddress,
          endpointPort: peer.endpointPort,
          persistentKeepalive: peer.persistentKeepalive,
          disabled: peer.disabled,
          comment: peer.comment,
        },
      );
      return flattenPeers([response.data])[0];
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wireguard', clusterId] });
      void queryClient.invalidateQueries({ queryKey: ['wireguard-peers', clusterId] });
    },
  });
}

export function useUpdatePeer(clusterId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<WireGuardPeer> }) => {
      if (isMock) return updatePeer(clusterId!, id, updates);
      const { routerId, ifaceName, peerRosId } = decodePeerId(id);
      await apiClient.patch(
        `/clusters/${clusterId}/wireguard/${routerId}/${encodeURIComponent(ifaceName)}/peers/${peerRosId}`,
        updates,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wireguard', clusterId] });
      void queryClient.invalidateQueries({ queryKey: ['wireguard-peers', clusterId] });
    },
  });
}

export function useDeletePeer(clusterId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (isMock) return deletePeer(clusterId!, id);
      const { routerId, ifaceName, peerRosId } = decodePeerId(id);
      await apiClient.delete(
        `/clusters/${clusterId}/wireguard/${routerId}/${encodeURIComponent(ifaceName)}/peers/${peerRosId}`,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wireguard', clusterId] });
      void queryClient.invalidateQueries({ queryKey: ['wireguard-peers', clusterId] });
    },
  });
}
