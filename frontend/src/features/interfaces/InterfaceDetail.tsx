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
} from '@mantine/core';
import { IconPencil } from '@tabler/icons-react';
import MonoText from '../../components/common/MonoText';
import StatusIndicator from '../../components/common/StatusIndicator';
import type { MergedInterface } from '../../api/types';
import { typeBadgeColors } from './interfaceColumns';

interface InterfaceDetailProps {
  iface: MergedInterface | null;
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

function getOverallStatus(iface: MergedInterface): {
  status: 'running' | 'stopped' | 'disabled';
  label: string;
} {
  if (iface.disabled) return { status: 'disabled', label: 'Disabled' };
  if (iface.endpoints.some((ep) => ep.running)) return { status: 'running', label: 'Running' };
  return { status: 'stopped', label: 'Stopped' };
}

export default function InterfaceDetail({
  iface,
  isOpen,
  onClose,
}: InterfaceDetailProps) {
  if (!iface) return null;

  const { status, label } = getOverallStatus(iface);

  return (
    <Drawer
      opened={isOpen}
      onClose={onClose}
      title={
        <Group gap="sm">
          <Title order={4}>{iface.name}</Title>
          <StatusIndicator status={status} label={label} />
        </Group>
      }
      position="right"
      size="lg"
      padding="xl"
    >
      <Stack gap="lg">
        {/* Section 1: Interface Details */}
        <Box>
          <Text fw={600} size="sm" mb="sm">
            Interface Details
          </Text>
          <Stack gap="xs">
            <DetailField label="Name">
              <MonoText>{iface.name}</MonoText>
            </DetailField>
            {iface.defaultName && iface.defaultName !== iface.name && (
              <DetailField label="Original Name">
                <MonoText c="dimmed">{iface.defaultName}</MonoText>
              </DetailField>
            )}
            <DetailField label="Type">
              <Badge
                variant="light"
                size="sm"
                radius="sm"
                color={typeBadgeColors[iface.type] ?? 'gray'}
              >
                {iface.type}
              </Badge>
            </DetailField>
            <DetailField label="MTU">
              <MonoText>{iface.mtu}</MonoText>
            </DetailField>
            {iface.comment && (
              <DetailField label="Comment">
                <Text size="sm">{iface.comment}</Text>
              </DetailField>
            )}
          </Stack>
        </Box>

        <Divider />

        {/* Section 2: Per-router endpoints */}
        <Box>
          <Text fw={600} size="sm" mb="sm">
            Router Endpoints
          </Text>
          <Stack gap="md">
            {iface.endpoints.map((ep) => {
              const epStatus = iface.disabled
                ? 'disabled'
                : ep.running
                  ? 'running'
                  : 'stopped';
              const epLabel = iface.disabled
                ? 'Disabled'
                : ep.running
                  ? 'Running'
                  : 'Stopped';
              return (
                <Box key={ep.routerName}>
                  <Group gap="xs" mb={4}>
                    <Text size="xs" fw={500}>{ep.routerName}</Text>
                    <Badge variant="light" size="xs" radius="sm" color={ep.role === 'master' ? 'blue' : 'orange'}>
                      {ep.role}
                    </Badge>
                    <StatusIndicator status={epStatus} label={epLabel} />
                  </Group>
                  <Stack gap={2} ml="sm">
                    <Group gap="xs">
                      <Text size="xs" c="dimmed" style={{ minWidth: 100 }}>MAC Address</Text>
                      <MonoText size="xs">{ep.macAddress || '\u2014'}</MonoText>
                    </Group>
                    {ep.addresses.length > 0 ? (
                      ep.addresses.map((addr) => (
                        <Group key={addr.id} gap="xs">
                          <Text size="xs" c="dimmed" style={{ minWidth: 100 }}>IP Address</Text>
                          <MonoText size="xs">{addr.address}</MonoText>
                          <Text size="xs" c="dimmed">({addr.network})</Text>
                        </Group>
                      ))
                    ) : (
                      <Group gap="xs">
                        <Text size="xs" c="dimmed" style={{ minWidth: 100 }}>IP Address</Text>
                        <Text size="xs" c="dimmed">&mdash;</Text>
                      </Group>
                    )}
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        </Box>

        <Divider />

        {/* Action buttons */}
        <Group>
          <Button
            variant="default"
            leftSection={<IconPencil size={16} />}
            onClick={onClose}
          >
            Edit
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
