import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import type { AddressList } from '../../api/types';
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

  return useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      if (isMock) return createAddressList(routerId!, name);
      const response = await apiClient.post(
        `/routers/${routerId}/address-lists`,
        { name },
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['address-lists', routerId] });
    },
  });
}

export function useDeleteAddressList(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      if (isMock) return deleteAddressList(routerId!, name);
      const response = await apiClient.delete(
        `/routers/${routerId}/address-lists/${name}`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['address-lists', routerId] });
    },
  });
}

export function useAddEntry(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

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
      const response = await apiClient.post(
        `/routers/${routerId}/address-lists/${listName}/entries`,
        { prefix, comment },
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['address-lists', routerId] });
    },
  });
}

export function useDeleteEntries(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listName,
      entryIds,
    }: {
      listName: string;
      entryIds: string[];
    }) => {
      if (isMock) return deleteEntries(routerId!, listName, entryIds);
      const ids = entryIds.join(',');
      const response = await apiClient.delete(
        `/routers/${routerId}/address-lists/${listName}/entries?ids=${ids}`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['address-lists', routerId] });
    },
  });
}

export function useUpdateEntry(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

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
      const response = await apiClient.patch(
        `/routers/${routerId}/address-lists/${listName}/entries/${entryId}`,
        { comment },
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['address-lists', routerId] });
    },
  });
}
