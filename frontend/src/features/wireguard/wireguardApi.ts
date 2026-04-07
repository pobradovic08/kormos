import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import type { WireGuardInterface, WireGuardPeer } from '../../api/types';
import { useExecuteOperation } from '../../api/operationsApi';
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

export function useWireGuardInterfaces(routerId: string | null) {
  const isMock = useMockMode();
  return useQuery<WireGuardInterface[]>({
    queryKey: ['wireguard-interfaces', routerId],
    queryFn: async () => {
      if (isMock) return listWireGuardInterfaces(routerId!);
      const response = await apiClient.get<WireGuardInterface[]>(`/routers/${routerId}/wireguard`);
      return response.data;
    },
    enabled: !!routerId,
  });
}

export function useCreateWireGuardInterface(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  const executeOp = useExecuteOperation();
  return useMutation({
    mutationFn: async (data: Omit<WireGuardInterface, 'id' | 'publicKey' | 'privateKey'>) => {
      if (isMock) return createWireGuardInterface(routerId!, data);
      const result = await executeOp.mutateAsync({
        description: `Create WireGuard interface "${data.name}"`,
        operations: [{
          router_id: routerId!,
          module: 'wireguard',
          operation_type: 'add',
          resource_path: '/interface/wireguard',
          body: data as unknown as Record<string, unknown>,
        }],
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wireguard-interfaces', routerId] });
    },
  });
}

export function useUpdateWireGuardInterface(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  const executeOp = useExecuteOperation();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<WireGuardInterface> }) => {
      if (isMock) return updateWireGuardInterface(routerId!, id, updates);
      const result = await executeOp.mutateAsync({
        description: `Update WireGuard interface ${id}`,
        operations: [{
          router_id: routerId!,
          module: 'wireguard',
          operation_type: 'modify',
          resource_path: '/interface/wireguard',
          resource_id: id,
          body: updates as unknown as Record<string, unknown>,
        }],
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wireguard-interfaces', routerId] });
    },
  });
}

export function useDeleteWireGuardInterface(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  const executeOp = useExecuteOperation();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (isMock) return deleteWireGuardInterface(routerId!, id);
      await executeOp.mutateAsync({
        description: `Delete WireGuard interface ${id}`,
        operations: [{
          router_id: routerId!,
          module: 'wireguard',
          operation_type: 'delete',
          resource_path: '/interface/wireguard',
          resource_id: id,
          body: {},
        }],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wireguard-interfaces', routerId] });
      queryClient.invalidateQueries({ queryKey: ['wireguard-peers', routerId] });
    },
  });
}

export function useWireGuardPeers(routerId: string | null) {
  const isMock = useMockMode();
  return useQuery<WireGuardPeer[]>({
    queryKey: ['wireguard-peers', routerId],
    queryFn: async () => {
      if (isMock) return listPeers(routerId!);
      const response = await apiClient.get<WireGuardPeer[]>(`/routers/${routerId}/wireguard/peers`);
      return response.data;
    },
    enabled: !!routerId,
  });
}

export function useAddPeer(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  const executeOp = useExecuteOperation();
  return useMutation({
    mutationFn: async (peer: Omit<WireGuardPeer, 'id'>) => {
      if (isMock) return addPeer(routerId!, peer);
      const result = await executeOp.mutateAsync({
        description: `Add WireGuard peer to interface "${peer.interface}"`,
        operations: [{
          router_id: routerId!,
          module: 'wireguard',
          operation_type: 'add',
          resource_path: '/interface/wireguard/peers',
          body: peer as unknown as Record<string, unknown>,
        }],
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wireguard-peers', routerId] });
    },
  });
}

export function useUpdatePeer(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  const executeOp = useExecuteOperation();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<WireGuardPeer> }) => {
      if (isMock) return updatePeer(routerId!, id, updates);
      const result = await executeOp.mutateAsync({
        description: `Update WireGuard peer ${id}`,
        operations: [{
          router_id: routerId!,
          module: 'wireguard',
          operation_type: 'modify',
          resource_path: '/interface/wireguard/peers',
          resource_id: id,
          body: updates as unknown as Record<string, unknown>,
        }],
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wireguard-peers', routerId] });
    },
  });
}

export function useDeletePeer(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  const executeOp = useExecuteOperation();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (isMock) return deletePeer(routerId!, id);
      await executeOp.mutateAsync({
        description: `Delete WireGuard peer ${id}`,
        operations: [{
          router_id: routerId!,
          module: 'wireguard',
          operation_type: 'delete',
          resource_path: '/interface/wireguard/peers',
          resource_id: id,
          body: {},
        }],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wireguard-peers', routerId] });
    },
  });
}
