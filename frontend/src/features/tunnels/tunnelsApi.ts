import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import type {
  GRETunnel,
  IPsecTunnel,
  MergedGRETunnel,
  MergedIPsecTunnel,
  CreateGRETunnelPayload,
  CreateIPsecTunnelPayload,
} from '../../api/types';
import { useMockMode } from '../../mocks/useMockMode';
import {
  listTunnels,
  addTunnel,
  updateTunnel,
  deleteTunnel,
} from '../../mocks/mockTunnelsData';
import type { Tunnel } from '../../api/types';

// ─── GRE Tunnels (cluster-scoped) ────────────────────────────────────────────

export function useGRETunnels(clusterId: string | null) {
  const isMock = useMockMode();

  return useQuery<MergedGRETunnel[]>({
    queryKey: ['tunnels-gre', clusterId],
    queryFn: async () => {
      if (isMock) {
        // Mock mode: return legacy tunnels filtered to GRE, wrapped as merged
        const all = listTunnels(clusterId!);
        return all
          .filter((t): t is GRETunnel => t.tunnelType === 'gre')
          .map((t) => ({
            name: t.name,
            tunnelType: t.tunnelType,
            mtu: t.mtu,
            keepaliveInterval: t.keepaliveInterval,
            keepaliveRetries: t.keepaliveRetries,
            ipsecSecret: t.ipsecSecret,
            disabled: t.disabled,
            comment: t.comment,
            endpoints: [{
              routerId: clusterId!,
              routerName: 'mock',
              role: 'master',
              rosId: t.id,
              localAddress: t.localAddress,
              remoteAddress: t.remoteAddress,
              running: t.running,
            }],
          }));
      }
      const response = await apiClient.get<MergedGRETunnel[]>(
        `/clusters/${clusterId}/tunnels/gre`,
      );
      return response.data;
    },
    enabled: !!clusterId,
  });
}

export function useCreateGRETunnel(clusterId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateGRETunnelPayload) => {
      const response = await apiClient.post<MergedGRETunnel>(
        `/clusters/${clusterId}/tunnels/gre`,
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tunnels-gre', clusterId] });
    },
  });
}

export function useUpdateGRETunnel(clusterId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, ...payload }: { name: string } & Partial<CreateGRETunnelPayload>) => {
      await apiClient.patch(`/clusters/${clusterId}/tunnels/gre/${name}`, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tunnels-gre', clusterId] });
    },
  });
}

export function useDeleteGRETunnel(clusterId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      await apiClient.delete(`/clusters/${clusterId}/tunnels/gre/${name}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tunnels-gre', clusterId] });
    },
  });
}

// ─── IPsec Tunnels (cluster-scoped) ──────────────────────────────────────────

export function useIPsecTunnels(clusterId: string | null) {
  const isMock = useMockMode();

  return useQuery<MergedIPsecTunnel[]>({
    queryKey: ['tunnels-ipsec', clusterId],
    queryFn: async () => {
      if (isMock) {
        const all = listTunnels(clusterId!);
        return all
          .filter((t): t is IPsecTunnel => t.tunnelType === 'ipsec')
          .map((t) => ({
            name: t.name,
            tunnelType: t.tunnelType,
            mode: t.mode,
            authMethod: t.authMethod,
            ipsecSecret: t.ipsecSecret,
            phase1: t.phase1,
            phase2: t.phase2,
            localSubnets: t.localSubnets,
            remoteSubnets: t.remoteSubnets,
            tunnelRoutes: t.tunnelRoutes,
            disabled: t.disabled,
            comment: t.comment,
            endpoints: [{
              routerId: clusterId!,
              routerName: 'mock',
              role: 'master',
              rosIds: { peer: '', profile: '', proposal: '', identity: '' },
              localAddress: t.localAddress,
              remoteAddress: t.remoteAddress,
              established: t.established,
            }],
          }));
      }
      const response = await apiClient.get<MergedIPsecTunnel[]>(
        `/clusters/${clusterId}/tunnels/ipsec`,
      );
      return response.data;
    },
    enabled: !!clusterId,
  });
}

export function useCreateIPsecTunnel(clusterId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateIPsecTunnelPayload) => {
      const response = await apiClient.post<MergedIPsecTunnel>(
        `/clusters/${clusterId}/tunnels/ipsec`,
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tunnels-ipsec', clusterId] });
    },
  });
}

export function useUpdateIPsecTunnel(clusterId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, ...payload }: { name: string } & Partial<CreateIPsecTunnelPayload>) => {
      await apiClient.patch(`/clusters/${clusterId}/tunnels/ipsec/${name}`, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tunnels-ipsec', clusterId] });
    },
  });
}

export function useDeleteIPsecTunnel(clusterId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      await apiClient.delete(`/clusters/${clusterId}/tunnels/ipsec/${name}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tunnels-ipsec', clusterId] });
    },
  });
}

// ─── Legacy hooks (kept for mock-mode compatibility in TunnelsPage) ──────────

export function useTunnels(routerId: string | null) {
  const isMock = useMockMode();

  return useQuery<Tunnel[]>({
    queryKey: ['tunnels', routerId],
    queryFn: async () => {
      if (isMock) return listTunnels(routerId!);
      // In live mode, this is no longer used. Callers should use
      // useGRETunnels / useIPsecTunnels instead.
      const response = await apiClient.get<Tunnel[]>(
        `/routers/${routerId}/tunnels`,
      );
      return response.data;
    },
    enabled: !!routerId && isMock,
  });
}

export function useAddTunnel(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tunnel: Omit<Tunnel, 'id'>) => {
      if (isMock) return addTunnel(routerId!, tunnel);
      throw new Error('Legacy useAddTunnel not supported in live mode');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tunnels', routerId] });
    },
  });
}

export function useUpdateTunnel(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Tunnel> }) => {
      if (isMock) return updateTunnel(routerId!, id, updates);
      throw new Error('Legacy useUpdateTunnel not supported in live mode');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tunnels', routerId] });
    },
  });
}

export function useDeleteTunnel(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (isMock) return deleteTunnel(routerId!, id);
      throw new Error('Legacy useDeleteTunnel not supported in live mode');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tunnels', routerId] });
    },
  });
}
