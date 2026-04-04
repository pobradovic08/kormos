import {
  Badge,
  Group,
  Text,
  Button,
  Menu,
} from '@mantine/core';
import {
  IconPencil,
  IconChevronDown,
  IconTrash,
  IconPlayerPause,
  IconPlayerPlay,
} from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import MonoText from '../../components/common/MonoText';
import type { Route } from '../../api/types';

function getRouteFlags(route: Route): string {
  let flags = '';
  if (route.disabled) flags += 'X';
  if (route.active) flags += 'A';
  if (route.routeType === 'static') flags += 'S';
  if (route.routeType === 'connected') flags += 'C';
  if (route.routeType === 'blackhole') flags += 'b';
  return flags;
}

function getFlagsBadgeColor(route: Route): string {
  if (route.disabled) return 'gray';
  if (route.active) return 'green';
  return 'red';
}

export interface RouteColumn {
  accessor: string;
  header: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  render: (
    route: Route,
    actions?: {
      onEdit: (route: Route) => void;
    },
  ) => React.ReactNode;
}

export const routeColumns: RouteColumn[] = [
  {
    accessor: 'flags',
    header: 'Flags',
    width: 70,
    align: 'center',
    render: (route) => (
      <Group justify="center">
        <Badge
          variant="light"
          color={getFlagsBadgeColor(route)}
          size="sm"
          radius="sm"
          styles={{ label: { fontFamily: 'monospace', letterSpacing: 1 } }}
        >
          {getRouteFlags(route)}
        </Badge>
      </Group>
    ),
  },
  {
    accessor: 'destination',
    header: 'Destination',
    render: (route) => (
      <div>
        <MonoText fw={500} size="xs">
          {route.destination}
        </MonoText>
        {route.comment && (
          <Text size="xs" c="dimmed" lineClamp={1}>
            {route.comment}
          </Text>
        )}
      </div>
    ),
  },
  {
    accessor: 'gateway',
    header: 'Next Hop',
    width: 280,
    render: (route) => (
      <div>
        <MonoText fw={500} size="xs">
          {route.gateway || '\u2014'}
        </MonoText>
        {route.interface && (
          <Text size="xs" c="dimmed">
            via{' '}
            <Text
              component={Link}
              to="/configure/interfaces"
              size="xs"
              fw={600}
              c="blue"
              style={{ cursor: 'pointer' }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              {route.interface}
            </Text>
          </Text>
        )}
      </div>
    ),
  },
  {
    accessor: 'distance',
    header: 'Distance',
    width: 80,
    align: 'center',
    render: (route) => (
      <MonoText size="xs" c="dimmed">
        {route.distance}
      </MonoText>
    ),
  },
  {
    accessor: 'routingMark',
    header: 'VRF',
    width: 160,
    align: 'center',
    render: (route) =>
      route.routingMark ? (
        <Badge variant="light" color="violet" size="xs" radius="sm">
          {route.routingMark}
        </Badge>
      ) : null,
  },
  {
    accessor: 'actions',
    header: 'Actions',
    width: 120,
    render: (route, actions) => {
      if (route.routeType !== 'static') return null;
      return (
        <Group gap={6} wrap="nowrap">
          <Button.Group>
            <Button
              variant="light"
              color="gray"
              size="xs"
              leftSection={<IconPencil size={14} />}
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation();
                actions?.onEdit(route);
              }}
            >
              Edit
            </Button>
            <Menu position="bottom-end">
              <Menu.Target>
                <Button
                  variant="light"
                  color="gray"
                  size="xs"
                  style={{ paddingLeft: 6, paddingRight: 6, borderLeft: '1px solid var(--mantine-color-gray-2)' }}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                  <IconChevronDown size={14} />
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  fz="xs"
                  leftSection={route.disabled ? <IconPlayerPlay size={14} /> : <IconPlayerPause size={14} />}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                  {route.disabled ? 'Enable' : 'Disable'}
                </Menu.Item>
                <Menu.Item
                  fz="xs"
                  color="red"
                  leftSection={<IconTrash size={14} />}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Button.Group>
        </Group>
      );
    },
  },
];
