import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Title,
  Button,
  Group,
  Text,
  Skeleton,
  Stack,
  TextInput,
} from '@mantine/core';
import {
  IconPlus,
  IconSearch,
  IconRouter,
  IconListDetails,
} from '@tabler/icons-react';
import { useRouterStore } from '../../stores/useRouterStore';
import { looksLikeCIDR, prefixOverlaps } from '../../utils/cidr';
import { useAddressLists, useDeleteAddressList, useDeleteEntries } from './addressListsApi';
import AddressListGroup from './AddressListGroup';
import AddressListForm from './AddressListForm';

import EmptyState from '../../components/common/EmptyState';
import ErrorBanner from '../../components/common/ErrorBanner';
import ConfirmDialog from '../../components/common/ConfirmDialog';

function LoadingSkeleton() {
  return (
    <>
      <Group justify="space-between" align="flex-start" mb="lg">
        <Stack gap={4}>
          <Title order={2}>Address Lists</Title>
          <Text size="sm" c="dimmed">
            Firewall address lists
          </Text>
        </Stack>
      </Group>
      <Skeleton height={36} radius="sm" mb="md" />
      <Stack gap="md">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} height={48} radius="sm" />
        ))}
      </Stack>
    </>
  );
}

export default function AddressListsPage() {
  const selectedRouterId = useRouterStore((s) => s.selectedRouterId);
  const { data: lists, isLoading, error, refetch } = useAddressLists(selectedRouterId);
  const deleteMutation = useDeleteAddressList(selectedRouterId);
  const deleteEntriesMutation = useDeleteEntries(selectedRouterId);

  const [search, setSearch] = useState('');
  const [collapsedLists, setCollapsedLists] = useState<Set<string>>(new Set());
  const [selectedEntries, setSelectedEntries] = useState<Record<string, Set<string>>>({});
  const [addListOpen, setAddListOpen] = useState(false);
  const [addEntryTarget, setAddEntryTarget] = useState<string | null>(null);

  const [deleteListTarget, setDeleteListTarget] = useState<string | null>(null);

  // Reset state when router changes
  const prevRouterId = useRef(selectedRouterId);
  useEffect(() => {
    if (prevRouterId.current !== selectedRouterId) {
      setCollapsedLists(new Set());
      setSelectedEntries({});
      setSearch('');
      prevRouterId.current = selectedRouterId;
    }
  }, [selectedRouterId]);

  // Collapse all lists by default when data loads
  const initializedRef = useRef(false);
  useEffect(() => {
    if (lists && lists.length > 0 && !initializedRef.current) {
      setCollapsedLists(new Set(lists.map((l) => l.name)));
      initializedRef.current = true;
    }
  }, [lists]);

  // Reset initialization when router changes
  useEffect(() => {
    initializedRef.current = false;
  }, [selectedRouterId]);

  const filteredLists = useMemo(() => {
    if (!lists) return [];
    const trimmed = search.trim();
    if (!trimmed) return lists;

    const query = trimmed.toLowerCase();
    const isCIDR = looksLikeCIDR(trimmed);

    return lists.filter((list) => {
      if (list.name.toLowerCase().includes(query)) return true;

      return list.entries.some((entry) => {
        if (isCIDR && prefixOverlaps(trimmed, entry.prefix)) return true;
        return (
          entry.prefix.toLowerCase().includes(query) ||
          entry.comment.toLowerCase().includes(query)
        );
      });
    });
  }, [lists, search]);

  // Auto-expand lists that matched via entry content (not list name)
  useEffect(() => {
    const trimmed = search.trim();
    if (!trimmed) return;

    const query = trimmed.toLowerCase();
    const isCIDR = looksLikeCIDR(trimmed);

    const toExpand: string[] = [];
    for (const list of filteredLists) {
      if (list.name.toLowerCase().includes(query)) continue;
      const hasEntryMatch = list.entries.some((entry) => {
        if (isCIDR && prefixOverlaps(trimmed, entry.prefix)) return true;
        return (
          entry.prefix.toLowerCase().includes(query) ||
          entry.comment.toLowerCase().includes(query)
        );
      });
      if (hasEntryMatch) toExpand.push(list.name);
    }

    if (toExpand.length > 0) {
      setCollapsedLists((prev) => {
        const next = new Set(prev);
        for (const name of toExpand) next.delete(name);
        return next;
      });
    }
  }, [filteredLists, search]);

  const toggleList = (name: string) => {
    setCollapsedLists((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleSelectionChange = (listName: string, selected: Set<string>) => {
    setSelectedEntries((prev) => ({ ...prev, [listName]: selected }));
  };

  const handleDeleteListConfirm = () => {
    if (!deleteListTarget) return;
    deleteMutation.mutate(
      { name: deleteListTarget },
      {
        onSuccess: () => {
          setDeleteListTarget(null);
        },
      },
    );
  };

  const handleDeleteEntries = (listName: string) => {
    const entryIds = selectedEntries[listName];
    if (!entryIds || entryIds.size === 0) return;
    deleteEntriesMutation.mutate(
      { listName, entryIds: Array.from(entryIds) },
      {
        onSuccess: () => {
          setSelectedEntries((prev) => ({ ...prev, [listName]: new Set() }));
        },
      },
    );
  };

  // Helper to get existing prefixes for a list
  const getExistingPrefixes = (listName: string): string[] => {
    const list = lists?.find((l) => l.name === listName);
    return list?.entries.map((e) => e.prefix) ?? [];
  };

  if (!selectedRouterId) {
    return (
      <Stack align="center" mt="xl" gap="md">
        <IconRouter size={48} stroke={1.5} color="var(--mantine-color-dimmed)" />
        <Text c="dimmed" size="lg">
          Select a router to view address lists
        </Text>
      </Stack>
    );
  }

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <ErrorBanner
        message="Failed to load address lists. Please try again later."
        onRetry={() => void refetch()}
      />
    );
  }

  const hasLists = lists && lists.length > 0;
  const existingNames = lists?.map((l) => l.name) ?? [];

  return (
    <>
      <Group justify="space-between" align="flex-start" mb="lg">
        <Stack gap={4}>
          <Title order={2}>Address Lists</Title>
          <Text size="sm" c="dimmed">
            Firewall address lists
          </Text>
        </Stack>
        {hasLists && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => setAddListOpen(true)}>
            Add Address List
          </Button>
        )}
      </Group>

      {hasLists ? (
        <>
          <TextInput
            placeholder="Search address lists..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            radius="sm"
            mb="md"
          />

          <Stack gap="md">
            {filteredLists.map((list) => (
              <AddressListGroup
                key={list.name}
                list={list}
                isCollapsed={collapsedLists.has(list.name)}
                onToggle={() => toggleList(list.name)}
                routerId={selectedRouterId}
                selectedEntries={selectedEntries[list.name] ?? new Set()}
                onSelectionChange={(selected) => handleSelectionChange(list.name, selected)}
                onAddEntry={(name) => setAddEntryTarget(name)}

                onDelete={(name) => setDeleteListTarget(name)}
                onDeleteEntries={(name) => handleDeleteEntries(name)}
              />
            ))}
            {filteredLists.length === 0 && search && (
              <Text size="sm" c="dimmed" ta="center" py="lg">
                No address lists match &ldquo;{search}&rdquo;
              </Text>
            )}
          </Stack>
        </>
      ) : (
        <EmptyState
          icon={IconListDetails}
          title="No address lists"
          description="Add your first address list to start managing firewall rules."
          action={
            <Button leftSection={<IconPlus size={16} />} onClick={() => setAddListOpen(true)}>
              Add Address List
            </Button>
          }
        />
      )}

      <AddressListForm
        isOpen={addListOpen}
        onClose={() => setAddListOpen(false)}
        routerId={selectedRouterId}
        existingNames={existingNames}
      />

      {addEntryTarget && (
        <AddressListForm
          isOpen={!!addEntryTarget}
          onClose={() => setAddEntryTarget(null)}
          routerId={selectedRouterId}
          existingNames={existingNames}
          targetListName={addEntryTarget}
          targetExistingPrefixes={getExistingPrefixes(addEntryTarget)}
        />
      )}


      <ConfirmDialog
        isOpen={!!deleteListTarget}
        onClose={() => setDeleteListTarget(null)}
        onConfirm={handleDeleteListConfirm}
        title="Delete Address List"
        message={
          deleteListTarget
            ? `Are you sure you want to delete address list '${deleteListTarget}'? All entries will be removed. This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        confirmColor="red"
      />
    </>
  );
}
