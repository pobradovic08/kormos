# Router Table Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the routers table from a flat striped table to a collapsible tree table supporting HA pairs and standalone routers, with status badges, version badges, role badges, and tenant info — all using Mantine `variant="light"` badges.

**Architecture:** Group routers by `cluster_id` into HA pairs (parent+children) and standalone entries. A new `routerGrouping.ts` utility handles grouping, status derivation (Online/Degraded/Offline), and version status computation (Up to date/Needs update/Version mismatch). The RoutersPage renders a `<Table>` (no stripes) with collapsible cluster rows. Mock data restructured into 3 HA pairs + 3 standalone routers.

**Tech Stack:** React 18, Mantine UI 7, TanStack Query, TypeScript 5.x, @tabler/icons-react

**Design Spec:** `docs/superpowers/specs/2026-04-03-router-table-redesign.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `frontend/src/api/types.ts` | Add cluster/role/version/uptime fields to Router |
| Modify | `frontend/src/components/common/StatusIndicator.tsx` | Add degraded status, switch to variant="light" |
| Modify | `frontend/src/mocks/mockData.ts` | Rewrite: 3 HA pairs (6 routers) + 3 standalone |
| Modify | `frontend/src/mocks/mockRoutersApi.ts` | Update createRouter for new fields |
| Create | `frontend/src/features/routers/routerGrouping.ts` | Grouping logic, status derivation, search filtering |
| Modify | `frontend/src/features/routers/RoutersPage.tsx` | Rewrite: tree table with collapse, badges, tenant links |
| Unchanged | `frontend/src/features/routers/RouterDetail.tsx` | Detail drawer — no changes needed |
| Unchanged | `frontend/src/features/routers/RouterForm.tsx` | Add/edit form — no changes needed |
| Unchanged | `frontend/src/features/routers/routersApi.ts` | API hooks — no changes needed |
| Unchanged | `frontend/src/components/common/MonoText.tsx` | Already supports `c` prop for color |
| Unchanged | `frontend/src/components/common/GaugeIndicator.tsx` | Used in detail drawer only |
| Unchanged | `frontend/src/utils/relativeTime.ts` | No longer used in table (uptime field instead) |
| Unchanged | `frontend/src/mocks/useMockMode.ts` | Env var check — no changes |

---

### Task 1: Extend Router type

**Files:**
- Modify: `frontend/src/api/types.ts:31-41`

- [ ] **Step 1: Add cluster, role, version, and uptime fields to Router interface**

In `frontend/src/api/types.ts`, add these optional fields to the `Router` interface after `tenant_name`:

```typescript
export interface Router {
  id: string;
  name: string;
  hostname: string;
  host: string;
  port: number;
  is_reachable: boolean;
  last_seen: string | null;
  created_at: string;
  tenant_name?: string;
  cluster_id?: string;
  cluster_name?: string;
  role?: 'master' | 'backup';
  routeros_version?: string;
  uptime?: string;
}
```

All new fields are optional (`?`) so existing code that creates Router objects without them still compiles.

---

### Task 2: Update StatusIndicator

**Files:**
- Modify: `frontend/src/components/common/StatusIndicator.tsx`

- [ ] **Step 1: Add degraded status and switch to variant="light"**

Replace the entire file content:

```typescript
import { Badge } from '@mantine/core';

interface StatusIndicatorProps {
  status: 'running' | 'stopped' | 'disabled' | 'degraded';
  label?: string;
}

const statusConfig: Record<StatusIndicatorProps['status'], { color: string; defaultLabel: string }> = {
  running: { color: 'green', defaultLabel: 'Online' },
  stopped: { color: 'red', defaultLabel: 'Offline' },
  disabled: { color: 'gray', defaultLabel: 'Disabled' },
  degraded: { color: 'orange', defaultLabel: 'Degraded' },
};

export default function StatusIndicator({ status, label }: StatusIndicatorProps) {
  const config = statusConfig[status];

  return (
    <Badge
      variant="light"
      color={config.color}
      size="sm"
      radius="sm"
    >
      {label ?? config.defaultLabel}
    </Badge>
  );
}
```

Changes: added `'degraded'` to the status union type, added degraded config with orange color, changed `variant` from `"filled"` to `"light"`.

---

### Task 3: Rewrite mock data

**Files:**
- Modify: `frontend/src/mocks/mockData.ts`

- [ ] **Step 1: Replace mock data with 3 HA pairs + 3 standalone routers**

Replace the entire file with:

```typescript
import type { Router, RouterStatus } from '../api/types';

export interface MockRouter extends Router {
  systemInfo: RouterStatus;
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600000).toISOString();
}
function daysAgo(d: number): string {
  return new Date(Date.now() - d * 86400000).toISOString();
}
function minutesAgo(m: number): string {
  return new Date(Date.now() - m * 60000).toISOString();
}

export const mockRouters: MockRouter[] = [
  // HA Pair 1: edge-gw — both online, both 7.16 → "Up to date"
  {
    id: 'mock-1', name: 'edge-gw-01', hostname: 'edge-gw-01.dc1.local',
    host: '10.0.1.1', port: 443, is_reachable: true, tenant_name: 'Mainstream',
    cluster_id: 'cluster-edge-gw', cluster_name: 'edge-gw', role: 'master',
    routeros_version: '7.16', uptime: '45d 12h',
    last_seen: minutesAgo(2), created_at: daysAgo(30),
    systemInfo: { is_reachable: true, routeros_version: '7.16', board_name: 'CHR', uptime: '45d 12h 30m', cpu_load: 12, free_memory: 805306368, total_memory: 1073741824, checked_at: minutesAgo(2) },
  },
  {
    id: 'mock-2', name: 'edge-gw-02', hostname: 'edge-gw-02.dc1.local',
    host: '10.0.1.4', port: 443, is_reachable: true, tenant_name: 'Mainstream',
    cluster_id: 'cluster-edge-gw', cluster_name: 'edge-gw', role: 'backup',
    routeros_version: '7.16', uptime: '45d 12h',
    last_seen: minutesAgo(2), created_at: daysAgo(30),
    systemInfo: { is_reachable: true, routeros_version: '7.16', board_name: 'CHR', uptime: '45d 12h 30m', cpu_load: 8, free_memory: 858993459, total_memory: 1073741824, checked_at: minutesAgo(2) },
  },

  // HA Pair 2: core-rtr — both online, 7.16 vs 7.14.3 → "Version mismatch"
  {
    id: 'mock-3', name: 'core-rtr-01', hostname: 'core-rtr-01.dc1.local',
    host: '10.0.1.2', port: 443, is_reachable: true, tenant_name: 'Mainstream',
    cluster_id: 'cluster-core-rtr', cluster_name: 'core-rtr', role: 'master',
    routeros_version: '7.16', uptime: '12d 5h',
    last_seen: minutesAgo(1), created_at: daysAgo(60),
    systemInfo: { is_reachable: true, routeros_version: '7.16', board_name: 'CHR', uptime: '12d 5h 15m', cpu_load: 45, free_memory: 322122547, total_memory: 1073741824, checked_at: minutesAgo(1) },
  },
  {
    id: 'mock-4', name: 'core-rtr-02', hostname: 'core-rtr-02.dc1.local',
    host: '10.0.1.3', port: 443, is_reachable: true, tenant_name: 'Mainstream',
    cluster_id: 'cluster-core-rtr', cluster_name: 'core-rtr', role: 'backup',
    routeros_version: '7.14.3', uptime: '12d 5h',
    last_seen: minutesAgo(1), created_at: daysAgo(60),
    systemInfo: { is_reachable: true, routeros_version: '7.14.3', board_name: 'CHR', uptime: '12d 5h 15m', cpu_load: 38, free_memory: 429496730, total_memory: 1073741824, checked_at: minutesAgo(1) },
  },

  // HA Pair 3: branch-rtr — one online (7.14.3), one offline → "Degraded" + "Needs update"
  {
    id: 'mock-5', name: 'branch-rtr-bgd', hostname: 'branch-rtr-bgd.rs.local',
    host: '172.16.10.1', port: 443, is_reachable: true, tenant_name: 'Acme Corp',
    cluster_id: 'cluster-branch-rtr', cluster_name: 'branch-rtr', role: 'master',
    routeros_version: '7.14.3', uptime: '28d 0h',
    last_seen: minutesAgo(3), created_at: daysAgo(45),
    systemInfo: { is_reachable: true, routeros_version: '7.14.3', board_name: 'CHR', uptime: '28d 0h 12m', cpu_load: 8, free_memory: 429496730, total_memory: 536870912, checked_at: minutesAgo(3) },
  },
  {
    id: 'mock-6', name: 'branch-rtr-nis', hostname: 'branch-rtr-nis.rs.local',
    host: '172.16.20.1', port: 443, is_reachable: false, tenant_name: 'Acme Corp',
    cluster_id: 'cluster-branch-rtr', cluster_name: 'branch-rtr', role: 'backup',
    last_seen: hoursAgo(2), created_at: daysAgo(45),
    systemInfo: { is_reachable: false, error: 'Connection timed out after 10s', checked_at: hoursAgo(2) },
  },

  // Standalone: lab-rtr-01 — online, 7.16 → "Up to date"
  {
    id: 'mock-7', name: 'lab-rtr-01', hostname: 'lab-rtr-01.lab.local',
    host: '192.168.100.1', port: 443, is_reachable: true, tenant_name: 'Lab Tenant',
    routeros_version: '7.16', uptime: '1d 2h',
    last_seen: minutesAgo(1), created_at: daysAgo(10),
    systemInfo: { is_reachable: true, routeros_version: '7.16', board_name: 'CHR', uptime: '1d 2h 30m', cpu_load: 3, free_memory: 483183821, total_memory: 536870912, checked_at: minutesAgo(1) },
  },

  // Standalone: vpn-gw-01 — online, 7.15.1 → "Needs update"
  {
    id: 'mock-8', name: 'vpn-gw-01', hostname: 'vpn-gw-01.dc1.local',
    host: '10.0.1.10', port: 443, is_reachable: true, tenant_name: 'Mainstream',
    routeros_version: '7.15.1', uptime: '60d 14h',
    last_seen: minutesAgo(1), created_at: daysAgo(120),
    systemInfo: { is_reachable: true, routeros_version: '7.15.1', board_name: 'CHR', uptime: '60d 14h 20m', cpu_load: 35, free_memory: 644245094, total_memory: 1073741824, checked_at: minutesAgo(1) },
  },

  // Standalone: backup-rtr-01 — offline
  {
    id: 'mock-9', name: 'backup-rtr-01', hostname: 'backup-rtr-01.dc2.local',
    host: '10.0.2.1', port: 443, is_reachable: false, tenant_name: 'Mainstream',
    last_seen: daysAgo(3), created_at: daysAgo(180),
    systemInfo: { is_reachable: false, error: 'No route to host', checked_at: daysAgo(3) },
  },
];
```

Changes from original: removed dc-fw-01, added edge-gw-02 and core-rtr-02, added `cluster_id`, `cluster_name`, `role`, `routeros_version`, `uptime` to all routers, organized into 3 HA pairs + 3 standalone. Total 9 routers (was 8).

- [ ] **Step 2: Commit data model changes**

```bash
git add frontend/src/api/types.ts frontend/src/components/common/StatusIndicator.tsx frontend/src/mocks/mockData.ts
git commit -m "Add HA cluster fields to Router type, update mock data for tree table"
```

---

### Task 4: Update mockRoutersApi

**Files:**
- Modify: `frontend/src/mocks/mockRoutersApi.ts`

- [ ] **Step 1: No functional changes needed**

The `stripSystemInfo` function destructures out `systemInfo` and returns the rest. Since the new fields (`cluster_id`, `cluster_name`, `role`, `routeros_version`, `uptime`) are on the `Router` interface directly, they automatically pass through. The `createRouter` function creates standalone routers without cluster fields, which is correct (new routers are standalone by default).

Verify this by reading the file — no code changes required.

---

### Task 5: Create router grouping utility

**Files:**
- Create: `frontend/src/features/routers/routerGrouping.ts`

- [ ] **Step 1: Write the grouping utility with types, grouping, and filtering**

Create `frontend/src/features/routers/routerGrouping.ts`:

```typescript
import type { Router } from '../../api/types';

export const LATEST_ROUTEROS_VERSION = '7.16';

export type VersionStatus = 'up-to-date' | 'needs-update' | 'version-mismatch';

export interface ClusterGroup {
  type: 'cluster';
  clusterId: string;
  clusterName: string;
  tenantName: string;
  status: 'online' | 'degraded' | 'offline';
  versionStatus: VersionStatus | null;
  routers: Router[];
}

export interface StandaloneGroup {
  type: 'standalone';
  router: Router;
  versionStatus: VersionStatus | null;
}

export type RouterGroup = ClusterGroup | StandaloneGroup;

function computeClusterStatus(routers: Router[]): 'online' | 'degraded' | 'offline' {
  const onlineCount = routers.filter(r => r.is_reachable).length;
  if (onlineCount === routers.length) return 'online';
  if (onlineCount === 0) return 'offline';
  return 'degraded';
}

function computeClusterVersionStatus(routers: Router[]): VersionStatus | null {
  const onlineRouters = routers.filter(r => r.is_reachable && r.routeros_version);
  if (onlineRouters.length === 0) return null;

  const versions = new Set(onlineRouters.map(r => r.routeros_version));
  if (versions.size > 1) return 'version-mismatch';

  const version = onlineRouters[0].routeros_version!;
  return version === LATEST_ROUTEROS_VERSION ? 'up-to-date' : 'needs-update';
}

function computeStandaloneVersionStatus(router: Router): VersionStatus | null {
  if (!router.is_reachable || !router.routeros_version) return null;
  return router.routeros_version === LATEST_ROUTEROS_VERSION ? 'up-to-date' : 'needs-update';
}

export function groupRouters(routers: Router[]): RouterGroup[] {
  const clusterMap = new Map<string, Router[]>();
  const standalone: Router[] = [];

  for (const router of routers) {
    if (router.cluster_id) {
      const existing = clusterMap.get(router.cluster_id) ?? [];
      existing.push(router);
      clusterMap.set(router.cluster_id, existing);
    } else {
      standalone.push(router);
    }
  }

  const groups: RouterGroup[] = [];

  for (const [clusterId, clusterRouters] of clusterMap) {
    // Sort within cluster: master first, then backup
    clusterRouters.sort((a, b) => {
      if (a.role === 'master' && b.role !== 'master') return -1;
      if (a.role !== 'master' && b.role === 'master') return 1;
      return 0;
    });

    const first = clusterRouters[0];
    groups.push({
      type: 'cluster',
      clusterId,
      clusterName: first.cluster_name ?? clusterId,
      tenantName: first.tenant_name ?? '',
      status: computeClusterStatus(clusterRouters),
      versionStatus: computeClusterVersionStatus(clusterRouters),
      routers: clusterRouters,
    });
  }

  // Sort clusters alphabetically by name
  groups.sort((a, b) => {
    if (a.type === 'cluster' && b.type === 'cluster') {
      return a.clusterName.localeCompare(b.clusterName);
    }
    return 0;
  });

  // Append standalone routers after clusters, sorted alphabetically by hostname
  const sortedStandalone = [...standalone].sort((a, b) =>
    a.hostname.localeCompare(b.hostname),
  );
  for (const router of sortedStandalone) {
    groups.push({
      type: 'standalone',
      router,
      versionStatus: computeStandaloneVersionStatus(router),
    });
  }

  return groups;
}

export function filterGroups(groups: RouterGroup[], query: string): RouterGroup[] {
  const q = query.toLowerCase().trim();
  if (!q) return groups;

  return groups.filter(group => {
    if (group.type === 'cluster') {
      return (
        group.clusterName.toLowerCase().includes(q) ||
        group.tenantName.toLowerCase().includes(q) ||
        group.routers.some(
          r =>
            r.name.toLowerCase().includes(q) ||
            r.hostname.toLowerCase().includes(q),
        )
      );
    }
    return (
      group.router.name.toLowerCase().includes(q) ||
      group.router.hostname.toLowerCase().includes(q) ||
      (group.router.tenant_name ?? '').toLowerCase().includes(q)
    );
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/routers/routerGrouping.ts
git commit -m "Add router grouping utility for tree table"
```

---

### Task 6: Rewrite RoutersPage as tree table

**Files:**
- Modify: `frontend/src/features/routers/RoutersPage.tsx`

This is a complete rewrite. The flat striped table becomes a collapsible tree table with HA parent rows, HA child rows, and standalone rows.

- [ ] **Step 1: Replace RoutersPage.tsx with the tree table implementation**

Replace the entire file with:

```tsx
import { useMemo, useState } from 'react';
import {
  Title,
  Button,
  Group,
  Table,
  Text,
  Skeleton,
  Stack,
  TextInput,
  Badge,
  Box,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconSearch,
  IconRouter,
  IconChevronDown,
  IconChevronRight,
  IconCloudComputing,
} from '@tabler/icons-react';
import { useRouters, useDeleteRouter } from './routersApi';
import {
  groupRouters,
  filterGroups,
  LATEST_ROUTEROS_VERSION,
} from './routerGrouping';
import type { ClusterGroup, StandaloneGroup } from './routerGrouping';
import RouterForm from './RouterForm';
import RouterDetail from './RouterDetail';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';
import ErrorBanner from '../../components/common/ErrorBanner';
import MonoText from '../../components/common/MonoText';
import type { Router } from '../../api/types';

const statusBadgeConfig = {
  online: { color: 'green', label: 'Online' },
  degraded: { color: 'orange', label: 'Degraded' },
  offline: { color: 'red', label: 'Offline' },
} as const;

const versionBadgeConfig = {
  'up-to-date': { color: 'green', label: 'Up to date' },
  'needs-update': { color: 'yellow', label: 'Needs update' },
  'version-mismatch': { color: 'orange', label: 'Version mismatch' },
} as const;

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

function ClusterRows({
  cluster,
  isCollapsed,
  onToggle,
  onRowClick,
  onTenantClick,
}: {
  cluster: ClusterGroup;
  isCollapsed: boolean;
  onToggle: () => void;
  onRowClick: (router: Router) => void;
  onTenantClick: (tenantName: string) => void;
}) {
  const statusCfg = statusBadgeConfig[cluster.status];
  const versionCfg = cluster.versionStatus
    ? versionBadgeConfig[cluster.versionStatus]
    : null;
  const ToggleIcon = isCollapsed ? IconChevronRight : IconChevronDown;

  return (
    <>
      {/* HA Parent Row */}
      <Table.Tr
        style={{
          backgroundColor: 'var(--mantine-color-blue-0)',
          cursor: 'pointer',
          borderBottom: isCollapsed
            ? '1px solid var(--mantine-color-gray-3)'
            : '1px solid var(--mantine-color-gray-2)',
        }}
        onClick={onToggle}
      >
        <Table.Td style={{ width: 40, verticalAlign: 'middle' }}>
          <ToggleIcon size={10} color="#868e96" />
        </Table.Td>
        <Table.Td>
          <Group gap={10} wrap="nowrap">
            <IconCloudComputing
              size={18}
              color="#868e96"
              style={{ flexShrink: 0 }}
            />
            <div>
              <Group gap={6} wrap="wrap">
                <Text fw={600} size="sm">
                  {cluster.clusterName}
                </Text>
                <Badge
                  variant="light"
                  color={statusCfg.color}
                  size="sm"
                  radius="sm"
                >
                  {statusCfg.label}
                </Badge>
                {versionCfg && (
                  <Badge
                    variant="light"
                    color={versionCfg.color}
                    size="sm"
                    radius="sm"
                  >
                    {versionCfg.label}
                  </Badge>
                )}
              </Group>
              <Group gap={4}>
                <Text
                  size="xs"
                  fw={600}
                  c="dark"
                  style={{ cursor: 'pointer' }}
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    onTenantClick(cluster.tenantName);
                  }}
                >
                  {cluster.tenantName}
                </Text>
                <Text size="xs" c="dimmed">
                  &middot; {cluster.routers.length} nodes
                </Text>
              </Group>
            </div>
          </Group>
        </Table.Td>
        <Table.Td />
        <Table.Td>
          <Badge variant="light" color="blue" size="sm" radius="sm">
            HA
          </Badge>
        </Table.Td>
        <Table.Td />
        <Table.Td />
      </Table.Tr>

      {/* HA Child Rows */}
      {!isCollapsed &&
        cluster.routers.map((router, index) => {
          const isLast = index === cluster.routers.length - 1;
          const isOnline = router.is_reachable;
          const isVersionOutdated =
            isOnline &&
            router.routeros_version !== LATEST_ROUTEROS_VERSION;

          return (
            <Table.Tr
              key={router.id}
              onClick={() => onRowClick(router)}
              style={{
                cursor: 'pointer',
                borderBottom: isLast
                  ? '1px solid var(--mantine-color-gray-3)'
                  : '1px solid var(--mantine-color-gray-1)',
              }}
            >
              <Table.Td />
              <Table.Td style={{ paddingLeft: 40 }}>
                <Group gap={8} wrap="nowrap">
                  <Box
                    w={7}
                    h={7}
                    style={{ borderRadius: '50%', flexShrink: 0 }}
                    bg={isOnline ? 'green.7' : 'red.7'}
                  />
                  <Text size="sm" c={isOnline ? undefined : 'dimmed'}>
                    {router.hostname}
                  </Text>
                </Group>
              </Table.Td>
              <Table.Td>
                <MonoText c={isOnline ? undefined : 'dimmed'}>
                  {router.host}:{router.port}
                </MonoText>
              </Table.Td>
              <Table.Td>
                <Badge
                  variant="light"
                  color={router.role === 'master' ? 'green' : 'orange'}
                  size="sm"
                  radius="sm"
                  style={isOnline ? undefined : { opacity: 0.5 }}
                >
                  {router.role === 'master' ? 'Master' : 'Backup'}
                </Badge>
              </Table.Td>
              <Table.Td>
                {isOnline ? (
                  <MonoText c={isVersionOutdated ? 'orange' : 'dimmed'}>
                    {router.routeros_version}
                  </MonoText>
                ) : (
                  <Text size="sm" c="dimmed">
                    &mdash;
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                {isOnline ? (
                  <Text size="xs" c="dimmed">
                    {router.uptime}
                  </Text>
                ) : (
                  <Text size="sm" c="dimmed">
                    &mdash;
                  </Text>
                )}
              </Table.Td>
            </Table.Tr>
          );
        })}
    </>
  );
}

function StandaloneRow({
  group,
  onRowClick,
  onTenantClick,
}: {
  group: StandaloneGroup;
  onRowClick: (router: Router) => void;
  onTenantClick: (tenantName: string) => void;
}) {
  const { router, versionStatus } = group;
  const isOnline = router.is_reachable;
  const statusCfg = statusBadgeConfig[isOnline ? 'online' : 'offline'];
  const versionCfg = versionStatus ? versionBadgeConfig[versionStatus] : null;
  const isVersionOutdated =
    isOnline && router.routeros_version !== LATEST_ROUTEROS_VERSION;

  return (
    <Table.Tr
      onClick={() => onRowClick(router)}
      style={{
        cursor: 'pointer',
        borderBottom: '1px solid var(--mantine-color-gray-2)',
      }}
    >
      <Table.Td style={{ width: 40 }} />
      <Table.Td>
        <Group gap={10} wrap="nowrap">
          <IconCloudComputing
            size={18}
            color={isOnline ? '#868e96' : '#adb5bd'}
            style={{ flexShrink: 0 }}
          />
          <div>
            <Group gap={6} wrap="wrap">
              <Text fw={500} size="sm" c={isOnline ? undefined : 'dimmed'}>
                {router.hostname}
              </Text>
              <Badge
                variant="light"
                color={statusCfg.color}
                size="sm"
                radius="sm"
              >
                {statusCfg.label}
              </Badge>
              {versionCfg && (
                <Badge
                  variant="light"
                  color={versionCfg.color}
                  size="sm"
                  radius="sm"
                >
                  {versionCfg.label}
                </Badge>
              )}
            </Group>
            {router.tenant_name && (
              <Text
                size="xs"
                fw={600}
                c="dark"
                style={{ cursor: 'pointer' }}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation();
                  onTenantClick(router.tenant_name!);
                }}
              >
                {router.tenant_name}
              </Text>
            )}
          </div>
        </Group>
      </Table.Td>
      <Table.Td>
        <MonoText c={isOnline ? undefined : 'dimmed'}>
          {router.host}:{router.port}
        </MonoText>
      </Table.Td>
      <Table.Td>
        <Badge
          variant="light"
          color="gray"
          size="sm"
          radius="sm"
          style={isOnline ? undefined : { opacity: 0.5 }}
        >
          Standalone
        </Badge>
      </Table.Td>
      <Table.Td>
        {isOnline ? (
          <MonoText c={isVersionOutdated ? 'orange' : 'dimmed'}>
            {router.routeros_version}
          </MonoText>
        ) : (
          <Text size="sm" c="dimmed">
            &mdash;
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        {isOnline ? (
          <Text size="xs" c="dimmed">
            {router.uptime}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            &mdash;
          </Text>
        )}
      </Table.Td>
    </Table.Tr>
  );
}

export default function RoutersPage() {
  const { data: routers, isLoading, error, refetch } = useRouters();
  const deleteMutation = useDeleteRouter();

  const [detailRouterId, setDetailRouterId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editRouter, setEditRouter] = useState<Router | null>(null);
  const [deleteRouter, setDeleteRouter] = useState<Router | null>(null);
  const [search, setSearch] = useState('');
  const [collapsedClusters, setCollapsedClusters] = useState<Set<string>>(
    new Set(),
  );

  const groups = useMemo(() => {
    if (!routers) return [];
    const grouped = groupRouters(routers);
    return filterGroups(grouped, search);
  }, [routers, search]);

  const handleAdd = () => {
    setEditRouter(null);
    setFormOpen(true);
  };

  const handleEdit = (router: Router) => {
    setEditRouter(router);
    setFormOpen(true);
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditRouter(null);
  };

  const handleRowClick = (router: Router) => {
    setDetailRouterId(router.id);
  };

  const handleDetailEdit = (router: Router) => {
    setDetailRouterId(null);
    handleEdit(router);
  };

  const handleDetailDelete = (router: Router) => {
    setDeleteRouter(router);
  };

  const handleTenantClick = (tenantName: string) => {
    setSearch(tenantName);
  };

  const toggleCluster = (clusterId: string) => {
    setCollapsedClusters((prev) => {
      const next = new Set(prev);
      if (next.has(clusterId)) next.delete(clusterId);
      else next.add(clusterId);
      return next;
    });
  };

  const handleDeleteConfirm = () => {
    if (!deleteRouter) return;
    deleteMutation.mutate(deleteRouter.id, {
      onSuccess: () => {
        notifications.show({
          title: 'Router deleted',
          message: `Router "${deleteRouter.name}" has been deleted.`,
          color: 'green',
        });
        setDeleteRouter(null);
        if (detailRouterId === deleteRouter.id) {
          setDetailRouterId(null);
        }
      },
      onError: (err) => {
        notifications.show({
          title: 'Error',
          message:
            err instanceof Error ? err.message : 'Failed to delete router',
          color: 'red',
        });
      },
    });
  };

  const hasRouters = routers && routers.length > 0;

  if (isLoading) {
    return (
      <>
        <Stack gap={4} mb="lg">
          <Title order={2}>Routers</Title>
          <Text size="sm" c="dimmed">
            Manage your MikroTik CHR instances
          </Text>
        </Stack>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 40 }} />
              <Table.Th>Router</Table.Th>
              <Table.Th>Address</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Version</Table.Th>
              <Table.Th>Uptime</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <Table.Tr key={i}>
                {Array.from({ length: 6 }).map((_, j) => (
                  <Table.Td key={j}>
                    <Skeleton height="36px" radius="sm" />
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </>
    );
  }

  if (error) {
    return (
      <ErrorBanner
        message="Failed to load routers. Please try again later."
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <>
      <Group justify="space-between" align="flex-start" mb="lg">
        <Stack gap={4}>
          <Title order={2}>Routers</Title>
          <Text size="sm" c="dimmed">
            Manage your MikroTik CHR instances
          </Text>
        </Stack>
        {hasRouters && (
          <Button leftSection={<IconPlus size={16} />} onClick={handleAdd}>
            Add Router
          </Button>
        )}
      </Group>

      {hasRouters ? (
        <>
          <TextInput
            placeholder="Search by name, hostname, or tenant..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            mb="md"
          />

          <Table
            style={{
              borderCollapse: 'collapse',
              border: '1px solid var(--mantine-color-gray-3)',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <Table.Thead>
              <Table.Tr
                style={{
                  backgroundColor: 'var(--mantine-color-gray-0)',
                  borderBottom: '1px solid var(--mantine-color-gray-3)',
                }}
              >
                <Table.Th style={{ width: 40 }} />
                <Table.Th>
                  <HeaderLabel>Router</HeaderLabel>
                </Table.Th>
                <Table.Th>
                  <HeaderLabel>Address</HeaderLabel>
                </Table.Th>
                <Table.Th style={{ width: 110 }}>
                  <HeaderLabel>Role</HeaderLabel>
                </Table.Th>
                <Table.Th style={{ width: 100 }}>
                  <HeaderLabel>Version</HeaderLabel>
                </Table.Th>
                <Table.Th style={{ width: 90 }}>
                  <HeaderLabel>Uptime</HeaderLabel>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {groups.map((group) => {
                if (group.type === 'cluster') {
                  return (
                    <ClusterRows
                      key={group.clusterId}
                      cluster={group}
                      isCollapsed={collapsedClusters.has(group.clusterId)}
                      onToggle={() => toggleCluster(group.clusterId)}
                      onRowClick={handleRowClick}
                      onTenantClick={handleTenantClick}
                    />
                  );
                }
                return (
                  <StandaloneRow
                    key={group.router.id}
                    group={group}
                    onRowClick={handleRowClick}
                    onTenantClick={handleTenantClick}
                  />
                );
              })}
              {groups.length === 0 && search && (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text size="sm" c="dimmed" ta="center" py="lg">
                      No routers match &ldquo;{search}&rdquo;
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </>
      ) : (
        <EmptyState
          icon={IconRouter}
          title="No routers configured"
          description="Add your first MikroTik CHR router to start managing your network infrastructure."
          action={
            <Button leftSection={<IconPlus size={16} />} onClick={handleAdd}>
              Add Router
            </Button>
          }
        />
      )}

      <RouterDetail
        routerId={detailRouterId}
        isOpen={!!detailRouterId}
        onClose={() => setDetailRouterId(null)}
        onEdit={handleDetailEdit}
        onDelete={handleDetailDelete}
      />

      <RouterForm
        isOpen={formOpen}
        onClose={handleFormClose}
        router={editRouter}
      />

      <ConfirmDialog
        isOpen={!!deleteRouter}
        onClose={() => setDeleteRouter(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Router"
        message={
          deleteRouter
            ? `Are you sure you want to delete router '${deleteRouter.name}'? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        confirmColor="red"
      />
    </>
  );
}
```

Key changes from the flat table:
- Removed `striped` and `highlightOnHover` from Table
- Removed all sortable column headers — tree hierarchy is the primary organization
- Added collapse state via `collapsedClusters: Set<string>`
- HA parent rows: blue-0 background, cloud icon, cluster name, status+version badges, tenant link, node count
- HA child rows: indented, status dot, FQDN hostname, address, role badge, version (orange if outdated), uptime
- Standalone rows: cloud icon, FQDN hostname, status+version badges, tenant, address, "Standalone" badge, version, uptime
- Offline nodes: dimmed text, role badge opacity 0.5, "—" for version/uptime
- Tenant name click → sets search input to filter by tenant
- Search filters across cluster names, router names, hostnames, and tenant names

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/routers/routerGrouping.ts frontend/src/features/routers/RoutersPage.tsx
git commit -m "Redesign router table as collapsible tree with HA pairs"
```

---

### Task 7: Compile and verify

- [ ] **Step 1: TypeScript compile check**

Run: `cd frontend && npx tsc --noEmit`
Expected: Zero errors.

If `IconCloudComputing` is not found in `@tabler/icons-react`, replace with `IconCloud` which is guaranteed to exist. The icon name varies by tabler version.

- [ ] **Step 2: Dev server check**

Run: `cd frontend && pnpm dev`
Navigate to `/routers` and verify:
- 3 HA pairs shown as collapsible groups (edge-gw, core-rtr, branch-rtr)
- 3 standalone routers below (backup-rtr-01, lab-rtr-01, vpn-gw-01)
- Click ▼ to collapse/expand HA groups
- Badges: Online/Degraded/Offline status, Up to date/Needs update/Version mismatch
- Offline nodes dimmed with "—" placeholders
- Click tenant name → filters table to that tenant
- Click child/standalone row → detail drawer opens
- Add/Edit/Delete still work via drawer

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -u
git commit -m "Fix compile issues from tree table redesign"
```
