# Router Table Redesign — Design Spec

**Date**: 2026-04-03
**Status**: Approved
**Branch**: `004-routers-mock-ui`

## Overview

Redesign the routers table from a flat striped table to a collapsible tree table that supports HA pairs and standalone routers. All badges use Mantine's `variant="light"` style. No striped rows.

## Data Model Changes

### Router Entity

Add to the `Router` type:
- `cluster_id?: string` — groups routers into HA pairs
- `cluster_name?: string` — display name for the cluster (e.g., "edge-gw")
- `role?: 'master' | 'backup'` — HA role within the cluster
- `tenant_name?: string` — already added
- `routeros_version?: string` — from system info
- `uptime?: string` — from system info

### HA Pair (derived, not stored)

A virtual row derived by grouping routers with the same `cluster_id`. Computed fields:
- **Status**: Online (all nodes up), Degraded (some up), Offline (all down)
- **Version status**: Up to date (all on latest), Needs update (all on same outdated version), Version mismatch (nodes on different versions)
- **Node count**: number of routers in the cluster

## Table Layout

### Columns

| Column | Parent Row (HA/Standalone) | Child Row (HA node) |
|--------|---------------------------|---------------------|
| Toggle | ▼ / ▶ collapse arrow | (empty) |
| Router | Cloud icon + name + status badge + version badge, tenant below | Dot + FQDN hostname |
| Address | (empty for HA parent) | host:port in monospace |
| Role | HA badge / Standalone badge | Master / Backup badge |
| Version | (empty — shown as badge near name) | version number in monospace |
| Uptime | (empty) | uptime string |

### Row Types

**HA Parent Row**:
- Light blue background (`#f8f9ff`)
- Cloud icon (IconCloudComputing from tabler) + cluster name (bold) + status badge + version status badge
- Tenant name (bold, clickable link) + "· 2 nodes" below the name
- Collapsible — toggle arrow expands/collapses child rows

**HA Child Row**:
- White background, indented (left padding)
- Green/red dot before the FQDN hostname
- Address in monospace
- Master/Backup badge in Role column
- Version number in monospace (highlighted orange if outdated/mismatched)
- Uptime string
- Offline nodes: hostname dimmed, address dimmed, version/uptime show "—"

**Standalone Row**:
- White background, no indent
- Cloud icon + FQDN hostname + status badge + version status badge
- Tenant name (bold, clickable link) below
- Address in monospace
- "Standalone" badge in Role column
- Version in monospace, uptime string

### Badges (all `variant="light"`, `radius="sm"`)

| Badge | Color | Used On |
|-------|-------|---------|
| Online | green | Parent/standalone status |
| Offline | red | Parent/standalone status |
| Degraded | orange | HA parent when some nodes down |
| HA | blue | HA parent role column |
| Standalone | gray | Standalone role column |
| Master | green | HA child role |
| Backup | orange | HA child role |
| Up to date | green | Version status (all current) |
| Needs update | yellow/orange | Version status (outdated) |
| Version mismatch | orange | Version status (nodes differ) |

All badge text is title case (Master, Backup, Standalone — not MASTER, BACKUP, STANDALONE).

### Status Indicators

- **Child row dots**: 7px circle, green (`#2f9e44`) for online, red (`#e03131`) for offline
- **No dots on parent or standalone rows** — they use the status badge instead

### Version Display

- **Parent/standalone row**: version status badge inline after the status badge near the name. No version in the Version column.
- **Child rows**: plain version number in monospace in the Version column. Highlighted orange if that node's version is outdated or mismatching.
- **Offline nodes**: "—" in version and uptime columns

### Tenant Name

- Bold text, styled as a clickable link (dark color, no underline)
- Links to filtered view showing only that tenant's routers
- Shown below the router/cluster name

### Separators

- Light separator (`#f1f3f5`) between child rows within a group
- Strong separator (`#e9ecef`) between groups (after last child row)
- No striped rows

### Icons

- **Cloud icon** (IconCloudComputing from @tabler/icons-react, 18x18px) — used for all parent and standalone rows
- Icon color: dimmed gray (`#868e96`), lighter gray (`#adb5bd`) for offline routers
- Vertically centered with the name using flex alignment

## Mantine Implementation Notes

- Use `<Table>` without `striped` prop
- Badges: `<Badge variant="light" color="green|red|orange|blue|gray" radius="sm" size="sm">`
- Wrap badges in `<Group>` inside table cells
- Cloud icon: `<IconCloudComputing size={18} />` from `@tabler/icons-react`
- Dots: `<Box w={7} h={7} style={{ borderRadius: '50%' }} bg="green.7" />`
- Monospace text: `<MonoText>` component or `ff="monospace"` prop
- Parent row background: use inline `style={{ backgroundColor: 'var(--mantine-color-blue-0)' }}`
- Collapse state managed per cluster via `useState<Set<string>>`

## Mock Data Updates

- Add `cluster_id`, `cluster_name`, `role`, `routeros_version`, `uptime` to mock routers
- Group mock routers into 3 HA pairs + 3 standalone
- Include varied version states: up to date, needs update, version mismatch
- Include mixed online/offline states including a degraded pair
