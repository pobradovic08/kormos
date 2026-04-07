import {
  Drawer,
  Stack,
  Group,
  Text,
  Title,
  Box,
  Button,
  Menu,
  Divider,
  CopyButton,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconPencil,
  IconChevronDown,
  IconTrash,
  IconCopy,
  IconCheck,
} from '@tabler/icons-react';
import MonoText from '../../components/common/MonoText';
import StatusIndicator from '../../components/common/StatusIndicator';
import type { WireGuardInterface } from '../../api/types';

interface Props {
  iface: WireGuardInterface | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (iface: WireGuardInterface) => void;
  onDelete: (iface: WireGuardInterface) => void;
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Group justify="space-between" wrap="nowrap" align="flex-start">
      <Text size="sm" c="dimmed" style={{ minWidth: 140 }}>{label}</Text>
      <Box>{children}</Box>
    </Group>
  );
}

export default function WireGuardInterfaceDetail({ iface, isOpen, onClose, onEdit, onDelete }: Props) {
  if (!iface) return null;

  return (
    <Drawer
      opened={isOpen}
      onClose={onClose}
      title={
        <Group gap="sm">
          <Title order={4}>{iface.name}</Title>
          {iface.disabled ? (
            <StatusIndicator status="disabled" label="Disabled" />
          ) : (
            <StatusIndicator status="running" label="Active" />
          )}
        </Group>
      }
      position="right"
      size="xl"
      padding="xl"
    >
      <Stack gap="lg">
        <Box>
          <Text fw={600} size="sm" mb="sm">Interface Settings</Text>
          <Stack gap="xs">
            <DetailField label="Name"><MonoText>{iface.name}</MonoText></DetailField>
            <DetailField label="Listen Port"><MonoText>{iface.listenPort}</MonoText></DetailField>
            <DetailField label="MTU"><MonoText>{iface.mtu}</MonoText></DetailField>
            <DetailField label="Gateway Address"><MonoText>{iface.gatewayAddress}</MonoText></DetailField>
          </Stack>
        </Box>

        <Divider />

        <Box>
          <Text fw={600} size="sm" mb="sm">Client Configuration</Text>
          <Stack gap="xs">
            <DetailField label="DNS"><Text size="sm">{iface.dns || '\u2014'}</Text></DetailField>
            <DetailField label="Client Allowed IPs"><MonoText>{iface.clientAllowedIPs}</MonoText></DetailField>
          </Stack>
        </Box>

        <Divider />

        <Box>
          <Text fw={600} size="sm" mb="sm">Public Key</Text>
          <Group gap="xs" wrap="nowrap">
            <MonoText size="xs" style={{ wordBreak: 'break-all' }}>{iface.publicKey}</MonoText>
            <CopyButton value={iface.publicKey}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow>
                  <ActionIcon size="sm" variant="subtle" color={copied ? 'teal' : 'gray'} onClick={copy}>
                    {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          </Group>
        </Box>

        <Divider />

        <Group>
          <Button.Group>
            <Button variant="light" color="gray" size="xs" leftSection={<IconPencil size={14} />}
              onClick={() => onEdit(iface)}>
              Edit
            </Button>
            <Menu position="bottom-end">
              <Menu.Target>
                <Button variant="light" color="gray" size="xs"
                  style={{ paddingLeft: 6, paddingRight: 6, borderLeft: '1px solid var(--mantine-color-gray-4)' }}>
                  <IconChevronDown size={14} />
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item fz="xs" color="red" leftSection={<IconTrash size={14} />}
                  onClick={() => onDelete(iface)}>
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Button.Group>
        </Group>
      </Stack>
    </Drawer>
  );
}
