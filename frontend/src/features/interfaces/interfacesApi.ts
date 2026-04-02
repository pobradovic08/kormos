import { useQuery } from '@tanstack/react-query';
import apiClient from '../../api/client';
import type { RouterInterface } from '../../api/types';

export function useInterfaces(routerId: string | null) {
  return useQuery<RouterInterface[]>({
    queryKey: ['interfaces', routerId],
    queryFn: async () => {
      const response = await apiClient.get<RouterInterface[]>(
        `/routers/${routerId}/interfaces`,
      );
      return response.data;
    },
    enabled: !!routerId,
  });
}

export function useInterface(routerId: string | null, name: string) {
  return useQuery<RouterInterface>({
    queryKey: ['interfaces', routerId, name],
    queryFn: async () => {
      const response = await apiClient.get<RouterInterface>(
        `/routers/${routerId}/interfaces/${name}`,
      );
      return response.data;
    },
    enabled: !!routerId && !!name,
  });
}
