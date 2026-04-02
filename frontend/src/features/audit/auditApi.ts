import { useQuery } from '@tanstack/react-query';
import apiClient from '../../api/client';
import type { AuditEntry } from '../../api/types';

export interface AuditFilters {
  routerId?: string;
  userId?: string;
  module?: string;
  from?: string;
  to?: string;
  page?: number;
  perPage?: number;
}

export interface AuditResponse {
  data: AuditEntry[];
  total: number;
  page: number;
  per_page: number;
}

export function useAuditLog(filters: AuditFilters) {
  return useQuery<AuditResponse>({
    queryKey: ['audit-log', filters],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters.routerId) params.set('router_id', filters.routerId);
      if (filters.userId) params.set('user_id', filters.userId);
      if (filters.module) params.set('module', filters.module);
      if (filters.from) params.set('from_date', new Date(filters.from).toISOString());
      if (filters.to) {
        // Set to end of selected day
        const toDate = new Date(filters.to);
        toDate.setHours(23, 59, 59, 999);
        params.set('to_date', toDate.toISOString());
      }
      if (filters.page) params.set('page', String(filters.page));
      if (filters.perPage) params.set('per_page', String(filters.perPage));

      const response = await apiClient.get<AuditResponse>('/audit-log', { params });
      return response.data;
    },
  });
}
