import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import type { AddressList } from '../../api/types';
import { useExecuteOperation } from '../../api/operationsApi';
import { useMockMode } from '../../mocks/useMockMode';
import {
  listAddressLists,
  createAddressList,
  deleteAddressList,
  addEntry,
  deleteEntries,
  updateEntry,
} from '../../mocks/mockAddressListsData';

export function useAddressLists(routerId: string | null) {
  const isMock = useMockMode();

  return useQuery<AddressList[]>({
    queryKey: ['address-lists', routerId],
    queryFn: async () => {
      if (isMock) return listAddressLists(routerId!);
      const response = await apiClient.get<AddressList[]>(
        `/routers/${routerId}/address-lists`,
      );
      return response.data;
    },
    enabled: !!routerId,
  });
}

export function useCreateAddressList(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  const executeOp = useExecuteOperation();

  return useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      if (isMock) return createAddressList(routerId!, name);
      const result = await executeOp.mutateAsync({
        description: `Create address list "${name}"`,
        operations: [{
          router_id: routerId!,
          module: 'address-lists',
          operation_type: 'add',
          resource_path: '/ip/firewall/address-list',
          body: { list: name } as Record<string, unknown>,
        }],
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['address-lists', routerId] });
    },
  });
}

export function useDeleteAddressList(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  const executeOp = useExecuteOperation();

  return useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      if (isMock) return deleteAddressList(routerId!, name);
      await executeOp.mutateAsync({
        description: `Delete address list "${name}"`,
        operations: [{
          router_id: routerId!,
          module: 'address-lists',
          operation_type: 'delete',
          resource_path: '/ip/firewall/address-list',
          resource_id: name,
          body: {},
        }],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['address-lists', routerId] });
    },
  });
}

export function useAddEntry(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  const executeOp = useExecuteOperation();

  return useMutation({
    mutationFn: async ({
      listName,
      prefix,
      comment,
    }: {
      listName: string;
      prefix: string;
      comment: string;
    }) => {
      if (isMock) return addEntry(routerId!, listName, prefix, comment);
      const result = await executeOp.mutateAsync({
        description: `Add entry ${prefix} to address list "${listName}"`,
        operations: [{
          router_id: routerId!,
          module: 'address-lists',
          operation_type: 'add',
          resource_path: '/ip/firewall/address-list',
          body: { list: listName, address: prefix, comment } as Record<string, unknown>,
        }],
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['address-lists', routerId] });
    },
  });
}

export function useDeleteEntries(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  const executeOp = useExecuteOperation();

  return useMutation({
    mutationFn: async ({
      listName,
      entryIds,
    }: {
      listName: string;
      entryIds: string[];
    }) => {
      if (isMock) return deleteEntries(routerId!, listName, entryIds);
      await executeOp.mutateAsync({
        description: `Delete ${entryIds.length} entries from address list "${listName}"`,
        operations: entryIds.map((entryId) => ({
          router_id: routerId!,
          module: 'address-lists' as const,
          operation_type: 'delete' as const,
          resource_path: '/ip/firewall/address-list',
          resource_id: entryId,
          body: {},
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['address-lists', routerId] });
    },
  });
}

export function useUpdateEntry(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  const executeOp = useExecuteOperation();

  return useMutation({
    mutationFn: async ({
      listName,
      entryId,
      comment,
    }: {
      listName: string;
      entryId: string;
      comment: string;
    }) => {
      if (isMock) return updateEntry(routerId!, listName, entryId, comment);
      const result = await executeOp.mutateAsync({
        description: `Update entry in address list "${listName}"`,
        operations: [{
          router_id: routerId!,
          module: 'address-lists',
          operation_type: 'modify',
          resource_path: '/ip/firewall/address-list',
          resource_id: entryId,
          body: { comment } as Record<string, unknown>,
        }],
      });
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['address-lists', routerId] });
    },
  });
}
