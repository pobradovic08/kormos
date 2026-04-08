import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import { useMockMode } from '../../mocks/useMockMode';
import type {
  ClusterResponse,
  CreateClusterRequest,
  UpdateClusterRequest,
  TestConnectionRequest,
  TestConnectionResponse,
} from '../../api/types';

export function useClusters() {
  const isMock = useMockMode();
  return useQuery<ClusterResponse[]>({
    queryKey: ['clusters'],
    queryFn: async () => {
      if (isMock) return [];
      const response = await apiClient.get<ClusterResponse[]>('/clusters');
      return response.data;
    },
  });
}

export function useCluster(clusterID: string | null) {
  const isMock = useMockMode();
  return useQuery<ClusterResponse>({
    queryKey: ['clusters', clusterID],
    queryFn: async () => {
      if (isMock) throw new Error('Not implemented in mock mode');
      const response = await apiClient.get<ClusterResponse>(`/clusters/${clusterID}`);
      return response.data;
    },
    enabled: !!clusterID && !isMock,
  });
}

export function useCreateCluster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: CreateClusterRequest) => {
      const response = await apiClient.post<ClusterResponse>('/clusters', req);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['clusters'] });
      void queryClient.invalidateQueries({ queryKey: ['routers'] });
    },
  });
}

export function useUpdateCluster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...req }: UpdateClusterRequest & { id: string }) => {
      const response = await apiClient.put<ClusterResponse>(`/clusters/${id}`, req);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['clusters'] });
      void queryClient.invalidateQueries({ queryKey: ['routers'] });
    },
  });
}

export function useDeleteCluster() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/clusters/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['clusters'] });
      void queryClient.invalidateQueries({ queryKey: ['routers'] });
    },
  });
}

export function useTestConnection() {
  return useMutation({
    mutationFn: async (req: TestConnectionRequest) => {
      const response = await apiClient.post<TestConnectionResponse>(
        '/clusters/test-connection',
        req,
      );
      return response.data;
    },
  });
}
