# Tunnels Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Tunnels mock page with a flat table, XL detail drawer, full CRUD via stepper forms, and split add button — matching the production quality of the Routes and Address Lists pages.

**Architecture:** Replace the collapsible group-by-type layout (`TunnelGroup.tsx`) with a flat `Table` component (`TunnelTable.tsx`). Add CRUD mock functions to `mockTunnelsData.ts` with TanStack Query mutations in `tunnelsApi.ts`. Create a new `TunnelForm.tsx` with Mantine `Stepper` for multi-step create/edit (2 steps for GRE, 3 for IPsec). Rewrite `TunnelDetail.tsx` as an XL drawer with edit/delete actions.

**Tech Stack:** React 19, Mantine UI 9, TanStack Query 5, Zustand, TypeScript 5.9

---

### Task 1: Add CRUD functions to mock data

**Files:**
- Modify: `frontend/src/mocks/mockTunnelsData.ts`

- [ ] **Step 1: Add mutable state pattern and CRUD functions**

Replace the current immutable data with a deep-cloned mutable store (same pattern as `mockAddressListsData.ts`), and add `addTunnel`, `updateTunnel`, `deleteTunnel` functions.

```typescript
// frontend/src/mocks/mockTunnelsData.ts
import type { Tunnel, GRETunnel, IPsecTunnel } from '../api/types';

const seedData: Record<string, Tunnel[]> = {
  // edge-gw-01
  'mock-1': [
    {
      id: 'gre-1-1', name: 'gre-to-branch-bgd', tunnelType: 'gre',
      localAddress: '203.0.113.2', remoteAddress: '172.16.10.1', localInterface: 'ether1',
      mtu: 1476, keepaliveInterval: 10, keepaliveRetries: 3,
      disabled: false, running: true, comment: 'GRE to Belgrade branch',
    } as GRETunnel,
    {
      id: 'gre-1-2', name: 'gre-to-branch-nis', tunnelType: 'gre',
      localAddress: '203.0.113.2', remoteAddress: '172.16.20.1', localInterface: 'ether1',
      mtu: 1476, keepaliveInterval: 10, keepaliveRetries: 3,
      disabled: false, running: false, comment: 'GRE to Nis branch',
    } as GRETunnel,
    {
      id: 'ipsec-1-1', name: 'ipsec-to-branch-bgd', tunnelType: 'ipsec',
      mode: 'route-based', localAddress: '203.0.113.2', remoteAddress: '172.16.10.1',
      ikeVersion: 2, authMethod: 'pre-shared-key',
      phase1: { encryption: 'aes-256-cbc', hash: 'sha256', dhGroup: 14, lifetime: '8h' },
      phase2: { encryption: 'aes-256-cbc', hash: 'sha256', pfsGroup: 14, lifetime: '1h' },
      tunnelInterface: 'ipsec-bgd', localSubnet: '', remoteSubnet: '',
      disabled: false, established: true, comment: 'IPsec to Belgrade',
    } as IPsecTunnel,
    {
      id: 'ipsec-1-2', name: 'ipsec-policy-datacenter', tunnelType: 'ipsec',
      mode: 'policy-based', localAddress: '203.0.113.2', remoteAddress: '198.51.100.1',
      ikeVersion: 2, authMethod: 'pre-shared-key',
      phase1: { encryption: 'aes-128-cbc', hash: 'sha256', dhGroup: 19, lifetime: '24h' },
      phase2: { encryption: 'aes-128-gcm', hash: 'none', pfsGroup: 19, lifetime: '1h' },
      tunnelInterface: '', localSubnet: '10.0.1.0/24', remoteSubnet: '10.20.0.0/24',
      disabled: false, established: true, comment: 'Policy-based to datacenter',
    } as IPsecTunnel,
  ],

  // edge-gw-02
  'mock-2': [
    {
      id: 'gre-2-1', name: 'gre-backup-bgd', tunnelType: 'gre',
      localAddress: '203.0.113.3', remoteAddress: '172.16.10.1', localInterface: 'ether1',
      mtu: 1476, keepaliveInterval: 10, keepaliveRetries: 3,
      disabled: false, running: true, comment: 'Backup GRE to Belgrade',
    } as GRETunnel,
    {
      id: 'ipsec-2-1', name: 'ipsec-backup-bgd', tunnelType: 'ipsec',
      mode: 'route-based', localAddress: '203.0.113.3', remoteAddress: '172.16.10.1',
      ikeVersion: 2, authMethod: 'pre-shared-key',
      phase1: { encryption: 'aes-256-cbc', hash: 'sha256', dhGroup: 14, lifetime: '8h' },
      phase2: { encryption: 'aes-256-cbc', hash: 'sha256', pfsGroup: 14, lifetime: '1h' },
      tunnelInterface: 'ipsec-bgd-bkp', localSubnet: '', remoteSubnet: '',
      disabled: false, established: true, comment: 'Backup IPsec to Belgrade',
    } as IPsecTunnel,
  ],

  // core-rtr-01
  'mock-3': [],
  // core-rtr-02
  'mock-4': [],

  // branch-rtr-bgd
  'mock-5': [
    {
      id: 'gre-5-1', name: 'gre-to-hq', tunnelType: 'gre',
      localAddress: '172.16.10.1', remoteAddress: '203.0.113.2', localInterface: 'ether1',
      mtu: 1476, keepaliveInterval: 10, keepaliveRetries: 3,
      disabled: false, running: true, comment: 'GRE to HQ',
    } as GRETunnel,
    {
      id: 'ipsec-5-1', name: 'ipsec-to-hq', tunnelType: 'ipsec',
      mode: 'policy-based', localAddress: '172.16.10.1', remoteAddress: '203.0.113.2',
      ikeVersion: 2, authMethod: 'pre-shared-key',
      phase1: { encryption: 'aes-256-cbc', hash: 'sha256', dhGroup: 14, lifetime: '8h' },
      phase2: { encryption: 'aes-256-cbc', hash: 'sha256', pfsGroup: 14, lifetime: '1h' },
      tunnelInterface: '', localSubnet: '192.168.1.0/24', remoteSubnet: '10.0.1.0/24',
      disabled: false, established: true, comment: 'IPsec to HQ',
    } as IPsecTunnel,
  ],

  // branch-rtr-nis (offline)
  'mock-6': [
    {
      id: 'gre-6-1', name: 'gre-to-hq', tunnelType: 'gre',
      localAddress: '172.16.20.1', remoteAddress: '203.0.113.2', localInterface: 'ether1',
      mtu: 1476, keepaliveInterval: 10, keepaliveRetries: 3,
      disabled: false, running: false, comment: 'GRE to HQ',
    } as GRETunnel,
    {
      id: 'ipsec-6-1', name: 'ipsec-to-hq', tunnelType: 'ipsec',
      mode: 'policy-based', localAddress: '172.16.20.1', remoteAddress: '203.0.113.2',
      ikeVersion: 2, authMethod: 'pre-shared-key',
      phase1: { encryption: 'aes-256-cbc', hash: 'sha256', dhGroup: 14, lifetime: '8h' },
      phase2: { encryption: 'aes-256-cbc', hash: 'sha256', pfsGroup: 14, lifetime: '1h' },
      tunnelInterface: '', localSubnet: '192.168.2.0/24', remoteSubnet: '10.0.1.0/24',
      disabled: false, established: false, comment: 'IPsec to HQ',
    } as IPsecTunnel,
  ],

  // lab-rtr-01
  'mock-7': [],

  // vpn-gw-01
  'mock-8': [
    {
      id: 'ipsec-8-1', name: 'ipsec-partner-api', tunnelType: 'ipsec',
      mode: 'route-based', localAddress: '10.0.1.10', remoteAddress: '198.51.100.50',
      ikeVersion: 2, authMethod: 'certificate',
      phase1: { encryption: 'aes-256-cbc', hash: 'sha256', dhGroup: 20, lifetime: '24h' },
      phase2: { encryption: 'aes-256-gcm', hash: 'none', pfsGroup: 20, lifetime: '2h' },
      tunnelInterface: 'ipsec-partner', localSubnet: '', remoteSubnet: '',
      disabled: false, established: true, comment: 'Partner API tunnel',
    } as IPsecTunnel,
    {
      id: 'ipsec-8-2', name: 'ipsec-cloud-dr', tunnelType: 'ipsec',
      mode: 'route-based', localAddress: '10.0.1.10', remoteAddress: '203.0.113.100',
      ikeVersion: 1, authMethod: 'pre-shared-key',
      phase1: { encryption: 'aes-128-cbc', hash: 'sha1', dhGroup: 14, lifetime: '8h' },
      phase2: { encryption: 'aes-128-cbc', hash: 'sha1', pfsGroup: 14, lifetime: '1h' },
      tunnelInterface: 'ipsec-cloud', localSubnet: '', remoteSubnet: '',
      disabled: false, established: true, comment: 'Cloud DR site',
    } as IPsecTunnel,
    {
      id: 'ipsec-8-3', name: 'ipsec-vendor-net', tunnelType: 'ipsec',
      mode: 'policy-based', localAddress: '10.0.1.10', remoteAddress: '192.0.2.1',
      ikeVersion: 2, authMethod: 'pre-shared-key',
      phase1: { encryption: 'aes-256-cbc', hash: 'sha256', dhGroup: 19, lifetime: '8h' },
      phase2: { encryption: 'aes-256-cbc', hash: 'sha256', pfsGroup: 19, lifetime: '1h' },
      tunnelInterface: '', localSubnet: '10.88.0.0/24', remoteSubnet: '172.20.0.0/16',
      disabled: true, established: false, comment: 'Vendor network (disabled)',
    } as IPsecTunnel,
  ],

  // backup-rtr-01
  'mock-9': [],
};

// Mutable state — deep clone to prevent seed corruption
let data = structuredClone(seedData);
let nextId = 1000;

export function listTunnels(routerId: string): Tunnel[] {
  return data[routerId] ?? [];
}

export function getTunnel(routerId: string, id: string): Tunnel | undefined {
  return data[routerId]?.find((t) => t.id === id);
}

export function addTunnel(routerId: string, tunnel: Omit<Tunnel, 'id'>): Tunnel {
  if (!data[routerId]) data[routerId] = [];
  const id = `tunnel-${++nextId}`;
  const newTunnel = { ...tunnel, id } as Tunnel;
  data[routerId].push(newTunnel);
  return newTunnel;
}

export function updateTunnel(routerId: string, id: string, updates: Partial<Tunnel>): Tunnel {
  const list = data[routerId];
  if (!list) throw new Error(`Router ${routerId} not found`);
  const index = list.findIndex((t) => t.id === id);
  if (index === -1) throw new Error(`Tunnel ${id} not found`);
  list[index] = { ...list[index], ...updates } as Tunnel;
  return list[index];
}

export function deleteTunnel(routerId: string, id: string): void {
  const list = data[routerId];
  if (!list) return;
  const index = list.findIndex((t) => t.id === id);
  if (index !== -1) list.splice(index, 1);
}
```

- [ ] **Step 2: Verify the app compiles**

Run: `cd /Users/pavle/speckit/kormos/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/mocks/mockTunnelsData.ts
git commit -m "Add CRUD functions to tunnel mock data"
```

---

### Task 2: Add mutation hooks to tunnelsApi

**Files:**
- Modify: `frontend/src/features/tunnels/tunnelsApi.ts`

- [ ] **Step 1: Add mutation hooks following addressListsApi pattern**

```typescript
// frontend/src/features/tunnels/tunnelsApi.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import type { Tunnel } from '../../api/types';
import { useMockMode } from '../../mocks/useMockMode';
import { listTunnels, addTunnel, updateTunnel, deleteTunnel } from '../../mocks/mockTunnelsData';

export function useTunnels(routerId: string | null) {
  const isMock = useMockMode();

  return useQuery<Tunnel[]>({
    queryKey: ['tunnels', routerId],
    queryFn: async () => {
      if (isMock) return listTunnels(routerId!);
      const response = await apiClient.get<Tunnel[]>(
        `/routers/${routerId}/tunnels`,
      );
      return response.data;
    },
    enabled: !!routerId,
  });
}

export function useAddTunnel(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tunnel: Omit<Tunnel, 'id'>) => {
      if (isMock) return addTunnel(routerId!, tunnel);
      const response = await apiClient.post(
        `/routers/${routerId}/tunnels`,
        tunnel,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tunnels', routerId] });
    },
  });
}

export function useUpdateTunnel(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Tunnel> }) => {
      if (isMock) return updateTunnel(routerId!, id, updates);
      const response = await apiClient.patch(
        `/routers/${routerId}/tunnels/${id}`,
        updates,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tunnels', routerId] });
    },
  });
}

export function useDeleteTunnel(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (isMock) return deleteTunnel(routerId!, id);
      const response = await apiClient.delete(
        `/routers/${routerId}/tunnels/${id}`,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tunnels', routerId] });
    },
  });
}
```

- [ ] **Step 2: Verify the app compiles**

Run: `cd /Users/pavle/speckit/kormos/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/tunnels/tunnelsApi.ts
git commit -m "Add mutation hooks for tunnel CRUD operations"
```

---

### Task 3: Create TunnelTable component (flat table)

**Files:**
- Create: `frontend/src/features/tunnels/TunnelTable.tsx`

- [ ] **Step 1: Create the flat table component**

This replaces `TunnelGroup.tsx`. It renders all tunnels in one table with Type and Mode badge columns, matching the `RoutesPage` table patterns exactly.

```typescript
// frontend/src/features/tunnels/TunnelTable.tsx
import {
  Table,
  Text,
  Badge,
  Group,
  Skeleton,
  Stack,
} from '@mantine/core';
import MonoText from '../../components/common/MonoText';
import StatusIndicator from '../../components/common/StatusIndicator';
import type { Tunnel, GRETunnel, IPsecTunnel } from '../../api/types';

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

export function getStatus(tunnel: Tunnel): { status: 'running' | 'stopped' | 'disabled'; label: string } {
  if (tunnel.tunnelType === 'gre') {
    const gre = tunnel as GRETunnel;
    if (gre.disabled) return { status: 'disabled', label: 'Disabled' };
    if (gre.running) return { status: 'running', label: 'Running' };
    return { status: 'stopped', label: 'Stopped' };
  }
  const ipsec = tunnel as IPsecTunnel;
  if (ipsec.disabled) return { status: 'disabled', label: 'Disabled' };
  if (ipsec.established) return { status: 'running', label: 'Established' };
  return { status: 'stopped', label: 'Down' };
}

const COLUMN_COUNT = 6;

interface TunnelTableProps {
  tunnels: Tunnel[];
  search: string;
  onRowClick: (tunnel: Tunnel) => void;
}

export function TunnelTableSkeleton() {
  return (
    <Table withRowBorders={false} style={tableStyle}>
      <Table.Thead>
        <Table.Tr style={headerRowStyle}>
          <Table.Th><HeaderLabel>Name</HeaderLabel></Table.Th>
          <Table.Th style={{ width: 80 }}><HeaderLabel>Type</HeaderLabel></Table.Th>
          <Table.Th style={{ width: 100 }}><HeaderLabel>Mode</HeaderLabel></Table.Th>
          <Table.Th><HeaderLabel>Local Address</HeaderLabel></Table.Th>
          <Table.Th><HeaderLabel>Remote Address</HeaderLabel></Table.Th>
          <Table.Th style={{ width: 100 }}><HeaderLabel>Status</HeaderLabel></Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {Array.from({ length: 4 }).map((_, i) => (
          <Table.Tr
            key={i}
            style={{ borderBottom: '1px solid var(--mantine-color-gray-1)' }}
          >
            <Table.Td>
              <Skeleton height={14} width={140} radius="sm" />
            </Table.Td>
            <Table.Td style={{ width: 80 }}>
              <Skeleton height={18} width={50} radius="sm" />
            </Table.Td>
            <Table.Td style={{ width: 100 }}>
              <Skeleton height={18} width={70} radius="sm" />
            </Table.Td>
            <Table.Td>
              <Skeleton height={14} width={110} radius="sm" />
            </Table.Td>
            <Table.Td>
              <Skeleton height={14} width={110} radius="sm" />
            </Table.Td>
            <Table.Td style={{ width: 100 }}>
              <Skeleton height={18} width={80} radius="sm" />
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

export default function TunnelTable({ tunnels, search, onRowClick }: TunnelTableProps) {
  return (
    <Table withRowBorders={false} style={tableStyle}>
      <Table.Thead>
        <Table.Tr style={headerRowStyle}>
          <Table.Th><HeaderLabel>Name</HeaderLabel></Table.Th>
          <Table.Th style={{ width: 80 }}><HeaderLabel>Type</HeaderLabel></Table.Th>
          <Table.Th style={{ width: 100 }}><HeaderLabel>Mode</HeaderLabel></Table.Th>
          <Table.Th><HeaderLabel>Local Address</HeaderLabel></Table.Th>
          <Table.Th><HeaderLabel>Remote Address</HeaderLabel></Table.Th>
          <Table.Th style={{ width: 100 }}><HeaderLabel>Status</HeaderLabel></Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {tunnels.map((tunnel, index) => {
          const isLast = index === tunnels.length - 1;
          const { status, label } = getStatus(tunnel);
          const isDisabled = tunnel.tunnelType === 'gre'
            ? (tunnel as GRETunnel).disabled
            : (tunnel as IPsecTunnel).disabled;

          return (
            <Table.Tr
              key={tunnel.id}
              onClick={() => onRowClick(tunnel)}
              style={{
                cursor: 'pointer',
                borderBottom: isLast
                  ? '1px solid var(--mantine-color-gray-2)'
                  : '1px solid var(--mantine-color-gray-1)',
              }}
            >
              <Table.Td style={{ opacity: isDisabled ? 0.5 : undefined }}>
                <Text fw={500} size="xs">{tunnel.name}</Text>
              </Table.Td>
              <Table.Td style={{ width: 80 }}>
                <Group>
                  <Badge
                    variant="light"
                    size="xs"
                    radius="sm"
                    color={tunnel.tunnelType === 'gre' ? 'blue' : 'violet'}
                  >
                    {tunnel.tunnelType === 'gre' ? 'GRE' : 'IPsec'}
                  </Badge>
                </Group>
              </Table.Td>
              <Table.Td style={{ width: 100 }}>
                {tunnel.tunnelType === 'ipsec' ? (
                  <Group>
                    <Badge
                      variant="light"
                      size="xs"
                      radius="sm"
                      color={(tunnel as IPsecTunnel).mode === 'route-based' ? 'blue' : 'violet'}
                    >
                      {(tunnel as IPsecTunnel).mode === 'route-based' ? 'route' : 'policy'}
                    </Badge>
                  </Group>
                ) : (
                  <Text size="xs" c="dimmed">{'\u2014'}</Text>
                )}
              </Table.Td>
              <Table.Td style={{ opacity: isDisabled ? 0.5 : undefined }}>
                <MonoText size="xs">{tunnel.localAddress}</MonoText>
              </Table.Td>
              <Table.Td style={{ opacity: isDisabled ? 0.5 : undefined }}>
                <MonoText size="xs">{tunnel.remoteAddress || '\u2014'}</MonoText>
              </Table.Td>
              <Table.Td style={{ width: 100 }}>
                <StatusIndicator status={status} label={label} />
              </Table.Td>
            </Table.Tr>
          );
        })}
        {tunnels.length === 0 && search && (
          <Table.Tr>
            <Table.Td colSpan={COLUMN_COUNT}>
              <Text size="sm" c="dimmed" ta="center" py="lg">
                No tunnels match &ldquo;{search}&rdquo;
              </Text>
            </Table.Td>
          </Table.Tr>
        )}
      </Table.Tbody>
    </Table>
  );
}
```

- [ ] **Step 2: Verify the app compiles**

Run: `cd /Users/pavle/speckit/kormos/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/tunnels/TunnelTable.tsx
git commit -m "Add flat TunnelTable component with skeleton loader"
```

---

### Task 4: Rewrite TunnelDetail drawer

**Files:**
- Modify: `frontend/src/features/tunnels/TunnelDetail.tsx`

- [ ] **Step 1: Rewrite the detail drawer with XL size, actions, and proper sections**

```typescript
// frontend/src/features/tunnels/TunnelDetail.tsx
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
import {
  IconPencil,
  IconChevronDown,
  IconTrash,
} from '@tabler/icons-react';
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
        {/* Connection Details */}
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

        {/* GRE Configuration */}
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

        {/* IPsec Configuration */}
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

            {/* Phase 1 Proposal */}
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

            {/* Phase 2 Proposal */}
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
        <Group>
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
                  style={{ paddingLeft: 6, paddingRight: 6, borderLeft: '1px solid var(--mantine-color-gray-4)' }}
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
        </Group>
      </Stack>
    </Drawer>
  );
}
```

- [ ] **Step 2: Verify the app compiles**

Run: `cd /Users/pavle/speckit/kormos/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/tunnels/TunnelDetail.tsx
git commit -m "Rewrite TunnelDetail as XL drawer with edit/delete actions"
```

---

### Task 5: Create TunnelForm stepper component

**Files:**
- Create: `frontend/src/features/tunnels/TunnelForm.tsx`

- [ ] **Step 1: Create the multi-step stepper form for creating and editing tunnels**

This is the largest component. GRE tunnels get 2 steps (Connection, GRE Params). IPsec tunnels get 3 steps (Connection, Phase 1, Phase 2). Edit mode pre-populates all values.

```typescript
// frontend/src/features/tunnels/TunnelForm.tsx
import { useState, useEffect } from 'react';
import {
  Drawer,
  Stepper,
  TextInput,
  NumberInput,
  Select,
  SegmentedControl,
  Button,
  Group,
  Stack,
  Text,
} from '@mantine/core';
import { useAddTunnel, useUpdateTunnel } from './tunnelsApi';
import type { Tunnel, GRETunnel, IPsecTunnel } from '../../api/types';

type TunnelType = 'gre' | 'ipsec';

interface TunnelFormProps {
  isOpen: boolean;
  onClose: () => void;
  routerId: string;
  tunnelType: TunnelType;
  editTunnel?: Tunnel | null;
}

const ENCRYPTION_OPTIONS = [
  { value: 'aes-128-cbc', label: 'aes-128-cbc' },
  { value: 'aes-256-cbc', label: 'aes-256-cbc' },
  { value: 'aes-128-gcm', label: 'aes-128-gcm' },
  { value: 'aes-256-gcm', label: 'aes-256-gcm' },
];

const HASH_OPTIONS = [
  { value: 'sha1', label: 'sha1' },
  { value: 'sha256', label: 'sha256' },
  { value: 'sha512', label: 'sha512' },
  { value: 'none', label: 'none' },
];

const DH_GROUP_OPTIONS = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '5', label: '5' },
  { value: '14', label: '14' },
  { value: '19', label: '19' },
  { value: '20', label: '20' },
];

const PFS_GROUP_OPTIONS = [
  { value: '0', label: 'None' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '5', label: '5' },
  { value: '14', label: '14' },
  { value: '19', label: '19' },
  { value: '20', label: '20' },
];

interface GREFormState {
  name: string;
  localAddress: string;
  remoteAddress: string;
  localInterface: string;
  comment: string;
  mtu: number;
  keepaliveInterval: number;
  keepaliveRetries: number;
}

interface IPsecFormState {
  name: string;
  mode: 'route-based' | 'policy-based';
  localAddress: string;
  remoteAddress: string;
  ikeVersion: string;
  authMethod: string;
  tunnelInterface: string;
  localSubnet: string;
  remoteSubnet: string;
  comment: string;
  phase1Encryption: string;
  phase1Hash: string;
  phase1DhGroup: string;
  phase1Lifetime: string;
  phase2Encryption: string;
  phase2Hash: string;
  phase2PfsGroup: string;
  phase2Lifetime: string;
}

function getInitialGREState(tunnel?: GRETunnel | null): GREFormState {
  if (tunnel) {
    return {
      name: tunnel.name,
      localAddress: tunnel.localAddress,
      remoteAddress: tunnel.remoteAddress,
      localInterface: tunnel.localInterface,
      comment: tunnel.comment,
      mtu: tunnel.mtu,
      keepaliveInterval: tunnel.keepaliveInterval,
      keepaliveRetries: tunnel.keepaliveRetries,
    };
  }
  return {
    name: '',
    localAddress: '',
    remoteAddress: '',
    localInterface: 'ether1',
    comment: '',
    mtu: 1476,
    keepaliveInterval: 10,
    keepaliveRetries: 3,
  };
}

function getInitialIPsecState(tunnel?: IPsecTunnel | null): IPsecFormState {
  if (tunnel) {
    return {
      name: tunnel.name,
      mode: tunnel.mode,
      localAddress: tunnel.localAddress,
      remoteAddress: tunnel.remoteAddress,
      ikeVersion: String(tunnel.ikeVersion),
      authMethod: tunnel.authMethod,
      tunnelInterface: tunnel.tunnelInterface,
      localSubnet: tunnel.localSubnet,
      remoteSubnet: tunnel.remoteSubnet,
      comment: tunnel.comment,
      phase1Encryption: tunnel.phase1.encryption,
      phase1Hash: tunnel.phase1.hash,
      phase1DhGroup: String(tunnel.phase1.dhGroup),
      phase1Lifetime: tunnel.phase1.lifetime,
      phase2Encryption: tunnel.phase2.encryption,
      phase2Hash: tunnel.phase2.hash,
      phase2PfsGroup: String(tunnel.phase2.pfsGroup),
      phase2Lifetime: tunnel.phase2.lifetime,
    };
  }
  return {
    name: '',
    mode: 'route-based',
    localAddress: '',
    remoteAddress: '',
    ikeVersion: '2',
    authMethod: 'pre-shared-key',
    tunnelInterface: '',
    localSubnet: '',
    remoteSubnet: '',
    comment: '',
    phase1Encryption: 'aes-256-cbc',
    phase1Hash: 'sha256',
    phase1DhGroup: '14',
    phase1Lifetime: '8h',
    phase2Encryption: 'aes-256-cbc',
    phase2Hash: 'sha256',
    phase2PfsGroup: '14',
    phase2Lifetime: '1h',
  };
}

export default function TunnelForm({
  isOpen,
  onClose,
  routerId,
  tunnelType,
  editTunnel,
}: TunnelFormProps) {
  const isEdit = !!editTunnel;
  const totalSteps = tunnelType === 'gre' ? 2 : 3;

  const [activeStep, setActiveStep] = useState(0);
  const [greState, setGreState] = useState<GREFormState>(getInitialGREState);
  const [ipsecState, setIpsecState] = useState<IPsecFormState>(getInitialIPsecState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const addMutation = useAddTunnel(routerId);
  const updateMutation = useUpdateTunnel(routerId);

  // Reset form when opening
  useEffect(() => {
    if (isOpen) {
      setActiveStep(0);
      setErrors({});
      setSaving(false);
      if (tunnelType === 'gre') {
        setGreState(getInitialGREState(editTunnel as GRETunnel | null));
      } else {
        setIpsecState(getInitialIPsecState(editTunnel as IPsecTunnel | null));
      }
    }
  }, [isOpen, editTunnel, tunnelType]);

  const validateGREStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    if (step === 0) {
      if (!greState.name.trim()) newErrors.name = 'Name is required';
      if (!greState.localAddress.trim()) newErrors.localAddress = 'Local address is required';
      if (!greState.remoteAddress.trim()) newErrors.remoteAddress = 'Remote address is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateIPsecStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};
    if (step === 0) {
      if (!ipsecState.name.trim()) newErrors.name = 'Name is required';
      if (!ipsecState.localAddress.trim()) newErrors.localAddress = 'Local address is required';
      if (!ipsecState.remoteAddress.trim()) newErrors.remoteAddress = 'Remote address is required';
      if (ipsecState.mode === 'route-based' && !ipsecState.tunnelInterface.trim()) {
        newErrors.tunnelInterface = 'Tunnel interface is required';
      }
      if (ipsecState.mode === 'policy-based') {
        if (!ipsecState.localSubnet.trim()) newErrors.localSubnet = 'Local subnet is required';
        if (!ipsecState.remoteSubnet.trim()) newErrors.remoteSubnet = 'Remote subnet is required';
      }
    }
    // Phase 1 and Phase 2 have defaults, no validation needed
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    const isValid = tunnelType === 'gre'
      ? validateGREStep(activeStep)
      : validateIPsecStep(activeStep);
    if (isValid) {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setErrors({});
    setActiveStep((prev) => prev - 1);
  };

  const handleSubmit = async () => {
    const isValid = tunnelType === 'gre'
      ? validateGREStep(activeStep)
      : validateIPsecStep(activeStep);
    if (!isValid) return;

    setSaving(true);
    try {
      if (tunnelType === 'gre') {
        const tunnelData: Omit<GRETunnel, 'id'> = {
          tunnelType: 'gre',
          name: greState.name.trim(),
          localAddress: greState.localAddress.trim(),
          remoteAddress: greState.remoteAddress.trim(),
          localInterface: greState.localInterface.trim() || 'ether1',
          comment: greState.comment.trim(),
          mtu: greState.mtu,
          keepaliveInterval: greState.keepaliveInterval,
          keepaliveRetries: greState.keepaliveRetries,
          disabled: false,
          running: true,
        };
        if (isEdit) {
          await updateMutation.mutateAsync({ id: editTunnel!.id, updates: tunnelData });
        } else {
          await addMutation.mutateAsync(tunnelData);
        }
      } else {
        const tunnelData: Omit<IPsecTunnel, 'id'> = {
          tunnelType: 'ipsec',
          name: ipsecState.name.trim(),
          mode: ipsecState.mode,
          localAddress: ipsecState.localAddress.trim(),
          remoteAddress: ipsecState.remoteAddress.trim(),
          ikeVersion: Number(ipsecState.ikeVersion) as 1 | 2,
          authMethod: ipsecState.authMethod as 'pre-shared-key' | 'certificate',
          tunnelInterface: ipsecState.tunnelInterface.trim(),
          localSubnet: ipsecState.localSubnet.trim(),
          remoteSubnet: ipsecState.remoteSubnet.trim(),
          comment: ipsecState.comment.trim(),
          phase1: {
            encryption: ipsecState.phase1Encryption,
            hash: ipsecState.phase1Hash,
            dhGroup: Number(ipsecState.phase1DhGroup),
            lifetime: ipsecState.phase1Lifetime,
          },
          phase2: {
            encryption: ipsecState.phase2Encryption,
            hash: ipsecState.phase2Hash,
            pfsGroup: Number(ipsecState.phase2PfsGroup),
            lifetime: ipsecState.phase2Lifetime,
          },
          disabled: false,
          established: false,
        };
        if (isEdit) {
          await updateMutation.mutateAsync({ id: editTunnel!.id, updates: tunnelData });
        } else {
          await addMutation.mutateAsync(tunnelData);
        }
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const isLastStep = activeStep === totalSteps - 1;
  const title = isEdit
    ? `Edit ${tunnelType === 'gre' ? 'GRE' : 'IPsec'} Tunnel`
    : `Add ${tunnelType === 'gre' ? 'GRE' : 'IPsec'} Tunnel`;

  return (
    <Drawer
      opened={isOpen}
      onClose={onClose}
      position="right"
      size="xl"
      padding="xl"
      title={title}
    >
      <Stack gap="lg">
        {tunnelType === 'gre' ? (
          <Stepper active={activeStep} size="sm" allowNextStepsSelect={isEdit}>
            <Stepper.Step label="Connection" description="Endpoints">
              <Stack gap="md" mt="md">
                <TextInput
                  label="Name"
                  placeholder="e.g. gre-to-branch"
                  value={greState.name}
                  onChange={(e) => setGreState((s) => ({ ...s, name: e.currentTarget.value }))}
                  error={errors.name}
                  required
                />
                <Group grow>
                  <TextInput
                    label="Local Address"
                    placeholder="e.g. 203.0.113.2"
                    value={greState.localAddress}
                    onChange={(e) => setGreState((s) => ({ ...s, localAddress: e.currentTarget.value }))}
                    error={errors.localAddress}
                    required
                  />
                  <TextInput
                    label="Remote Address"
                    placeholder="e.g. 172.16.10.1"
                    value={greState.remoteAddress}
                    onChange={(e) => setGreState((s) => ({ ...s, remoteAddress: e.currentTarget.value }))}
                    error={errors.remoteAddress}
                    required
                  />
                </Group>
                <TextInput
                  label="Local Interface"
                  placeholder="ether1"
                  value={greState.localInterface}
                  onChange={(e) => setGreState((s) => ({ ...s, localInterface: e.currentTarget.value }))}
                />
                <TextInput
                  label="Comment"
                  placeholder="Optional description"
                  value={greState.comment}
                  onChange={(e) => setGreState((s) => ({ ...s, comment: e.currentTarget.value }))}
                />
              </Stack>
            </Stepper.Step>

            <Stepper.Step label="GRE Parameters" description="Tunnel config">
              <Stack gap="md" mt="md">
                <NumberInput
                  label="MTU"
                  value={greState.mtu}
                  onChange={(val) => setGreState((s) => ({ ...s, mtu: Number(val) || 1476 }))}
                  min={68}
                  max={65535}
                />
                <NumberInput
                  label="Keepalive Interval"
                  description="Set to 0 to disable"
                  value={greState.keepaliveInterval}
                  onChange={(val) => setGreState((s) => ({ ...s, keepaliveInterval: Number(val) || 0 }))}
                  min={0}
                  suffix="s"
                />
                <NumberInput
                  label="Keepalive Retries"
                  value={greState.keepaliveRetries}
                  onChange={(val) => setGreState((s) => ({ ...s, keepaliveRetries: Number(val) || 0 }))}
                  min={0}
                />
              </Stack>
            </Stepper.Step>
          </Stepper>
        ) : (
          <Stepper active={activeStep} size="sm" allowNextStepsSelect={isEdit}>
            <Stepper.Step label="Connection" description="Endpoints & auth">
              <Stack gap="md" mt="md">
                <TextInput
                  label="Name"
                  placeholder="e.g. ipsec-to-branch"
                  value={ipsecState.name}
                  onChange={(e) => setIpsecState((s) => ({ ...s, name: e.currentTarget.value }))}
                  error={errors.name}
                  required
                />
                <div>
                  <Text size="sm" fw={500} mb={4}>Mode <Text component="span" c="red">*</Text></Text>
                  <SegmentedControl
                    fullWidth
                    data={[
                      { value: 'route-based', label: 'Route-based' },
                      { value: 'policy-based', label: 'Policy-based' },
                    ]}
                    value={ipsecState.mode}
                    onChange={(val) => setIpsecState((s) => ({ ...s, mode: val as 'route-based' | 'policy-based' }))}
                  />
                </div>
                <Group grow>
                  <TextInput
                    label="Local Address"
                    placeholder="e.g. 203.0.113.2"
                    value={ipsecState.localAddress}
                    onChange={(e) => setIpsecState((s) => ({ ...s, localAddress: e.currentTarget.value }))}
                    error={errors.localAddress}
                    required
                  />
                  <TextInput
                    label="Remote Address"
                    placeholder="e.g. 172.16.10.1"
                    value={ipsecState.remoteAddress}
                    onChange={(e) => setIpsecState((s) => ({ ...s, remoteAddress: e.currentTarget.value }))}
                    error={errors.remoteAddress}
                    required
                  />
                </Group>
                <Group grow>
                  <Select
                    label="IKE Version"
                    data={[
                      { value: '1', label: 'v1' },
                      { value: '2', label: 'v2' },
                    ]}
                    value={ipsecState.ikeVersion}
                    onChange={(val) => setIpsecState((s) => ({ ...s, ikeVersion: val || '2' }))}
                  />
                  <Select
                    label="Auth Method"
                    data={[
                      { value: 'pre-shared-key', label: 'Pre-shared Key' },
                      { value: 'certificate', label: 'Certificate' },
                    ]}
                    value={ipsecState.authMethod}
                    onChange={(val) => setIpsecState((s) => ({ ...s, authMethod: val || 'pre-shared-key' }))}
                  />
                </Group>
                {ipsecState.mode === 'route-based' && (
                  <TextInput
                    label="Tunnel Interface"
                    placeholder="e.g. ipsec-bgd"
                    value={ipsecState.tunnelInterface}
                    onChange={(e) => setIpsecState((s) => ({ ...s, tunnelInterface: e.currentTarget.value }))}
                    error={errors.tunnelInterface}
                    required
                  />
                )}
                {ipsecState.mode === 'policy-based' && (
                  <Group grow>
                    <TextInput
                      label="Local Subnet"
                      placeholder="e.g. 10.0.1.0/24"
                      value={ipsecState.localSubnet}
                      onChange={(e) => setIpsecState((s) => ({ ...s, localSubnet: e.currentTarget.value }))}
                      error={errors.localSubnet}
                      required
                    />
                    <TextInput
                      label="Remote Subnet"
                      placeholder="e.g. 10.20.0.0/24"
                      value={ipsecState.remoteSubnet}
                      onChange={(e) => setIpsecState((s) => ({ ...s, remoteSubnet: e.currentTarget.value }))}
                      error={errors.remoteSubnet}
                      required
                    />
                  </Group>
                )}
                <TextInput
                  label="Comment"
                  placeholder="Optional description"
                  value={ipsecState.comment}
                  onChange={(e) => setIpsecState((s) => ({ ...s, comment: e.currentTarget.value }))}
                />
              </Stack>
            </Stepper.Step>

            <Stepper.Step label="Phase 1" description="IKE proposal">
              <Stack gap="md" mt="md">
                <Group grow>
                  <Select
                    label="Encryption"
                    data={ENCRYPTION_OPTIONS}
                    value={ipsecState.phase1Encryption}
                    onChange={(val) => setIpsecState((s) => ({ ...s, phase1Encryption: val || 'aes-256-cbc' }))}
                  />
                  <Select
                    label="Hash"
                    data={HASH_OPTIONS}
                    value={ipsecState.phase1Hash}
                    onChange={(val) => setIpsecState((s) => ({ ...s, phase1Hash: val || 'sha256' }))}
                  />
                </Group>
                <Group grow>
                  <Select
                    label="DH Group"
                    data={DH_GROUP_OPTIONS}
                    value={ipsecState.phase1DhGroup}
                    onChange={(val) => setIpsecState((s) => ({ ...s, phase1DhGroup: val || '14' }))}
                  />
                  <TextInput
                    label="Lifetime"
                    placeholder="e.g. 8h"
                    value={ipsecState.phase1Lifetime}
                    onChange={(e) => setIpsecState((s) => ({ ...s, phase1Lifetime: e.currentTarget.value }))}
                  />
                </Group>
              </Stack>
            </Stepper.Step>

            <Stepper.Step label="Phase 2" description="ESP proposal">
              <Stack gap="md" mt="md">
                <Group grow>
                  <Select
                    label="Encryption"
                    data={ENCRYPTION_OPTIONS}
                    value={ipsecState.phase2Encryption}
                    onChange={(val) => setIpsecState((s) => ({ ...s, phase2Encryption: val || 'aes-256-cbc' }))}
                  />
                  <Select
                    label="Hash"
                    data={HASH_OPTIONS}
                    value={ipsecState.phase2Hash}
                    onChange={(val) => setIpsecState((s) => ({ ...s, phase2Hash: val || 'sha256' }))}
                  />
                </Group>
                <Group grow>
                  <Select
                    label="PFS Group"
                    data={PFS_GROUP_OPTIONS}
                    value={ipsecState.phase2PfsGroup}
                    onChange={(val) => setIpsecState((s) => ({ ...s, phase2PfsGroup: val || '14' }))}
                  />
                  <TextInput
                    label="Lifetime"
                    placeholder="e.g. 1h"
                    value={ipsecState.phase2Lifetime}
                    onChange={(e) => setIpsecState((s) => ({ ...s, phase2Lifetime: e.currentTarget.value }))}
                  />
                </Group>
              </Stack>
            </Stepper.Step>
          </Stepper>
        )}

        {/* Navigation buttons */}
        <Group justify="space-between" mt="md">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Group gap="sm">
            {activeStep > 0 && (
              <Button variant="default" onClick={handleBack}>
                Back
              </Button>
            )}
            {isLastStep ? (
              <Button onClick={handleSubmit} loading={saving}>
                {isEdit ? 'Save' : 'Create'}
              </Button>
            ) : (
              <Button onClick={handleNext}>
                Next
              </Button>
            )}
          </Group>
        </Group>
      </Stack>
    </Drawer>
  );
}
```

- [ ] **Step 2: Verify the app compiles**

Run: `cd /Users/pavle/speckit/kormos/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/tunnels/TunnelForm.tsx
git commit -m "Add TunnelForm stepper component for GRE and IPsec CRUD"
```

---

### Task 6: Rewrite TunnelsPage with all integrations

**Files:**
- Modify: `frontend/src/features/tunnels/TunnelsPage.tsx`

- [ ] **Step 1: Rewrite TunnelsPage with flat table, split add button, CRUD integration**

```typescript
// frontend/src/features/tunnels/TunnelsPage.tsx
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

function matchesTunnel(tunnel: Tunnel, query: string, isCIDR: boolean): boolean {
  if (tunnel.name.toLowerCase().includes(query)) return true;
  if (tunnel.tunnelType.toLowerCase().includes(query)) return true;

  if (isCIDR) {
    if (prefixOverlaps(query, tunnel.localAddress)) return true;
    if (tunnel.remoteAddress && prefixOverlaps(query, tunnel.remoteAddress)) return true;
    if (tunnel.tunnelType === 'ipsec') {
      const ipsec = tunnel as IPsecTunnel;
      if (ipsec.localSubnet && prefixOverlaps(query, ipsec.localSubnet)) return true;
      if (ipsec.remoteSubnet && prefixOverlaps(query, ipsec.remoteSubnet)) return true;
    }
  } else {
    if (tunnel.localAddress.includes(query)) return true;
    if (tunnel.remoteAddress && tunnel.remoteAddress.includes(query)) return true;
  }

  return false;
}

function AddTunnelButton({ onAddGRE, onAddIPsec }: { onAddGRE: () => void; onAddIPsec: () => void }) {
  return (
    <Button.Group>
      <Button leftSection={<IconPlus size={16} />} onClick={onAddGRE}>
        Add Tunnel
      </Button>
      <Menu position="bottom-end">
        <Menu.Target>
          <Button
            style={{ paddingLeft: 8, paddingRight: 8, borderLeft: '1px solid rgba(255,255,255,0.3)' }}
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

export default function TunnelsPage() {
  const selectedRouterId = useRouterStore((s) => s.selectedRouterId);
  const { data: tunnels, isLoading, error, refetch } = useTunnels(selectedRouterId);
  const deleteMutation = useDeleteTunnel(selectedRouterId);

  const [search, setSearch] = useState('');
  const [selectedTunnel, setSelectedTunnel] = useState<Tunnel | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<'gre' | 'ipsec'>('gre');
  const [editTunnel, setEditTunnel] = useState<Tunnel | null>(null);

  // Delete confirmation
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

  const filteredTunnels = useMemo(() => {
    if (!tunnels) return [];
    const trimmed = search.trim();
    if (!trimmed) return tunnels;

    const query = trimmed.toLowerCase();
    const isCIDR = looksLikeCIDR(trimmed);

    return tunnels.filter((t) => matchesTunnel(t, query, isCIDR));
  }, [tunnels, search]);

  const handleRowClick = (tunnel: Tunnel) => {
    setSelectedTunnel(tunnel);
    setDetailOpen(true);
  };

  const handleDetailClose = () => {
    setDetailOpen(false);
  };

  const handleAddGRE = () => {
    setEditTunnel(null);
    setFormType('gre');
    setFormOpen(true);
  };

  const handleAddIPsec = () => {
    setEditTunnel(null);
    setFormType('ipsec');
    setFormOpen(true);
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
    if (deleteTarget) {
      deleteMutation.mutate(
        { id: deleteTarget.id },
        {
          onSuccess: () => {
            setDeleteTarget(null);
            setSelectedTunnel(null);
          },
        },
      );
    }
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditTunnel(null);
  };

  if (!selectedRouterId) {
    return (
      <Stack align="center" mt="xl" gap="md">
        <IconRouter size={48} stroke={1.5} color="var(--mantine-color-dimmed)" />
        <Text c="dimmed" size="lg">
          Select a router to view tunnels
        </Text>
      </Stack>
    );
  }

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
            tunnels={filteredTunnels}
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
            <AddTunnelButton onAddGRE={handleAddGRE} onAddIPsec={handleAddIPsec} />
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
```

- [ ] **Step 2: Verify the app compiles**

Run: `cd /Users/pavle/speckit/kormos/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/tunnels/TunnelsPage.tsx
git commit -m "Rewrite TunnelsPage with flat table, split add button, and CRUD"
```

---

### Task 7: Delete TunnelGroup.tsx and verify

**Files:**
- Delete: `frontend/src/features/tunnels/TunnelGroup.tsx`

- [ ] **Step 1: Delete the old TunnelGroup component**

```bash
rm frontend/src/features/tunnels/TunnelGroup.tsx
```

- [ ] **Step 2: Verify no remaining imports of TunnelGroup**

Run: `cd /Users/pavle/speckit/kormos/frontend && grep -r "TunnelGroup" src/`
Expected: No matches

- [ ] **Step 3: Verify the app compiles**

Run: `cd /Users/pavle/speckit/kormos/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Verify the dev server runs**

Run: `cd /Users/pavle/speckit/kormos/frontend && npx vite build --mode development 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src/features/tunnels/
git commit -m "Remove obsolete TunnelGroup component"
```

---

### Task 8: Manual smoke test and final commit

- [ ] **Step 1: Start dev server and verify all pages render**

Run: `cd /Users/pavle/speckit/kormos/frontend && npx vite build --mode development 2>&1 | tail -5`
Expected: Build succeeds with no errors

- [ ] **Step 2: Verify TypeScript compilation**

Run: `cd /Users/pavle/speckit/kormos/frontend && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Verify ESLint passes**

Run: `cd /Users/pavle/speckit/kormos/frontend && npx eslint src/features/tunnels/ --ext .ts,.tsx 2>&1 | tail -20`
Expected: No errors (warnings are acceptable)
