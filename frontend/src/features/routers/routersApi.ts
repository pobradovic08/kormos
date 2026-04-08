import { useQuery } from '@tanstack/react-query';
import apiClient from '../../api/client';
import type { Router, RouterStatus } from '../../api/types';
import { useMockMode } from '../../mocks/useMockMode';
import {
  listRouters,
  checkStatus,
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

