import {
  Drawer,
  Title,
  Group,
  Stack,
  Text,
  Button,
  Divider,
  Box,
  Loader,
} from '@mantine/core';
import {
  IconPencil,
  IconTrash,
  IconRefresh,
  IconWifiOff,
  IconCpu,
  IconDatabase,
} from '@tabler/icons-react';
import { useRouterStatus, useRouters } from './routersApi';
import StatusIndicator from '../../components/common/StatusIndicator';
import MonoText from '../../components/common/MonoText';
import GaugeIndicator from '../../components/common/GaugeIndicator';
import { relativeTime } from '../../utils/relativeTime';
import type { Router } from '../../api/types';

interface RouterDetailProps {
  routerId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (router: Router) => void;
  onDelete: (router: Router) => void;
}

function formatBytes(bytes: number): string {
  const mb = Math.round(bytes / (1024 * 1024));
  return `${mb} MB`;
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Group justify="space-between" wrap="nowrap">
      <Text size="sm" c="dimmed" style={{ minWidth: 120 }}>
        {label}
      </Text>
      <Box>{children}</Box>
    </Group>
  );
}

export default function RouterDetail({
  routerId,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}: RouterDetailProps) {
  const { data: routers } = useRouters();
  const {
    data: status,
    isLoading: statusLoading,
    refetch: refetchStatus,
    isFetching: statusFetching,
  } = useRouterStatus(routerId ?? '');

  const router = routers?.find((r) => r.id === routerId) ?? null;

  if (!router) {
    return (
      <Drawer
        opened={isOpen}
        onClose={onClose}
        position="right"
        size="lg"
        title="Router Details"
      >
        <Text c="dimmed">Router not found.</Text>
      </Drawer>
    );
  }

  const isOnline = status?.is_reachable ?? router.is_reachable;
  const memoryUsedMB =
    status?.total_memory && status?.free_memory
      ? formatBytes(status.total_memory - status.free_memory)
      : null;
  const memoryTotalMB = status?.total_memory
    ? formatBytes(status.total_memory)
    : null;
  const memoryPercent =
    status?.total_memory && status?.free_memory
      ? Math.round(
          ((status.total_memory - status.free_memory) / status.total_memory) *
            100,
        )
      : null;

  return (
    <Drawer
      opened={isOpen}
      onClose={onClose}
      position="right"
      size="lg"
      padding="xl"
      title={
        <Group gap="sm">
          <Title order={4}>{router.name}</Title>
          <StatusIndicator
            status={isOnline ? 'running' : 'stopped'}
            label={isOnline ? 'Online' : 'Offline'}
          />
        </Group>
      }
    >
      <Stack gap="lg">
        {/* Section 1: Connection Details */}
        <Box>
          <Text fw={600} size="sm" mb="sm">
            Connection Details
          </Text>
          <Stack gap="xs">
            <DetailField label="Hostname">
              <MonoText>{router.hostname || '-'}</MonoText>
            </DetailField>
            <DetailField label="Address">
              <MonoText>
                {router.host}:{router.port}
              </MonoText>
            </DetailField>
            <DetailField label="Status">
              <StatusIndicator
                status={isOnline ? 'running' : 'stopped'}
                label={isOnline ? 'Online' : 'Offline'}
              />
            </DetailField>
            <DetailField label="Last Seen">
              <Text size="sm" c="dimmed">
                {relativeTime(router.last_seen)}
              </Text>
            </DetailField>
            <DetailField label="Registered">
              <Text size="sm" c="dimmed">
                {relativeTime(router.created_at)}
              </Text>
            </DetailField>
          </Stack>
          <Button
            variant="outline"
            size="xs"
            mt="sm"
            leftSection={
              statusFetching ? (
                <Loader size={14} />
              ) : (
                <IconRefresh size={14} />
              )
            }
            onClick={() => void refetchStatus()}
            loading={statusFetching}
          >
            Check Status
          </Button>
        </Box>

        <Divider />

        {/* Section 2: System Information */}
        <Box>
          <Text fw={600} size="sm" mb="sm">
            System Information
          </Text>
          {statusLoading ? (
            <Stack gap="xs">
              <Loader size="sm" />
            </Stack>
          ) : isOnline && status ? (
            <Stack gap="xs">
              <DetailField label="RouterOS Version">
                <Text size="sm">{status.routeros_version ?? '-'}</Text>
              </DetailField>
              <DetailField label="Board">
                <Text size="sm">{status.board_name ?? '-'}</Text>
              </DetailField>
              <DetailField label="Uptime">
                <Text size="sm">{status.uptime ?? '-'}</Text>
              </DetailField>
              <Box>
                <GaugeIndicator
                  value={status.cpu_load ?? 0}
                  label="CPU"
                  icon={<IconCpu size={16} color="var(--mantine-color-dimmed)" />}
                />
              </Box>
              <Box>
                {memoryPercent !== null && memoryUsedMB && memoryTotalMB ? (
                  <GaugeIndicator
                    value={memoryPercent}
                    label={`Memory (${memoryUsedMB} / ${memoryTotalMB})`}
                    icon={<IconDatabase size={16} color="var(--mantine-color-dimmed)" />}
                  />
                ) : (
                  <GaugeIndicator value={0} label="Memory" icon={<IconDatabase size={16} color="var(--mantine-color-dimmed)" />} />
                )}
              </Box>
            </Stack>
          ) : (
            <Group gap="xs" c="dimmed">
              <IconWifiOff size={16} />
              <Text size="sm" c="dimmed">
                System information unavailable — router is not reachable
              </Text>
            </Group>
          )}
        </Box>

        <Divider />

        {/* Action buttons */}
        <Group>
          <Button
            variant="default"
            leftSection={<IconPencil size={16} />}
            onClick={() => onEdit(router)}
          >
            Edit
          </Button>
          <Button
            variant="subtle"
            color="red"
            leftSection={<IconTrash size={16} />}
            onClick={() => onDelete(router)}
          >
            Delete
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
