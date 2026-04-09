import {
  Drawer,
  Stack,
  Group,
  Text,
  Title,
  Badge,
  Button,
  Divider,
  Box,
  Alert,
} from '@mantine/core';
import { IconPencil, IconLock } from '@tabler/icons-react';
import MonoText from '../../components/common/MonoText';
import StatusIndicator from '../../components/common/StatusIndicator';
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

const routeTypeBadgeColors: Record<string, string> = {
  static: 'blue',
  connected: 'teal',
  blackhole: 'red',
};

interface RouteDetailProps {
  route: Route | null;
  isOpen: boolean;
  onClose: () => void;
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Group justify="space-between" wrap="nowrap" align="flex-start">
      <Text size="sm" c="dimmed" style={{ minWidth: 120 }}>
        {label}
      </Text>
      <Box>{children}</Box>
    </Group>
  );
}

function getStatus(route: Route): {
  status: 'running' | 'stopped' | 'disabled';
  label: string;
} {
  if (route.disabled) return { status: 'disabled', label: 'Disabled' };
  if (route.active) return { status: 'running', label: 'Active' };
  return { status: 'stopped', label: 'Inactive' };
}

export default function RouteDetail({
  route,
  isOpen,
  onClose,
}: RouteDetailProps) {
  if (!route) return null;

  const { status, label } = getStatus(route);

  return (
    <Drawer
      opened={isOpen}
      onClose={onClose}
      title={
        <Group gap="sm">
          <Title order={4}>
            <MonoText>{route.destination}</MonoText>
          </Title>
          <StatusIndicator status={status} label={label} />
        </Group>
      }
      position="right"
      size="lg"
      padding="xl"
    >
      <Stack gap="lg">
        {/* Section 1: Route Details */}
        <Box>
          <Text fw={600} size="sm" mb="sm">
            Route Details
          </Text>
          <Stack gap="xs">
            <DetailField label="Flags">
              <Badge
                variant="light"
                color={getFlagsBadgeColor(route)}
                size="sm"
                radius="sm"
                styles={{ label: { fontFamily: 'monospace', letterSpacing: 1 } }}
              >
                {getRouteFlags(route)}
              </Badge>
            </DetailField>
            <DetailField label="Destination">
              <MonoText>{route.destination}</MonoText>
            </DetailField>
            <DetailField label="Gateway">
              <MonoText>{route.gateway || '\u2014'}</MonoText>
            </DetailField>
            <DetailField label="Interface">
              <MonoText>{route.interface}</MonoText>
            </DetailField>
            <DetailField label="Distance">
              <MonoText>{route.distance}</MonoText>
            </DetailField>
            <DetailField label="VRF">
              {route.routingMark ? (
                <Badge variant="light" size="sm" radius="sm" color="violet">
                  {route.routingMark}
                </Badge>
              ) : (
                <Text size="sm" c="dimmed">main</Text>
              )}
            </DetailField>
            <DetailField label="Type">
              <Badge
                variant="light"
                size="sm"
                radius="sm"
                color={routeTypeBadgeColors[route.routeType] ?? 'gray'}
              >
                {route.routeType}
              </Badge>
            </DetailField>
            <DetailField label="Status">
              <StatusIndicator status={status} label={label} />
            </DetailField>
            {route.comment && (
              <DetailField label="Comment">
                <Text size="sm">{route.comment}</Text>
              </DetailField>
            )}
          </Stack>
        </Box>

        <Divider />

        {/* Action buttons */}
        {route.comment?.startsWith('ipsec:') ? (
          <Alert variant="light" color="gray" radius="sm" icon={<IconLock size={16} />}>
            <Text size="sm">Managed by IPsec tunnel <strong>{route.comment.slice(6)}</strong>. Edit through the tunnel configuration.</Text>
          </Alert>
        ) : (
          <Group>
            <Button
              variant="default"
              leftSection={<IconPencil size={16} />}
              onClick={onClose}
            >
              Edit
            </Button>
          </Group>
        )}
      </Stack>
    </Drawer>
  );
}
