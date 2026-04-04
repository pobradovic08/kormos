import {
  Badge,
  Group,
  Box,
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
  vrrp: 'red',
};

export interface InterfaceColumn {
  accessor: string;
  header: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  render: (
    iface: RouterInterface,
    actions?: {
      onEdit: (iface: RouterInterface) => void;
    },
  ) => React.ReactNode;
}

export const interfaceColumns: InterfaceColumn[] = [
  {
    accessor: 'name',
    header: 'Interface',
    render: (iface) => {
      const dotColor = typeBadgeColors[iface.type] ?? 'gray';
      return (
        <Group gap={8} wrap="nowrap" align="flex-start">
          <Box
            w={7}
            h={7}
            mt={6}
            style={{ borderRadius: '50%', flexShrink: 0 }}
            bg={`${dotColor}.5`}
          />
          <div>
            <Group gap={6} wrap="nowrap">
              <Text fw={500} size="sm">
                {iface.name}
              </Text>
              <Badge
                color={dotColor}
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
        </Group>
      );
    },
  },
  {
    accessor: 'addresses',
    header: 'IP Addresses',
    width: 180,
    render: (iface) =>
      iface.addresses.length > 0 ? (
        <Stack gap={2}>
          {iface.addresses.map((addr) => (
            <MonoText key={addr.id} size="xs">
              {addr.address}
            </MonoText>
          ))}
        </Stack>
      ) : (
        <Text size="xs" c="dimmed">
          &mdash;
        </Text>
      ),
  },
  {
    accessor: 'status',
    header: 'Status',
    width: 90,
    align: 'center',
    render: (iface) => {
      if (iface.disabled) {
        return (
          <Group justify="center">
            <Tooltip label="Disabled" fz="xs" radius="sm">
              <IconCircleMinus size={18} color="var(--mantine-color-gray-5)" />
            </Tooltip>
          </Group>
        );
      }
      if (iface.running) {
        return (
          <Group justify="center">
            <Tooltip label="Running" fz="xs" radius="sm">
              <IconCircleCheck size={18} color="var(--mantine-color-green-6)" />
            </Tooltip>
          </Group>
        );
      }
      return (
        <Group justify="center">
          <Tooltip label="Stopped" fz="xs" radius="sm">
            <IconCircleX size={18} color="var(--mantine-color-red-6)" />
          </Tooltip>
        </Group>
      );
    },
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
    width: 160,
    render: (iface) => (
      <MonoText size="xs" c="dimmed">
        {iface.mac_address || '\u2014'}
      </MonoText>
    ),
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
