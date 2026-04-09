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

export function useRoutes(clusterId: string | null) {
  const isMock = useMockMode();

  return useQuery<Route[]>({
    queryKey: ['routes', clusterId],
    queryFn: async () => {
      if (isMock) return listRoutes(clusterId!);
      const response = await apiClient.get<Route[]>(
        `/clusters/${clusterId}/routes`,
      );
      return response.data;
    },
    enabled: !!clusterId,
  });
}

export function useRoute(clusterId: string | null, id: string) {
  const isMock = useMockMode();

  return useQuery<Route>({
    queryKey: ['routes', clusterId, id],
    queryFn: async () => {
      if (isMock) {
        const route = getRoute(clusterId!, id);
        if (!route) throw new Error(`Route ${id} not found`);
        return route;
      }
      const response = await apiClient.get<Route>(
        `/clusters/${clusterId}/routes/${id}`,
      );
      return response.data;
    },
    enabled: !!clusterId && !!id,
  });
}

export function useCreateRoute(clusterId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateRoutePayload) => {
      const response = await apiClient.post<Route>(
        `/clusters/${clusterId}/routes`,
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['routes', clusterId] });
    },
  });
}

export function useUpdateRoute(clusterId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateRoutePayload & { id: string }) => {
      await apiClient.patch(`/clusters/${clusterId}/routes/${id}`, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['routes', clusterId] });
    },
  });
}

export function useDeleteRoute(clusterId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/clusters/${clusterId}/routes/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['routes', clusterId] });
    },
  });
}
