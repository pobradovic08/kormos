import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Title,
  Button,
  Group,
  Menu,
  Text,
  Skeleton,
  Stack,
  TextInput,
} from '@mantine/core';
import {
  IconPlus,
  IconSearch,
  IconRouter,
  IconBuilding,
  IconChevronDown,
} from '@tabler/icons-react';
import { useRouterStore } from '../../stores/useRouterStore';
import { looksLikeCIDR, prefixOverlaps } from '../../utils/cidr';
import { useTunnels, useDeleteTunnel } from './tunnelsApi';
import TunnelTable, { TunnelTableSkeleton } from './TunnelTable';
import TunnelDetail from './TunnelDetail';
import TunnelForm from './TunnelForm';
import EmptyState from '../../components/common/EmptyState';
import ErrorBanner from '../../components/common/ErrorBanner';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import type { Tunnel, IPsecTunnel } from '../../api/types';

function AddTunnelButton({
  onAddGRE,
  onAddIPsec,
}: {
  onAddGRE: () => void;
  onAddIPsec: () => void;
}) {
  return (
    <Button.Group>
      <Button leftSection={<IconPlus size={16} />} onClick={onAddGRE}>
        Add Tunnel
      </Button>
      <Menu position="bottom-end">
        <Menu.Target>
          <Button
            style={{
              paddingLeft: 8,
              paddingRight: 8,
              borderLeft: '1px solid rgba(255,255,255,0.3)',
            }}
          >
            <IconChevronDown size={14} />
          </Button>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Item fz="xs" onClick={onAddGRE}>
            Add GRE Tunnel
          </Menu.Item>
          <Menu.Item fz="xs" onClick={onAddIPsec}>
            Add IPsec Tunnel
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
    </Button.Group>
  );
}

function matchesTunnel(
  tunnel: Tunnel,
  query: string,
  isCIDR: boolean,
): boolean {
  if (tunnel.name.toLowerCase().includes(query)) return true;
  if (tunnel.tunnelType.toLowerCase().includes(query)) return true;

  // Address matching
  if (isCIDR) {
    if (prefixOverlaps(query, tunnel.localAddress)) return true;
    if (tunnel.remoteAddress && prefixOverlaps(query, tunnel.remoteAddress))
      return true;
    if (tunnel.tunnelType === 'ipsec') {
      const ipsec = tunnel as IPsecTunnel;
      if (ipsec.localSubnets.some((s) => prefixOverlaps(query, s))) return true;
      if (ipsec.remoteSubnets.some((s) => prefixOverlaps(query, s))) return true;
      if (ipsec.tunnelRoutes.some((r) => prefixOverlaps(query, r))) return true;
    }
  } else {
    if (tunnel.localAddress.includes(query)) return true;
    if (tunnel.remoteAddress && tunnel.remoteAddress.includes(query))
      return true;
  }

  return false;
}

export default function TunnelsPage() {
  const selectedRouterId = useRouterStore((s) => s.selectedRouterId);
  const { data: tunnels, isLoading, error, refetch } = useTunnels(selectedRouterId);
  const deleteMutation = useDeleteTunnel(selectedRouterId);

  const [search, setSearch] = useState('');
  const [selectedTunnel, setSelectedTunnel] = useState<Tunnel | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<'gre' | 'ipsec'>('gre');
  const [editTunnel, setEditTunnel] = useState<Tunnel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tunnel | null>(null);

  // Reset state when router changes
  const prevRouterId = useRef(selectedRouterId);
  useEffect(() => {
    if (prevRouterId.current !== selectedRouterId) {
      setSearch('');
      setSelectedTunnel(null);
      setDetailOpen(false);
      setFormOpen(false);
      setEditTunnel(null);
      setDeleteTarget(null);
      prevRouterId.current = selectedRouterId;
    }
  }, [selectedRouterId]);

  // Filter tunnels based on search
  const filtered = useMemo(() => {
    if (!tunnels) return [];
    const trimmed = search.trim();
    if (!trimmed) return tunnels;

    const query = trimmed.toLowerCase();
    const isCIDR = looksLikeCIDR(trimmed);
    return tunnels.filter((t) => matchesTunnel(t, query, isCIDR));
  }, [tunnels, search]);

  // CRUD handlers
  const handleAddGRE = () => {
    setFormType('gre');
    setEditTunnel(null);
    setFormOpen(true);
  };

  const handleAddIPsec = () => {
    setFormType('ipsec');
    setEditTunnel(null);
    setFormOpen(true);
  };

  const handleRowClick = (tunnel: Tunnel) => {
    setSelectedTunnel(tunnel);
    setDetailOpen(true);
  };

  const handleDetailClose = () => {
    setDetailOpen(false);
  };

  const handleEdit = (tunnel: Tunnel) => {
    setDetailOpen(false);
    setEditTunnel(tunnel);
    setFormType(tunnel.tunnelType);
    setFormOpen(true);
  };

  const handleDelete = (tunnel: Tunnel) => {
    setDetailOpen(false);
    setDeleteTarget(tunnel);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          setDeleteTarget(null);
          setSelectedTunnel(null);
        },
      },
    );
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditTunnel(null);
  };

  // No router selected
  if (!selectedRouterId) {
    return (
      <Stack align="center" mt="xl" gap="md">
        <IconRouter
          size={48}
          stroke={1.5}
          color="var(--mantine-color-dimmed)"
        />
        <Text c="dimmed" size="lg">
          Select a router to view tunnels
        </Text>
      </Stack>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <>
        <Group justify="space-between" align="flex-start" mb="lg">
          <Stack gap={4}>
            <Title order={2}>Tunnels</Title>
            <Text size="sm" c="dimmed">
              GRE and IPsec tunnels for this router
            </Text>
          </Stack>
        </Group>
        <Skeleton height={36} radius="sm" mb="md" />
        <TunnelTableSkeleton />
      </>
    );
  }

  // Error
  if (error) {
    return (
      <ErrorBanner
        message="Failed to load tunnels. Please try again later."
        onRetry={() => void refetch()}
      />
    );
  }

  const hasTunnels = tunnels && tunnels.length > 0;

  return (
    <>
      <Group justify="space-between" align="flex-start" mb="lg">
        <Stack gap={4}>
          <Title order={2}>Tunnels</Title>
          <Text size="sm" c="dimmed">
            GRE and IPsec tunnels for this router
          </Text>
        </Stack>
        <AddTunnelButton onAddGRE={handleAddGRE} onAddIPsec={handleAddIPsec} />
      </Group>

      {hasTunnels ? (
        <>
          <TextInput
            placeholder="Search by name, address, type..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            radius="sm"
            mb="md"
          />
          <TunnelTable
            tunnels={filtered}
            search={search}
            onRowClick={handleRowClick}
          />
        </>
      ) : (
        <EmptyState
          icon={IconBuilding}
          title="No tunnels configured"
          description="This router has no GRE or IPsec tunnels configured."
          action={
            <AddTunnelButton
              onAddGRE={handleAddGRE}
              onAddIPsec={handleAddIPsec}
            />
          }
        />
      )}

      <TunnelDetail
        tunnel={selectedTunnel}
        isOpen={detailOpen}
        onClose={handleDetailClose}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {selectedRouterId && (
        <TunnelForm
          isOpen={formOpen}
          onClose={handleFormClose}
          routerId={selectedRouterId}
          tunnelType={formType}
          editTunnel={editTunnel}
        />
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Tunnel"
        message={`Are you sure you want to delete tunnel '${deleteTarget?.name}'? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmColor="red"
      />
    </>
  );
}
