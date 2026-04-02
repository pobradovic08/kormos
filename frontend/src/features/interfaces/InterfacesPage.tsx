import { useState, useMemo } from 'react';
import {
  Title,
  Button,
  Group,
  Table,
  TextInput,
  Text,
  Stack,
  Skeleton,
  Modal,
} from '@mantine/core';
import {
  IconPlus,
  IconSearch,
  IconRouter,
  IconNetwork,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useRouterStore } from '../../stores/useRouterStore';
import { useCommitStore } from '../../stores/useCommitStore';
import { useInterfaces } from './interfacesApi';
import { interfaceColumns } from './interfaceColumns';
import InterfaceDetail from './InterfaceDetail';
import InterfaceForm from './InterfaceForm';
import InterfaceTypeSelector from './InterfaceTypeSelector';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';
import ErrorBanner from '../../components/common/ErrorBanner';
import type { InterfaceTypeOption } from './InterfaceTypeSelector';
import type { RouterInterface } from '../../api/types';

function LoadingSkeleton() {
  return (
    <Table striped>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Name</Table.Th>
          <Table.Th>Type</Table.Th>
          <Table.Th>IP Addresses</Table.Th>
          <Table.Th>Status</Table.Th>
          <Table.Th>Comment</Table.Th>
          <Table.Th>MTU</Table.Th>
          <Table.Th>MAC</Table.Th>
          <Table.Th>Actions</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {Array.from({ length: 6 }).map((_, i) => (
          <Table.Tr key={i}>
            {Array.from({ length: 8 }).map((_, j) => (
              <Table.Td key={j}>
                <Skeleton height="36px" radius="sm" />
              </Table.Td>
            ))}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

type CreateStep = 'select-type' | 'fill-form';

export default function InterfacesPage() {
  const selectedRouterId = useRouterStore((s) => s.selectedRouterId);
  const stageChange = useCommitStore((s) => s.stageChange);
  const { data: interfaces, isLoading, error, refetch } = useInterfaces(selectedRouterId);

  const [search, setSearch] = useState('');
  const [selectedInterface, setSelectedInterface] =
    useState<RouterInterface | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Create interface state
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState<CreateStep>('select-type');
  const [selectedType, setSelectedType] = useState<InterfaceTypeOption | null>(
    null,
  );

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<RouterInterface | null>(
    null,
  );
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const filteredInterfaces = useMemo(() => {
    if (!interfaces) return [];
    if (!search.trim()) return interfaces;

    const query = search.toLowerCase();
    return interfaces.filter(
      (iface) =>
        iface.name.toLowerCase().includes(query) ||
        iface.type.toLowerCase().includes(query) ||
        iface.addresses.some((a) => a.address.toLowerCase().includes(query)),
    );
  }, [interfaces, search]);

  const handleRowClick = (iface: RouterInterface) => {
    setSelectedInterface(iface);
    setDetailOpen(true);
  };

  const handleDetailClose = () => {
    setDetailOpen(false);
    setSelectedInterface(null);
  };

  const handleEdit = (iface: RouterInterface) => {
    setSelectedInterface(iface);
    setDetailOpen(true);
  };

  const handleDelete = (iface: RouterInterface) => {
    setDeleteTarget(iface);
    setConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!selectedRouterId || !deleteTarget) return;

    stageChange(selectedRouterId, {
      routerId: selectedRouterId,
      module: 'interfaces',
      operation: 'delete',
      resourcePath: `/interfaces/${deleteTarget.name}`,
      resourceId: deleteTarget.id,
      before: deleteTarget as unknown as Record<string, unknown>,
      after: null,
    });

    notifications.show({
      title: 'Delete staged',
      message: `Deletion of "${deleteTarget.name}" has been staged for commit.`,
      color: 'orange',
    });

    setDeleteTarget(null);
  };

  // Create flow handlers
  const handleNewClick = () => {
    setCreateStep('select-type');
    setSelectedType(null);
    setCreateOpen(true);
  };

  const handleTypeSelect = (option: InterfaceTypeOption) => {
    setSelectedType(option);
    setCreateStep('fill-form');
  };

  const handleCreateClose = () => {
    setCreateOpen(false);
    setCreateStep('select-type');
    setSelectedType(null);
  };

  if (!selectedRouterId) {
    return (
      <Stack align="center" mt="xl" gap="md">
        <IconRouter size={48} stroke={1.5} color="var(--mantine-color-dimmed)" />
        <Text c="dimmed" size="lg">
          Select a router to view interfaces
        </Text>
      </Stack>
    );
  }

  if (isLoading) {
    return (
      <>
        <Group justify="space-between" mb="md">
          <Title order={2} mb="lg">Interfaces</Title>
        </Group>
        <LoadingSkeleton />
      </>
    );
  }

  if (error) {
    return (
      <ErrorBanner
        message="Failed to load interfaces. Please try again later."
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={2} mb="lg">Interfaces</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={handleNewClick}>
          New Interface
        </Button>
      </Group>

      <TextInput
        placeholder="Search by name, type, or IP address..."
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        mb="md"
      />

      {filteredInterfaces.length > 0 ? (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              {interfaceColumns.map((col) => (
                <Table.Th key={col.accessor}>{col.header}</Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {filteredInterfaces.map((iface) => (
              <Table.Tr
                key={iface.id}
                onClick={() => handleRowClick(iface)}
                style={{ cursor: 'pointer' }}
              >
                {interfaceColumns.map((col) => (
                  <Table.Td key={col.accessor}>
                    {col.render(iface, {
                      onEdit: handleEdit,
                      onDelete: handleDelete,
                    })}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <EmptyState
          icon={IconNetwork}
          title={search.trim() ? 'No matching interfaces' : 'No interfaces found'}
          description={
            search.trim()
              ? 'No interfaces match your search.'
              : 'No interfaces found on this router.'
          }
        />
      )}

      <InterfaceDetail
        iface={selectedInterface}
        isOpen={detailOpen}
        onClose={handleDetailClose}
      />

      {/* New Interface Modal */}
      <Modal
        opened={createOpen}
        onClose={handleCreateClose}
        title={
          createStep === 'select-type'
            ? 'Select Interface Type'
            : `New ${selectedType?.label ?? ''} Interface`
        }
        size={createStep === 'select-type' ? 'lg' : 'md'}
        centered
      >
        {createStep === 'select-type' && (
          <InterfaceTypeSelector onSelect={handleTypeSelect} />
        )}
        {createStep === 'fill-form' && selectedType && (
          <InterfaceForm
            isNew
            interfaceType={selectedType.type}
            resourcePath={selectedType.resourcePath}
            onClose={handleCreateClose}
          />
        )}
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        onClose={() => {
          setConfirmDeleteOpen(false);
          setDeleteTarget(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Interface"
        message={
          deleteTarget
            ? `Are you sure you want to delete interface "${deleteTarget.name}"? This change will be staged and applied on the next commit.`
            : ''
        }
        confirmLabel="Delete"
        confirmColor="red"
      />
    </>
  );
}
