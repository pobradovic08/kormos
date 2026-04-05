import {
  Drawer,
  Stack,
  Group,
  Text,
  Title,
  Badge,
  Button,
  Menu,
  Divider,
  Box,
} from '@mantine/core';
import { IconPencil, IconChevronDown, IconTrash } from '@tabler/icons-react';
import MonoText from '../../components/common/MonoText';
import StatusIndicator from '../../components/common/StatusIndicator';
import { getStatus } from './TunnelTable';
import type { Tunnel, GRETunnel, IPsecTunnel } from '../../api/types';

interface TunnelDetailProps {
  tunnel: Tunnel | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (tunnel: Tunnel) => void;
  onDelete: (tunnel: Tunnel) => void;
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

export default function TunnelDetail({
  tunnel,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}: TunnelDetailProps) {
  if (!tunnel) return null;

  const { status, label } = getStatus(tunnel);

  return (
    <Drawer
      opened={isOpen}
      onClose={onClose}
      title={
        <Group gap="sm">
          <Title order={4}>{tunnel.name}</Title>
          <StatusIndicator status={status} label={label} />
        </Group>
      }
      position="right"
      size="xl"
      padding="xl"
    >
      <Stack gap="lg">
        {/* Section 1: Connection Details */}
        <Box>
          <Text fw={600} size="sm" mb="sm">
            Connection Details
          </Text>
          <Stack gap="xs">
            <DetailField label="Name">
              <MonoText>{tunnel.name}</MonoText>
            </DetailField>
            <DetailField label="Type">
              <Badge
                variant="light"
                size="sm"
                radius="sm"
                color={tunnel.tunnelType === 'gre' ? 'blue' : 'violet'}
              >
                {tunnel.tunnelType === 'gre' ? 'GRE' : 'IPsec'}
              </Badge>
            </DetailField>
            <DetailField label="Local Address">
              <MonoText>{tunnel.localAddress}</MonoText>
            </DetailField>
            <DetailField label="Remote Address">
              <MonoText>{tunnel.remoteAddress || '\u2014'}</MonoText>
            </DetailField>
            <DetailField label="Status">
              <StatusIndicator status={status} label={label} />
            </DetailField>
            {tunnel.comment && (
              <DetailField label="Comment">
                <Text size="sm">{tunnel.comment}</Text>
              </DetailField>
            )}
          </Stack>
        </Box>

        {/* Section 2: GRE Configuration */}
        {tunnel.tunnelType === 'gre' && (
          <>
            <Divider />
            <Box>
              <Text fw={600} size="sm" mb="sm">
                GRE Configuration
              </Text>
              <Stack gap="xs">
                <DetailField label="Local Interface">
                  <MonoText>{(tunnel as GRETunnel).localInterface}</MonoText>
                </DetailField>
                <DetailField label="MTU">
                  <MonoText>{(tunnel as GRETunnel).mtu}</MonoText>
                </DetailField>
                <DetailField label="Keepalive Interval">
                  <Text size="sm">
                    {(tunnel as GRETunnel).keepaliveInterval === 0
                      ? 'Disabled'
                      : `${(tunnel as GRETunnel).keepaliveInterval}s`}
                  </Text>
                </DetailField>
                <DetailField label="Keepalive Retries">
                  <Text size="sm">{(tunnel as GRETunnel).keepaliveRetries}</Text>
                </DetailField>
              </Stack>
            </Box>
          </>
        )}

        {/* Section 2: IPsec Configuration */}
        {tunnel.tunnelType === 'ipsec' && (
          <>
            <Divider />
            <Box>
              <Text fw={600} size="sm" mb="sm">
                IPsec Configuration
              </Text>
              <Stack gap="xs">
                <DetailField label="Mode">
                  <Badge
                    variant="light"
                    size="sm"
                    radius="sm"
                    color={(tunnel as IPsecTunnel).mode === 'route-based' ? 'blue' : 'violet'}
                  >
                    {(tunnel as IPsecTunnel).mode}
                  </Badge>
                </DetailField>
                <DetailField label="IKE Version">
                  <Text size="sm">v{(tunnel as IPsecTunnel).ikeVersion}</Text>
                </DetailField>
                <DetailField label="Authentication">
                  <Text size="sm">
                    {(tunnel as IPsecTunnel).authMethod === 'pre-shared-key'
                      ? 'Pre-shared Key'
                      : 'Certificate'}
                  </Text>
                </DetailField>
                {(tunnel as IPsecTunnel).mode === 'route-based' && (
                  <DetailField label="Tunnel Interface">
                    <MonoText>{(tunnel as IPsecTunnel).tunnelInterface}</MonoText>
                  </DetailField>
                )}
                {(tunnel as IPsecTunnel).mode === 'policy-based' && (
                  <>
                    <DetailField label="Local Subnet">
                      <MonoText>{(tunnel as IPsecTunnel).localSubnet}</MonoText>
                    </DetailField>
                    <DetailField label="Remote Subnet">
                      <MonoText>{(tunnel as IPsecTunnel).remoteSubnet}</MonoText>
                    </DetailField>
                  </>
                )}
              </Stack>
            </Box>

            {/* Section 3: Phase 1 Proposal */}
            <Divider />
            <Box>
              <Text fw={600} size="sm" mb="sm">
                Phase 1 Proposal
              </Text>
              <Stack gap="xs">
                <DetailField label="Encryption">
                  <Text size="sm">{(tunnel as IPsecTunnel).phase1.encryption}</Text>
                </DetailField>
                <DetailField label="Hash">
                  <Text size="sm">{(tunnel as IPsecTunnel).phase1.hash}</Text>
                </DetailField>
                <DetailField label="DH Group">
                  <Text size="sm">{(tunnel as IPsecTunnel).phase1.dhGroup}</Text>
                </DetailField>
                <DetailField label="Lifetime">
                  <Text size="sm">{(tunnel as IPsecTunnel).phase1.lifetime}</Text>
                </DetailField>
              </Stack>
            </Box>

            {/* Section 4: Phase 2 Proposal */}
            <Divider />
            <Box>
              <Text fw={600} size="sm" mb="sm">
                Phase 2 Proposal
              </Text>
              <Stack gap="xs">
                <DetailField label="Encryption">
                  <Text size="sm">{(tunnel as IPsecTunnel).phase2.encryption}</Text>
                </DetailField>
                <DetailField label="Hash">
                  <Text size="sm">{(tunnel as IPsecTunnel).phase2.hash}</Text>
                </DetailField>
                <DetailField label="PFS Group">
                  <Text size="sm">
                    {(tunnel as IPsecTunnel).phase2.pfsGroup === 0
                      ? 'None'
                      : (tunnel as IPsecTunnel).phase2.pfsGroup}
                  </Text>
                </DetailField>
                <DetailField label="Lifetime">
                  <Text size="sm">{(tunnel as IPsecTunnel).phase2.lifetime}</Text>
                </DetailField>
              </Stack>
            </Box>
          </>
        )}

        {/* Actions */}
        <Divider />
        <Button.Group>
          <Button
            variant="light"
            color="gray"
            size="xs"
            leftSection={<IconPencil size={14} />}
            onClick={(e) => {
              e.stopPropagation();
              onEdit(tunnel);
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
                onClick={() => onDelete(tunnel)}
              >
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Button.Group>
      </Stack>
    </Drawer>
  );
}
