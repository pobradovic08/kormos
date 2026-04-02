import { Badge, Group, ActionIcon, Stack, Tooltip } from '@mantine/core';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import MonoText from '../../components/common/MonoText';
import StatusIndicator from '../../components/common/StatusIndicator';
import type { RouterInterface } from '../../api/types';

const typeBadgeColors: Record<string, string> = {
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
};

function getStatusInfo(iface: RouterInterface): {
  status: 'running' | 'stopped' | 'disabled';
  label: string;
} {
  if (iface.disabled) return { status: 'disabled', label: 'Disabled' };
  if (iface.running) return { status: 'running', label: 'Running' };
  return { status: 'stopped', label: 'Stopped' };
}

export interface InterfaceColumn {
  accessor: string;
  header: string;
  render: (
    iface: RouterInterface,
    actions?: {
      onEdit: (iface: RouterInterface) => void;
      onDelete: (iface: RouterInterface) => void;
    },
  ) => React.ReactNode;
}

export const interfaceColumns: InterfaceColumn[] = [
  {
    accessor: 'name',
    header: 'Name',
    render: (iface) => <MonoText>{iface.name}</MonoText>,
  },
  {
    accessor: 'type',
    header: 'Type',
    render: (iface) => (
      <Badge
        color={typeBadgeColors[iface.type] ?? 'gray'}
        variant="light"
        size="sm"
      >
        {iface.type}
      </Badge>
    ),
  },
  {
    accessor: 'addresses',
    header: 'IP Addresses',
    render: (iface) =>
      iface.addresses.length > 0 ? (
        <Stack gap={2}>
          {iface.addresses.map((addr) => (
            <MonoText key={addr.id}>{addr.address}</MonoText>
          ))}
        </Stack>
      ) : (
        <MonoText>-</MonoText>
      ),
  },
  {
    accessor: 'status',
    header: 'Status',
    render: (iface) => {
      const { status, label } = getStatusInfo(iface);
      return <StatusIndicator status={status} label={label} />;
    },
  },
  {
    accessor: 'comment',
    header: 'Comment',
    render: (iface) => iface.comment || '-',
  },
  {
    accessor: 'mtu',
    header: 'MTU',
    render: (iface) => <MonoText>{iface.mtu}</MonoText>,
  },
  {
    accessor: 'mac_address',
    header: 'MAC',
    render: (iface) => (
      <MonoText>{iface.mac_address || '-'}</MonoText>
    ),
  },
  {
    accessor: 'actions',
    header: 'Actions',
    render: (iface, actions) => (
      <Group gap="xs">
        <Tooltip label="Edit">
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              actions?.onEdit(iface);
            }}
            size="sm"
            aria-label={`Edit interface ${iface.name}`}
          >
            <IconEdit size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Delete">
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation();
              actions?.onDelete(iface);
            }}
            size="sm"
            aria-label={`Delete interface ${iface.name}`}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
    ),
  },
];
