import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import type { Route } from '../../api/types';
import { useMockMode } from '../../mocks/useMockMode';
import { listRoutes, getRoute } from '../../mocks/mockRoutesData';

export interface CreateRoutePayload {
  destination: string;
  gateway: string;
  distance: number;
  comment?: string;
}

export interface UpdateRoutePayload {
  gateway?: string;
  distance?: number;
  disabled?: boolean;
  comment?: string;
}

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

export function useCreateRoute(routerId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateRoutePayload) => {
      const response = await apiClient.post<Route>(
        `/routers/${routerId}/routes`,
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['routes', routerId] });
    },
  });
}

export function useUpdateRoute(routerId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateRoutePayload & { id: string }) => {
      await apiClient.patch(`/routers/${routerId}/routes/${id}`, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['routes', routerId] });
    },
  });
}

export function useDeleteRoute(routerId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/routers/${routerId}/routes/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['routes', routerId] });
    },
  });
}
