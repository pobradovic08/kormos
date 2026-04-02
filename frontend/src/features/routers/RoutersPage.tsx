import { useState } from 'react';
import {
  Title,
  Button,
  Group,
  Table,
  Badge,
  ActionIcon,
  Text,
  Alert,
  Skeleton,
  Tooltip,
  Modal,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconRefresh,
  IconAlertCircle,
} from '@tabler/icons-react';
import { useRouters, useDeleteRouter, useRouterStatus } from './routersApi';
import RouterForm from './RouterForm';
import type { Router } from '../../api/types';

function StatusCheckButton({ routerId }: { routerId: string }) {
  const { refetch, isFetching } = useRouterStatus(routerId);

  return (
    <Tooltip label="Check status">
      <ActionIcon
        variant="subtle"
        color="blue"
        onClick={() => void refetch()}
        loading={isFetching}
        size="sm"
        aria-label="Check router status"
      >
        <IconRefresh size={16} />
      </ActionIcon>
    </Tooltip>
  );
}

function formatLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return 'Never';
  const date = new Date(lastSeen);
  return date.toLocaleString();
}

export default function RoutersPage() {
  const { data: routers, isLoading, error } = useRouters();
  const deleteMutation = useDeleteRouter();

  const [formOpened, setFormOpened] = useState(false);
  const [editingRouter, setEditingRouter] = useState<Router | null>(null);
  const [deletingRouter, setDeletingRouter] = useState<Router | null>(null);

  const handleAdd = () => {
    setEditingRouter(null);
    setFormOpened(true);
  };

  const handleEdit = (router: Router) => {
    setEditingRouter(router);
    setFormOpened(true);
  };

  const handleFormClose = () => {
    setFormOpened(false);
    setEditingRouter(null);
  };

  const handleDeleteClick = (router: Router) => {
    setDeletingRouter(router);
  };

  const handleDeleteConfirm = () => {
    if (!deletingRouter) return;

    deleteMutation.mutate(deletingRouter.id, {
      onSuccess: () => {
        notifications.show({
          title: 'Router deleted',
          message: `Router "${deletingRouter.name}" has been deleted.`,
          color: 'green',
        });
        setDeletingRouter(null);
      },
      onError: (err) => {
        notifications.show({
          title: 'Error',
          message: err instanceof Error ? err.message : 'Failed to delete router',
          color: 'red',
        });
      },
    });
  };

  if (isLoading) {
    return (
      <>
        <Group justify="space-between" mb="md">
          <Title order={2}>Routers</Title>
        </Group>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Hostname</Table.Th>
              <Table.Th>Host:Port</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Last Seen</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <Table.Tr key={i}>
                {Array.from({ length: 6 }).map((_, j) => (
                  <Table.Td key={j}>
                    <Skeleton height="36px" radius="sm" />
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </>
    );
  }

  if (error) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" mt="md">
        Failed to load routers. Please try again later.
      </Alert>
    );
  }

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={2}>Routers</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={handleAdd}>
          Add Router
        </Button>
      </Group>

      {routers && routers.length > 0 ? (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Hostname</Table.Th>
              <Table.Th>Host:Port</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Last Seen</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {routers.map((router) => (
              <Table.Tr key={router.id}>
                <Table.Td>{router.name}</Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {router.hostname || '-'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" ff="monospace">
                    {router.host}:{router.port}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={router.is_reachable ? 'green' : 'red'}
                    variant="filled"
                    size="sm"
                  >
                    {router.is_reachable ? 'Online' : 'Offline'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {formatLastSeen(router.last_seen)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Tooltip label="Edit">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={() => handleEdit(router)}
                        size="sm"
                        aria-label={`Edit router ${router.name}`}
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Delete">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleDeleteClick(router)}
                        size="sm"
                        aria-label={`Delete router ${router.name}`}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <StatusCheckButton routerId={router.id} />
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text c="dimmed" ta="center" mt="xl">
          No routers configured. Click "Add Router" to get started.
        </Text>
      )}

      <RouterForm
        opened={formOpened}
        onClose={handleFormClose}
        router={editingRouter}
      />

      <Modal
        opened={!!deletingRouter}
        onClose={() => setDeletingRouter(null)}
        title="Delete Router"
        size="sm"
      >
        <Text size="sm">
          Are you sure you want to delete router{' '}
          <strong>{deletingRouter?.name}</strong>? This action cannot be undone.
        </Text>
        <Group justify="flex-end" mt="lg">
          <Button
            variant="default"
            onClick={() => setDeletingRouter(null)}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            color="red"
            onClick={handleDeleteConfirm}
            loading={deleteMutation.isPending}
          >
            Delete
          </Button>
        </Group>
      </Modal>
    </>
  );
}
