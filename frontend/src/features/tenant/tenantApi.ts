import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import type { Tenant } from '../../api/types';

export function useTenant() {
  return useQuery<Tenant>({
    queryKey: ['tenant'],
    queryFn: async () => {
      const response = await apiClient.get<Tenant>('/tenant');
      return response.data;
    },
  });
}

interface UpdateTenantPayload {
  name: string;
}

export function useUpdateTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateTenantPayload) => {
      const response = await apiClient.put<Tenant>('/tenant', payload);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tenant'] });
    },
  });
}
