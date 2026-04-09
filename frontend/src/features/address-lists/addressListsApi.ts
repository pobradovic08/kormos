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

export function useAddressLists(clusterId: string | null) {
  const isMock = useMockMode();

  return useQuery<AddressList[]>({
    queryKey: ['address-lists', clusterId],
    queryFn: async () => {
      if (isMock) return listAddressLists(clusterId!);
      const response = await apiClient.get<AddressList[]>(
        `/clusters/${clusterId}/address-lists`,
      );
      return response.data;
    },
    enabled: !!clusterId,
  });
}

export function useCreateAddressList(clusterId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      if (isMock) return createAddressList(clusterId!, name);
      // MikroTik creates a list implicitly when the first entry is added.
      // No separate API call needed.
      return { name };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['address-lists', clusterId] });
    },
  });
}

export function useDeleteAddressList(clusterId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, entryIds }: { name: string; entryIds: string[] }) => {
      if (isMock) return deleteAddressList(clusterId!, name);
      // No backend endpoint exists to delete an entire list by name.
      // Delete all entries belonging to this list one by one.
      await Promise.all(
        entryIds.map((entryId) =>
          apiClient.delete(`/clusters/${clusterId}/address-lists/${entryId}`),
        ),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['address-lists', clusterId] });
    },
  });
}

export function useAddEntry(clusterId: string | null) {
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
      if (isMock) return addEntry(clusterId!, listName, prefix, comment);
      const response = await apiClient.post(
        `/clusters/${clusterId}/address-lists`,
        { list: listName, address: prefix, comment },
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['address-lists', clusterId] });
    },
  });
}

export function useDeleteEntries(clusterId: string | null) {
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
      if (isMock) return deleteEntries(clusterId!, listName, entryIds);
      await Promise.all(
        entryIds.map((entryId) =>
          apiClient.delete(`/clusters/${clusterId}/address-lists/${entryId}`),
        ),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['address-lists', clusterId] });
    },
  });
}

export function useUpdateEntry(clusterId: string | null) {
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
      if (isMock) return updateEntry(clusterId!, listName, entryId, comment);
      await apiClient.patch(
        `/clusters/${clusterId}/address-lists/${entryId}`,
        { comment },
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['address-lists', clusterId] });
    },
  });
}
