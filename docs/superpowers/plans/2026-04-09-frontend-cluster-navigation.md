# Frontend Cluster Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the entire frontend from router-scoped to cluster-scoped views. The Routers page "Connect" button targets a cluster (not a router). All feature pages fetch data from cluster-scoped backend endpoints instead of router-scoped ones. The navigation model treats clusters as the primary entity.

**Tech Stack:** TypeScript 5.9.3, React 19, React Router 7, Mantine UI 9, TanStack Query 5, Zustand 5

---

## File Structure

### Renamed Files

| Old Path | New Path |
|----------|----------|
| `frontend/src/stores/useRouterStore.ts` | `frontend/src/stores/useClusterStore.ts` |
| `frontend/src/components/shell/RouterSelector.tsx` | `frontend/src/components/shell/ClusterSelector.tsx` |

### Modified Files

| File | Change |
|------|--------|
| `frontend/src/components/shell/AppShell.tsx` | Import useClusterStore + ClusterSelector |
| `frontend/src/features/configure/ConfigureLayout.tsx` | Import useClusterStore |
| `frontend/src/features/routers/RoutersPage.tsx` | Connect navigates to cluster, import useClusterStore |
| `frontend/src/features/dashboard/DashboardPage.tsx` | Import useClusterStore |
| `frontend/src/components/undo/UndoHistoryPanel.tsx` | Import useClusterStore |
| `frontend/src/components/undo/UndoHistoryButton.tsx` | Import useClusterStore |
| `frontend/src/features/routes/routesApi.ts` | Cluster endpoints, direct mutations |
| `frontend/src/features/firewall/firewallApi.ts` | Cluster endpoints, direct mutations |
| `frontend/src/features/address-lists/addressListsApi.ts` | Cluster endpoints, direct mutations |
| `frontend/src/features/interfaces/interfacesApi.ts` | Cluster endpoints, new MergedInterface type |
| `frontend/src/features/tunnels/tunnelsApi.ts` | Cluster endpoints (GRE + IPsec separated) |
| `frontend/src/features/wireguard/wireguardApi.ts` | Cluster endpoints |
| `frontend/src/api/types.ts` | Add MergedInterface, MergedInterfaceEndpoint, RouterWireGuard types |

### Backend Dependencies

| Feature | Backend Sub-project | Status |
|---------|-------------------|--------|
| Routes, Firewall, Address Lists | Cluster read/write endpoints (sub-project 1) | **Not yet implemented** |
| Interfaces | Cluster interfaces endpoint (sub-project 2) | **Not yet implemented** |
| Tunnels (GRE, IPsec) | Tunnel/WireGuard backend | **Done** (current branch) |
| WireGuard | Tunnel/WireGuard backend | **Done** (current branch) |

---

## Task 1: Rename useRouterStore to useClusterStore

**Files:**
- Create: `frontend/src/stores/useClusterStore.ts`
- Delete: `frontend/src/stores/useRouterStore.ts`

- [ ] **Step 1: Create useClusterStore.ts**

Create `frontend/src/stores/useClusterStore.ts`:

```typescript
import { create } from 'zustand';

interface ClusterState {
  selectedClusterId: string | null;
  selectCluster: (id: string) => void;
  clearCluster: () => void;
}

export const useClusterStore = create<ClusterState>((set, get) => ({
  selectedClusterId: localStorage.getItem('selected_cluster_id'),

  selectCluster: (id: string) => {
    if (get().selectedClusterId === id) return;
    localStorage.setItem('selected_cluster_id', id);
    set({ selectedClusterId: id });
  },

  clearCluster: () => {
    localStorage.removeItem('selected_cluster_id');
    set({ selectedClusterId: null });
  },
}));
```

- [ ] **Step 2: Delete the old store file**

Delete `frontend/src/stores/useRouterStore.ts`.

- [ ] **Step 3: Verify build**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -50
```

This will fail because consumers still import the old file. That is expected -- we fix all consumers in the next tasks.

**Commit:** `Rename useRouterStore to useClusterStore with cluster-scoped state`

---

## Task 2: Update all useRouterStore consumers

**Files:**
- Modify: `frontend/src/components/shell/AppShell.tsx`
- Modify: `frontend/src/features/configure/ConfigureLayout.tsx`
- Modify: `frontend/src/features/routers/RoutersPage.tsx`
- Modify: `frontend/src/features/dashboard/DashboardPage.tsx`
- Modify: `frontend/src/components/undo/UndoHistoryPanel.tsx`
- Modify: `frontend/src/components/undo/UndoHistoryButton.tsx`

- [ ] **Step 1: Update AppShell.tsx**

In `frontend/src/components/shell/AppShell.tsx`, replace:

```typescript
import { useRouterStore } from '../../stores/useRouterStore';
```

with:

```typescript
import { useClusterStore } from '../../stores/useClusterStore';
```

Then replace:

```typescript
  const selectedRouterId = useRouterStore((s) => s.selectedRouterId);
```

with:

```typescript
  const selectedClusterId = useClusterStore((s) => s.selectedClusterId);
```

Then replace all three occurrences of `selectedRouterId` in this file with `selectedClusterId`. Specifically, replace:

```typescript
  // Extract clusterId from URL if on a configure page, else fall back to store
  const configureClusterId = isConfigureActive
    ? location.pathname.split('/')[2] ?? selectedRouterId
    : selectedRouterId;
```

with:

```typescript
  // Extract clusterId from URL if on a configure page, else fall back to store
  const configureClusterId = isConfigureActive
    ? location.pathname.split('/')[2] ?? selectedClusterId
    : selectedClusterId;
```

- [ ] **Step 2: Update ConfigureLayout.tsx**

Replace the entire contents of `frontend/src/features/configure/ConfigureLayout.tsx` with:

```typescript
import { useEffect } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { useClusterStore } from '../../stores/useClusterStore';

export default function ConfigureLayout() {
  const { clusterId } = useParams<{ clusterId: string }>();
  const selectCluster = useClusterStore((s) => s.selectCluster);

  useEffect(() => {
    if (clusterId) {
      selectCluster(clusterId);
    }
  }, [clusterId, selectCluster]);

  return <Outlet />;
}
```

- [ ] **Step 3: Update RoutersPage.tsx**

In `frontend/src/features/routers/RoutersPage.tsx`, replace:

```typescript
import { useRouterStore } from '../../stores/useRouterStore';
```

with:

```typescript
import { useClusterStore } from '../../stores/useClusterStore';
```

Replace:

```typescript
  const selectRouter = useRouterStore((s) => s.selectRouter);
```

with:

```typescript
  const selectCluster = useClusterStore((s) => s.selectCluster);
  const navigate = useNavigate();
```

Note: `useNavigate` is not currently imported in RoutersPage.tsx. Add it to the existing `react-router-dom` imports. Find:

```typescript
import { notifications } from '@mantine/notifications';
```

This file does not import from react-router-dom currently, so add above the notifications import:

```typescript
import { useNavigate } from 'react-router-dom';
```

Then change the `onConnect` callback at line 650 from:

```typescript
                  onConnect={(router) => selectRouter(router.id)}
```

to:

```typescript
                  onConnect={(router) => {
                    const cluster = clusterForRouter(router.id);
                    if (cluster) {
                      selectCluster(cluster.id);
                      navigate(`/configure/${cluster.id}`);
                    }
                  }}
```

This makes the Connect button navigate to the cluster configure page rather than just selecting a router.

- [ ] **Step 4: Update DashboardPage.tsx**

In `frontend/src/features/dashboard/DashboardPage.tsx`, replace:

```typescript
import { useRouterStore } from '../../stores/useRouterStore';
```

with:

```typescript
import { useClusterStore } from '../../stores/useClusterStore';
```

Replace:

```typescript
  const selectedRouterId = useRouterStore((s) => s.selectedRouterId);
```

with:

```typescript
  const selectedClusterId = useClusterStore((s) => s.selectedClusterId);
```

Replace all remaining occurrences of `selectedRouterId` (used in `useOperationHistory` call and the configure interfaces navigation) with `selectedClusterId`. There are two:

```typescript
  const { data: opHistory } = useOperationHistory(selectedRouterId, 1, 50);
```

becomes:

```typescript
  const { data: opHistory } = useOperationHistory(selectedClusterId, 1, 50);
```

And:

```typescript
        <UnstyledButton onClick={() => {
          if (selectedRouterId) {
            navigate(configurePath(selectedRouterId, 'interfaces'));
          } else {
            navigate('/routers');
          }
        }}>
```

becomes:

```typescript
        <UnstyledButton onClick={() => {
          if (selectedClusterId) {
            navigate(configurePath(selectedClusterId, 'interfaces'));
          } else {
            navigate('/routers');
          }
        }}>
```

- [ ] **Step 5: Update UndoHistoryPanel.tsx**

In `frontend/src/components/undo/UndoHistoryPanel.tsx`, replace:

```typescript
import { useRouterStore } from '../../stores/useRouterStore';
```

with:

```typescript
import { useClusterStore } from '../../stores/useClusterStore';
```

Replace:

```typescript
  const selectedRouterId = useRouterStore((s) => s.selectedRouterId);
  const { data, isLoading } = useOperationHistory(selectedRouterId, 1, 50);
```

with:

```typescript
  const selectedClusterId = useClusterStore((s) => s.selectedClusterId);
  const { data, isLoading } = useOperationHistory(selectedClusterId, 1, 50);
```

- [ ] **Step 6: Update UndoHistoryButton.tsx**

In `frontend/src/components/undo/UndoHistoryButton.tsx`, replace:

```typescript
import { useRouterStore } from '../../stores/useRouterStore';
```

with:

```typescript
import { useClusterStore } from '../../stores/useClusterStore';
```

Replace:

```typescript
  const selectedRouterId = useRouterStore((s) => s.selectedRouterId);
  const { data } = useOperationHistory(selectedRouterId, 1, 50);
```

with:

```typescript
  const selectedClusterId = useClusterStore((s) => s.selectedClusterId);
  const { data } = useOperationHistory(selectedClusterId, 1, 50);
```

- [ ] **Step 7: Verify build**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -50
```

**Commit:** `Update all consumers to use useClusterStore instead of useRouterStore`

---

## Task 3: Rename RouterSelector to ClusterSelector

**Files:**
- Create: `frontend/src/components/shell/ClusterSelector.tsx`
- Delete: `frontend/src/components/shell/RouterSelector.tsx`
- Modify: `frontend/src/components/shell/AppShell.tsx`

- [ ] **Step 1: Create ClusterSelector.tsx**

Create `frontend/src/components/shell/ClusterSelector.tsx`:

```typescript
import { Combobox, InputBase, useCombobox, Group, Text, Box, Badge } from '@mantine/core';
import { IconSelector } from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useClusters } from '../../features/routers/clustersApi';
import { configurePath } from '../../features/configure/moduleConfig';
import { useClusterStore } from '../../stores/useClusterStore';
import type { ClusterResponse } from '../../api/types';

function ClusterOption({ cluster }: { cluster: ClusterResponse }) {
  const allReachable = cluster.routers.every((r) => r.is_reachable);
  const someReachable = cluster.routers.some((r) => r.is_reachable);

  return (
    <Group gap={8} wrap="nowrap" align="center">
      <Box
        w={7}
        h={7}
        style={{ borderRadius: '50%', flexShrink: 0 }}
        bg={allReachable ? 'green.7' : someReachable ? 'orange.7' : 'red.7'}
      />
      <div>
        <Group gap={6} wrap="nowrap">
          <Text size="xs" fw={600}>
            {cluster.name}
          </Text>
          <Badge variant="light" size="xs" radius="sm" color={cluster.mode === 'ha' ? 'blue' : 'gray'}>
            {cluster.mode === 'ha' ? 'HA' : 'Standalone'}
          </Badge>
        </Group>
        <Text size="xs" c="dimmed">
          {cluster.routers.length} {cluster.routers.length === 1 ? 'node' : 'nodes'}
        </Text>
      </div>
    </Group>
  );
}

export default function ClusterSelector() {
  const { data: clusters, isLoading } = useClusters();
  const selectedClusterId = useClusterStore((s) => s.selectedClusterId);
  const selectCluster = useClusterStore((s) => s.selectCluster);
  const navigate = useNavigate();
  const location = useLocation();

  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const selectedCluster = clusters?.find((c) => c.id === selectedClusterId);

  // Other clusters (not the currently selected one)
  const otherClusters = (clusters ?? []).filter((c) => c.id !== selectedClusterId);

  const allReachable = selectedCluster?.routers.every((r) => r.is_reachable) ?? false;
  const someReachable = selectedCluster?.routers.some((r) => r.is_reachable) ?? false;

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={(val) => {
        if (val === '__all_routers__') {
          navigate('/routers');
        } else {
          selectCluster(val);
          if (location.pathname.startsWith('/configure/')) {
            const subPath = location.pathname.split('/').slice(3).join('/');
            navigate(configurePath(val, subPath || undefined));
          }
        }
        combobox.closeDropdown();
      }}
    >
      <Combobox.Target>
        <InputBase
          component="button"
          type="button"
          pointer
          radius="sm"
          w={220}
          onClick={() => combobox.toggleDropdown()}
          rightSectionPointerEvents="none"
          rightSection={<IconSelector size={14} color="var(--mantine-color-dark-2)" />}
          leftSection={
            selectedCluster ? (
              <Box
                w={7}
                h={7}
                style={{ borderRadius: '50%', flexShrink: 0 }}
                bg={allReachable ? 'green.4' : someReachable ? 'orange.4' : 'red.4'}
              />
            ) : undefined
          }
          styles={{
            input: {
              backgroundColor: 'var(--mantine-color-dark-6)',
              borderColor: 'var(--mantine-color-dark-4)',
              color: '#ffffff',
              height: 'auto',
              minHeight: 32,
              paddingTop: 4,
              paddingBottom: 4,
            },
          }}
        >
          {selectedCluster ? (
            <div style={{ lineHeight: 1.3 }}>
              <Text size="xs" fw={600} c="white" truncate>
                {selectedCluster.name}
              </Text>
              <Text size="10px" c="dimmed" truncate>
                {selectedCluster.routers.length} {selectedCluster.routers.length === 1 ? 'node' : 'nodes'}
                {selectedCluster.mode === 'ha' ? ' (HA)' : ''}
              </Text>
            </div>
          ) : (
            <Text size="xs" c="dimmed">
              {isLoading ? 'Loading...' : 'Select cluster'}
            </Text>
          )}
        </InputBase>
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options>
          {otherClusters.map((cluster) => (
            <Combobox.Option
              key={cluster.id}
              value={cluster.id}
              style={{ padding: '6px 10px' }}
            >
              <ClusterOption cluster={cluster} />
            </Combobox.Option>
          ))}
          {otherClusters.length > 0 && <Combobox.Option value="" disabled style={{ padding: 0, borderTop: '1px solid var(--mantine-color-gray-3)', minHeight: 0 }} />}
          <Combobox.Option value="__all_routers__" style={{ padding: '6px 10px' }}>
            <Group gap={8} wrap="nowrap" align="center">
              <Box w={7} style={{ flexShrink: 0 }} />
              <div>
                <Text size="xs" fw={600}>All clusters</Text>
                <Text size="xs" c="dimmed">Browse & manage</Text>
              </div>
            </Group>
          </Combobox.Option>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
```

- [ ] **Step 2: Delete RouterSelector.tsx**

Delete `frontend/src/components/shell/RouterSelector.tsx`.

- [ ] **Step 3: Update AppShell.tsx import**

In `frontend/src/components/shell/AppShell.tsx`, replace:

```typescript
import RouterSelector from './RouterSelector';
```

with:

```typescript
import ClusterSelector from './ClusterSelector';
```

Replace the usage in the JSX:

```typescript
            <RouterSelector />
```

with:

```typescript
            <ClusterSelector />
```

- [ ] **Step 4: Verify build**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -50
```

**Commit:** `Replace RouterSelector with ClusterSelector showing cluster names`

---

## Task 4: Add new types to api/types.ts

**Files:**
- Modify: `frontend/src/api/types.ts`

- [ ] **Step 1: Add MergedInterface types**

In `frontend/src/api/types.ts`, add the following types after the existing `RouterInterface` type (after line 82):

```typescript
export interface MergedInterfaceEndpoint {
  router_id: string;
  router_name: string;
  mac_address: string;
  addresses: InterfaceAddress[];
  running: boolean;
}

export interface MergedInterface {
  name: string;
  default_name?: string;
  type: string;
  disabled: boolean;
  comment: string;
  mtu: number;
  properties: Record<string, unknown>;
  endpoints: MergedInterfaceEndpoint[];
}
```

- [ ] **Step 2: Add RouterWireGuard type**

In `frontend/src/api/types.ts`, add the following type after the `WireGuardPeer` type (after line 211):

```typescript
export interface RouterWireGuardInterface {
  router_id: string;
  router_name: string;
  interfaces: WireGuardInterface[];
}

export interface RouterWireGuardPeer {
  router_id: string;
  router_name: string;
  peers: WireGuardPeer[];
}
```

- [ ] **Step 3: Add cluster-scoped tunnel types**

In `frontend/src/api/types.ts`, add the following types after the `Tunnel` type (after line 153):

```typescript
export interface GRETunnelEndpoint {
  router_id: string;
  router_name: string;
  id: string;
  running: boolean;
}

export interface MergedGRETunnel {
  name: string;
  localAddress: string;
  remoteAddress: string;
  mtu: number;
  keepaliveInterval: number;
  keepaliveRetries: number;
  ipsecSecret: string;
  disabled: boolean;
  comment: string;
  endpoints: GRETunnelEndpoint[];
}

export interface IPsecTunnelEndpoint {
  router_id: string;
  router_name: string;
  established: boolean;
}

export interface MergedIPsecTunnel {
  name: string;
  mode: 'route-based' | 'policy-based';
  remoteAddress: string;
  localAddress: string;
  authMethod: 'pre-shared-key' | 'digital-signature';
  ipsecSecret: string;
  phase1: {
    encryption: string;
    hash: string;
    dhGroup: string;
    lifetime: string;
  };
  phase2: {
    encryption: string;
    authAlgorithm: string;
    pfsGroup: string;
    lifetime: string;
  };
  localSubnets: string[];
  remoteSubnets: string[];
  tunnelRoutes: string[];
  disabled: boolean;
  comment: string;
  endpoints: IPsecTunnelEndpoint[];
}
```

- [ ] **Step 4: Verify build**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -50
```

**Commit:** `Add MergedInterface, MergedTunnel, and RouterWireGuard types`

---

## Task 5: Migrate tunnels API to cluster endpoints

**Depends on:** Tunnel/WireGuard backend (done on current branch)

**Files:**
- Modify: `frontend/src/features/tunnels/tunnelsApi.ts`

- [ ] **Step 1: Rewrite tunnelsApi.ts**

Replace the entire contents of `frontend/src/features/tunnels/tunnelsApi.ts` with:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import type { GRETunnel, IPsecTunnel, MergedGRETunnel, MergedIPsecTunnel } from '../../api/types';
import { useMockMode } from '../../mocks/useMockMode';
import {
  listTunnels,
  addTunnel,
  updateTunnel,
  deleteTunnel,
} from '../../mocks/mockTunnelsData';
import type { Tunnel } from '../../api/types';

// ─── GRE Tunnels (cluster-scoped) ────────────────────────────────────────────

export function useGRETunnels(clusterId: string | null) {
  const isMock = useMockMode();

  return useQuery<MergedGRETunnel[]>({
    queryKey: ['tunnels-gre', clusterId],
    queryFn: async () => {
      if (isMock) {
        // Mock mode: return legacy tunnels filtered to GRE, wrapped as merged
        const all = listTunnels(clusterId!);
        return all
          .filter((t): t is GRETunnel => t.tunnelType === 'gre')
          .map((t) => ({
            name: t.name,
            localAddress: t.localAddress,
            remoteAddress: t.remoteAddress,
            mtu: t.mtu,
            keepaliveInterval: t.keepaliveInterval,
            keepaliveRetries: t.keepaliveRetries,
            ipsecSecret: t.ipsecSecret,
            disabled: t.disabled,
            comment: t.comment,
            endpoints: [{ router_id: clusterId!, router_name: 'mock', id: t.id, running: t.running }],
          }));
      }
      const response = await apiClient.get<MergedGRETunnel[]>(
        `/clusters/${clusterId}/tunnels/gre`,
      );
      return response.data;
    },
    enabled: !!clusterId,
  });
}

export function useCreateGRETunnel(clusterId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<GRETunnel, 'id' | 'running'>) => {
      const response = await apiClient.post<MergedGRETunnel>(
        `/clusters/${clusterId}/tunnels/gre`,
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tunnels-gre', clusterId] });
    },
  });
}

export function useUpdateGRETunnel(clusterId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, ...payload }: { name: string } & Partial<GRETunnel>) => {
      await apiClient.patch(`/clusters/${clusterId}/tunnels/gre/${name}`, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tunnels-gre', clusterId] });
    },
  });
}

export function useDeleteGRETunnel(clusterId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      await apiClient.delete(`/clusters/${clusterId}/tunnels/gre/${name}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tunnels-gre', clusterId] });
    },
  });
}

// ─── IPsec Tunnels (cluster-scoped) ──────────────────────────────────────────

export function useIPsecTunnels(clusterId: string | null) {
  const isMock = useMockMode();

  return useQuery<MergedIPsecTunnel[]>({
    queryKey: ['tunnels-ipsec', clusterId],
    queryFn: async () => {
      if (isMock) {
        const all = listTunnels(clusterId!);
        return all
          .filter((t): t is IPsecTunnel => t.tunnelType === 'ipsec')
          .map((t) => ({
            name: t.name,
            mode: t.mode,
            remoteAddress: t.remoteAddress,
            localAddress: t.localAddress,
            authMethod: t.authMethod,
            ipsecSecret: t.ipsecSecret,
            phase1: t.phase1,
            phase2: t.phase2,
            localSubnets: t.localSubnets,
            remoteSubnets: t.remoteSubnets,
            tunnelRoutes: t.tunnelRoutes,
            disabled: t.disabled,
            comment: t.comment,
            endpoints: [{ router_id: clusterId!, router_name: 'mock', established: t.established }],
          }));
      }
      const response = await apiClient.get<MergedIPsecTunnel[]>(
        `/clusters/${clusterId}/tunnels/ipsec`,
      );
      return response.data;
    },
    enabled: !!clusterId,
  });
}

export function useCreateIPsecTunnel(clusterId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<IPsecTunnel, 'id' | 'established'>) => {
      const response = await apiClient.post<MergedIPsecTunnel>(
        `/clusters/${clusterId}/tunnels/ipsec`,
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tunnels-ipsec', clusterId] });
    },
  });
}

export function useUpdateIPsecTunnel(clusterId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, ...payload }: { name: string } & Partial<IPsecTunnel>) => {
      await apiClient.patch(`/clusters/${clusterId}/tunnels/ipsec/${name}`, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tunnels-ipsec', clusterId] });
    },
  });
}

export function useDeleteIPsecTunnel(clusterId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      await apiClient.delete(`/clusters/${clusterId}/tunnels/ipsec/${name}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tunnels-ipsec', clusterId] });
    },
  });
}

// ─── Legacy hooks (kept for mock-mode compatibility in TunnelsPage) ──────────

export function useTunnels(routerId: string | null) {
  const isMock = useMockMode();

  return useQuery<Tunnel[]>({
    queryKey: ['tunnels', routerId],
    queryFn: async () => {
      if (isMock) return listTunnels(routerId!);
      // In live mode, this is no longer used. Callers should use
      // useGRETunnels / useIPsecTunnels instead.
      const response = await apiClient.get<Tunnel[]>(
        `/routers/${routerId}/tunnels`,
      );
      return response.data;
    },
    enabled: !!routerId && isMock,
  });
}

export function useAddTunnel(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tunnel: Omit<Tunnel, 'id'>) => {
      if (isMock) return addTunnel(routerId!, tunnel);
      throw new Error('Legacy useAddTunnel not supported in live mode');
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
      throw new Error('Legacy useUpdateTunnel not supported in live mode');
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
      throw new Error('Legacy useDeleteTunnel not supported in live mode');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tunnels', routerId] });
    },
  });
}
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -50
```

The TunnelsPage.tsx still uses the legacy hooks for now. It will keep compiling because we kept the legacy hooks. The TunnelsPage will be updated in a later task to use the new split GRE/IPsec hooks (this is a UI-level change that should be done when the page is redesigned).

**Commit:** `Migrate tunnels API to cluster-scoped GRE and IPsec endpoints`

---

## Task 6: Migrate WireGuard API to cluster endpoints

**Depends on:** Tunnel/WireGuard backend (done on current branch)

**Files:**
- Modify: `frontend/src/features/wireguard/wireguardApi.ts`

- [ ] **Step 1: Rewrite wireguardApi.ts**

Replace the entire contents of `frontend/src/features/wireguard/wireguardApi.ts` with:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import type { WireGuardInterface, WireGuardPeer, RouterWireGuardInterface, RouterWireGuardPeer } from '../../api/types';
import { useMockMode } from '../../mocks/useMockMode';
import {
  listWireGuardInterfaces,
  createWireGuardInterface,
  updateWireGuardInterface,
  deleteWireGuardInterface,
  listPeers,
  addPeer,
  updatePeer,
  deletePeer,
} from '../../mocks/mockWireGuardData';

// ─── Read hooks ──────────────────────────────────────────────────────────────

export function useWireGuardInterfaces(clusterId: string | null) {
  const isMock = useMockMode();
  return useQuery<WireGuardInterface[]>({
    queryKey: ['wireguard', clusterId],
    queryFn: async () => {
      if (isMock) return listWireGuardInterfaces(clusterId!);
      const response = await apiClient.get<WireGuardInterface[]>(`/clusters/${clusterId}/wireguard`);
      return response.data;
    },
    enabled: !!clusterId,
  });
}

export function useWireGuardPeers(clusterId: string | null) {
  const isMock = useMockMode();
  return useQuery<WireGuardPeer[]>({
    queryKey: ['wireguard-peers', clusterId],
    queryFn: async () => {
      if (isMock) return listPeers(clusterId!);
      const response = await apiClient.get<WireGuardPeer[]>(`/clusters/${clusterId}/wireguard/peers`);
      return response.data;
    },
    enabled: !!clusterId,
  });
}

// ─── WireGuard Interface mutations ───────────────────────────────────────────

export function useCreateWireGuardInterface(clusterId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<WireGuardInterface, 'id' | 'publicKey' | 'privateKey'>) => {
      if (isMock) return createWireGuardInterface(clusterId!, data);
      const response = await apiClient.post<WireGuardInterface>(
        `/clusters/${clusterId}/wireguard`,
        data,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wireguard', clusterId] });
    },
  });
}

export function useUpdateWireGuardInterface(clusterId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<WireGuardInterface> }) => {
      if (isMock) return updateWireGuardInterface(clusterId!, id, updates);
      await apiClient.patch(`/clusters/${clusterId}/wireguard/${id}`, updates);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wireguard', clusterId] });
    },
  });
}

export function useDeleteWireGuardInterface(clusterId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (isMock) return deleteWireGuardInterface(clusterId!, id);
      await apiClient.delete(`/clusters/${clusterId}/wireguard/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wireguard', clusterId] });
      void queryClient.invalidateQueries({ queryKey: ['wireguard-peers', clusterId] });
    },
  });
}

// ─── WireGuard Peer mutations ────────────────────────────────────────────────

export function useAddPeer(clusterId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (peer: Omit<WireGuardPeer, 'id'>) => {
      if (isMock) return addPeer(clusterId!, peer);
      const response = await apiClient.post<WireGuardPeer>(
        `/clusters/${clusterId}/wireguard/peers`,
        peer,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wireguard-peers', clusterId] });
    },
  });
}

export function useUpdatePeer(clusterId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<WireGuardPeer> }) => {
      if (isMock) return updatePeer(clusterId!, id, updates);
      await apiClient.patch(`/clusters/${clusterId}/wireguard/peers/${id}`, updates);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wireguard-peers', clusterId] });
    },
  });
}

export function useDeletePeer(clusterId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (isMock) return deletePeer(clusterId!, id);
      await apiClient.delete(`/clusters/${clusterId}/wireguard/peers/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wireguard-peers', clusterId] });
    },
  });
}
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -50
```

The WireGuard page and sub-components pass `routerId` as prop names internally, but the actual values are already `clusterId` from `useClusterId()`. The prop names are cosmetic and can be renamed in a separate cleanup pass if desired.

**Commit:** `Migrate WireGuard API to cluster-scoped endpoints`

---

## Task 7: Migrate routes API to cluster endpoints

**Depends on:** Backend cluster routes/firewall/address-lists endpoints (sub-project 1, NOT yet implemented)

**Files:**
- Modify: `frontend/src/features/routes/routesApi.ts`

- [ ] **Step 1: Rewrite routesApi.ts**

Replace the entire contents of `frontend/src/features/routes/routesApi.ts` with:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import type { Route } from '../../api/types';
import { useMockMode } from '../../mocks/useMockMode';
import { listRoutes, getRoute } from '../../mocks/mockRoutesData';

export interface CreateRoutePayload {
  destination: string;
  gateway: string;
  distance: number;
  comment?: string;
}

export interface UpdateRoutePayload {
  gateway?: string;
  distance?: number;
  disabled?: boolean;
  comment?: string;
}

export function useRoutes(clusterId: string | null) {
  const isMock = useMockMode();

  return useQuery<Route[]>({
    queryKey: ['routes', clusterId],
    queryFn: async () => {
      if (isMock) return listRoutes(clusterId!);
      const response = await apiClient.get<Route[]>(
        `/clusters/${clusterId}/routes`,
      );
      return response.data;
    },
    enabled: !!clusterId,
  });
}

export function useRoute(clusterId: string | null, id: string) {
  const isMock = useMockMode();

  return useQuery<Route>({
    queryKey: ['routes', clusterId, id],
    queryFn: async () => {
      if (isMock) {
        const route = getRoute(clusterId!, id);
        if (!route) throw new Error(`Route ${id} not found`);
        return route;
      }
      const response = await apiClient.get<Route>(
        `/clusters/${clusterId}/routes/${id}`,
      );
      return response.data;
    },
    enabled: !!clusterId && !!id,
  });
}

export function useCreateRoute(clusterId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateRoutePayload) => {
      const response = await apiClient.post<Route>(
        `/clusters/${clusterId}/routes`,
        payload,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['routes', clusterId] });
    },
  });
}

export function useUpdateRoute(clusterId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateRoutePayload & { id: string }) => {
      await apiClient.patch(`/clusters/${clusterId}/routes/${id}`, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['routes', clusterId] });
    },
  });
}

export function useDeleteRoute(clusterId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/clusters/${clusterId}/routes/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['routes', clusterId] });
    },
  });
}
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -50
```

**Commit:** `Migrate routes API to cluster-scoped endpoints`

---

## Task 8: Migrate firewall API to cluster endpoints

**Depends on:** Backend cluster routes/firewall/address-lists endpoints (sub-project 1, NOT yet implemented)

**Files:**
- Modify: `frontend/src/features/firewall/firewallApi.ts`

- [ ] **Step 1: Rewrite firewallApi.ts**

Replace the entire contents of `frontend/src/features/firewall/firewallApi.ts` with:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import type { FirewallRule } from '../../api/types';
import { useMockMode } from '../../mocks/useMockMode';
import {
  listFirewallRules,
  addFirewallRule,
  updateFirewallRule,
  deleteFirewallRule,
  moveFirewallRule,
} from '../../mocks/mockFirewallData';

export function useFirewallRules(clusterId: string | null) {
  const isMock = useMockMode();
  return useQuery<FirewallRule[]>({
    queryKey: ['firewall-rules', clusterId],
    queryFn: async () => {
      if (isMock) return listFirewallRules(clusterId!);
      const response = await apiClient.get<FirewallRule[]>(`/clusters/${clusterId}/firewall/filter`);
      return response.data;
    },
    enabled: !!clusterId,
  });
}

export function useAddFirewallRule(clusterId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rule: Omit<FirewallRule, 'id'>) => {
      if (isMock) return addFirewallRule(clusterId!, rule);
      const response = await apiClient.post<FirewallRule>(
        `/clusters/${clusterId}/firewall/filter`,
        rule,
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['firewall-rules', clusterId] });
    },
  });
}

export function useUpdateFirewallRule(clusterId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FirewallRule> }) => {
      if (isMock) return updateFirewallRule(clusterId!, id, updates);
      await apiClient.patch(`/clusters/${clusterId}/firewall/filter/${id}`, updates);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['firewall-rules', clusterId] });
    },
  });
}

export function useDeleteFirewallRule(clusterId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (isMock) return deleteFirewallRule(clusterId!, id);
      await apiClient.delete(`/clusters/${clusterId}/firewall/filter/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['firewall-rules', clusterId] });
    },
  });
}

export function useMoveFirewallRule(clusterId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ ruleId, destinationId }: { ruleId: string; destinationId: string }) => {
      if (isMock) return moveFirewallRule(clusterId!, ruleId, destinationId);
      await apiClient.post(`/clusters/${clusterId}/firewall/filter/move`, { '.id': ruleId, destination: destinationId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['firewall-rules', clusterId] });
    },
  });
}
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -50
```

**Commit:** `Migrate firewall API to cluster-scoped endpoints`

---

## Task 9: Migrate address lists API to cluster endpoints

**Depends on:** Backend cluster routes/firewall/address-lists endpoints (sub-project 1, NOT yet implemented)

**Files:**
- Modify: `frontend/src/features/address-lists/addressListsApi.ts`

- [ ] **Step 1: Rewrite addressListsApi.ts**

Replace the entire contents of `frontend/src/features/address-lists/addressListsApi.ts` with:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';
import type { AddressList } from '../../api/types';
import { useMockMode } from '../../mocks/useMockMode';
import {
  listAddressLists,
  createAddressList,
  deleteAddressList,
  addEntry,
  deleteEntries,
  updateEntry,
} from '../../mocks/mockAddressListsData';

export function useAddressLists(clusterId: string | null) {
  const isMock = useMockMode();

  return useQuery<AddressList[]>({
    queryKey: ['address-lists', clusterId],
    queryFn: async () => {
      if (isMock) return listAddressLists(clusterId!);
      const response = await apiClient.get<AddressList[]>(
        `/clusters/${clusterId}/address-lists`,
      );
      return response.data;
    },
    enabled: !!clusterId,
  });
}

export function useCreateAddressList(clusterId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      if (isMock) return createAddressList(clusterId!, name);
      // MikroTik creates a list implicitly when the first entry is added.
      // No separate API call needed.
      return { name };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['address-lists', clusterId] });
    },
  });
}

export function useDeleteAddressList(clusterId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      if (isMock) return deleteAddressList(clusterId!, name);
      await apiClient.delete(`/clusters/${clusterId}/address-lists/${encodeURIComponent(name)}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['address-lists', clusterId] });
    },
  });
}

export function useAddEntry(clusterId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listName,
      prefix,
      comment,
    }: {
      listName: string;
      prefix: string;
      comment: string;
    }) => {
      if (isMock) return addEntry(clusterId!, listName, prefix, comment);
      const response = await apiClient.post(
        `/clusters/${clusterId}/address-lists/${encodeURIComponent(listName)}/entries`,
        { address: prefix, comment },
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['address-lists', clusterId] });
    },
  });
}

export function useDeleteEntries(clusterId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listName,
      entryIds,
    }: {
      listName: string;
      entryIds: string[];
    }) => {
      if (isMock) return deleteEntries(clusterId!, listName, entryIds);
      // Delete entries one by one (or use bulk endpoint if backend supports it)
      await Promise.all(
        entryIds.map((entryId) =>
          apiClient.delete(
            `/clusters/${clusterId}/address-lists/${encodeURIComponent(listName)}/entries/${entryId}`,
          ),
        ),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['address-lists', clusterId] });
    },
  });
}

export function useUpdateEntry(clusterId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      listName,
      entryId,
      comment,
    }: {
      listName: string;
      entryId: string;
      comment: string;
    }) => {
      if (isMock) return updateEntry(clusterId!, listName, entryId, comment);
      await apiClient.patch(
        `/clusters/${clusterId}/address-lists/${encodeURIComponent(listName)}/entries/${entryId}`,
        { comment },
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['address-lists', clusterId] });
    },
  });
}
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -50
```

**Commit:** `Migrate address lists API to cluster-scoped endpoints`

---

## Task 10: Migrate interfaces API to cluster endpoints

**Depends on:** Backend cluster interfaces endpoint (sub-project 2, NOT yet implemented)

**Files:**
- Modify: `frontend/src/features/interfaces/interfacesApi.ts`

- [ ] **Step 1: Rewrite interfacesApi.ts**

Replace the entire contents of `frontend/src/features/interfaces/interfacesApi.ts` with:

```typescript
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../api/client';
import type { RouterInterface, MergedInterface } from '../../api/types';
import { useMockMode } from '../../mocks/useMockMode';
import { listInterfaces, getInterface } from '../../mocks/mockInterfacesData';

export function useInterfaces(clusterId: string | null) {
  const isMock = useMockMode();

  return useQuery<RouterInterface[]>({
    queryKey: ['interfaces', clusterId],
    queryFn: async () => {
      if (isMock) return listInterfaces(clusterId!);
      const response = await apiClient.get<RouterInterface[]>(
        `/clusters/${clusterId}/interfaces`,
      );
      return response.data;
    },
    enabled: !!clusterId,
  });
}

export function useMergedInterfaces(clusterId: string | null) {
  const isMock = useMockMode();

  return useQuery<MergedInterface[]>({
    queryKey: ['interfaces-merged', clusterId],
    queryFn: async () => {
      if (isMock) {
        // In mock mode, wrap flat interfaces as merged with single endpoint
        const flat = listInterfaces(clusterId!);
        return flat.map((iface) => ({
          name: iface.name,
          default_name: iface.default_name,
          type: iface.type,
          disabled: iface.disabled,
          comment: iface.comment,
          mtu: iface.mtu,
          properties: iface.properties,
          endpoints: [{
            router_id: clusterId!,
            router_name: 'mock',
            mac_address: iface.mac_address,
            addresses: iface.addresses,
            running: iface.running,
          }],
        }));
      }
      const response = await apiClient.get<MergedInterface[]>(
        `/clusters/${clusterId}/interfaces`,
      );
      return response.data;
    },
    enabled: !!clusterId,
  });
}

export function useInterface(clusterId: string | null, name: string) {
  const isMock = useMockMode();

  return useQuery<RouterInterface>({
    queryKey: ['interfaces', clusterId, name],
    queryFn: async () => {
      if (isMock) {
        const iface = getInterface(clusterId!, name);
        if (!iface) throw new Error(`Interface ${name} not found`);
        return iface;
      }
      const response = await apiClient.get<RouterInterface>(
        `/clusters/${clusterId}/interfaces/${name}`,
      );
      return response.data;
    },
    enabled: !!clusterId && !!name,
  });
}
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -50
```

**Commit:** `Migrate interfaces API to cluster-scoped endpoints`

---

## Task 11: Update InterfaceForm to use cluster endpoints for mutations

**Depends on:** Backend cluster interfaces endpoint (sub-project 2, NOT yet implemented)

**Files:**
- Modify: `frontend/src/features/interfaces/InterfaceForm.tsx`

The InterfaceForm currently uses `useExecuteOperation()` with `router_id` for add/modify. It needs to switch to calling cluster endpoints directly.

- [ ] **Step 1: Replace operation-based mutations with direct API calls**

In `frontend/src/features/interfaces/InterfaceForm.tsx`, replace the imports:

```typescript
import { useClusterId } from '../../hooks/useClusterId';
import { useExecuteOperation } from '../../api/operationsApi';
import { useInterfaces } from './interfacesApi';
```

with:

```typescript
import { useClusterId } from '../../hooks/useClusterId';
import apiClient from '../../api/client';
import { useInterfaces } from './interfacesApi';
```

Then replace the body of the component's variable declarations. Find:

```typescript
  const selectedRouterId = useClusterId();
  const executeOp = useExecuteOperation();
  const queryClient = useQueryClient();
  const { data: existingInterfaces } = useInterfaces(selectedRouterId);
```

Replace with:

```typescript
  const clusterId = useClusterId();
  const queryClient = useQueryClient();
  const { data: existingInterfaces } = useInterfaces(clusterId);
```

Then replace the `handleSubmit` function. Find the entire try block inside handleSubmit and replace it. The current code is:

```typescript
    try {
      if (isNew) {
        const path = resourcePath ?? `/interface/${interfaceType}`;

        await executeOp.mutateAsync({
          description: `Add ${interfaceType} interface`,
          operations: [{
            router_id: selectedRouterId,
            module: 'interfaces',
            operation_type: 'add',
            resource_path: path,
            body: cleanedValues as unknown as Record<string, unknown>,
          }],
        });

        notifications.show({
          title: 'Interface created',
          message: `New ${interfaceType} interface has been created.`,
          color: 'green',
        });
      } else {
        if (!iface) return;

        await executeOp.mutateAsync({
          description: `Update interface ${iface.name}`,
          operations: [{
            router_id: selectedRouterId,
            module: 'interfaces',
            operation_type: 'modify',
            resource_path: `/interface/${iface.name}`,
            resource_id: iface.id,
            body: cleanedValues as unknown as Record<string, unknown>,
          }],
        });

        notifications.show({
          title: 'Interface updated',
          message: `Changes to "${iface.name}" have been applied.`,
          color: 'green',
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['interfaces', selectedRouterId] });
      onClose();
```

Replace with:

```typescript
    try {
      if (isNew) {
        await apiClient.post(
          `/clusters/${clusterId}/interfaces`,
          cleanedValues,
        );

        notifications.show({
          title: 'Interface created',
          message: `New ${interfaceType} interface has been created.`,
          color: 'green',
        });
      } else {
        if (!iface) return;

        await apiClient.patch(
          `/clusters/${clusterId}/interfaces/${iface.name}`,
          cleanedValues,
        );

        notifications.show({
          title: 'Interface updated',
          message: `Changes to "${iface.name}" have been applied.`,
          color: 'green',
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['interfaces', clusterId] });
      await queryClient.invalidateQueries({ queryKey: ['interfaces-merged', clusterId] });
      onClose();
```

- [ ] **Step 2: Verify build**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -50
```

**Commit:** `Update InterfaceForm to use cluster endpoints for mutations`

---

## Task 12: Rename variable names in feature pages (cosmetic)

This is a cosmetic cleanup: the feature pages currently name the variable from `useClusterId()` as `selectedRouterId`. Since it is actually a cluster ID, rename for clarity.

**Files:**
- Modify: `frontend/src/features/interfaces/InterfacesPage.tsx`
- Modify: `frontend/src/features/routes/RoutesPage.tsx`
- Modify: `frontend/src/features/firewall/FirewallPage.tsx`
- Modify: `frontend/src/features/address-lists/AddressListsPage.tsx`
- Modify: `frontend/src/features/tunnels/TunnelsPage.tsx`
- Modify: `frontend/src/features/wireguard/WireGuardPage.tsx`

- [ ] **Step 1: Rename in InterfacesPage.tsx**

In `frontend/src/features/interfaces/InterfacesPage.tsx`, replace:

```typescript
  const selectedRouterId = useClusterId();
  const { data: interfaces, isLoading, error, refetch } = useInterfaces(selectedRouterId);
```

with:

```typescript
  const clusterId = useClusterId();
  const { data: interfaces, isLoading, error, refetch } = useInterfaces(clusterId);
```

- [ ] **Step 2: Rename in RoutesPage.tsx**

In `frontend/src/features/routes/RoutesPage.tsx`, replace:

```typescript
  const selectedRouterId = useClusterId();
  const { data: routes, isLoading, error, refetch } = useRoutes(selectedRouterId);
```

with:

```typescript
  const clusterId = useClusterId();
  const { data: routes, isLoading, error, refetch } = useRoutes(clusterId);
```

Then replace the two remaining references to `selectedRouterId` in this file:

```typescript
                          clusterId: selectedRouterId,
```

becomes:

```typescript
                          clusterId: clusterId,
```

And:

```typescript
        routerId={selectedRouterId}
```

becomes:

```typescript
        routerId={clusterId}
```

- [ ] **Step 3: Rename in FirewallPage.tsx**

In `frontend/src/features/firewall/FirewallPage.tsx`, replace all occurrences of `selectedRouterId` with `clusterId`. There are 7 occurrences:

Line 47: `const selectedRouterId = useClusterId();` becomes `const clusterId = useClusterId();`

Line 48: `useFirewallRules(selectedRouterId)` becomes `useFirewallRules(clusterId)`

Line 49: `useUpdateFirewallRule(selectedRouterId)` becomes `useUpdateFirewallRule(clusterId)`

Line 50: `useMoveFirewallRule(selectedRouterId)` becomes `useMoveFirewallRule(clusterId)`

Line 52: `useInterfaces(selectedRouterId)` becomes `useInterfaces(clusterId)`

Line 56: `useAddressLists(selectedRouterId)` becomes `useAddressLists(clusterId)`

Line 244: `routerId={selectedRouterId}` becomes `routerId={clusterId}`

Also update the ref and effect that reset state on router change:

```typescript
  const prevRouterId = useRef(selectedRouterId);
  useEffect(() => {
    if (prevRouterId.current !== selectedRouterId) {
```

becomes:

```typescript
  const prevClusterId = useRef(clusterId);
  useEffect(() => {
    if (prevClusterId.current !== clusterId) {
```

And the closing lines of the effect:

```typescript
      prevRouterId.current = selectedRouterId;
    }
  }, [selectedRouterId]);
```

becomes:

```typescript
      prevClusterId.current = clusterId;
    }
  }, [clusterId]);
```

The `useDeleteFirewallRule(selectedRouterId)` on line 50 also becomes `useDeleteFirewallRule(clusterId)`.

- [ ] **Step 4: Rename in AddressListsPage.tsx**

In `frontend/src/features/address-lists/AddressListsPage.tsx`, replace all occurrences of `selectedRouterId` with `clusterId`. There are 8 occurrences:

Line 48: `const selectedRouterId = useClusterId();` becomes `const clusterId = useClusterId();`

Line 49: `useAddressLists(selectedRouterId)` becomes `useAddressLists(clusterId)`

Line 50: `useDeleteAddressList(selectedRouterId)` becomes `useDeleteAddressList(clusterId)`

Line 51: `useDeleteEntries(selectedRouterId)` becomes `useDeleteEntries(clusterId)`

The ref/effect pattern:

```typescript
  const prevRouterId = useRef(selectedRouterId);
  useEffect(() => {
    if (prevRouterId.current !== selectedRouterId) {
```

becomes:

```typescript
  const prevClusterId = useRef(clusterId);
  useEffect(() => {
    if (prevClusterId.current !== clusterId) {
```

And:

```typescript
      prevRouterId.current = selectedRouterId;
    }
  }, [selectedRouterId]);
```

becomes:

```typescript
      prevClusterId.current = clusterId;
    }
  }, [clusterId]);
```

The second effect:

```typescript
  }, [selectedRouterId]);
```

becomes:

```typescript
  }, [clusterId]);
```

And the prop passes:

```typescript
                routerId={selectedRouterId}
```

becomes (there are 3 occurrences for AddressListGroup and 2 for AddressListForm):

```typescript
                routerId={clusterId}
```

- [ ] **Step 5: Rename in TunnelsPage.tsx**

In `frontend/src/features/tunnels/TunnelsPage.tsx`, replace all occurrences of `selectedRouterId` with `clusterId`:

Line 95: `const selectedRouterId = useClusterId();` becomes `const clusterId = useClusterId();`

Line 96: `useTunnels(selectedRouterId)` becomes `useTunnels(clusterId)`

Line 97: `useDeleteTunnel(selectedRouterId)` becomes `useDeleteTunnel(clusterId)`

The ref/effect:

```typescript
  const prevRouterId = useRef(selectedRouterId);
  useEffect(() => {
    if (prevRouterId.current !== selectedRouterId) {
```

becomes:

```typescript
  const prevClusterId = useRef(clusterId);
  useEffect(() => {
    if (prevClusterId.current !== clusterId) {
```

And:

```typescript
      prevRouterId.current = selectedRouterId;
    }
  }, [selectedRouterId]);
```

becomes:

```typescript
      prevClusterId.current = clusterId;
    }
  }, [clusterId]);
```

And the form prop:

```typescript
        routerId={selectedRouterId}
```

becomes:

```typescript
        routerId={clusterId}
```

- [ ] **Step 6: Rename in WireGuardPage.tsx**

In `frontend/src/features/wireguard/WireGuardPage.tsx`, replace all occurrences of `selectedRouterId` with `clusterId`:

Line 17: `const selectedRouterId = useClusterId();` becomes `const clusterId = useClusterId();`

Line 18: `useWireGuardInterfaces(selectedRouterId)` becomes `useWireGuardInterfaces(clusterId)`

The ref/effect:

```typescript
  const prevRouterId = useRef(selectedRouterId);
  useEffect(() => {
    if (prevRouterId.current !== selectedRouterId) {
```

becomes:

```typescript
  const prevClusterId = useRef(clusterId);
  useEffect(() => {
    if (prevClusterId.current !== clusterId) {
```

And:

```typescript
      prevRouterId.current = selectedRouterId;
    }
  }, [selectedRouterId]);
```

becomes:

```typescript
      prevClusterId.current = clusterId;
    }
  }, [clusterId]);
```

The two prop passes:

```typescript
          <WireGuardInterfaceTab routerId={selectedRouterId} />
```

becomes:

```typescript
          <WireGuardInterfaceTab routerId={clusterId} />
```

And:

```typescript
          <WireGuardPeers routerId={selectedRouterId} />
```

becomes:

```typescript
          <WireGuardPeers routerId={clusterId} />
```

- [ ] **Step 7: Verify build**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -50
```

**Commit:** `Rename selectedRouterId to clusterId across feature pages`

---

## Task 13: Final verification and cleanup

**Files:**
- All modified files

- [ ] **Step 1: Run full TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 2: Run lint**

```bash
cd frontend && npm run lint
```

- [ ] **Step 3: Verify no remaining references to old store**

Search for any lingering references:

```bash
grep -r "useRouterStore" frontend/src/ || echo "No references found"
grep -r "RouterSelector" frontend/src/ || echo "No references found"
grep -r "selectedRouterId" frontend/src/ || echo "No references found (or only in prop names)"
grep -r "selectRouter" frontend/src/ || echo "No references found"
grep -r "clearRouter" frontend/src/ || echo "No references found"
grep -r "selected_router_id" frontend/src/ || echo "No references found"
```

Note: `selectedRouterId` may still appear in prop interface definitions (like `routerId: string` in sub-components). These are cosmetic and acceptable -- the values passed are cluster IDs already. A full rename of all prop names from `routerId` to `clusterId` would touch many files and is tracked separately.

- [ ] **Step 4: Verify no references to old /routers/{id}/ endpoints in API hooks**

```bash
grep -r '`/routers/${' frontend/src/features/routes/routesApi.ts frontend/src/features/firewall/firewallApi.ts frontend/src/features/address-lists/addressListsApi.ts frontend/src/features/interfaces/interfacesApi.ts frontend/src/features/wireguard/wireguardApi.ts || echo "Clean"
```

The tunnels API may retain a legacy `/routers/` reference in the mock-only `useTunnels` hook, which is expected.

**Commit:** `Verify clean build and no stale references`

---

## Summary of All Changes

| # | Task | Backend Dependency | Status |
|---|------|-------------------|--------|
| 1 | Create useClusterStore | None | Ready |
| 2 | Update all store consumers | None | Ready |
| 3 | Create ClusterSelector | None | Ready |
| 4 | Add new types | None | Ready |
| 5 | Migrate tunnels API | Tunnel backend (done) | Ready |
| 6 | Migrate WireGuard API | Tunnel backend (done) | Ready |
| 7 | Migrate routes API | Sub-project 1 (pending) | Blocked |
| 8 | Migrate firewall API | Sub-project 1 (pending) | Blocked |
| 9 | Migrate address lists API | Sub-project 1 (pending) | Blocked |
| 10 | Migrate interfaces API | Sub-project 2 (pending) | Blocked |
| 11 | Update InterfaceForm | Sub-project 2 (pending) | Blocked |
| 12 | Rename variables in pages | None | Ready |
| 13 | Final verification | None | Ready |

Tasks 1-6 and 12-13 can be implemented immediately. Tasks 7-11 require the corresponding backend endpoints to be implemented first, but the frontend code can be written and tested against mock mode in the meantime.
