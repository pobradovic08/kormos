import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import type { Tunnel } from '../../api/types';
import { useExecuteOperation } from '../../api/operationsApi';
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
  const executeOp = useExecuteOperation();

  return useMutation({
    mutationFn: async (tunnel: Omit<Tunnel, 'id'>) => {
      if (isMock) return addTunnel(routerId!, tunnel);
      const result = await executeOp.mutateAsync({
        description: `Add ${tunnel.tunnelType.toUpperCase()} tunnel "${tunnel.name}"`,
        operations: [{
          router_id: routerId!,
          module: 'tunnels',
          operation_type: 'add',
          resource_path: '/interface/gre',
          body: tunnel as unknown as Record<string, unknown>,
        }],
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tunnels', routerId] });
    },
  });
}

export function useUpdateTunnel(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  const executeOp = useExecuteOperation();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Tunnel> }) => {
      if (isMock) return updateTunnel(routerId!, id, updates);
      const result = await executeOp.mutateAsync({
        description: `Update tunnel ${id}`,
        operations: [{
          router_id: routerId!,
          module: 'tunnels',
          operation_type: 'modify',
          resource_path: '/interface/gre',
          resource_id: id,
          body: updates as unknown as Record<string, unknown>,
        }],
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tunnels', routerId] });
    },
  });
}

export function useDeleteTunnel(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  const executeOp = useExecuteOperation();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (isMock) return deleteTunnel(routerId!, id);
      await executeOp.mutateAsync({
        description: `Delete tunnel ${id}`,
        operations: [{
          router_id: routerId!,
          module: 'tunnels',
          operation_type: 'delete',
          resource_path: '/interface/gre',
          resource_id: id,
          body: {},
        }],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tunnels', routerId] });
    },
  });
}
