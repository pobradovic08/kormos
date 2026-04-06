import { Table, Text, Badge, Group, Skeleton } from '@mantine/core';
import MonoText from '../../components/common/MonoText';
import StatusIndicator from '../../components/common/StatusIndicator';
import type { Tunnel, GRETunnel, IPsecTunnel } from '../../api/types';

interface TunnelTableProps {
  tunnels: Tunnel[];
  search: string;
  onRowClick: (tunnel: Tunnel) => void;
}

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

export function getStatus(tunnel: Tunnel): { status: 'running' | 'stopped' | 'disabled'; label: string } {
  if (tunnel.tunnelType === 'gre') {
    const gre = tunnel as GRETunnel;
    if (gre.disabled) return { status: 'disabled', label: 'Disabled' };
    if (gre.running) return { status: 'running', label: 'Running' };
    return { status: 'stopped', label: 'Stopped' };
  }

  const ipsec = tunnel as IPsecTunnel;
  if (ipsec.disabled) return { status: 'disabled', label: 'Disabled' };
  if (ipsec.established) return { status: 'running', label: 'Established' };
  return { status: 'stopped', label: 'Down' };
}

const columns = [
  { key: 'name', header: 'Name', width: undefined },
  { key: 'type', header: 'Type', width: 80, align: 'center' as const },
  { key: 'mode', header: 'Mode', width: 130, align: 'center' as const },
  { key: 'localAddress', header: 'Local Address', width: 250 },
  { key: 'remoteAddress', header: 'Remote Address', width: 250 },
  { key: 'status', header: 'Status', width: 120 },
];

export default function TunnelTable({ tunnels, search, onRowClick }: TunnelTableProps) {
  return (
    <div style={tableWrapperStyle}>
    <Table withRowBorders={false} style={tableStyle}>
      <Table.Thead>
        <Table.Tr style={headerRowStyle}>
          {columns.map((col) => (
            <Table.Th key={col.key} style={{ width: col.width, textAlign: (col as any).align }}>
              <HeaderLabel>{col.header}</HeaderLabel>
            </Table.Th>
          ))}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {tunnels.map((tunnel, index) => {
          const isLast = index === tunnels.length - 1;
          const tunnelStatus = getStatus(tunnel);
          const isDisabled = tunnel.disabled;

          return (
            <Table.Tr
              key={tunnel.id}
              onClick={() => onRowClick(tunnel)}
              style={{
                cursor: 'pointer',
                opacity: isDisabled ? 0.5 : undefined,
                borderBottom: isLast
                  ? undefined
                  : '1px solid var(--mantine-color-gray-1)',
              }}
            >
              <Table.Td>
                <Text fw={500} size="xs">
                  {tunnel.name}
                </Text>
              </Table.Td>
              <Table.Td style={{ width: 80, textAlign: 'center' }}>
                <Group justify="center">
                  <Badge
                    variant="light"
                    size="sm"
                    radius="sm"
                    color={tunnel.tunnelType === 'gre' ? 'blue' : 'violet'}
                  >
                    {tunnel.tunnelType === 'gre' ? 'GRE' : 'IPsec'}
                  </Badge>
                </Group>
              </Table.Td>
              <Table.Td style={{ width: 130, textAlign: 'center' }}>
                {tunnel.tunnelType === 'ipsec' ? (
                  <Group justify="center">
                    <Badge
                      variant="light"
                      size="sm"
                      radius="sm"
                      color={(tunnel as IPsecTunnel).mode === 'route-based' ? 'blue' : 'violet'}
                    >
                      {(tunnel as IPsecTunnel).mode === 'route-based' ? 'route' : 'policy'}
                    </Badge>
                  </Group>
                ) : (tunnel as GRETunnel).ipsecSecret ? (
                  <Group justify="center">
                    <Badge variant="light" size="sm" radius="sm" color="green">
                      encrypted
                    </Badge>
                  </Group>
                ) : (
                  <Group justify="center">
                    <Badge variant="light" size="sm" radius="sm" color="gray">
                      unencrypted
                    </Badge>
                  </Group>
                )}
              </Table.Td>
              <Table.Td>
                <MonoText size="xs">{tunnel.localAddress}</MonoText>
              </Table.Td>
              <Table.Td>
                <MonoText size="xs">
                  {tunnel.remoteAddress || '\u2014'}
                </MonoText>
              </Table.Td>
              <Table.Td style={{ width: 100 }}>
                <StatusIndicator status={tunnelStatus.status} label={tunnelStatus.label} />
              </Table.Td>
            </Table.Tr>
          );
        })}
        {tunnels.length === 0 && search && (
          <Table.Tr>
            <Table.Td colSpan={columns.length}>
              <Text size="sm" c="dimmed" ta="center" py="lg">
                No tunnels match &ldquo;{search}&rdquo;
              </Text>
            </Table.Td>
          </Table.Tr>
        )}
      </Table.Tbody>
    </Table>
    </div>
  );
}

export function TunnelTableSkeleton() {
  return (
    <div style={tableWrapperStyle}>
    <Table withRowBorders={false} style={tableStyle}>
      <Table.Thead>
        <Table.Tr style={headerRowStyle}>
          {columns.map((col) => (
            <Table.Th key={col.key} style={{ width: col.width, textAlign: (col as any).align }}>
              <HeaderLabel>{col.header}</HeaderLabel>
            </Table.Th>
          ))}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {Array.from({ length: 4 }).map((_, i) => (
          <Table.Tr
            key={i}
            style={{
              borderBottom: '1px solid var(--mantine-color-gray-1)',
            }}
          >
            <Table.Td>
              <Skeleton height={14} width={140} radius="sm" />
            </Table.Td>
            <Table.Td style={{ width: 80 }}>
              <Skeleton height={18} width={50} radius="sm" />
            </Table.Td>
            <Table.Td style={{ width: 100 }}>
              <Skeleton height={18} width={70} radius="sm" />
            </Table.Td>
            <Table.Td>
              <Skeleton height={14} width={110} radius="sm" />
            </Table.Td>
            <Table.Td>
              <Skeleton height={14} width={110} radius="sm" />
            </Table.Td>
            <Table.Td style={{ width: 100 }}>
              <Skeleton height={18} width={80} radius="sm" />
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
    </div>
  );
}
