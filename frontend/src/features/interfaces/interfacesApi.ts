import { useQuery } from '@tanstack/react-query';
import apiClient from '../../api/client';
import type { RouterInterface } from '../../api/types';
import { useMockMode } from '../../mocks/useMockMode';
import { listInterfaces, getInterface } from '../../mocks/mockInterfacesData';

export function useInterfaces(routerId: string | null) {
  const isMock = useMockMode();

  return useQuery<RouterInterface[]>({
    queryKey: ['interfaces', routerId],
    queryFn: async () => {
      if (isMock) return listInterfaces(routerId!);
      const response = await apiClient.get<RouterInterface[]>(
        `/routers/${routerId}/interfaces`,
      );
      return response.data;
    },
    enabled: !!routerId,
  });
}

export function useInterface(routerId: string | null, name: string) {
  const isMock = useMockMode();

  return useQuery<RouterInterface>({
    queryKey: ['interfaces', routerId, name],
    queryFn: async () => {
      if (isMock) {
        const iface = getInterface(routerId!, name);
        if (!iface) throw new Error(`Interface ${name} not found`);
        return iface;
      }
      const response = await apiClient.get<RouterInterface>(
        `/routers/${routerId}/interfaces/${name}`,
      );
      return response.data;
    },
    enabled: !!routerId && !!name,
  });
}
