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
  IconNetwork,
} from '@tabler/icons-react';
import { useClusterId } from '../../hooks/useClusterId';
import { useInterfaces } from './interfacesApi';
import { interfaceColumns } from './interfaceColumns';
import InterfaceDetail from './InterfaceDetail';
import EmptyState from '../../components/common/EmptyState';
import ErrorBanner from '../../components/common/ErrorBanner';
import type { RouterInterface } from '../../api/types';

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
          {interfaceColumns.map((col) => (
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
            <Table.Td>
              <Group gap={8} wrap="nowrap">
                <Skeleton height={7} width={7} circle />
                <Stack gap={4}>
                  <Skeleton height={14} width={100} radius="sm" />
                  <Skeleton height={10} width={70} radius="sm" />
                </Stack>
              </Group>
            </Table.Td>
            <Table.Td style={{ width: 180 }}>
              <Stack gap={2}>
                <Skeleton height={12} width={120} radius="sm" />
              </Stack>
            </Table.Td>
            <Table.Td style={{ width: 90, textAlign: 'center' }}>
              <Skeleton height={18} width={18} circle mx="auto" />
            </Table.Td>
            <Table.Td style={{ width: 80, textAlign: 'center' }}>
              <Skeleton height={12} width={40} radius="sm" mx="auto" />
            </Table.Td>
            <Table.Td style={{ width: 160 }}>
              <Skeleton height={12} width={130} radius="sm" />
            </Table.Td>
            <Table.Td style={{ width: 120 }}>
              <Skeleton height={28} width={90} radius="sm" />
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
    </div>
  );
}

export default function InterfacesPage() {
  const selectedRouterId = useClusterId();
  const { data: interfaces, isLoading, error, refetch } = useInterfaces(selectedRouterId);

  const [search, setSearch] = useState('');
  const [selectedInterface, setSelectedInterface] =
    useState<RouterInterface | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

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

  const hasInterfaces = interfaces && interfaces.length > 0;

  if (isLoading) {
    return (
      <>
        <Group justify="space-between" align="flex-start" mb="lg">
          <Stack gap={4}>
            <Title order={2}>Interfaces</Title>
            <Text size="sm" c="dimmed">
              Network interfaces and addressing
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
        message="Failed to load interfaces. Please try again later."
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <>
      <Group justify="space-between" align="flex-start" mb="lg">
        <Stack gap={4}>
          <Title order={2}>Interfaces</Title>
          <Text size="sm" c="dimmed">
            Network interfaces and addressing
          </Text>
        </Stack>
      </Group>

      {hasInterfaces ? (
        <>
          <TextInput
            placeholder="Search by name, type, or IP address..."
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
                {interfaceColumns.map((col) => (
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
              {filteredInterfaces.map((iface, index) => {
                const isLast = index === filteredInterfaces.length - 1;
                return (
                  <Table.Tr
                    key={iface.id}
                    onClick={() => handleRowClick(iface)}
                    style={{
                      cursor: 'pointer',
                      borderBottom: isLast
                        ? undefined
                        : '1px solid var(--mantine-color-gray-1)',
                    }}
                  >
                    {interfaceColumns.map((col) => (
                      <Table.Td
                        key={col.accessor}
                        style={{ textAlign: col.align ?? 'left' }}
                      >
                        {col.render(iface, {
                          onEdit: handleEdit,
                        })}
                      </Table.Td>
                    ))}
                  </Table.Tr>
                );
              })}
              {filteredInterfaces.length === 0 && search && (
                <Table.Tr>
                  <Table.Td colSpan={interfaceColumns.length}>
                    <Text size="sm" c="dimmed" ta="center" py="lg">
                      No interfaces match &ldquo;{search}&rdquo;
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
          icon={IconNetwork}
          title="No interfaces found"
          description="No interfaces found on this router."
        />
      )}

      <InterfaceDetail
        iface={selectedInterface}
        isOpen={detailOpen}
        onClose={handleDetailClose}
      />

    </>
  );
}
