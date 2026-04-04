import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import type { Router, RouterStatus } from '../../api/types';
import { useMockMode } from '../../mocks/useMockMode';
import {
  listRouters,
  checkStatus,
  createRouter as mockCreateRouter,
  updateRouter as mockUpdateRouter,
  deleteRouter as mockDeleteRouter,
} from '../../mocks/mockRoutersApi';

export function useRouters() {
  const isMock = useMockMode();

  return useQuery<Router[]>({
    queryKey: ['routers'],
    queryFn: async () => {
      if (isMock) return listRouters();
      const response = await apiClient.get<Router[]>('/routers');
      return response.data;
    },
  });
}

export function useRouterStatus(routerId: string) {
  const isMock = useMockMode();

  return useQuery<RouterStatus>({
    queryKey: ['routers', routerId, 'status'],
    queryFn: async () => {
      if (isMock) return checkStatus(routerId);
      const response = await apiClient.get<RouterStatus>(
        `/routers/${routerId}/status`,
      );
      return response.data;
    },
    enabled: !!routerId,
  });
}

interface CreateRouterPayload {
  name: string;
  hostname: string;
  host: string;
  port: number;
  username: string;
  password: string;
}

export function useCreateRouter() {
  const queryClient = useQueryClient();
  const isMock = useMockMode();

  return useMutation({
    mutationFn: async (payload: CreateRouterPayload) => {
      if (isMock) return mockCreateRouter(payload);
      const response = await apiClient.post<Router>('/routers', payload);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['routers'] });
    },
  });
}

interface UpdateRouterPayload {
  id: string;
  name: string;
  hostname: string;
  host: string;
  port: number;
  username: string;
  password: string;
}

export function useUpdateRouter() {
  const queryClient = useQueryClient();
  const isMock = useMockMode();

  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateRouterPayload) => {
      if (isMock) return mockUpdateRouter(id, payload);
      const response = await apiClient.put<Router>(
        `/routers/${id}`,
        payload,
      );
      return response.data;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['routers'] });
      void queryClient.invalidateQueries({
        queryKey: ['routers', variables.id, 'status'],
      });
    },
  });
}

export function useDeleteRouter() {
  const queryClient = useQueryClient();
  const isMock = useMockMode();

  return useMutation({
    mutationFn: async (id: string) => {
      if (isMock) {
        mockDeleteRouter(id);
        return;
      }
      await apiClient.delete(`/routers/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['routers'] });
    },
  });
}
