import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import type { WireGuardInterface, WireGuardPeer } from '../../api/types';
import { useMockMode } from '../../mocks/useMockMode';
import {
  getWireGuardInterface,
  createWireGuardInterface,
  updateWireGuardInterface,
  deleteWireGuardInterface,
  listPeers,
  addPeer,
  updatePeer,
  deletePeer,
} from '../../mocks/mockWireGuardData';

export function useWireGuardInterface(routerId: string | null) {
  const isMock = useMockMode();

  return useQuery<WireGuardInterface | null>({
    queryKey: ['wireguard-interface', routerId],
    queryFn: async () => {
      if (isMock) return getWireGuardInterface(routerId!);
      const response = await apiClient.get<WireGuardInterface>(
        `/routers/${routerId}/wireguard`,
      );
      return response.data;
    },
    enabled: !!routerId,
  });
}

export function useCreateWireGuardInterface(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<WireGuardInterface, 'publicKey' | 'privateKey'>) => {
      if (isMock) return createWireGuardInterface(routerId!, data);
      const response = await apiClient.post(`/routers/${routerId}/wireguard`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wireguard-interface', routerId] });
    },
  });
}

export function useUpdateWireGuardInterface(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<WireGuardInterface>) => {
      if (isMock) return updateWireGuardInterface(routerId!, updates);
      const response = await apiClient.patch(`/routers/${routerId}/wireguard`, updates);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wireguard-interface', routerId] });
    },
  });
}

export function useDeleteWireGuardInterface(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (isMock) return deleteWireGuardInterface(routerId!);
      await apiClient.delete(`/routers/${routerId}/wireguard`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wireguard-interface', routerId] });
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
      const response = await apiClient.get<WireGuardPeer[]>(
        `/routers/${routerId}/wireguard/peers`,
      );
      return response.data;
    },
    enabled: !!routerId,
  });
}

export function useAddPeer(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (peer: Omit<WireGuardPeer, 'id'>) => {
      if (isMock) return addPeer(routerId!, peer);
      const response = await apiClient.post(`/routers/${routerId}/wireguard/peers`, peer);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wireguard-peers', routerId] });
    },
  });
}

export function useUpdatePeer(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<WireGuardPeer> }) => {
      if (isMock) return updatePeer(routerId!, id, updates);
      const response = await apiClient.patch(`/routers/${routerId}/wireguard/peers/${id}`, updates);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wireguard-peers', routerId] });
    },
  });
}

export function useDeletePeer(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (isMock) return deletePeer(routerId!, id);
      await apiClient.delete(`/routers/${routerId}/wireguard/peers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wireguard-peers', routerId] });
    },
  });
}
