import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import type { FirewallRule } from '../../api/types';
import { useExecuteOperation } from '../../api/operationsApi';
import { useMockMode } from '../../mocks/useMockMode';
import {
  listFirewallRules,
  addFirewallRule,
  updateFirewallRule,
  deleteFirewallRule,
  moveFirewallRule,
} from '../../mocks/mockFirewallData';

export function useFirewallRules(routerId: string | null) {
  const isMock = useMockMode();
  return useQuery<FirewallRule[]>({
    queryKey: ['firewall-rules', routerId],
    queryFn: async () => {
      if (isMock) return listFirewallRules(routerId!);
      const response = await apiClient.get<FirewallRule[]>(`/routers/${routerId}/firewall/filter`);
      return response.data;
    },
    enabled: !!routerId,
  });
}

export function useAddFirewallRule(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  const executeOp = useExecuteOperation();

  return useMutation({
    mutationFn: async (rule: Omit<FirewallRule, 'id'>) => {
      if (isMock) return addFirewallRule(routerId!, rule);
      const result = await executeOp.mutateAsync({
        description: `Add firewall rule to ${rule.chain} chain`,
        operations: [{
          router_id: routerId!,
          module: 'firewall',
          operation_type: 'add',
          resource_path: '/ip/firewall/filter',
          body: rule as unknown as Record<string, unknown>,
        }],
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firewall-rules', routerId] });
    },
  });
}

export function useUpdateFirewallRule(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  const executeOp = useExecuteOperation();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FirewallRule> }) => {
      if (isMock) return updateFirewallRule(routerId!, id, updates);
      const result = await executeOp.mutateAsync({
        description: `Update firewall rule ${id}`,
        operations: [{
          router_id: routerId!,
          module: 'firewall',
          operation_type: 'modify',
          resource_path: '/ip/firewall/filter',
          resource_id: id,
          body: updates as unknown as Record<string, unknown>,
        }],
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firewall-rules', routerId] });
    },
  });
}

export function useDeleteFirewallRule(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  const executeOp = useExecuteOperation();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (isMock) return deleteFirewallRule(routerId!, id);
      await executeOp.mutateAsync({
        description: `Delete firewall rule ${id}`,
        operations: [{
          router_id: routerId!,
          module: 'firewall',
          operation_type: 'delete',
          resource_path: '/ip/firewall/filter',
          resource_id: id,
          body: {},
        }],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firewall-rules', routerId] });
    },
  });
}

export function useMoveFirewallRule(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ruleId, destinationId }: { ruleId: string; destinationId: string }) => {
      if (isMock) return moveFirewallRule(routerId!, ruleId, destinationId);
      await apiClient.post(`/routers/${routerId}/firewall/filter/move`, { '.id': ruleId, destination: destinationId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firewall-rules', routerId] });
    },
  });
}
