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
import type { FirewallRule, FirewallAction, FirewallChain, ConnectionState } from '../../api/types';

// ─── Exported constants (used by FirewallTable) ───────────────────────────────

export const ACTION_COLORS: Record<FirewallAction, string> = {
  accept: 'green',
  drop: 'red',
  reject: 'red',
  'fasttrack-connection': 'blue',
  passthrough: 'gray',
};

export const CHAIN_LABELS: Record<FirewallChain, string> = {
  forward: 'Forwarding',
  input: 'Router inbound',
  output: 'Router outbound',
};

export const CONNECTION_STATE_ABBR: Record<ConnectionState, string> = {
  established: 'est',
  related: 'rel',
  new: 'new',
  invalid: 'inv',
  untracked: 'unt',
};

// ─── Local helpers ────────────────────────────────────────────────────────────

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

// ─── Props ────────────────────────────────────────────────────────────────────

interface FirewallDetailProps {
  rule: FirewallRule | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (rule: FirewallRule) => void;
  onDelete: (rule: FirewallRule) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FirewallDetail({
  rule,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}: FirewallDetailProps) {
  if (!rule) return null;

  const hasAddresses =
    rule.srcAddress || rule.dstAddress || rule.srcAddressList || rule.dstAddressList;
  const hasProtocolOrPorts = rule.protocol || rule.srcPort || rule.dstPort;
  const hasInterfaces = rule.inInterface || rule.outInterface;
  const hasConnectionState = rule.connectionState && rule.connectionState.length > 0;

  return (
    <Drawer
      opened={isOpen}
      onClose={onClose}
      title={
        <Group gap="sm">
          <Title order={4}>Rule Details</Title>
          <Badge
            variant="light"
            size="sm"
            radius="sm"
            color={ACTION_COLORS[rule.action]}
          >
            {rule.action}
          </Badge>
        </Group>
      }
      position="right"
      size="xl"
      padding="xl"
    >
      <Stack gap="lg">
        {/* Section 1: General */}
        <Box>
          <Text fw={600} size="sm" mb="sm">
            General
          </Text>
          <Stack gap="xs">
            <DetailField label="Chain">
              <Text size="sm">{CHAIN_LABELS[rule.chain]}</Text>
            </DetailField>
            <DetailField label="Action">
              <Badge
                variant="light"
                size="sm"
                radius="sm"
                color={ACTION_COLORS[rule.action]}
              >
                {rule.action}
              </Badge>
            </DetailField>
            {rule.comment && (
              <DetailField label="Comment">
                <Text size="sm">{rule.comment}</Text>
              </DetailField>
            )}
            <DetailField label="Status">
              <Badge
                variant="light"
                size="sm"
                radius="sm"
                color={rule.disabled ? 'gray' : 'teal'}
              >
                {rule.disabled ? 'Disabled' : 'Enabled'}
              </Badge>
            </DetailField>
          </Stack>
        </Box>

        {/* Section 2: Addresses */}
        {hasAddresses && (
          <>
            <Divider />
            <Box>
              <Text fw={600} size="sm" mb="sm">
                Addresses
              </Text>
              <Stack gap="xs">
                {rule.srcAddress && (
                  <DetailField label="Source Address">
                    <MonoText>{rule.srcAddress}</MonoText>
                  </DetailField>
                )}
                {rule.srcAddressList && (
                  <DetailField label="Source Address List">
                    <Badge variant="light" size="sm" radius="sm" color="violet">
                      {rule.srcAddressList}
                    </Badge>
                  </DetailField>
                )}
                {rule.dstAddress && (
                  <DetailField label="Destination Address">
                    <MonoText>{rule.dstAddress}</MonoText>
                  </DetailField>
                )}
                {rule.dstAddressList && (
                  <DetailField label="Destination Address List">
                    <Badge variant="light" size="sm" radius="sm" color="violet">
                      {rule.dstAddressList}
                    </Badge>
                  </DetailField>
                )}
              </Stack>
            </Box>
          </>
        )}

        {/* Section 3: Protocol & Ports */}
        {hasProtocolOrPorts && (
          <>
            <Divider />
            <Box>
              <Text fw={600} size="sm" mb="sm">
                Protocol &amp; Ports
              </Text>
              <Stack gap="xs">
                {rule.protocol && (
                  <DetailField label="Protocol">
                    <MonoText>{rule.protocol}</MonoText>
                  </DetailField>
                )}
                {rule.srcPort && (
                  <DetailField label="Source Port">
                    <MonoText>{rule.srcPort}</MonoText>
                  </DetailField>
                )}
                {rule.dstPort && (
                  <DetailField label="Destination Port">
                    <MonoText>{rule.dstPort}</MonoText>
                  </DetailField>
                )}
              </Stack>
            </Box>
          </>
        )}

        {/* Section 4: Interfaces */}
        {hasInterfaces && (
          <>
            <Divider />
            <Box>
              <Text fw={600} size="sm" mb="sm">
                Interfaces
              </Text>
              <Stack gap="xs">
                {rule.inInterface && (
                  <DetailField label="In Interface">
                    <MonoText>{rule.inInterface}</MonoText>
                  </DetailField>
                )}
                {rule.outInterface && (
                  <DetailField label="Out Interface">
                    <MonoText>{rule.outInterface}</MonoText>
                  </DetailField>
                )}
              </Stack>
            </Box>
          </>
        )}

        {/* Section 5: Connection State */}
        {hasConnectionState && (
          <>
            <Divider />
            <Box>
              <Text fw={600} size="sm" mb="sm">
                Connection State
              </Text>
              <Group gap="xs">
                {rule.connectionState!.map((state) => (
                  <Badge key={state} variant="light" size="sm" radius="sm" color="blue">
                    {state}
                  </Badge>
                ))}
              </Group>
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
              onEdit(rule);
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
                onClick={() => onDelete(rule)}
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
