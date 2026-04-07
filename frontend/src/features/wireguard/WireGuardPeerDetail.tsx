import {
  Drawer,
  Stack,
  Group,
  Text,
  Title,
  Button,
  Menu,
  Divider,
  Box,
  CopyButton,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconPencil,
  IconChevronDown,
  IconTrash,
  IconFileText,
  IconCopy,
  IconCheck,
} from '@tabler/icons-react';
import MonoText from '../../components/common/MonoText';
import StatusIndicator from '../../components/common/StatusIndicator';
import type { WireGuardPeer } from '../../api/types';

interface WireGuardPeerDetailProps {
  peer: WireGuardPeer | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (peer: WireGuardPeer) => void;
  onDelete: (peer: WireGuardPeer) => void;
  onShowConfig: (peer: WireGuardPeer) => void;
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Group justify="space-between" wrap="nowrap" align="flex-start">
      <Text size="sm" c="dimmed" style={{ minWidth: 140 }}>
        {label}
      </Text>
      <Box>{children}</Box>
    </Group>
  );
}

function getPeerStatus(peer: WireGuardPeer): { status: 'running' | 'stopped' | 'disabled'; label: string } {
  if (peer.disabled) return { status: 'disabled', label: 'Disabled' };
  if (!peer.lastHandshake) return { status: 'stopped', label: 'Disconnected' };

  const handshakeTime = new Date(peer.lastHandshake).getTime();
  const now = Date.now();
  const threeMinutes = 3 * 60 * 1000;

  if (now - handshakeTime <= threeMinutes) {
    return { status: 'running', label: 'Connected' };
  }
  return { status: 'stopped', label: 'Disconnected' };
}

function formatRelativeTime(dateStr: string): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(1)} ${units[i]}`;
}

export default function WireGuardPeerDetail({
  peer,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onShowConfig,
}: WireGuardPeerDetailProps) {
  if (!peer) return null;

  const { status, label } = getPeerStatus(peer);
  const endpoint =
    peer.endpointAddress && peer.endpointPort
      ? `${peer.endpointAddress}:${peer.endpointPort}`
      : 'Never connected';

  return (
    <Drawer
      opened={isOpen}
      onClose={onClose}
      title={
        <Group gap="sm">
          <Title order={4}>{peer.name}</Title>
          <StatusIndicator status={status} label={label} />
        </Group>
      }
      position="right"
      size="xl"
      padding="xl"
    >
      <Stack gap="lg">
        {/* Connection */}
        <Box>
          <Text fw={600} size="sm" mb="sm">
            Connection
          </Text>
          <Stack gap="xs">
            <DetailField label="Name">
              <Text size="sm">{peer.name}</Text>
            </DetailField>
            <DetailField label="Public Key">
              <Group gap="xs" wrap="nowrap">
                <MonoText size="xs">{peer.publicKey}</MonoText>
                <CopyButton value={peer.publicKey}>
                  {({ copied, copy }) => (
                    <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow>
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color={copied ? 'teal' : 'gray'}
                        onClick={copy}
                      >
                        {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                      </ActionIcon>
                    </Tooltip>
                  )}
                </CopyButton>
              </Group>
            </DetailField>
            <DetailField label="Allowed Address">
              <MonoText>{peer.allowedAddress}</MonoText>
            </DetailField>
            <DetailField label="Preshared Key">
              <Text size="sm">{peer.presharedKey ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : 'None'}</Text>
            </DetailField>
            <DetailField label="Status">
              <StatusIndicator status={status} label={label} />
            </DetailField>
          </Stack>
        </Box>

        {/* Endpoint */}
        <Divider />
        <Box>
          <Text fw={600} size="sm" mb="sm">
            Endpoint
          </Text>
          <Stack gap="xs">
            <DetailField label="Address">
              <MonoText>{endpoint}</MonoText>
            </DetailField>
            <DetailField label="Last Handshake">
              <Text size="sm">{formatRelativeTime(peer.lastHandshake)}</Text>
            </DetailField>
            <DetailField label="Transfer RX">
              <Text size="sm">{formatBytes(peer.rx)}</Text>
            </DetailField>
            <DetailField label="Transfer TX">
              <Text size="sm">{formatBytes(peer.tx)}</Text>
            </DetailField>
          </Stack>
        </Box>

        {/* Settings */}
        <Divider />
        <Box>
          <Text fw={600} size="sm" mb="sm">
            Settings
          </Text>
          <Stack gap="xs">
            <DetailField label="Persistent Keepalive">
              <Text size="sm">
                {peer.persistentKeepalive > 0 ? `${peer.persistentKeepalive}s` : 'Disabled'}
              </Text>
            </DetailField>
            {peer.comment && (
              <DetailField label="Comment">
                <Text size="sm">{peer.comment}</Text>
              </DetailField>
            )}
          </Stack>
        </Box>

        {/* Actions */}
        <Divider />
        <Group gap="sm">
          <Button.Group>
            <Button
              variant="light"
              color="gray"
              size="xs"
              leftSection={<IconPencil size={14} />}
              onClick={(e) => {
                e.stopPropagation();
                onEdit(peer);
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
                  style={{
                    paddingLeft: 6,
                    paddingRight: 6,
                    borderLeft: '1px solid var(--mantine-color-gray-4)',
                  }}
                >
                  <IconChevronDown size={14} />
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  fz="xs"
                  color="red"
                  leftSection={<IconTrash size={14} />}
                  onClick={() => onDelete(peer)}
                >
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Button.Group>

          {peer.clientPrivateKey && (
            <Button
              variant="light"
              size="xs"
              leftSection={<IconFileText size={14} />}
              onClick={() => onShowConfig(peer)}
            >
              Show Config
            </Button>
          )}
        </Group>
      </Stack>
    </Drawer>
  );
}
