import {
  Badge,
  Group,
  Text,
  Stack,
  Button,
  Tooltip,
} from '@mantine/core';
import {
  IconPencil,
  IconCircleCheck,
  IconCircleX,
  IconCircleMinus,
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

function EndpointField({ endpoints, field }: { endpoints: MergedInterfaceEndpoint[]; field: 'macAddress' }) {
  if (endpoints.length === 0) return <Text size="xs" c="dimmed">&mdash;</Text>;
  if (endpoints.length === 1) {
    return <MonoText size="xs" c="dimmed">{endpoints[0][field] || '\u2014'}</MonoText>;
  }
  return (
    <Stack gap={2}>
      {endpoints.map((ep) => (
        <Group key={ep.routerName} gap={6} wrap="nowrap">
          <Text size="xs" c="dimmed" style={{ minWidth: 0, flexShrink: 0 }}>{ep.routerName}</Text>
          <MonoText size="xs" c="dimmed">{ep[field] || '\u2014'}</MonoText>
        </Group>
      ))}
    </Stack>
  );
}

function EndpointAddresses({ endpoints }: { endpoints: MergedInterfaceEndpoint[] }) {
  const allAddrs = endpoints.flatMap((ep) =>
    ep.addresses.map((a) => ({ ...a, routerName: ep.routerName })),
  );
  if (allAddrs.length === 0) return <Text size="xs" c="dimmed">&mdash;</Text>;

  if (endpoints.length === 1) {
    return (
      <Stack gap={2}>
        {endpoints[0].addresses.map((addr) => (
          <MonoText key={addr.id} size="xs">{addr.address}</MonoText>
        ))}
      </Stack>
    );
  }

  return (
    <Stack gap={2}>
      {endpoints.map((ep) =>
        ep.addresses.map((addr) => (
          <Group key={`${ep.routerName}-${addr.id}`} gap={6} wrap="nowrap">
            <Text size="xs" c="dimmed" style={{ minWidth: 0, flexShrink: 0 }}>{ep.routerName}</Text>
            <MonoText size="xs">{addr.address}</MonoText>
          </Group>
        )),
      )}
    </Stack>
  );
}

function EndpointStatus({ endpoints, disabled }: { endpoints: MergedInterfaceEndpoint[]; disabled: boolean }) {
  if (disabled) {
    return (
      <Group justify="center">
        <Tooltip label="Disabled" fz="xs" radius="sm">
          <IconCircleMinus size={18} color="var(--mantine-color-gray-5)" />
        </Tooltip>
      </Group>
    );
  }

  if (endpoints.length === 1) {
    const running = endpoints[0].running;
    return (
      <Group justify="center">
        <Tooltip label={running ? 'Running' : 'Stopped'} fz="xs" radius="sm">
          {running
            ? <IconCircleCheck size={18} color="var(--mantine-color-green-6)" />
            : <IconCircleX size={18} color="var(--mantine-color-red-6)" />}
        </Tooltip>
      </Group>
    );
  }

  return (
    <Stack gap={2} align="center">
      {endpoints.map((ep) => (
        <Group key={ep.routerName} gap={4} wrap="nowrap">
          <Text size="xs" c="dimmed">{ep.routerName}</Text>
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
    width: 90,
    align: 'center',
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
    render: (iface) => <EndpointField endpoints={iface.endpoints} field="macAddress" />,
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
