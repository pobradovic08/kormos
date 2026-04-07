import { useState, useMemo } from 'react';
import {
  Title,
  Group,
  Table,
  TextInput,
  Text,
  Stack,
  Skeleton,
} from '@mantine/core';
import {
  IconSearch,
  IconRouteAltRight,
} from '@tabler/icons-react';
import { useClusterId } from '../../hooks/useClusterId';
import { useRoutes } from './routesApi';
import { routeColumns } from './routeColumns';
import RouteDetail from './RouteDetail';
import EmptyState from '../../components/common/EmptyState';
import ErrorBanner from '../../components/common/ErrorBanner';
import type { Route } from '../../api/types';
import { looksLikeCIDR, prefixOverlaps } from '../../utils/cidr';

function HeaderLabel({ children }: { children: string }) {
  return (
    <Text
      size="xs"
      fw={600}
      c="dimmed"
      tt="uppercase"
      style={{ letterSpacing: 0.5 }}
    >
      {children}
    </Text>
  );
}

const tableWrapperStyle = {
  border: '1px solid var(--mantine-color-gray-3)',
  borderRadius: 4,
  overflow: 'hidden' as const,
};

const tableStyle = {
  borderCollapse: 'collapse' as const,
};

const headerRowStyle = {
  backgroundColor: 'var(--mantine-color-gray-0)',
  borderBottom: '1px solid var(--mantine-color-gray-3)',
};

function LoadingSkeleton() {
  return (
    <div style={tableWrapperStyle}>
    <Table withRowBorders={false} style={tableStyle}>
      <Table.Thead>
        <Table.Tr style={headerRowStyle}>
          {routeColumns.map((col) => (
            <Table.Th
              key={col.accessor}
              style={{
                width: col.width,
                textAlign: col.align ?? 'left',
              }}
            >
              <HeaderLabel>{col.header}</HeaderLabel>
            </Table.Th>
          ))}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {Array.from({ length: 5 }).map((_, i) => (
          <Table.Tr
            key={i}
            style={{
              borderBottom: '1px solid var(--mantine-color-gray-1)',
            }}
          >
            <Table.Td style={{ width: 70, textAlign: 'center' }}>
              <Skeleton height={20} width={36} radius="sm" mx="auto" />
            </Table.Td>
            <Table.Td>
              <Stack gap={4}>
                <Skeleton height={14} width={120} radius="sm" />
                <Skeleton height={10} width={160} radius="sm" />
              </Stack>
            </Table.Td>
            <Table.Td style={{ width: 280 }}>
              <Stack gap={4}>
                <Skeleton height={12} width={200} radius="sm" />
                <Skeleton height={10} width={80} radius="sm" />
              </Stack>
            </Table.Td>
            <Table.Td style={{ width: 80, textAlign: 'center' }}>
              <Skeleton height={12} width={20} radius="sm" mx="auto" />
            </Table.Td>
            <Table.Td style={{ width: 160 }}>
              <Skeleton height={18} width={90} radius="sm" />
            </Table.Td>
            <Table.Td style={{ width: 100 }}>
              <Skeleton height={28} width={90} radius="sm" />
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
    </div>
  );
}

export default function RoutesPage() {
  const selectedRouterId = useClusterId();
  const { data: routes, isLoading, error, refetch } = useRoutes(selectedRouterId);

  const [search, setSearch] = useState('');
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const filteredRoutes = useMemo(() => {
    if (!routes) return [];
    const trimmed = search.trim();
    if (!trimmed) return routes;

    const query = trimmed.toLowerCase();
    const isCIDR = looksLikeCIDR(trimmed);

    return routes.filter((route) => {
      if (isCIDR && prefixOverlaps(trimmed, route.destination)) return true;

      return (
        route.destination.toLowerCase().includes(query) ||
        route.gateway.toLowerCase().includes(query) ||
        route.interface.toLowerCase().includes(query) ||
        route.routingMark.toLowerCase().includes(query)
      );
    });
  }, [routes, search]);

  const handleRowClick = (route: Route) => {
    setSelectedRoute(route);
    setDetailOpen(true);
  };

  const handleDetailClose = () => {
    setDetailOpen(false);
    setSelectedRoute(null);
  };

  const handleEdit = (route: Route) => {
    setSelectedRoute(route);
    setDetailOpen(true);
  };

  const hasRoutes = routes && routes.length > 0;

  if (isLoading) {
    return (
      <>
        <Group justify="space-between" align="flex-start" mb="lg">
          <Stack gap={4}>
            <Title order={2}>Routes</Title>
            <Text size="sm" c="dimmed">
              Static routes and routing table
            </Text>
          </Stack>
        </Group>
        <Skeleton height={36} radius="sm" mb="md" />
        <LoadingSkeleton />
      </>
    );
  }

  if (error) {
    return (
      <ErrorBanner
        message="Failed to load routes. Please try again later."
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <>
      <Group justify="space-between" align="flex-start" mb="lg">
        <Stack gap={4}>
          <Title order={2}>Routes</Title>
          <Text size="sm" c="dimmed">
            Static routes and routing table
          </Text>
        </Stack>
      </Group>

      {hasRoutes ? (
        <>
          <TextInput
            placeholder="Search by destination, gateway, or interface..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            radius="sm"
            mb="md"
          />

          <div style={tableWrapperStyle}>
          <Table withRowBorders={false} style={tableStyle}>
            <Table.Thead>
              <Table.Tr style={headerRowStyle}>
                {routeColumns.map((col) => (
                  <Table.Th
                    key={col.accessor}
                    style={{
                      width: col.width,
                      textAlign: col.align ?? 'left',
                    }}
                  >
                    <HeaderLabel>{col.header}</HeaderLabel>
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredRoutes.map((route, index) => {
                const isLast = index === filteredRoutes.length - 1;
                return (
                  <Table.Tr
                    key={route.id}
                    onClick={() => handleRowClick(route)}
                    style={{
                      cursor: 'pointer',
                      borderBottom: isLast
                        ? undefined
                        : '1px solid var(--mantine-color-gray-1)',
                      backgroundColor: !route.disabled && !route.active
                        ? 'var(--mantine-color-red-0)'
                        : undefined,
                    }}
                  >
                    {routeColumns.map((col) => (
                      <Table.Td
                        key={col.accessor}
                        style={{
                          textAlign: col.align ?? 'left',
                          opacity: route.disabled && col.accessor !== 'actions' ? 0.5 : undefined,
                        }}
                      >
                        {col.render(route, {
                          onEdit: handleEdit,
                          clusterId: selectedRouterId,
                        })}
                      </Table.Td>
                    ))}
                  </Table.Tr>
                );
              })}
              {filteredRoutes.length === 0 && search && (
                <Table.Tr>
                  <Table.Td colSpan={routeColumns.length}>
                    <Text size="sm" c="dimmed" ta="center" py="lg">
                      No routes match &ldquo;{search}&rdquo;
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
          </div>
        </>
      ) : (
        <EmptyState
          icon={IconRouteAltRight}
          title="No routes found"
          description="No routes found on this router."
        />
      )}

      <RouteDetail
        route={selectedRoute}
        isOpen={detailOpen}
        onClose={handleDetailClose}
      />
    </>
  );
}
