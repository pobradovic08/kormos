import { useState } from 'react';
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
import InterfaceForm from './InterfaceForm';
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
      <Box>{children}</Box>
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
        <Group gap="sm">
          <Title order={4}>{iface.name}</Title>
          <StatusIndicator status={status} label={label} />
        </Group>
      }
      position="right"
      size="lg"
      padding="xl"
    >
      {isEditing ? (
        <InterfaceForm iface={iface} onClose={handleEditClose} />
      ) : (
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
              <DetailField label="Status">
                <StatusIndicator status={status} label={label} />
              </DetailField>
              <DetailField label="MTU">
                <MonoText>{iface.mtu}</MonoText>
              </DetailField>
              <DetailField label="MAC Address">
                <MonoText>{iface.mac_address || '\u2014'}</MonoText>
              </DetailField>
              {iface.comment && (
                <DetailField label="Comment">
                  <Text size="sm">{iface.comment}</Text>
                </DetailField>
              )}
            </Stack>
          </Box>

          <Divider />

          {/* Section 2: IP Addresses */}
          <Box>
            <Text fw={600} size="sm" mb="sm">
              IP Addresses
            </Text>
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
          </Box>

          {Object.keys(iface.properties).length > 0 && (
            <>
              <Divider />

              {/* Section 3: Properties */}
              <Box>
                <Text fw={600} size="sm" mb="sm">
                  Properties
                </Text>
                <Stack gap="xs">
                  {Object.entries(iface.properties).map(([key, value]) => (
                    <DetailField key={key} label={key}>
                      <MonoText>{String(value)}</MonoText>
                    </DetailField>
                  ))}
                </Stack>
              </Box>
            </>
          )}

          <Divider />

          {/* Action buttons */}
          <Group>
            <Button
              variant="default"
              leftSection={<IconPencil size={16} />}
              onClick={() => setIsEditing(true)}
            >
              Edit
            </Button>
          </Group>
        </Stack>
      )}
    </Drawer>
  );
}
