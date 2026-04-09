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
  IconBuilding,
  IconChevronDown,
} from '@tabler/icons-react';
import { useClusterId } from '../../hooks/useClusterId';
import { looksLikeCIDR, prefixOverlaps } from '../../utils/cidr';
import {
  useGRETunnels,
  useIPsecTunnels,
  useDeleteGRETunnel,
  useDeleteIPsecTunnel,
} from './tunnelsApi';
import TunnelTable, { TunnelTableSkeleton } from './TunnelTable';
import TunnelDetail from './TunnelDetail';
import TunnelForm from './TunnelForm';
import EmptyState from '../../components/common/EmptyState';
import ErrorBanner from '../../components/common/ErrorBanner';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import type {
  Tunnel,
  GRETunnel,
  IPsecTunnel,
  MergedGRETunnel,
  MergedIPsecTunnel,
  DisplayEndpoint,
} from '../../api/types';

// ─── Tunnel with endpoints for display ───────────────────────────────────────

export type DisplayTunnel = Tunnel & { displayEndpoints: DisplayEndpoint[] };

function mergedGREToDisplay(t: MergedGRETunnel): DisplayTunnel {
  const ep = t.endpoints[0];
  const base: GRETunnel = {
    id: t.name,
    name: t.name,
    tunnelType: 'gre',
    localAddress: ep?.localAddress ?? '0.0.0.0',
    remoteAddress: ep?.remoteAddress ?? '',
    mtu: t.mtu,
    keepaliveInterval: t.keepaliveInterval,
    keepaliveRetries: t.keepaliveRetries,
    ipsecSecret: t.ipsecSecret,
    disabled: t.disabled,
    running: ep?.running ?? false,
    comment: t.comment,
  };
  return {
    ...base,
    displayEndpoints: t.endpoints.map((e) => ({
      routerName: e.routerName,
      role: e.role,
      localAddress: e.localAddress,
      remoteAddress: e.remoteAddress,
    })),
  };
}

function mergedIPsecToDisplay(t: MergedIPsecTunnel): DisplayTunnel {
  const ep = t.endpoints[0];
  const base: IPsecTunnel = {
    id: t.name,
    name: t.name,
    tunnelType: 'ipsec',
    mode: t.mode as 'route-based' | 'policy-based',
    localAddress: ep?.localAddress ?? '0.0.0.0',
    remoteAddress: ep?.remoteAddress ?? '',
    authMethod: t.authMethod as 'pre-shared-key' | 'digital-signature',
    ipsecSecret: t.ipsecSecret,
    phase1: t.phase1,
    phase2: t.phase2,
    localSubnets: t.localSubnets,
    remoteSubnets: t.remoteSubnets,
    tunnelRoutes: t.tunnelRoutes,
    localTunnelAddress: t.localTunnelAddress,
    remoteTunnelAddress: t.remoteTunnelAddress,
    disabled: t.disabled,
    established: ep?.established ?? false,
    comment: t.comment,
  };
  return {
    ...base,
    displayEndpoints: t.endpoints.map((e) => ({
      routerName: e.routerName,
      role: e.role,
      localAddress: e.localAddress,
      remoteAddress: e.remoteAddress,
    })),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TunnelsPage() {
  const clusterId = useClusterId();

  // Cluster-scoped queries
  const { data: greTunnels, isLoading: greLoading, error: greError, refetch: greRefetch } = useGRETunnels(clusterId);
  const { data: ipsecTunnels, isLoading: ipsecLoading, error: ipsecError, refetch: ipsecRefetch } = useIPsecTunnels(clusterId);
  const deleteGRE = useDeleteGRETunnel(clusterId);
  const deleteIPsec = useDeleteIPsecTunnel(clusterId);

  const isLoading = greLoading || ipsecLoading;
  const error = greError || ipsecError;

  // Keep a map from name → merged tunnel for edit/detail
  const mergedByName = useMemo(() => {
    const map = new Map<string, MergedGRETunnel | MergedIPsecTunnel>();
    for (const t of greTunnels ?? []) map.set(t.name, t);
    for (const t of ipsecTunnels ?? []) map.set(t.name, t);
    return map;
  }, [greTunnels, ipsecTunnels]);

  // Convert to DisplayTunnel[] for table/detail
  const tunnels = useMemo<DisplayTunnel[]>(() => {
    const gre = (greTunnels ?? []).map(mergedGREToDisplay);
    const ipsec = (ipsecTunnels ?? []).map(mergedIPsecToDisplay);
    return [...gre, ...ipsec];
  }, [greTunnels, ipsecTunnels]);

  const [search, setSearch] = useState('');
  const [selectedTunnel, setSelectedTunnel] = useState<DisplayTunnel | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<'gre' | 'ipsec'>('gre');
  const [editTunnel, setEditTunnel] = useState<MergedGRETunnel | MergedIPsecTunnel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DisplayTunnel | null>(null);

  // Reset state when cluster changes
  const prevClusterId = useRef(clusterId);
  useEffect(() => {
    if (prevClusterId.current !== clusterId) {
      setSearch('');
      setSelectedTunnel(null);
      setDetailOpen(false);
      setFormOpen(false);
      setEditTunnel(null);
      setDeleteTarget(null);
      prevClusterId.current = clusterId;
    }
  }, [clusterId]);

  // Filter tunnels based on search
  const filtered = useMemo(() => {
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

  const handleRowClick = (tunnel: DisplayTunnel) => {
    setSelectedTunnel(tunnel);
    setDetailOpen(true);
  };

  const handleDetailClose = () => {
    setDetailOpen(false);
  };

  const handleEdit = (tunnel: DisplayTunnel) => {
    setDetailOpen(false);
    const merged = mergedByName.get(tunnel.name) ?? null;
    setEditTunnel(merged);
    setFormType(tunnel.tunnelType);
    setFormOpen(true);
  };

  const handleDelete = (tunnel: DisplayTunnel) => {
    setDetailOpen(false);
    setDeleteTarget(tunnel);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    const onSuccess = () => {
      setDeleteTarget(null);
      setSelectedTunnel(null);
    };
    if (deleteTarget.tunnelType === 'gre') {
      deleteGRE.mutate(deleteTarget.name, { onSuccess });
    } else {
      deleteIPsec.mutate(deleteTarget.name, { onSuccess });
    }
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditTunnel(null);
  };

  // Loading
  if (isLoading) {
    return (
      <>
        <Group justify="space-between" align="flex-start" mb="lg">
          <Stack gap={4}>
            <Title order={2}>Tunnels</Title>
            <Text size="sm" c="dimmed">
              GRE and IPsec tunnels for this cluster
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
        onRetry={() => { void greRefetch(); void ipsecRefetch(); }}
      />
    );
  }

  const hasTunnels = tunnels.length > 0;

  return (
    <>
      <Group justify="space-between" align="flex-start" mb="lg">
        <Stack gap={4}>
          <Title order={2}>Tunnels</Title>
          <Text size="sm" c="dimmed">
            GRE and IPsec tunnels for this cluster
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
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </>
      ) : (
        <EmptyState
          icon={IconBuilding}
          title="No tunnels configured"
          description="This cluster has no GRE or IPsec tunnels configured."
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

      <TunnelForm
        isOpen={formOpen}
        onClose={handleFormClose}
        clusterId={clusterId}
        tunnelType={formType}
        editTunnel={editTunnel}
      />

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
