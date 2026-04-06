# Cluster-Scoped Configure Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite all configure routes to include `:clusterId` in the URL, making cluster context URL-driven and shareable.

**Architecture:** A new `ConfigureLayout` wrapper component reads `:clusterId` from the URL and syncs it one-way into the existing Zustand `useRouterStore`. All configure pages read `clusterId` from `useParams()` instead of the store. The `moduleConfig` routes become relative slugs, and all navigation code constructs full paths dynamically.

**Tech Stack:** React 19, React Router 7 (`useParams`, `useLocation`, `useNavigate`, `Outlet`), Zustand, Mantine UI 9, TypeScript 5.9

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `frontend/src/features/configure/ConfigureLayout.tsx` | Route wrapper: reads `:clusterId`, syncs store, renders `<Outlet />` |
| Modify | `frontend/src/features/configure/moduleConfig.ts` | Change `route` from absolute path to relative slug |
| Modify | `frontend/src/app/routes.tsx` | Nest configure routes under `configure/:clusterId` with `ConfigureLayout` |
| Modify | `frontend/src/components/shell/AppShell.tsx` | Build configure menu paths dynamically using `clusterId` |
| Modify | `frontend/src/components/shell/RouterSelector.tsx` | Navigate to new cluster-scoped URL when switching on configure pages |
| Modify | `frontend/src/features/configure/ConfigureLandingPage.tsx` | Build card links using `clusterId` from URL |
| Modify | `frontend/src/features/interfaces/InterfacesPage.tsx` | Read `clusterId` from URL instead of store |
| Modify | `frontend/src/features/interfaces/InterfaceForm.tsx` | Read `clusterId` from URL instead of store |
| Modify | `frontend/src/features/routes/RoutesPage.tsx` | Read `clusterId` from URL instead of store |
| Modify | `frontend/src/features/address-lists/AddressListsPage.tsx` | Read `clusterId` from URL instead of store |
| Modify | `frontend/src/features/tunnels/TunnelsPage.tsx` | Read `clusterId` from URL instead of store |
| Modify | `frontend/src/features/wireguard/WireGuardPage.tsx` | Read `clusterId` from URL instead of store |
| Modify | `frontend/src/features/dashboard/DashboardPage.tsx` | Build configure link using `clusterId` from store |
| Modify | `frontend/src/features/routes/routeColumns.tsx` | Build interface link using `clusterId` from store |

---

### Task 1: Create new git branch

**Files:** None (git only)

- [ ] **Step 1: Create and switch to branch**

```bash
git checkout -b 010-cluster-scoped-routes
```

- [ ] **Step 2: Verify branch**

```bash
git branch --show-current
```

Expected: `010-cluster-scoped-routes`

---

### Task 2: Change moduleConfig routes to relative slugs

**Files:**
- Modify: `frontend/src/features/configure/moduleConfig.ts`

- [ ] **Step 1: Change route values from absolute paths to slugs**

Replace each `route` value. The full file becomes:

```typescript
import {
  IconNetwork,
  IconRouteAltRight,
  IconShieldCheck,
  IconListDetails,
  IconArrowsShuffle,
  IconBuilding,
  IconLock,
  IconGauge,
} from '@tabler/icons-react';

export interface ModuleConfig {
  title: string;
  subtitle: string;
  icon: React.ComponentType<any>;
  route: string;
  isEnabled: boolean;
}

export const modules: ModuleConfig[] = [
  { title: 'Interfaces', subtitle: 'Configure interface addresses', icon: IconNetwork, route: 'interfaces', isEnabled: true },
  { title: 'Routes', subtitle: 'Configure static routes', icon: IconRouteAltRight, route: 'routes', isEnabled: true },
  { title: 'Firewall', subtitle: 'Configure firewall filter rules', icon: IconShieldCheck, route: 'firewall', isEnabled: false },
  { title: 'Address Lists', subtitle: 'Configure firewall address lists', icon: IconListDetails, route: 'address-lists', isEnabled: true },
  { title: 'NAT', subtitle: 'Configure NAT rules', icon: IconArrowsShuffle, route: 'nat', isEnabled: false },
  { title: 'Tunnels', subtitle: 'Configure IPsec / GRE tunnels', icon: IconBuilding, route: 'tunnels', isEnabled: true },
  { title: 'WireGuard', subtitle: 'Configure WireGuard VPN', icon: IconLock, route: 'wireguard', isEnabled: true },
  { title: 'Queues', subtitle: 'Configure bandwidth management', icon: IconGauge, route: 'queues', isEnabled: false },
];
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/configure/moduleConfig.ts
git commit -m "Change moduleConfig routes to relative slugs"
```

---

### Task 3: Create ConfigureLayout wrapper component

**Files:**
- Create: `frontend/src/features/configure/ConfigureLayout.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { useEffect } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { useRouterStore } from '../../stores/useRouterStore';

export default function ConfigureLayout() {
  const { clusterId } = useParams<{ clusterId: string }>();
  const selectRouter = useRouterStore((s) => s.selectRouter);

  useEffect(() => {
    if (clusterId) {
      selectRouter(clusterId);
    }
  }, [clusterId, selectRouter]);

  return <Outlet />;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/configure/ConfigureLayout.tsx
git commit -m "Add ConfigureLayout wrapper with URL-to-store sync"
```

---

### Task 4: Rewrite route definitions in routes.tsx

**Files:**
- Modify: `frontend/src/app/routes.tsx`

- [ ] **Step 1: Add ConfigureLayout import**

Add this import after the existing `ConfigureLandingPage` import (line 17):

```typescript
import ConfigureLayout from '../features/configure/ConfigureLayout';
```

- [ ] **Step 2: Replace the configure route block**

Replace the six configure route entries (lines 112-134):

```tsx
          {
            path: 'configure',
            element: <ConfigureLandingPage />,
          },
          {
            path: 'configure/interfaces',
            element: <InterfacesPage />,
          },
          {
            path: 'configure/routes',
            element: <RoutesPage />,
          },
          {
            path: 'configure/address-lists',
            element: <AddressListsPage />,
          },
          {
            path: 'configure/tunnels',
            element: <TunnelsPage />,
          },
          {
            path: 'configure/wireguard',
            element: <WireGuardPage />,
          },
```

With this single nested route:

```tsx
          {
            path: 'configure/:clusterId',
            element: <ConfigureLayout />,
            children: [
              {
                index: true,
                element: <ConfigureLandingPage />,
              },
              {
                path: 'interfaces',
                element: <InterfacesPage />,
              },
              {
                path: 'routes',
                element: <RoutesPage />,
              },
              {
                path: 'address-lists',
                element: <AddressListsPage />,
              },
              {
                path: 'tunnels',
                element: <TunnelsPage />,
              },
              {
                path: 'wireguard',
                element: <WireGuardPage />,
              },
            ],
          },
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/routes.tsx
git commit -m "Nest configure routes under configure/:clusterId"
```

---

### Task 5: Update AppShell Configure navigation menu

**Files:**
- Modify: `frontend/src/components/shell/AppShell.tsx`

The Configure dropdown menu and the "Configure" nav button need to build paths dynamically. The cluster ID comes from the URL if already on a configure page, or from the Zustand store otherwise. If neither is available, navigate to `/routers`.

- [ ] **Step 1: Add imports**

Add `useRouterStore` import:

```typescript
import { useRouterStore } from '../../stores/useRouterStore';
```

- [ ] **Step 2: Add clusterId resolution inside AppShellLayout**

Inside `AppShellLayout()`, after the existing `const isConfigureActive = ...` line (line 87), add:

```typescript
  const selectedRouterId = useRouterStore((s) => s.selectedRouterId);

  // Extract clusterId from URL if on a configure page, else fall back to store
  const configureClusterId = isConfigureActive
    ? location.pathname.split('/')[2] ?? selectedRouterId
    : selectedRouterId;
```

- [ ] **Step 3: Update Configure nav button onClick**

Replace the `onClick` on the Configure NavLink (line 138):

```typescript
                      onClick={() => {
                        if (configureClusterId) {
                          navigate(`/configure/${configureClusterId}`);
                        } else {
                          navigate('/routers');
                        }
                      }}
```

- [ ] **Step 4: Update menu item onClick handlers**

Replace the menu item `onClick` (line 158-159):

```typescript
                        onClick={() => {
                          if (mod.isEnabled) {
                            if (configureClusterId) {
                              navigate(`/configure/${configureClusterId}/${mod.route}`);
                            } else {
                              navigate('/routers');
                            }
                          }
                        }}
```

- [ ] **Step 5: Verify the app compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no type errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/shell/AppShell.tsx
git commit -m "Update AppShell configure menu to use cluster-scoped paths"
```

---

### Task 6: Update RouterSelector to navigate on configure pages

**Files:**
- Modify: `frontend/src/components/shell/RouterSelector.tsx`

When on a configure page and the user picks a different router/cluster, navigate to the same sub-page with the new cluster ID.

- [ ] **Step 1: Add useLocation import**

The file already imports `useNavigate` from react-router-dom. Add `useLocation`:

```typescript
import { useNavigate, useLocation } from 'react-router-dom';
```

- [ ] **Step 2: Add location-aware navigation in onOptionSubmit**

Replace the `onOptionSubmit` handler (lines 51-58):

```typescript
      onOptionSubmit={(val) => {
        if (val === '__all_routers__') {
          navigate('/routers');
        } else {
          selectRouter(val);
          // If on a configure page, navigate to same sub-page with new cluster ID
          if (location.pathname.startsWith('/configure/')) {
            const parts = location.pathname.split('/');
            // parts: ['', 'configure', oldClusterId, ...subPath]
            const subPath = parts.slice(3).join('/');
            navigate(`/configure/${val}/${subPath}`);
          }
        }
        combobox.closeDropdown();
      }}
```

- [ ] **Step 3: Add location constant**

Inside the `RouterSelector` function body, after the existing `const navigate = useNavigate();` line, add:

```typescript
  const location = useLocation();
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/shell/RouterSelector.tsx
git commit -m "Update RouterSelector to navigate cluster-scoped routes"
```

---

### Task 7: Update ConfigureLandingPage to use clusterId from URL

**Files:**
- Modify: `frontend/src/features/configure/ConfigureLandingPage.tsx`

The landing page card links currently use `mod.route` (which was an absolute path). Now they need to use relative navigation with the clusterId from the URL.

- [ ] **Step 1: Add useParams import**

Replace the existing router import line (line 1):

```typescript
import { useNavigate, useParams } from 'react-router-dom';
```

- [ ] **Step 2: Read clusterId inside component**

Inside `ConfigureLandingPage()`, after `const navigate = useNavigate();`, add:

```typescript
  const { clusterId } = useParams<{ clusterId: string }>();
```

- [ ] **Step 3: Update card navigation**

Replace the `onClick` in the enabled card's `UnstyledButton` (line 68):

```typescript
              onClick={() => navigate(`/configure/${clusterId}/${mod.route}`)}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/configure/ConfigureLandingPage.tsx
git commit -m "Update ConfigureLandingPage to use clusterId from URL"
```

---

### Task 8: Update InterfacesPage to read clusterId from URL

**Files:**
- Modify: `frontend/src/features/interfaces/InterfacesPage.tsx`

- [ ] **Step 1: Replace store import with useParams**

Remove the import (line 16):

```typescript
import { useRouterStore } from '../../stores/useRouterStore';
```

Add in its place:

```typescript
import { useParams } from 'react-router-dom';
```

- [ ] **Step 2: Replace store usage with useParams**

Replace lines 115-116:

```typescript
  const selectedRouterId = useRouterStore((s) => s.selectedRouterId);
  const { data: interfaces, isLoading, error, refetch } = useInterfaces(selectedRouterId);
```

With:

```typescript
  const { clusterId } = useParams<{ clusterId: string }>();
  const { data: interfaces, isLoading, error, refetch } = useInterfaces(clusterId ?? null);
```

- [ ] **Step 3: Remove the "no router selected" guard**

Delete the block at lines 151-160:

```tsx
  if (!selectedRouterId) {
    return (
      <Stack align="center" mt="xl" gap="md">
        <IconRouter size={48} stroke={1.5} color="var(--mantine-color-dimmed)" />
        <Text c="dimmed" size="lg">
          Select a router to view interfaces
        </Text>
      </Stack>
    );
  }
```

Also remove `IconRouter` from the `@tabler/icons-react` import since it's no longer used (check if it's used elsewhere in the file first — it isn't).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/interfaces/InterfacesPage.tsx
git commit -m "Update InterfacesPage to read clusterId from URL"
```

---

### Task 9: Update InterfaceForm to read clusterId from URL

**Files:**
- Modify: `frontend/src/features/interfaces/InterfaceForm.tsx`

- [ ] **Step 1: Replace store import with useParams**

Remove the import (line 20):

```typescript
import { useRouterStore } from '../../stores/useRouterStore';
```

Add in its place:

```typescript
import { useParams } from 'react-router-dom';
```

- [ ] **Step 2: Replace store usage with useParams**

Replace line 105:

```typescript
  const selectedRouterId = useRouterStore((s) => s.selectedRouterId);
```

With:

```typescript
  const { clusterId } = useParams<{ clusterId: string }>();
  const selectedRouterId = clusterId ?? null;
```

Note: We keep the `selectedRouterId` local variable name since it's used many times in this file (lines 107, 170, 181, 182, 209, 210). This minimizes the diff.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/interfaces/InterfaceForm.tsx
git commit -m "Update InterfaceForm to read clusterId from URL"
```

---

### Task 10: Update RoutesPage to read clusterId from URL

**Files:**
- Modify: `frontend/src/features/routes/RoutesPage.tsx`

- [ ] **Step 1: Replace store import with useParams**

Remove the import (line 16):

```typescript
import { useRouterStore } from '../../stores/useRouterStore';
```

Add in its place:

```typescript
import { useParams } from 'react-router-dom';
```

- [ ] **Step 2: Replace store usage with useParams**

Replace lines 114-115:

```typescript
  const selectedRouterId = useRouterStore((s) => s.selectedRouterId);
  const { data: routes, isLoading, error, refetch } = useRoutes(selectedRouterId);
```

With:

```typescript
  const { clusterId } = useParams<{ clusterId: string }>();
  const { data: routes, isLoading, error, refetch } = useRoutes(clusterId ?? null);
```

- [ ] **Step 3: Remove the "no router selected" guard**

Delete the block at lines 156-165:

```tsx
  if (!selectedRouterId) {
    return (
      <Stack align="center" mt="xl" gap="md">
        <IconRouter size={48} stroke={1.5} color="var(--mantine-color-dimmed)" />
        <Text c="dimmed" size="lg">
          Select a router to view routes
        </Text>
      </Stack>
    );
  }
```

Also remove `IconRouter` from the `@tabler/icons-react` import since it's no longer used.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/routes/RoutesPage.tsx
git commit -m "Update RoutesPage to read clusterId from URL"
```

---

### Task 11: Update AddressListsPage to read clusterId from URL

**Files:**
- Modify: `frontend/src/features/address-lists/AddressListsPage.tsx`

- [ ] **Step 1: Replace store import with useParams**

Remove the import (line 17):

```typescript
import { useRouterStore } from '../../stores/useRouterStore';
```

Add in its place:

```typescript
import { useParams } from 'react-router-dom';
```

- [ ] **Step 2: Replace store usage with useParams**

Replace lines 49-52:

```typescript
  const selectedRouterId = useRouterStore((s) => s.selectedRouterId);
  const { data: lists, isLoading, error, refetch } = useAddressLists(selectedRouterId);
  const deleteMutation = useDeleteAddressList(selectedRouterId);
  const deleteEntriesMutation = useDeleteEntries(selectedRouterId);
```

With:

```typescript
  const { clusterId } = useParams<{ clusterId: string }>();
  const selectedRouterId = clusterId ?? null;
  const { data: lists, isLoading, error, refetch } = useAddressLists(selectedRouterId);
  const deleteMutation = useDeleteAddressList(selectedRouterId);
  const deleteEntriesMutation = useDeleteEntries(selectedRouterId);
```

Note: We keep the `selectedRouterId` local variable name since it's referenced many times in this file (lines 63-85, 182, 243, 275, 283).

- [ ] **Step 3: Remove the "no router selected" guard**

Delete the block at lines 182-191:

```tsx
  if (!selectedRouterId) {
    return (
      <Stack align="center" mt="xl" gap="md">
        <IconRouter size={48} stroke={1.5} color="var(--mantine-color-dimmed)" />
        <Text c="dimmed" size="lg">
          Select a router to view address lists
        </Text>
      </Stack>
    );
  }
```

Also remove `IconRouter` from the `@tabler/icons-react` import.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/address-lists/AddressListsPage.tsx
git commit -m "Update AddressListsPage to read clusterId from URL"
```

---

### Task 12: Update TunnelsPage to read clusterId from URL

**Files:**
- Modify: `frontend/src/features/tunnels/TunnelsPage.tsx`

- [ ] **Step 1: Replace store import with useParams**

Remove the import (line 19):

```typescript
import { useRouterStore } from '../../stores/useRouterStore';
```

Add in its place:

```typescript
import { useParams } from 'react-router-dom';
```

- [ ] **Step 2: Replace store usage with useParams**

Replace lines 96-98:

```typescript
  const selectedRouterId = useRouterStore((s) => s.selectedRouterId);
  const { data: tunnels, isLoading, error, refetch } = useTunnels(selectedRouterId);
  const deleteMutation = useDeleteTunnel(selectedRouterId);
```

With:

```typescript
  const { clusterId } = useParams<{ clusterId: string }>();
  const selectedRouterId = clusterId ?? null;
  const { data: tunnels, isLoading, error, refetch } = useTunnels(selectedRouterId);
  const deleteMutation = useDeleteTunnel(selectedRouterId);
```

Note: We keep the `selectedRouterId` local variable name since it's referenced many times (lines 109-120, 186, 281, 285).

- [ ] **Step 3: Remove the "no router selected" guard**

Delete the block at lines 186-199:

```tsx
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
```

Also remove `IconRouter` from the `@tabler/icons-react` import.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/tunnels/TunnelsPage.tsx
git commit -m "Update TunnelsPage to read clusterId from URL"
```

---

### Task 13: Update WireGuardPage to read clusterId from URL

**Files:**
- Modify: `frontend/src/features/wireguard/WireGuardPage.tsx`

- [ ] **Step 1: Replace store import with useParams**

Remove the import (line 11):

```typescript
import { useRouterStore } from '../../stores/useRouterStore';
```

Add in its place:

```typescript
import { useParams } from 'react-router-dom';
```

- [ ] **Step 2: Replace store usage with useParams**

Replace lines 18-19:

```typescript
  const selectedRouterId = useRouterStore((s) => s.selectedRouterId);
  const { isLoading, error, refetch } = useWireGuardInterfaces(selectedRouterId);
```

With:

```typescript
  const { clusterId } = useParams<{ clusterId: string }>();
  const selectedRouterId = clusterId ?? null;
  const { isLoading, error, refetch } = useWireGuardInterfaces(selectedRouterId);
```

Note: We keep the `selectedRouterId` local variable name since it's referenced at lines 23-29, 31, 80, 84.

- [ ] **Step 3: Remove the "no router selected" guard**

Delete the block at lines 31-38:

```tsx
  if (!selectedRouterId) {
    return (
      <Stack align="center" mt="xl" gap="md">
        <IconRouter size={48} stroke={1.5} color="var(--mantine-color-dimmed)" />
        <Text c="dimmed" size="lg">Select a router to view WireGuard configuration</Text>
      </Stack>
    );
  }
```

Also remove `IconRouter` from the `@tabler/icons-react` import (line 10).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/wireguard/WireGuardPage.tsx
git commit -m "Update WireGuardPage to read clusterId from URL"
```

---

### Task 14: Update DashboardPage configure link

**Files:**
- Modify: `frontend/src/features/dashboard/DashboardPage.tsx`

The DashboardPage has a hardcoded link `navigate('/configure/interfaces')` (line 204). This needs to include the cluster ID from the store (since Dashboard is not inside a configure route).

- [ ] **Step 1: Add store import**

Add this import:

```typescript
import { useRouterStore } from '../../stores/useRouterStore';
```

- [ ] **Step 2: Read selectedRouterId**

Inside the component function, add:

```typescript
  const selectedRouterId = useRouterStore((s) => s.selectedRouterId);
```

- [ ] **Step 3: Update the navigation call**

Replace line 204:

```typescript
        <UnstyledButton onClick={() => navigate('/configure/interfaces')}>
```

With:

```typescript
        <UnstyledButton onClick={() => {
          if (selectedRouterId) {
            navigate(`/configure/${selectedRouterId}/interfaces`);
          } else {
            navigate('/routers');
          }
        }}>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/dashboard/DashboardPage.tsx
git commit -m "Update DashboardPage configure link to include clusterId"
```

---

### Task 15: Update routeColumns interface link

**Files:**
- Modify: `frontend/src/features/routes/routeColumns.tsx`
- Modify: `frontend/src/features/routes/RoutesPage.tsx`

The routeColumns file has a hardcoded `Link` to `/configure/interfaces` (line 98). Since this is a column definition (not a React component with hooks), we pass the clusterId through the render context.

- [ ] **Step 1: Update the RouteColumn render type**

In `routeColumns.tsx`, update the `render` signature in the `RouteColumn` interface (lines 40-45):

```typescript
  render: (
    route: Route,
    actions?: {
      onEdit: (route: Route) => void;
      clusterId?: string;
    },
  ) => React.ReactNode;
```

- [ ] **Step 2: Update the gateway column render**

In the `gateway` column's render function (line 88), update the function signature to capture the actions param, and use it for the link. Replace the entire gateway column (lines 84-111):

```typescript
  {
    accessor: 'gateway',
    header: 'Next Hop',
    width: 280,
    render: (route, ctx) => (
      <div>
        <MonoText fw={500} size="xs">
          {route.gateway || '\u2014'}
        </MonoText>
        {route.interface && (
          <Text size="xs" c="dimmed">
            via{' '}
            <Text
              component={Link}
              to={ctx?.clusterId ? `/configure/${ctx.clusterId}/interfaces` : '#'}
              size="xs"
              fw={600}
              c="blue"
              style={{ cursor: 'pointer' }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              {route.interface}
            </Text>
          </Text>
        )}
      </div>
    ),
  },
```

- [ ] **Step 3: Update RoutesPage to pass clusterId in render context**

In `RoutesPage.tsx`, find the `col.render(route, { onEdit: handleEdit })` call (inside the table body map) and add `clusterId`:

```typescript
{col.render(route, {
  onEdit: handleEdit,
  clusterId: clusterId ?? undefined,
})}
```

- [ ] **Step 4: Also update the InterfacesPage render context**

In `InterfacesPage.tsx`, the same column render pattern is used with `interfaceColumns`. Check if `interfaceColumns` has a similar render context type. The call is `col.render(iface, { onEdit: handleEdit })`. Since `interfaceColumns` doesn't have any link that needs a clusterId, no change is needed there.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/routes/routeColumns.tsx frontend/src/features/routes/RoutesPage.tsx
git commit -m "Update routeColumns interface link to include clusterId"
```

---

### Task 16: Final compilation check and cleanup

**Files:** All modified files

- [ ] **Step 1: Type check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2: Lint check**

```bash
cd frontend && npx eslint src/ --ext .ts,.tsx --max-warnings 0
```

Fix any warnings or errors that arise.

- [ ] **Step 3: Run the dev server and smoke test**

```bash
cd frontend && npm run dev
```

Manually verify:
- Navigating to `/routers`, selecting a router, and clicking Configure takes you to `/configure/{clusterId}`
- Clicking a module card navigates to `/configure/{clusterId}/{module}`
- The RouterSelector switches cluster ID in the URL when on a configure page
- Bookmarking a configure URL and navigating to it directly works
- The Configure dropdown menu in the header works from any page

- [ ] **Step 4: Final commit (if any lint/type fixes were needed)**

```bash
git add -u
git commit -m "Fix lint and type errors from route rewrite"
```
