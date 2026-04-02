import { useState } from 'react';
import {
  Drawer,
  Stack,
  Group,
  Text,
  Badge,
  Button,
  Divider,
} from '@mantine/core';
import { IconEdit } from '@tabler/icons-react';
import MonoText from '../../components/common/MonoText';
import StatusIndicator from '../../components/common/StatusIndicator';
import InterfaceForm from './InterfaceForm';
import type { RouterInterface } from '../../api/types';

interface InterfaceDetailProps {
  iface: RouterInterface | null;
  isOpen: boolean;
  onClose: () => void;
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Group justify="space-between" wrap="nowrap" align="flex-start">
      <Text size="sm" c="dimmed" style={{ minWidth: 120 }}>
        {label}
      </Text>
      <div style={{ textAlign: 'right' }}>{children}</div>
    </Group>
  );
}

function getStatus(iface: RouterInterface): {
  status: 'running' | 'stopped' | 'disabled';
  label: string;
} {
  if (iface.disabled) return { status: 'disabled', label: 'Disabled' };
  if (iface.running) return { status: 'running', label: 'Running' };
  return { status: 'stopped', label: 'Stopped' };
}

export default function InterfaceDetail({
  iface,
  isOpen,
  onClose,
}: InterfaceDetailProps) {
  const [isEditing, setIsEditing] = useState(false);

  const handleClose = () => {
    setIsEditing(false);
    onClose();
  };

  const handleEditClose = () => {
    setIsEditing(false);
  };

  if (!iface) return null;

  const { status, label } = getStatus(iface);

  return (
    <Drawer
      opened={isOpen}
      onClose={handleClose}
      title={
        <Text fw={600} size="lg">
          {iface.name}
        </Text>
      }
      position="right"
      size="md"
    >
      {isEditing ? (
        <InterfaceForm iface={iface} onClose={handleEditClose} />
      ) : (
        <Stack gap="md">
          <Group justify="flex-end">
            <Button
              variant="light"
              size="compact-sm"
              leftSection={<IconEdit size={14} />}
              onClick={() => setIsEditing(true)}
            >
              Edit
            </Button>
          </Group>

          <DetailField label="Name">
            <MonoText>{iface.name}</MonoText>
          </DetailField>

          <DetailField label="Type">
            <Badge variant="light" size="sm">
              {iface.type}
            </Badge>
          </DetailField>

          <DetailField label="Status">
            <StatusIndicator status={status} label={label} />
          </DetailField>

          <DetailField label="MTU">
            <MonoText>{iface.mtu}</MonoText>
          </DetailField>

          <DetailField label="MAC Address">
            <MonoText>{iface.mac_address || '-'}</MonoText>
          </DetailField>

          <DetailField label="Comment">
            <Text size="sm">{iface.comment || '-'}</Text>
          </DetailField>

          <Divider label="IP Addresses" labelPosition="left" />

          {iface.addresses.length > 0 ? (
            <Stack gap="xs">
              {iface.addresses.map((addr) => (
                <Group key={addr.id} justify="space-between">
                  <MonoText>{addr.address}</MonoText>
                  <Text size="xs" c="dimmed">
                    network: {addr.network}
                  </Text>
                </Group>
              ))}
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">
              No addresses configured
            </Text>
          )}

          {Object.keys(iface.properties).length > 0 && (
            <>
              <Divider label="Properties" labelPosition="left" />
              <Stack gap="xs">
                {Object.entries(iface.properties).map(([key, value]) => (
                  <DetailField key={key} label={key}>
                    <MonoText>{String(value)}</MonoText>
                  </DetailField>
                ))}
              </Stack>
            </>
          )}
        </Stack>
      )}
    </Drawer>
  );
}
