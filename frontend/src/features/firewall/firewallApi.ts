import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import type { FirewallRule } from '../../api/types';
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
  return useMutation({
    mutationFn: async (rule: Omit<FirewallRule, 'id'>) => {
      if (isMock) return addFirewallRule(routerId!, rule);
      const response = await apiClient.put(`/routers/${routerId}/firewall/filter`, rule);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firewall-rules', routerId] });
    },
  });
}

export function useUpdateFirewallRule(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FirewallRule> }) => {
      if (isMock) return updateFirewallRule(routerId!, id, updates);
      const response = await apiClient.patch(`/routers/${routerId}/firewall/filter/${id}`, updates);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firewall-rules', routerId] });
    },
  });
}

export function useDeleteFirewallRule(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (isMock) return deleteFirewallRule(routerId!, id);
      await apiClient.delete(`/routers/${routerId}/firewall/filter/${id}`);
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
