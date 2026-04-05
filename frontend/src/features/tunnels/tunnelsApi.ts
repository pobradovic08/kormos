import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import type { Tunnel } from '../../api/types';
import { useMockMode } from '../../mocks/useMockMode';
import {
  listTunnels,
  addTunnel,
  updateTunnel,
  deleteTunnel,
} from '../../mocks/mockTunnelsData';

export function useTunnels(routerId: string | null) {
  const isMock = useMockMode();

  return useQuery<Tunnel[]>({
    queryKey: ['tunnels', routerId],
    queryFn: async () => {
      if (isMock) return listTunnels(routerId!);
      const response = await apiClient.get<Tunnel[]>(
        `/routers/${routerId}/tunnels`,
      );
      return response.data;
    },
    enabled: !!routerId,
  });
}

export function useAddTunnel(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tunnel: Omit<Tunnel, 'id'>) => {
      if (isMock) return addTunnel(routerId!, tunnel);
      const response = await apiClient.post(
        `/routers/${routerId}/tunnels`,
        tunnel,
      );
      return response.data;
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
      const response = await apiClient.patch(
        `/routers/${routerId}/tunnels/${id}`,
        updates,
      );
      return response.data;
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
      const response = await apiClient.delete(
        `/routers/${routerId}/tunnels/${id}`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tunnels', routerId] });
    },
  });
}
