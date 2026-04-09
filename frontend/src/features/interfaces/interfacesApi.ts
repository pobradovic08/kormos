import { useQuery } from '@tanstack/react-query';
import apiClient from '../../api/client';
import type { RouterInterface, MergedInterface } from '../../api/types';
import { useMockMode } from '../../mocks/useMockMode';
import { listInterfaces, getInterface } from '../../mocks/mockInterfacesData';

export function useInterfaces(clusterId: string | null) {
  const isMock = useMockMode();

  return useQuery<RouterInterface[]>({
    queryKey: ['interfaces', clusterId],
    queryFn: async () => {
      if (isMock) return listInterfaces(clusterId!);
      // Backend returns MergedInterface[] — flatten to RouterInterface[] for page compatibility.
      const response = await apiClient.get<MergedInterface[]>(
        `/clusters/${clusterId}/interfaces`,
      );
      return response.data.flatMap((merged) =>
        merged.endpoints.map((ep) => ({
          id: ep.rosId,
          name: merged.name,
          default_name: merged.defaultName,
          type: merged.type,
          running: ep.running,
          disabled: merged.disabled,
          comment: merged.comment,
          mtu: merged.mtu,
          mac_address: ep.macAddress,
          addresses: ep.addresses,
          properties: {},
        })),
      );
    },
    enabled: !!clusterId,
  });
}

export function useMergedInterfaces(clusterId: string | null) {
  const isMock = useMockMode();

  return useQuery<MergedInterface[]>({
    queryKey: ['interfaces-merged', clusterId],
    queryFn: async () => {
      if (isMock) {
        // In mock mode, wrap flat interfaces as merged with single endpoint
        const flat = listInterfaces(clusterId!);
        return flat.map((iface) => ({
          name: iface.name,
          defaultName: iface.default_name,
          type: iface.type,
          mtu: iface.mtu,
          disabled: iface.disabled,
          comment: iface.comment,
          endpoints: [{
            routerId: clusterId!,
            routerName: 'mock',
            role: 'master',
            rosId: iface.id,
            macAddress: iface.mac_address,
            running: iface.running,
            addresses: iface.addresses,
          }],
        }));
      }
      const response = await apiClient.get<MergedInterface[]>(
        `/clusters/${clusterId}/interfaces`,
      );
      return response.data;
    },
    enabled: !!clusterId,
  });
}

export function useInterface(clusterId: string | null, name: string) {
  const isMock = useMockMode();

  return useQuery<RouterInterface>({
    queryKey: ['interfaces', clusterId, name],
    queryFn: async () => {
      if (isMock) {
        const iface = getInterface(clusterId!, name);
        if (!iface) throw new Error(`Interface ${name} not found`);
        return iface;
      }
      const response = await apiClient.get<RouterInterface>(
        `/clusters/${clusterId}/interfaces/${name}`,
      );
      return response.data;
    },
    enabled: !!clusterId && !!name,
  });
}
