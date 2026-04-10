import {
  Badge,
  Group,
  Text,
  Stack,
  Button,
  Tooltip,
  Box,
} from '@mantine/core';
import {
  IconPencil,
  IconCircleCheck,
  IconCircleX,
  IconCircleMinus,
  IconPointFilled,
} from '@tabler/icons-react';
import MonoText from '../../components/common/MonoText';
import type { MergedInterface, MergedInterfaceEndpoint } from '../../api/types';

export const typeBadgeColors: Record<string, string> = {
  ether: 'blue',
  vlan: 'violet',
  bridge: 'teal',
  bonding: 'orange',
  wireguard: 'green',
  gre: 'cyan',
  ovpn: 'grape',
  pppoe: 'pink',
  l2tp: 'yellow',
  loopback: 'gray',
  vrrp: 'red',
};

const roleDotColor = (role: string) =>
  role === 'master' ? 'var(--mantine-color-blue-5)' : 'var(--mantine-color-orange-5)';

export interface InterfaceColumn {
  accessor: string;
  header: string;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  adminOnly?: boolean;
  render: (
    iface: MergedInterface,
    actions?: {
      onEdit: (iface: MergedInterface) => void;
    },
  ) => React.ReactNode;
}

// Dot + value per endpoint, stacked. Single endpoint = no dot.
function DottedPerEndpoint({ endpoints, getValue }: {
  endpoints: MergedInterfaceEndpoint[];
  getValue: (ep: MergedInterfaceEndpoint) => string;
}) {
  if (endpoints.length <= 1) {
    const val = endpoints[0] ? getValue(endpoints[0]) : '';
    return <MonoText size="xs" c="dimmed">{val || '\u2014'}</MonoText>;
  }
  return (
    <Stack gap={2}>
      {endpoints.map((ep) => (
        <Group key={ep.routerName} gap={4} wrap="nowrap">
          <IconPointFilled size={14} color={roleDotColor(ep.role)} style={{ flexShrink: 0 }} />
          <MonoText size="xs" c="dimmed">{getValue(ep) || '\u2014'}</MonoText>
        </Group>
      ))}
    </Stack>
  );
}

function EndpointAddresses({ endpoints }: { endpoints: MergedInterfaceEndpoint[] }) {
  const hasAny = endpoints.some((ep) => ep.addresses.length > 0);
  if (!hasAny) return <Text size="xs" c="dimmed">&mdash;</Text>;

  if (endpoints.length <= 1) {
    return (
      <Stack gap={2}>
        {(endpoints[0]?.addresses ?? []).map((addr) => (
          <MonoText key={addr.id} size="xs">{addr.address}</MonoText>
        ))}
      </Stack>
    );
  }

  return (
    <Stack gap={2}>
      {endpoints.map((ep) => (
        <Group key={ep.routerName} gap={4} wrap="nowrap">
          <IconPointFilled size={14} color={roleDotColor(ep.role)} style={{ flexShrink: 0 }} />
          <MonoText size="xs">
            {ep.addresses.map((a) => a.address).join(', ') || '\u2014'}
          </MonoText>
        </Group>
      ))}
    </Stack>
  );
}

function EndpointStatus({ endpoints, disabled }: { endpoints: MergedInterfaceEndpoint[]; disabled: boolean }) {
  if (disabled) {
    return (
      <Box ta="center">
        <Tooltip label="Disabled" fz="xs" radius="sm">
          <IconCircleMinus size={18} color="var(--mantine-color-gray-5)" />
        </Tooltip>
      </Box>
    );
  }

  if (endpoints.length <= 1) {
    const running = endpoints[0]?.running ?? false;
    return (
      <Box ta="center">
        <Tooltip label={running ? 'Running' : 'Stopped'} fz="xs" radius="sm">
          {running
            ? <IconCircleCheck size={18} color="var(--mantine-color-green-6)" />
            : <IconCircleX size={18} color="var(--mantine-color-red-6)" />}
        </Tooltip>
      </Box>
    );
  }

  // Multi-router: router name + badge + status icon per line.
  return (
    <Stack gap={2}>
      {endpoints.map((ep) => (
        <Group key={ep.routerName} gap={4} wrap="nowrap">
          <Text size="xs" c="dimmed">{ep.routerName}</Text>
          <Badge variant="light" size="xs" radius="sm"
            color={ep.role === 'master' ? 'blue' : 'orange'}>
            {ep.role}
          </Badge>
          <Tooltip label={ep.running ? 'Running' : 'Stopped'} fz="xs" radius="sm">
            {ep.running
              ? <IconCircleCheck size={14} color="var(--mantine-color-green-6)" />
              : <IconCircleX size={14} color="var(--mantine-color-red-6)" />}
          </Tooltip>
        </Group>
      ))}
    </Stack>
  );
}

export const interfaceColumns: InterfaceColumn[] = [
  {
    accessor: 'name',
    header: 'Interface',
    render: (iface) => {
      const badgeColor = typeBadgeColors[iface.type] ?? 'gray';
      return (
        <div>
          <Group gap={6} wrap="nowrap">
            <Text fw={500} size="sm">
              {iface.name}
            </Text>
            <Badge
              color={badgeColor}
              variant="light"
              size="xs"
              radius="sm"
            >
              {iface.type}
            </Badge>
          </Group>
          {iface.comment && (
            <Text size="xs" c="dimmed" lineClamp={1}>
              {iface.comment}
            </Text>
          )}
        </div>
      );
    },
  },
  {
    accessor: 'default_name',
    header: 'Original Name',
    width: '20%',
    adminOnly: true,
    render: (iface) => (
      <MonoText size="xs" c="dimmed">
        {iface.defaultName || iface.name}
      </MonoText>
    ),
  },
  {
    accessor: 'addresses',
    header: 'IP Addresses',
    width: 220,
    render: (iface) => <EndpointAddresses endpoints={iface.endpoints} />,
  },
  {
    accessor: 'status',
    header: 'Status',
    width: 180,
    render: (iface) => <EndpointStatus endpoints={iface.endpoints} disabled={iface.disabled} />,
  },
  {
    accessor: 'mtu',
    header: 'MTU',
    width: 80,
    align: 'center',
    render: (iface) => (
      <MonoText size="xs" c="dimmed">
        {iface.mtu}
      </MonoText>
    ),
  },
  {
    accessor: 'mac_address',
    header: 'MAC Address',
    width: 200,
    render: (iface) => <DottedPerEndpoint endpoints={iface.endpoints} getValue={(ep) => ep.macAddress} />,
  },
  {
    accessor: 'actions',
    header: 'Actions',
    width: 100,
    render: (iface, actions) => (
      <Button
        variant="light"
        color="gray"
        size="xs"
        leftSection={<IconPencil size={14} />}
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          actions?.onEdit(iface);
        }}
      >
        Edit
      </Button>
    ),
  },
];
