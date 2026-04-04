import { useQuery } from '@tanstack/react-query';
import apiClient from '../../api/client';
import type { Route } from '../../api/types';
import { useMockMode } from '../../mocks/useMockMode';
import { listRoutes, getRoute } from '../../mocks/mockRoutesData';

export function useRoutes(routerId: string | null) {
  const isMock = useMockMode();

  return useQuery<Route[]>({
    queryKey: ['routes', routerId],
    queryFn: async () => {
      if (isMock) return listRoutes(routerId!);
      const response = await apiClient.get<Route[]>(
        `/routers/${routerId}/routes`,
      );
      return response.data;
    },
    enabled: !!routerId,
  });
}

export function useRoute(routerId: string | null, id: string) {
  const isMock = useMockMode();

  return useQuery<Route>({
    queryKey: ['routes', routerId, id],
    queryFn: async () => {
      if (isMock) {
        const route = getRoute(routerId!, id);
        if (!route) throw new Error(`Route ${id} not found`);
        return route;
      }
      const response = await apiClient.get<Route>(
        `/routers/${routerId}/routes/${id}`,
      );
      return response.data;
    },
    enabled: !!routerId && !!id,
  });
}
