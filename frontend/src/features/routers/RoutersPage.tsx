import { useState } from 'react';
import {
  Title,
  Button,
  Group,
  Table,
  Badge,
  ActionIcon,
  Text,
  Skeleton,
  Tooltip,
  Stack,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconRefresh,
  IconRouter,
} from '@tabler/icons-react';
import { useRouters, useDeleteRouter, useRouterStatus } from './routersApi';
import RouterForm from './RouterForm';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';
import ErrorBanner from '../../components/common/ErrorBanner';
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
  const { data: routers, isLoading, error, refetch } = useRouters();
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

  const hasRouters = routers && routers.length > 0;

  if (isLoading) {
    return (
      <>
        <Stack gap={4} mb="md">
          <Title order={2}>Routers</Title>
          <Text size="sm" c="dimmed">Manage your MikroTik CHR instances</Text>
        </Stack>
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
      <ErrorBanner
        message="Failed to load routers. Please try again later."
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <>
      <Group justify="space-between" align="flex-start" mb="md">
        <Stack gap={4}>
          <Title order={2}>Routers</Title>
          <Text size="sm" c="dimmed">Manage your MikroTik CHR instances</Text>
        </Stack>
        {hasRouters && (
          <Button leftSection={<IconPlus size={16} />} onClick={handleAdd}>
            Add Router
          </Button>
        )}
      </Group>

      {hasRouters ? (
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
        <EmptyState
          icon={IconRouter}
          title="No routers configured"
          description="Add your first MikroTik CHR router to start managing your network infrastructure."
          action={
            <Button leftSection={<IconPlus size={16} />} onClick={handleAdd}>
              Add Router
            </Button>
          }
        />
      )}

      <RouterForm
        opened={formOpened}
        onClose={handleFormClose}
        router={editingRouter}
      />

      <ConfirmDialog
        isOpen={!!deletingRouter}
        onClose={() => setDeletingRouter(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Router"
        message={
          deletingRouter
            ? `Are you sure you want to delete router "${deletingRouter.name}"? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        confirmColor="red"
      />
    </>
  );
}
