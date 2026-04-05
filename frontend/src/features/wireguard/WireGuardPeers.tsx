import { useState, useMemo } from 'react';
import {
  Table,
  Text,
  Group,
  Button,
  Menu,
  TextInput,
  Skeleton,
} from '@mantine/core';
import { IconPlus, IconSearch, IconUsers, IconLock, IconPencil, IconChevronDown, IconTrash } from '@tabler/icons-react';
import MonoText from '../../components/common/MonoText';
import StatusIndicator from '../../components/common/StatusIndicator';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import WireGuardPeerForm from './WireGuardPeerForm';
import WireGuardPeerDetail from './WireGuardPeerDetail';
import WireGuardConfigDisplay from './WireGuardConfigDisplay';
import { useWireGuardInterfaces, useWireGuardPeers, useDeletePeer } from './wireguardApi';
import type { WireGuardInterface, WireGuardPeer } from '../../api/types';

interface WireGuardPeersProps {
  routerId: string;
}

function HeaderLabel({ children }: { children: string }) {
  return (
    <Text
      size="xs"
      fw={600}
      c="dimmed"
      tt="uppercase"
      style={{ letterSpacing: 0.5 }}
    >
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

const columns = [
  { key: 'name', header: 'Name', width: undefined },
  { key: 'interface', header: 'Interface', width: 120 },
  { key: 'allowedAddress', header: 'Allowed Address', width: 200 },
  { key: 'dns', header: 'DNS', width: 140 },
  { key: 'endpoint', header: 'Endpoint', width: 200 },
  { key: 'status', header: 'Status', width: 120 },
  { key: 'actions', header: 'Actions', width: 120 },
];

export default function WireGuardPeers({ routerId }: WireGuardPeersProps) {
  const { data: wgInterfaces } = useWireGuardInterfaces(routerId);
  const { data: peers, isLoading } = useWireGuardPeers(routerId);
  const deleteMutation = useDeletePeer(routerId);

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editPeer, setEditPeer] = useState<WireGuardPeer | null>(null);
  const [selectedPeer, setSelectedPeer] = useState<WireGuardPeer | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WireGuardPeer | null>(null);
  const [configPeer, setConfigPeer] = useState<WireGuardPeer | null>(null);

  const filtered = useMemo(() => {
    if (!peers) return [];
    const trimmed = search.trim().toLowerCase();
    if (!trimmed) return peers;
    return peers.filter(
      (p) =>
        p.name.toLowerCase().includes(trimmed) ||
        p.interface.toLowerCase().includes(trimmed) ||
        p.allowedAddress.toLowerCase().includes(trimmed) ||
        p.endpointAddress.toLowerCase().includes(trimmed),
    );
  }, [peers, search]);

  const handleRowClick = (peer: WireGuardPeer) => {
    setSelectedPeer(peer);
    setDetailOpen(true);
  };

  const handleEdit = (peer: WireGuardPeer) => {
    setDetailOpen(false);
    setEditPeer(peer);
    setFormOpen(true);
  };

  const handleDelete = (peer: WireGuardPeer) => {
    setDetailOpen(false);
    setDeleteTarget(peer);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          setDeleteTarget(null);
          setSelectedPeer(null);
        },
      },
    );
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditPeer(null);
  };

  const handlePeerCreated = (peer: WireGuardPeer) => {
    if (peer.clientPrivateKey) {
      setConfigPeer(peer);
    }
  };

  const handleShowConfig = (peer: WireGuardPeer) => {
    setDetailOpen(false);
    setConfigPeer(peer);
  };

  const hasInterfaces = wgInterfaces && wgInterfaces.length > 0;

  // No interface configured
  if (!hasInterfaces) {
    return (
      <EmptyState
        icon={IconLock}
        title="Configure WireGuard interface first"
        description="You need to configure a WireGuard interface before adding peers. Switch to the Interfaces tab to get started."
      />
    );
  }

  // Find the interface for a given peer
  const findInterface = (peer: WireGuardPeer): WireGuardInterface | undefined =>
    wgInterfaces.find((i) => i.name === peer.interface);

  // Loading
  if (isLoading) {
    return (
      <>
        <Skeleton height={36} radius="sm" mb="md" />
        <PeerTableSkeleton />
      </>
    );
  }

  const hasPeers = peers && peers.length > 0;

  return (
    <>
      {hasPeers ? (
        <>
          <Group justify="space-between" mb="md">
            <TextInput
              placeholder="Search by name, address, endpoint..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              radius="sm"
              style={{ flex: 1 }}
            />
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                setEditPeer(null);
                setFormOpen(true);
              }}
            >
              Add Peer
            </Button>
          </Group>

          <div style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 4, overflow: 'hidden' }}>
          <Table withRowBorders={false} style={{ borderCollapse: 'collapse' as const }}>
            <Table.Thead>
              <Table.Tr style={headerRowStyle}>
                {columns.map((col) => (
                  <Table.Th key={col.key} style={{ width: col.width }}>
                    <HeaderLabel>{col.header}</HeaderLabel>
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((peer, index) => {
                const isLast = index === filtered.length - 1;
                const peerStatus = getPeerStatus(peer);
                const isDisabled = peer.disabled;
                const endpoint =
                  peer.endpointAddress && peer.endpointPort
                    ? `${peer.endpointAddress}:${peer.endpointPort}`
                    : '\u2014';

                return (
                  <Table.Tr
                    key={peer.id}
                    onClick={() => handleRowClick(peer)}
                    style={{
                      cursor: 'pointer',
                      opacity: isDisabled ? 0.5 : undefined,
                      borderBottom: isLast
                        ? undefined
                        : '1px solid var(--mantine-color-gray-1)',
                    }}
                  >
                    <Table.Td>
                      <Text fw={500} size="xs">
                        {peer.name}
                      </Text>
                    </Table.Td>
                    <Table.Td style={{ width: 120 }}>
                      <MonoText size="xs">{peer.interface}</MonoText>
                    </Table.Td>
                    <Table.Td>
                      <MonoText size="xs">{peer.allowedAddress}</MonoText>
                    </Table.Td>
                    <Table.Td style={{ width: 140 }}>
                      <MonoText size="xs">{findInterface(peer)?.dns || '\u2014'}</MonoText>
                    </Table.Td>
                    <Table.Td>
                      <span style={{ backgroundColor: 'var(--mantine-color-yellow-0)', padding: '2px 6px', borderRadius: 4, display: 'inline-block' }}>
                        <MonoText size="xs">{endpoint}</MonoText>
                      </span>
                    </Table.Td>
                    <Table.Td style={{ width: 120 }}>
                      <Group>
                        <StatusIndicator status={peerStatus.status} label={peerStatus.label} />
                      </Group>
                    </Table.Td>
                    <Table.Td style={{ width: 120 }}>
                      <Button.Group>
                        <Button variant="light" color="gray" size="xs"
                          leftSection={<IconPencil size={14} />}
                          onClick={(e) => { e.stopPropagation(); handleEdit(peer); }}>
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
                              onClick={() => handleDelete(peer)}>
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
                  <Table.Td colSpan={columns.length}>
                    <Text size="sm" c="dimmed" ta="center" py="lg">
                      No peers match &ldquo;{search}&rdquo;
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
          icon={IconUsers}
          title="No peers configured"
          description="Add WireGuard peers to allow remote clients to connect to this router."
          action={
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => {
                setEditPeer(null);
                setFormOpen(true);
              }}
            >
              Add Peer
            </Button>
          }
        />
      )}

      <WireGuardPeerDetail
        peer={selectedPeer}
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onShowConfig={handleShowConfig}
      />

      <WireGuardPeerForm
        isOpen={formOpen}
        onClose={handleFormClose}
        routerId={routerId}
        wgInterfaces={wgInterfaces}
        editPeer={editPeer}
        onCreated={handlePeerCreated}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Peer"
        message={`Are you sure you want to delete peer '${deleteTarget?.name}'? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmColor="red"
      />

      {configPeer && findInterface(configPeer) && (
        <WireGuardConfigDisplay
          isOpen={!!configPeer}
          onClose={() => setConfigPeer(null)}
          peer={configPeer}
          wgInterface={findInterface(configPeer)!}
        />
      )}
    </>
  );
}

function PeerTableSkeleton() {
  return (
    <div style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 4, overflow: 'hidden' }}>
    <Table withRowBorders={false} style={{ borderCollapse: 'collapse' as const }}>
      <Table.Thead>
        <Table.Tr style={headerRowStyle}>
          {columns.map((col) => (
            <Table.Th key={col.key} style={{ width: col.width }}>
              <HeaderLabel>{col.header}</HeaderLabel>
            </Table.Th>
          ))}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {Array.from({ length: 3 }).map((_, i) => (
          <Table.Tr
            key={i}
            style={{ borderBottom: '1px solid var(--mantine-color-gray-1)' }}
          >
            <Table.Td>
              <Skeleton height={14} width={140} radius="sm" />
            </Table.Td>
            <Table.Td>
              <Skeleton height={14} width={110} radius="sm" />
            </Table.Td>
            <Table.Td>
              <Skeleton height={14} width={130} radius="sm" />
            </Table.Td>
            <Table.Td style={{ width: 120 }}>
              <Skeleton height={18} width={80} radius="sm" />
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
    </div>
  );
}
