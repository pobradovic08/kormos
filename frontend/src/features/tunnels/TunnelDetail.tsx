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
import type { GRETunnel, IPsecTunnel } from '../../api/types';
import type { DisplayTunnel } from './TunnelsPage';

interface TunnelDetailProps {
  tunnel: DisplayTunnel | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (tunnel: DisplayTunnel) => void;
  onDelete: (tunnel: DisplayTunnel) => void;
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
            {/* Per-router endpoints */}
            {tunnel.displayEndpoints.map((ep) => (
              <Box key={ep.routerName}>
                <Group gap="xs" mb={4}>
                  <Text size="xs" fw={500}>{ep.routerName}</Text>
                  <Badge variant="light" size="xs" radius="sm" color={ep.role === 'master' ? 'blue' : 'orange'}>
                    {ep.role}
                  </Badge>
                </Group>
                <Stack gap={2} ml="sm">
                  <Group gap="xs">
                    <Text size="xs" c="dimmed" style={{ minWidth: 100 }}>Local Address</Text>
                    <MonoText size="xs">{ep.localAddress}</MonoText>
                  </Group>
                  <Group gap="xs">
                    <Text size="xs" c="dimmed" style={{ minWidth: 100 }}>Remote Address</Text>
                    <MonoText size="xs">{ep.remoteAddress || '\u2014'}</MonoText>
                  </Group>
                </Stack>
              </Box>
            ))}
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
                <DetailField label="MTU">
                  <MonoText>{(tunnel as GRETunnel).mtu}</MonoText>
                </DetailField>
                <DetailField label="Keepalive">
                  <Text size="sm">
                    {(tunnel as GRETunnel).keepaliveInterval === 0 && (tunnel as GRETunnel).keepaliveRetries === 0
                      ? 'Disabled'
                      : `${(tunnel as GRETunnel).keepaliveInterval}s, ${(tunnel as GRETunnel).keepaliveRetries} retries`}
                  </Text>
                </DetailField>
                <DetailField label="IPsec Secret">
                  <Text size="sm">
                    {(tunnel as GRETunnel).ipsecSecret ? '••••••••' : 'None'}
                  </Text>
                </DetailField>
              </Stack>
            </Box>
          </>
        )}

        {/* Section 2: IPsec Configuration */}
        {tunnel.tunnelType === 'ipsec' && (() => {
          const ipsec = tunnel as IPsecTunnel;
          return (
            <>
              <Divider />
              <Box>
                <Text fw={600} size="sm" mb="sm">
                  IPsec Configuration
                </Text>
                <Stack gap="xs">
                  <DetailField label="Mode">
                    <Badge variant="light" size="sm" radius="sm"
                      color={ipsec.mode === 'route-based' ? 'blue' : 'violet'}>
                      {ipsec.mode}
                    </Badge>
                  </DetailField>
                  <DetailField label="Authentication">
                    <Text size="sm">
                      {ipsec.authMethod === 'pre-shared-key' ? 'Pre-shared Key' : 'Certificate'}
                    </Text>
                  </DetailField>
                  <DetailField label="IPsec Secret">
                    <Text size="sm">{ipsec.ipsecSecret ? '••••••••' : 'None'}</Text>
                  </DetailField>
                </Stack>
              </Box>

              {/* Phase 1 */}
              <Divider />
              <Box>
                <Text fw={600} size="sm" mb="sm">
                  Phase 1 (IKE Profile)
                </Text>
                <Stack gap="xs">
                  <DetailField label="Encryption">
                    <Text size="sm">{ipsec.phase1.encryption}</Text>
                  </DetailField>
                  <DetailField label="Hash">
                    <Text size="sm">{ipsec.phase1.hash}</Text>
                  </DetailField>
                  <DetailField label="DH Group">
                    <Text size="sm">{ipsec.phase1.dhGroup}</Text>
                  </DetailField>
                  <DetailField label="Lifetime">
                    <Text size="sm">{ipsec.phase1.lifetime}</Text>
                  </DetailField>
                </Stack>
              </Box>

              {/* Phase 2 */}
              <Divider />
              <Box>
                <Text fw={600} size="sm" mb="sm">
                  Phase 2 (ESP Proposal)
                </Text>
                <Stack gap="xs">
                  <DetailField label="Encryption">
                    <Text size="sm">{ipsec.phase2.encryption}</Text>
                  </DetailField>
                  <DetailField label="Auth Algorithm">
                    <Text size="sm">{ipsec.phase2.authAlgorithm === 'null' ? 'None' : ipsec.phase2.authAlgorithm}</Text>
                  </DetailField>
                  <DetailField label="PFS Group">
                    <Text size="sm">{ipsec.phase2.pfsGroup === 'none' ? 'None' : ipsec.phase2.pfsGroup}</Text>
                  </DetailField>
                  <DetailField label="Lifetime">
                    <Text size="sm">{ipsec.phase2.lifetime}</Text>
                  </DetailField>
                </Stack>
              </Box>

              {/* Protected Networks or Tunnel Routes */}
              {(ipsec.mode === 'policy-based' && ipsec.localSubnets.length > 0) && (
                <>
                  <Divider />
                  <Box>
                    <Text fw={600} size="sm" mb="sm">Protected Networks</Text>
                    <Stack gap="xs">
                      <DetailField label="Local Subnets">
                        <Stack gap={2}>{ipsec.localSubnets.map((s) => <MonoText key={s}>{s}</MonoText>)}</Stack>
                      </DetailField>
                      <DetailField label="Remote Subnets">
                        <Stack gap={2}>{ipsec.remoteSubnets.map((s) => <MonoText key={s}>{s}</MonoText>)}</Stack>
                      </DetailField>
                    </Stack>
                  </Box>
                </>
              )}
              {(ipsec.mode === 'route-based' && ipsec.tunnelRoutes.length > 0) && (
                <>
                  <Divider />
                  <Box>
                    <Text fw={600} size="sm" mb="sm">Tunnel Routes</Text>
                    <Stack gap={2}>{ipsec.tunnelRoutes.map((r) => <MonoText key={r}>{r}</MonoText>)}</Stack>
                  </Box>
                </>
              )}

              {/* Advanced defaults */}
              <Divider />
              <Box>
                <Text fw={600} size="sm" mb="sm">Advanced</Text>
                <Stack gap="xs">
                  <DetailField label="IKE Version"><Text size="sm">v2</Text></DetailField>
                  <DetailField label="NAT Traversal"><Text size="sm">Enabled</Text></DetailField>
                  <DetailField label="DPD Interval"><Text size="sm">2m</Text></DetailField>
                  <DetailField label="DPD Max Failures"><Text size="sm">5</Text></DetailField>
                </Stack>
              </Box>
            </>
          );
        })()}

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
