import { useState, useMemo } from 'react';
import {
  Stack,
  Group,
  Table,
  Text,
  TextInput,
  Button,
  Badge,
  Menu,
  CopyButton,
  ActionIcon,
  Tooltip,
  Skeleton,
} from '@mantine/core';
import {
  IconPlus,
  IconSearch,
  IconCopy,
  IconCheck,
  IconLock,
  IconPencil,
  IconChevronDown,
  IconTrash,
} from '@tabler/icons-react';
import MonoText from '../../components/common/MonoText';
import StatusIndicator from '../../components/common/StatusIndicator';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import WireGuardInterfaceForm from './WireGuardInterfaceForm';
import WireGuardInterfaceDetail from './WireGuardInterfaceDetail';
import { useWireGuardInterfaces, useWireGuardPeers, useDeleteWireGuardInterface } from './wireguardApi';
import type { WireGuardInterface as WireGuardInterfaceType } from '../../api/types';

function HeaderLabel({ children }: { children: string }) {
  return (
    <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: 0.5 }}>
      {children}
    </Text>
  );
}

const tableStyle = {
  borderCollapse: 'collapse' as const,
  border: '1px solid var(--mantine-color-gray-3)',
  borderRadius: 4,
  overflow: 'hidden',
};

const headerRowStyle = {
  backgroundColor: 'var(--mantine-color-gray-0)',
  borderBottom: '1px solid var(--mantine-color-gray-3)',
};

interface WireGuardInterfaceTabProps {
  routerId: string;
}

export default function WireGuardInterfaceTab({ routerId }: WireGuardInterfaceTabProps) {
  const { data: wgInterfaces, isLoading } = useWireGuardInterfaces(routerId);
  const { data: allPeers } = useWireGuardPeers(routerId);
  const deleteMutation = useDeleteWireGuardInterface(routerId);

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editIface, setEditIface] = useState<WireGuardInterfaceType | null>(null);
  const [detailIface, setDetailIface] = useState<WireGuardInterfaceType | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WireGuardInterfaceType | null>(null);

  const handleAdd = () => {
    setEditIface(null);
    setFormOpen(true);
  };

  const handleEdit = (iface: WireGuardInterfaceType) => {
    setDetailOpen(false);
    setEditIface(iface);
    setFormOpen(true);
  };

  const handleDelete = (iface: WireGuardInterfaceType) => {
    setDetailOpen(false);
    setDeleteTarget(iface);
  };

  const handleDeleteConfirm = () => {
    if (deleteTarget) {
      deleteMutation.mutate({ id: deleteTarget.id }, {
        onSuccess: () => setDeleteTarget(null),
      });
    }
  };

  const handleRowClick = (iface: WireGuardInterfaceType) => {
    setDetailIface(iface);
    setDetailOpen(true);
  };

  if (isLoading) {
    return (
      <Stack gap="md">
        <Skeleton height={36} radius="sm" />
        <Skeleton height={120} radius="sm" />
      </Stack>
    );
  }

  const hasInterfaces = wgInterfaces && wgInterfaces.length > 0;

  const filtered = useMemo(() => {
    if (!wgInterfaces) return [];
    const q = search.trim().toLowerCase();
    if (!q) return wgInterfaces;
    return wgInterfaces.filter((i) =>
      i.name.toLowerCase().includes(q) ||
      i.gatewayAddress.includes(q) ||
      String(i.listenPort).includes(q)
    );
  }, [wgInterfaces, search]);

  return (
    <>
      <Stack gap="md">
        {hasInterfaces ? (
          <>
            <Group justify="space-between">
              <TextInput
                placeholder="Search by name, gateway, port..."
                leftSection={<IconSearch size={16} />}
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                radius="sm"
                style={{ flex: 1 }}
              />
              <Button size="sm" leftSection={<IconPlus size={16} />} onClick={handleAdd}>
                Add WireGuard
              </Button>
            </Group>
          <div style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 4, overflow: 'hidden' }}>
          <Table withRowBorders={false} style={{ borderCollapse: 'collapse' as const }}>
            <Table.Thead>
              <Table.Tr style={headerRowStyle}>
                <Table.Th><HeaderLabel>Name</HeaderLabel></Table.Th>
                <Table.Th style={{ width: 80 }}><HeaderLabel>Port</HeaderLabel></Table.Th>
                <Table.Th style={{ width: 140 }}><HeaderLabel>VPN Gateway</HeaderLabel></Table.Th>
                <Table.Th style={{ width: 100, textAlign: 'center' }}><HeaderLabel>Mode</HeaderLabel></Table.Th>
                <Table.Th><HeaderLabel>Public Key</HeaderLabel></Table.Th>
                <Table.Th style={{ width: 120 }}><HeaderLabel>Status</HeaderLabel></Table.Th>
                <Table.Th style={{ width: 120 }}><HeaderLabel>Actions</HeaderLabel></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((iface, index) => {
                const isLast = index === filtered.length - 1;
                return (
                  <Table.Tr
                    key={iface.id}
                    onClick={() => handleRowClick(iface)}
                    style={{
                      cursor: 'pointer',
                      opacity: iface.disabled ? 0.5 : undefined,
                      borderBottom: isLast
                        ? undefined
                        : '1px solid var(--mantine-color-gray-1)',
                    }}
                  >
                    <Table.Td>
                      <Text fw={500} size="xs">{iface.name}</Text>
                      <Text size="xs" c="dimmed">
                        {(() => {
                          const count = (allPeers ?? []).filter((p) => p.interface === iface.name).length;
                          return count === 0 ? 'No peers' : `${count} ${count === 1 ? 'peer' : 'peers'} configured`;
                        })()}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ width: 80 }}>
                      <MonoText size="xs">{iface.listenPort}</MonoText>
                    </Table.Td>
                    <Table.Td style={{ width: 140 }}>
                      <MonoText size="xs">{iface.gatewayAddress}</MonoText>
                    </Table.Td>
                    <Table.Td style={{ width: 100, textAlign: 'center' }}>
                      <Group justify="center">
                        <Badge variant="light" size="sm" radius="sm"
                          color={iface.clientAllowedIPs.includes('0.0.0.0/0') ? 'blue' : 'teal'}>
                          {iface.clientAllowedIPs.includes('0.0.0.0/0') ? 'full' : 'split'}
                        </Badge>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <MonoText size="xs" lineClamp={1} style={{ maxWidth: 200 }}>
                          {iface.publicKey}
                        </MonoText>
                        <CopyButton value={iface.publicKey}>
                          {({ copied, copy }) => (
                            <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow>
                              <ActionIcon
                                size="sm" variant="subtle"
                                color={copied ? 'teal' : 'gray'}
                                onClick={(e) => { e.stopPropagation(); copy(); }}
                              >
                                {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </CopyButton>
                      </Group>
                    </Table.Td>
                    <Table.Td style={{ width: 120 }}>
                      <Group>
                        {iface.disabled ? (
                          <StatusIndicator status="disabled" label="Disabled" />
                        ) : (
                          <StatusIndicator status="running" label="Active" />
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td style={{ width: 120 }}>
                      <Button.Group>
                        <Button variant="light" color="gray" size="xs"
                          leftSection={<IconPencil size={14} />}
                          onClick={(e) => { e.stopPropagation(); handleEdit(iface); }}>
                          Edit
                        </Button>
                        <Menu position="bottom-end">
                          <Menu.Target>
                            <Button variant="light" color="gray" size="xs"
                              onClick={(e) => e.stopPropagation()}
                              style={{ paddingLeft: 6, paddingRight: 6, borderLeft: '1px solid var(--mantine-color-gray-4)' }}>
                              <IconChevronDown size={14} />
                            </Button>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item fz="xs" color="red" leftSection={<IconTrash size={14} />}
                              onClick={() => handleDelete(iface)}>
                              Delete
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Button.Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
              {filtered.length === 0 && search && (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <Text size="sm" c="dimmed" ta="center" py="lg">
                      No interfaces match &ldquo;{search}&rdquo;
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
          </div>
          </>
        ) : (
          <EmptyState
            icon={IconLock}
            title="No WireGuard interfaces"
            description="Add a WireGuard interface to enable remote access VPN."
            action={
              <Button leftSection={<IconPlus size={16} />} onClick={handleAdd}>
                Add WireGuard
              </Button>
            }
          />
        )}
      </Stack>

      <WireGuardInterfaceForm
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditIface(null); }}
        routerId={routerId}
        editInterface={editIface}
      />

      <WireGuardInterfaceDetail
        iface={detailIface}
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete WireGuard Interface"
        message={`Are you sure you want to delete '${deleteTarget?.name}'? All peers on this interface will also be removed.`}
        confirmLabel="Delete"
        confirmColor="red"
      />
    </>
  );
}
