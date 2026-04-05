import { useState } from 'react';
import {
  Stack,
  Group,
  Text,
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
  IconLock,
} from '@tabler/icons-react';
import MonoText from '../../components/common/MonoText';
import StatusIndicator from '../../components/common/StatusIndicator';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import WireGuardInterfaceForm from './WireGuardInterfaceForm';
import { useDeleteWireGuardInterface } from './wireguardApi';
import type { WireGuardInterface as WireGuardInterfaceType } from '../../api/types';

interface WireGuardInterfaceProps {
  routerId: string;
  wgInterface: WireGuardInterfaceType | null;
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

export default function WireGuardInterface({ routerId, wgInterface }: WireGuardInterfaceProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteMutation = useDeleteWireGuardInterface(routerId);

  const handleDeleteConfirm = () => {
    deleteMutation.mutate(undefined);
    setDeleteOpen(false);
  };

  if (!wgInterface) {
    return (
      <>
        <EmptyState
          icon={IconLock}
          title="No WireGuard interface configured"
          description="Configure a WireGuard interface to enable remote access VPN for this router."
          action={
            <Button leftSection={<IconLock size={16} />} onClick={() => setFormOpen(true)}>
              Configure WireGuard
            </Button>
          }
        />
        <WireGuardInterfaceForm
          isOpen={formOpen}
          onClose={() => setFormOpen(false)}
          routerId={routerId}
        />
      </>
    );
  }

  return (
    <>
      <Stack gap="lg">
        <Box>
          <Text fw={600} size="sm" mb="sm">
            Interface Settings
          </Text>
          <Stack gap="xs">
            <DetailField label="Name">
              <MonoText>{wgInterface.name}</MonoText>
            </DetailField>
            <DetailField label="Listen Port">
              <MonoText>{wgInterface.listenPort}</MonoText>
            </DetailField>
            <DetailField label="MTU">
              <MonoText>{wgInterface.mtu}</MonoText>
            </DetailField>
            <DetailField label="Gateway Address">
              <MonoText>{wgInterface.gatewayAddress}</MonoText>
            </DetailField>
            <DetailField label="DNS">
              <Text size="sm">{wgInterface.dns || '\u2014'}</Text>
            </DetailField>
            <DetailField label="Client Allowed IPs">
              <MonoText>{wgInterface.clientAllowedIPs}</MonoText>
            </DetailField>
            <DetailField label="Public Key">
              <Group gap="xs" wrap="nowrap">
                <MonoText size="xs">{wgInterface.publicKey}</MonoText>
                <CopyButton value={wgInterface.publicKey}>
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
            <DetailField label="Status">
              {wgInterface.disabled ? (
                <StatusIndicator status="disabled" label="Disabled" />
              ) : (
                <StatusIndicator status="running" label="Active" />
              )}
            </DetailField>
          </Stack>
        </Box>

        <Divider />

        <Button.Group>
          <Button
            variant="light"
            color="gray"
            size="xs"
            leftSection={<IconPencil size={14} />}
            onClick={() => setFormOpen(true)}
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
                onClick={() => setDeleteOpen(true)}
              >
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Button.Group>
      </Stack>

      <WireGuardInterfaceForm
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        routerId={routerId}
        editInterface={wgInterface}
      />

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete WireGuard Interface"
        message={`Are you sure you want to delete the WireGuard interface '${wgInterface.name}'? All peers will also be removed. This action cannot be undone.`}
        confirmLabel="Delete"
        confirmColor="red"
      />
    </>
  );
}
