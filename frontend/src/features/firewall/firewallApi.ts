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

export function useFirewallRules(clusterId: string | null) {
  const isMock = useMockMode();
  return useQuery<FirewallRule[]>({
    queryKey: ['firewall-rules', clusterId],
    queryFn: async () => {
      if (isMock) return listFirewallRules(clusterId!);
      const response = await apiClient.get<FirewallRule[]>(`/clusters/${clusterId}/firewall/filter`);
      return response.data;
    },
    enabled: !!clusterId,
  });
}

export function useAddFirewallRule(clusterId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rule: Omit<FirewallRule, 'id'>) => {
      if (isMock) return addFirewallRule(clusterId!, rule);
      const response = await apiClient.post<FirewallRule>(
        `/clusters/${clusterId}/firewall/filter`,
        rule,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['firewall-rules', clusterId] });
    },
  });
}

export function useUpdateFirewallRule(clusterId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FirewallRule> }) => {
      if (isMock) return updateFirewallRule(clusterId!, id, updates);
      await apiClient.patch(`/clusters/${clusterId}/firewall/filter/${id}`, updates);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['firewall-rules', clusterId] });
    },
  });
}

export function useDeleteFirewallRule(clusterId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (isMock) return deleteFirewallRule(clusterId!, id);
      await apiClient.delete(`/clusters/${clusterId}/firewall/filter/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['firewall-rules', clusterId] });
    },
  });
}

export function useMoveFirewallRule(clusterId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ruleId, destinationId }: { ruleId: string; destinationId: string }) => {
      if (isMock) return moveFirewallRule(clusterId!, ruleId, destinationId);
      await apiClient.post(`/clusters/${clusterId}/firewall/filter/move`, { '.id': ruleId, destination: destinationId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['firewall-rules', clusterId] });
    },
  });
}
