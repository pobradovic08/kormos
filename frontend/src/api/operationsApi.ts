import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './client';
import type {
  ExecuteOperationRequest,
  ExecuteOperationResponse,
  UndoResponse,
  OperationHistoryResponse,
} from './types';

export function useExecuteOperation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (req: ExecuteOperationRequest) => {
      const response = await apiClient.post<ExecuteOperationResponse>(
        '/v1/operations/execute',
        req,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operation-history'] });
    },
  });
}

export function useUndoOperation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (groupId: string) => {
      const response = await apiClient.post<UndoResponse>(
        `/v1/operations/undo/${groupId}`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['operation-history'] });
    },
  });
}

export function useOperationHistory(routerId: string | null, page = 1, perPage = 20) {
  return useQuery({
    queryKey: ['operation-history', routerId, page, perPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (routerId) params.set('router_id', routerId);
      params.set('page', String(page));
      params.set('per_page', String(perPage));
      const response = await apiClient.get<OperationHistoryResponse>(
        `/v1/operations/history?${params.toString()}`,
      );
      return response.data;
    },
    enabled: !!routerId,
  });
}
