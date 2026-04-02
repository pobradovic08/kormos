import { useQuery, useMutation } from '@tanstack/react-query';
import apiClient from '../../api/client';
import type { AuthUser } from '../../api/types';

export interface SetupStatus {
  setup_complete: boolean;
}

export interface CompleteSetupRequest {
  admin: {
    email: string;
    name: string;
    password: string;
  };
  portal: {
    portal_name: string;
    default_timezone: string;
    support_email: string;
  };
}

export interface SetupResponse {
  access_token: string;
  user: AuthUser;
}

export interface PortalSettings {
  portal_name: string;
  default_timezone: string;
  support_email: string;
}

export function useSetupStatus() {
  return useQuery<SetupStatus>({
    queryKey: ['setup-status'],
    queryFn: async () => {
      const response = await apiClient.get<SetupStatus>('/setup/status');
      return response.data;
    },
  });
}

export function useCompleteSetup() {
  return useMutation<SetupResponse, Error, CompleteSetupRequest>({
    mutationFn: async (data: CompleteSetupRequest) => {
      const response = await apiClient.post<SetupResponse>('/setup/complete', data);
      return response.data;
    },
  });
}

export function usePortalSettings() {
  return useQuery<PortalSettings>({
    queryKey: ['portal-settings'],
    queryFn: async () => {
      const response = await apiClient.get<PortalSettings>('/portal/settings');
      return response.data;
    },
    enabled: !!localStorage.getItem('access_token'),
  });
}
