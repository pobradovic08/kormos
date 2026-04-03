import { useMemo, useState } from 'react';
import {
  Title,
  Button,
  Group,
  Table,
  Text,
  Skeleton,
  Stack,
  TextInput,
  Badge,
  Box,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconSearch,
  IconRouter,
  IconChevronDown,
  IconChevronRight,
  IconCloudComputing,
} from '@tabler/icons-react';
import { useRouters, useDeleteRouter } from './routersApi';
import {
  groupRouters,
  filterGroups,
  LATEST_ROUTEROS_VERSION,
} from './routerGrouping';
import type { ClusterGroup, StandaloneGroup } from './routerGrouping';
import RouterForm from './RouterForm';
import RouterDetail from './RouterDetail';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';
import ErrorBanner from '../../components/common/ErrorBanner';
import MonoText from '../../components/common/MonoText';
import type { Router } from '../../api/types';

const statusBadgeConfig = {
  online: { color: 'green', label: 'Online' },
  degraded: { color: 'orange', label: 'Degraded' },
  offline: { color: 'red', label: 'Offline' },
} as const;

const versionBadgeConfig = {
  'up-to-date': { color: 'green', label: 'Up to date' },
  'needs-update': { color: 'yellow', label: 'Needs update' },
  'version-mismatch': { color: 'orange', label: 'Version mismatch' },
} as const;

function HeaderLabel({ children }: { children: string }) {
  return (
    <Text
      size="sm"
      fw={600}
      c="dimmed"
      tt="uppercase"
      style={{ letterSpacing: 0.5 }}
    >
      {children}
    </Text>
  );
}

function ClusterRows({
  cluster,
  isCollapsed,
  onToggle,
  onRowClick,
  onTenantClick,
}: {
  cluster: ClusterGroup;
  isCollapsed: boolean;
  onToggle: () => void;
  onRowClick: (router: Router) => void;
  onTenantClick: (tenantName: string) => void;
}) {
  const statusCfg = statusBadgeConfig[cluster.status];
  const versionCfg = cluster.versionStatus
    ? versionBadgeConfig[cluster.versionStatus]
    : null;
  const ToggleIcon = isCollapsed ? IconChevronRight : IconChevronDown;

  return (
    <>
      {/* HA Parent Row */}
      <Table.Tr
        style={{
          backgroundColor: '#f8f9ff',
          cursor: 'pointer',
          borderBottom: isCollapsed
            ? '1px solid var(--mantine-color-gray-2)'
            : '1px solid var(--mantine-color-gray-1)',
        }}
        onClick={onToggle}
      >
        <Table.Td style={{ width: 40, verticalAlign: 'middle' }}>
          <ToggleIcon size={10} color="#868e96" />
        </Table.Td>
        <Table.Td>
          <Group gap={10} wrap="nowrap">
            <IconCloudComputing
              size={18}
              color="#868e96"
              style={{ flexShrink: 0 }}
            />
            <div>
              <Group gap={6} wrap="wrap">
                <Text fw={600} size="sm">
                  {cluster.clusterName}
                </Text>
                <Badge
                  variant="light"
                  color={statusCfg.color}
                  size="sm"
                  radius="sm"
                  tt="none"
                >
                  {statusCfg.label}
                </Badge>
                {versionCfg && (
                  <Badge
                    variant="light"
                    color={versionCfg.color}
                    size="sm"
                    radius="sm"
                    tt="none"
                  >
                    {versionCfg.label}
                  </Badge>
                )}
              </Group>
              <Group gap={4}>
                <Text
                  size="xs"
                  fw={600}
                  c="dark"
                  style={{ cursor: 'pointer' }}
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    onTenantClick(cluster.tenantName);
                  }}
                >
                  {cluster.tenantName}
                </Text>
                <Text size="xs" c="dimmed">
                  &middot; {cluster.routers.length} nodes
                </Text>
              </Group>
            </div>
          </Group>
        </Table.Td>
        <Table.Td />
        <Table.Td>
          <Badge variant="light" color="blue" size="sm" radius="sm" tt="none">
            HA
          </Badge>
        </Table.Td>
        <Table.Td />
        <Table.Td />
      </Table.Tr>

      {/* HA Child Rows */}
      {!isCollapsed &&
        cluster.routers.map((router, index) => {
          const isLast = index === cluster.routers.length - 1;
          const isOnline = router.is_reachable;
          const isVersionOutdated =
            isOnline &&
            router.routeros_version !== LATEST_ROUTEROS_VERSION;

          return (
            <Table.Tr
              key={router.id}
              onClick={() => onRowClick(router)}
              style={{
                cursor: 'pointer',
                borderBottom: isLast
                  ? '1px solid var(--mantine-color-gray-2)'
                  : '1px solid var(--mantine-color-gray-1)',
              }}
            >
              <Table.Td />
              <Table.Td style={{ paddingLeft: 40 }}>
                <Group gap={8} wrap="nowrap">
                  <Box
                    w={7}
                    h={7}
                    style={{ borderRadius: '50%', flexShrink: 0 }}
                    bg={isOnline ? 'green.7' : 'red.7'}
                  />
                  <Text size="xs" c={isOnline ? undefined : 'dimmed'}>
                    {router.hostname}
                  </Text>
                </Group>
              </Table.Td>
              <Table.Td>
                <MonoText size="xs" c={isOnline ? undefined : 'dimmed'}>
                  {router.host}:{router.port}
                </MonoText>
              </Table.Td>
              <Table.Td>
                <Badge
                  variant="light"
                  color={router.role === 'master' ? 'green' : 'orange'}
                  size="sm"
                  radius="sm"
                  tt="none"
                  style={isOnline ? undefined : { opacity: 0.5 }}
                >
                  {router.role === 'master' ? 'Master' : 'Backup'}
                </Badge>
              </Table.Td>
              <Table.Td>
                {isOnline ? (
                  <MonoText size="xs" c={isVersionOutdated ? 'orange' : 'dimmed'}>
                    {router.routeros_version}
                  </MonoText>
                ) : (
                  <Text size="xs" c="dimmed">
                    &mdash;
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                {isOnline ? (
                  <Text size="xs" c="dimmed">
                    {router.uptime}
                  </Text>
                ) : (
                  <Text size="xs" c="dimmed">
                    &mdash;
                  </Text>
                )}
              </Table.Td>
            </Table.Tr>
          );
        })}
    </>
  );
}

function StandaloneRow({
  group,
  onRowClick,
  onTenantClick,
}: {
  group: StandaloneGroup;
  onRowClick: (router: Router) => void;
  onTenantClick: (tenantName: string) => void;
}) {
  const { router, versionStatus } = group;
  const isOnline = router.is_reachable;
  const statusCfg = statusBadgeConfig[isOnline ? 'online' : 'offline'];
  const versionCfg = versionStatus ? versionBadgeConfig[versionStatus] : null;
  const isVersionOutdated =
    isOnline && router.routeros_version !== LATEST_ROUTEROS_VERSION;

  return (
    <Table.Tr
      onClick={() => onRowClick(router)}
      style={{
        cursor: 'pointer',
        borderBottom: '1px solid var(--mantine-color-gray-2)',
      }}
    >
      <Table.Td style={{ width: 40 }} />
      <Table.Td>
        <Group gap={10} wrap="nowrap">
          <IconCloudComputing
            size={18}
            color={isOnline ? '#868e96' : '#adb5bd'}
            style={{ flexShrink: 0 }}
          />
          <div>
            <Group gap={6} wrap="wrap">
              <Text fw={500} size="sm" c={isOnline ? undefined : 'dimmed'}>
                {router.hostname}
              </Text>
              <Badge
                variant="light"
                color={statusCfg.color}
                size="sm"
                radius="sm"
                tt="none"
              >
                {statusCfg.label}
              </Badge>
              {versionCfg && (
                <Badge
                  variant="light"
                  color={versionCfg.color}
                  size="sm"
                  radius="sm"
                  tt="none"
                >
                  {versionCfg.label}
                </Badge>
              )}
            </Group>
            {router.tenant_name && (
              <Text
                size="xs"
                fw={600}
                c="dark"
                style={{ cursor: 'pointer' }}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onTenantClick(router.tenant_name!);
                }}
              >
                {router.tenant_name}
              </Text>
            )}
          </div>
        </Group>
      </Table.Td>
      <Table.Td>
        <MonoText size="xs" c={isOnline ? undefined : 'dimmed'}>
          {router.host}:{router.port}
        </MonoText>
      </Table.Td>
      <Table.Td>
        <Badge
          variant="light"
          color="gray"
          size="sm"
          radius="sm"
          tt="none"
          style={isOnline ? undefined : { opacity: 0.5 }}
        >
          Standalone
        </Badge>
      </Table.Td>
      <Table.Td>
        {isOnline ? (
          <MonoText size="xs" c={isVersionOutdated ? 'orange' : 'dimmed'}>
            {router.routeros_version}
          </MonoText>
        ) : (
          <Text size="xs" c="dimmed">
            &mdash;
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        {isOnline ? (
          <Text size="xs" c="dimmed">
            {router.uptime}
          </Text>
        ) : (
          <Text size="xs" c="dimmed">
            &mdash;
          </Text>
        )}
      </Table.Td>
    </Table.Tr>
  );
}

export default function RoutersPage() {
  const { data: routers, isLoading, error, refetch } = useRouters();
  const deleteMutation = useDeleteRouter();

  const [detailRouterId, setDetailRouterId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editRouter, setEditRouter] = useState<Router | null>(null);
  const [deleteRouter, setDeleteRouter] = useState<Router | null>(null);
  const [search, setSearch] = useState('');
  const [collapsedClusters, setCollapsedClusters] = useState<Set<string>>(
    new Set(),
  );

  const groups = useMemo(() => {
    if (!routers) return [];
    const grouped = groupRouters(routers);
    return filterGroups(grouped, search);
  }, [routers, search]);

  const handleAdd = () => {
    setEditRouter(null);
    setFormOpen(true);
  };

  const handleEdit = (router: Router) => {
    setEditRouter(router);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditRouter(null);
  };

  const handleRowClick = (router: Router) => {
    setDetailRouterId(router.id);
  };

  const handleDetailEdit = (router: Router) => {
    setDetailRouterId(null);
    handleEdit(router);
  };

  const handleDetailDelete = (router: Router) => {
    setDeleteRouter(router);
  };

  const handleTenantClick = (tenantName: string) => {
    setSearch(tenantName);
  };

  const toggleCluster = (clusterId: string) => {
    setCollapsedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(clusterId)) next.delete(clusterId);
      else next.add(clusterId);
      return next;
    });
  };

  const handleDeleteConfirm = () => {
    if (!deleteRouter) return;
    deleteMutation.mutate(deleteRouter.id, {
      onSuccess: () => {
        notifications.show({
          title: 'Router deleted',
          message: `Router "${deleteRouter.name}" has been deleted.`,
          color: 'green',
        });
        setDeleteRouter(null);
        if (detailRouterId === deleteRouter.id) {
          setDetailRouterId(null);
        }
      },
      onError: (err) => {
        notifications.show({
          title: 'Error',
          message:
            err instanceof Error ? err.message : 'Failed to delete router',
          color: 'red',
        });
      },
    });
  };

  const hasRouters = routers && routers.length > 0;

  if (isLoading) {
    return (
      <>
        <Stack gap={4} mb="lg">
          <Title order={2}>Routers</Title>
          <Text size="sm" c="dimmed">
            Manage your MikroTik CHR instances
          </Text>
        </Stack>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 40 }} />
              <Table.Th>Router</Table.Th>
              <Table.Th>Address</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Version</Table.Th>
              <Table.Th>Uptime</Table.Th>
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
      <Group justify="space-between" align="flex-start" mb="lg">
        <Stack gap={4}>
          <Title order={2}>Routers</Title>
          <Text size="sm" c="dimmed">
            Manage your MikroTik CHR instances
          </Text>
        </Stack>
        {hasRouters && (
          <Button leftSection={<IconPlus size={16} />} onClick={handleAdd}>
            Add Router
          </Button>
        )}
      </Group>

      {hasRouters ? (
        <>
          <TextInput
            placeholder="Search by name, hostname, or tenant..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            mb="md"
          />

          <Table
            style={{
              borderCollapse: 'collapse',
              border: '1px solid var(--mantine-color-gray-3)',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <Table.Thead>
              <Table.Tr
                style={{
                  backgroundColor: 'var(--mantine-color-gray-0)',
                  borderBottom: '1px solid var(--mantine-color-gray-3)',
                }}
              >
                <Table.Th style={{ width: 40 }} />
                <Table.Th>
                  <HeaderLabel>Router</HeaderLabel>
                </Table.Th>
                <Table.Th>
                  <HeaderLabel>Address</HeaderLabel>
                </Table.Th>
                <Table.Th style={{ width: 110 }}>
                  <HeaderLabel>Role</HeaderLabel>
                </Table.Th>
                <Table.Th style={{ width: 100 }}>
                  <HeaderLabel>Version</HeaderLabel>
                </Table.Th>
                <Table.Th style={{ width: 90 }}>
                  <HeaderLabel>Uptime</HeaderLabel>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {groups.map((group) => {
                if (group.type === 'cluster') {
                  return (
                    <ClusterRows
                      key={group.clusterId}
                      cluster={group}
                      isCollapsed={collapsedClusters.has(group.clusterId)}
                      onToggle={() => toggleCluster(group.clusterId)}
                      onRowClick={handleRowClick}
                      onTenantClick={handleTenantClick}
                    />
                  );
                }
                return (
                  <StandaloneRow
                    key={group.router.id}
                    group={group}
                    onRowClick={handleRowClick}
                    onTenantClick={handleTenantClick}
                  />
                );
              })}
              {groups.length === 0 && search && (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text size="sm" c="dimmed" ta="center" py="lg">
                      No routers match &ldquo;{search}&rdquo;
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </>
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

      <RouterDetail
        routerId={detailRouterId}
        isOpen={!!detailRouterId}
        onClose={() => setDetailRouterId(null)}
        onEdit={handleDetailEdit}
        onDelete={handleDetailDelete}
      />

      <RouterForm
        isOpen={formOpen}
        onClose={handleFormClose}
        router={editRouter}
      />

      <ConfirmDialog
        isOpen={!!deleteRouter}
        onClose={() => setDeleteRouter(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Router"
        message={
          deleteRouter
            ? `Are you sure you want to delete router '${deleteRouter.name}'? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        confirmColor="red"
      />
    </>
  );
}
