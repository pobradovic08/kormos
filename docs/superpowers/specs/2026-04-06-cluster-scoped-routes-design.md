# Cluster-Scoped Configure Routes

## Problem

All configure routes (`/configure/interfaces`, `/configure/routes`, etc.) are flat paths with no indication of which cluster is being configured. The selected cluster lives only in a Zustand store backed by localStorage. This means:

- URLs are not shareable or bookmarkable to a specific cluster's configuration
- Browser back/forward doesn't preserve cluster context
- There is no URL-level enforcement that a cluster is selected before accessing configure pages

## Solution

Rewrite configure routes to include the cluster ID as a URL parameter:

```
/configure/:clusterId              -> ConfigureLandingPage
/configure/:clusterId/interfaces   -> InterfacesPage
/configure/:clusterId/routes       -> RoutesPage
/configure/:clusterId/address-lists -> AddressListsPage
/configure/:clusterId/tunnels      -> TunnelsPage
/configure/:clusterId/wireguard    -> WireGuardPage
```

Standalone routers (no HA/VRRP) are modeled as single-member clusters. The `clusterId` for standalone routers is their `router.id`, consistent with the existing `groupRouters()` logic.

All other routes (`/dashboard`, `/routers`, `/users`, `/audit-log`, `/settings`) remain unchanged.

## Architecture

### Sync: URL is source of truth, store follows

The `useRouterStore` Zustand store continues to exist for components outside the configure route tree (CommitButton, CommitPanel, etc.). However, within configure routes, the URL parameter is the authoritative source of the cluster ID.

A new `ConfigureLayout` wrapper component sits at the `configure/:clusterId` route level:

1. Reads `:clusterId` from `useParams()`
2. Syncs the store by calling `selectRouter()` on mount and whenever the param changes
3. Renders `<Outlet />` for child routes

The sync is strictly one-way: URL -> store. The store never drives the URL for configure pages.

### Route definitions

```tsx
// routes.tsx - configure section becomes:
{
  path: 'configure/:clusterId',
  element: <ConfigureLayout />,
  children: [
    { index: true, element: <ConfigureLandingPage /> },
    { path: 'interfaces', element: <InterfacesPage /> },
    { path: 'routes', element: <RoutesPage /> },
    { path: 'address-lists', element: <AddressListsPage /> },
    { path: 'tunnels', element: <TunnelsPage /> },
    { path: 'wireguard', element: <WireGuardPage /> },
  ],
}
```

The old `/configure` route (without cluster ID) is removed. Clicking "Configure" in the nav requires a cluster to be selected.

### ConfigureLayout component

New file: `src/features/configure/ConfigureLayout.tsx`

```tsx
function ConfigureLayout() {
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

### RouterSelector behavior

When the user selects a different router/cluster while on a configure page:

1. Determine the current configure sub-path (e.g. `interfaces`, `routes`)
2. Navigate to `/configure/${newClusterId}/${currentSubPath}`
3. The `ConfigureLayout` sync effect updates the store from the new URL param

When on a non-configure page, the selector continues to just update the store (current behavior).

### Navigation updates

**AppShell Configure dropdown menu:** Menu items currently use static routes from `moduleConfig`. They need to construct paths dynamically using the current `clusterId`:

- If on a configure page: read `clusterId` from URL
- If on a non-configure page: read from the store
- If no cluster selected: navigate to `/routers` instead

**ConfigureLandingPage cards:** Same logic — construct `/configure/${clusterId}/${slug}` for each module.

### moduleConfig change

The `route` field changes from absolute path to relative slug:

```typescript
// Before
{ title: 'Interfaces', route: '/configure/interfaces', ... }

// After
{ title: 'Interfaces', route: 'interfaces', ... }
```

Consumers construct the full path: `/configure/${clusterId}/${mod.route}`

### Configure page changes

Each configure page stops importing `useRouterStore` directly. Instead, it reads `clusterId` from `useParams()`. The API hooks already accept `routerId` as a parameter, so the change is just the source of the value.

Pages affected:
- `InterfacesPage.tsx` — reads `useRouterStore` at line 115
- `InterfaceForm.tsx` — reads `useRouterStore` at line 105
- `RoutesPage.tsx` — reads `useRouterStore` at line 114
- `AddressListsPage.tsx` — reads `useRouterStore` at line 49
- `TunnelsPage.tsx` — reads `useRouterStore` at line 96
- `WireGuardPage.tsx` — reads `useRouterStore` at line 18

Each page's "no router selected" empty state becomes unreachable (the URL enforces a cluster ID), so those guards can be removed.

### Store field semantics

The `useRouterStore` currently has a `selectedRouterId` field. With this change, the value stored there may be either a router ID (for standalone routers, where router ID = cluster ID) or a cluster ID (for HA pairs). The field name stays as `selectedRouterId` to avoid a large rename across non-configure code, but its semantic meaning broadens to "the currently active cluster/router context." The `ConfigureLayout` sync writes the URL's `clusterId` into this field.

For configure pages, the `clusterId` from the URL is what gets passed to API hooks. For HA clusters, the API layer already handles routing requests to the appropriate cluster member.

### What doesn't change

- `useRouterStore` itself — still exists, still persists to localStorage
- CommitButton, CommitPanel — still read from the store
- RoutersPage — still calls `selectRouter()` when a user picks a router
- API layer — hooks are already parameterized by `routerId`
- `routerGrouping.ts` — already treats standalone routers as single-member clusters

## Edge cases

**Invalid clusterId in URL:** If the URL contains a cluster ID that doesn't match any known router/cluster, the configure pages will show an error or empty state from the API layer (existing behavior when data isn't found).

**Direct navigation without prior selection:** A user can bookmark `/configure/abc123/interfaces` and navigate directly. The `ConfigureLayout` syncs the store, and the page loads normally.

**Cluster member switching:** The RouterSelector shows cluster peers. Switching between peers within the same cluster keeps the same `clusterId` in the URL (since peers share a cluster ID for HA pairs). For standalone routers, switching to a different standalone router changes the `clusterId`.
