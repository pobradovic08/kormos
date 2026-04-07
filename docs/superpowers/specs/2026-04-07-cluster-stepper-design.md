# Cluster Stepper Design

## Overview

Replace the flat "Add Router" flow with a cluster-first model. A cluster is an HA pair (1-2 routers). Users create a cluster first, then add a primary router and optionally a secondary (backup) router via a 4-step stepper in an XL drawer. The same drawer handles both creation and editing.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Cluster model | Always 1 or 2 routers (HA pair) | Matches MikroTik VRRP pairs; simple constraint |
| Backend model | Clusters table + FK on routers | Clean separation, follows existing repo/service/handler pattern |
| Router naming | Auto-derived from cluster name (-1, -2), editable | Reduces typing, keeps naming consistent |
| Connection test | Optional during setup | Allows pre-provisioning routers not yet online |
| Edit flow | Reuses stepper drawer | One component, handles add/remove backup, rename, credential updates |
| Backward compat | Not needed | No production deployments yet |

## Database Schema

### New `clusters` table

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK, default gen_random_uuid() |
| tenant_id | UUID | FK to tenants, NOT NULL |
| name | VARCHAR(255) | NOT NULL |
| created_at | TIMESTAMPTZ | DEFAULT now() |
| updated_at | TIMESTAMPTZ | DEFAULT now() |

UNIQUE constraint on (tenant_id, name).

### Changes to `routers` table

| Column | Type | Notes |
|--------|------|-------|
| cluster_id | UUID | FK to clusters, NOT NULL |
| role | ENUM('master', 'backup') | NOT NULL, DEFAULT 'master' |

Every router belongs to a cluster. A standalone router is a cluster with one master router. Backend enforces max 2 routers per cluster, with one master and one backup when 2 exist.

## Backend API

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/clusters` | List all clusters with nested routers |
| POST | `/api/clusters` | Create cluster + routers atomically |
| GET | `/api/clusters/{clusterID}` | Get cluster with routers |
| PUT | `/api/clusters/{clusterID}` | Update cluster + routers (diff-based) |
| DELETE | `/api/clusters/{clusterID}` | Delete cluster and all its routers |

### Create request

```json
{
  "name": "edge-gw",
  "routers": [
    {
      "name": "edge-gw-1",
      "hostname": "edge-gw-1.dc1.local",
      "host": "10.0.1.1",
      "port": 443,
      "username": "admin",
      "password": "secret",
      "role": "master"
    },
    {
      "name": "edge-gw-2",
      "hostname": "edge-gw-2.dc1.local",
      "host": "10.0.1.2",
      "port": 443,
      "username": "admin",
      "password": "secret",
      "role": "backup"
    }
  ]
}
```

### Update request

Same shape as create, but each existing router includes its `id` field. Backend diffs against current state:
- Existing router ID missing from array: that router is deleted
- Router without `id`: created as new
- Router with `id`: updated (credentials re-encrypted only if password is non-empty)

### Validation rules

- Cluster name must be unique per tenant
- 1-2 routers per cluster
- If 2 routers: one master, one backup
- Router name must be unique per tenant
- Router host+port must be unique per tenant

### List response

Clusters with routers nested, reachability status on each router:

```json
{
  "clusters": [
    {
      "id": "uuid",
      "name": "edge-gw",
      "mode": "ha",
      "created_at": "...",
      "routers": [
        {
          "id": "uuid",
          "name": "edge-gw-1",
          "hostname": "edge-gw-1.dc1.local",
          "host": "10.0.1.1",
          "port": 443,
          "role": "master",
          "is_reachable": true,
          "last_seen": "..."
        },
        {
          "id": "uuid",
          "name": "edge-gw-2",
          "hostname": "edge-gw-2.dc1.local",
          "host": "10.0.1.2",
          "port": 443,
          "role": "backup",
          "is_reachable": true,
          "last_seen": "..."
        }
      ]
    }
  ]
}
```

The `mode` field is derived: "ha" if 2 routers, "standalone" if 1.

### Existing endpoints

`/api/routers` endpoints remain read-only. The operation service uses `GetClientForRouter` which still works. Creation/update/delete goes through `/api/clusters`.

## Frontend — Stepper Drawer

XL drawer (560px), right-side position, 4 steps. Same component for create and edit.

### Step 1: Cluster

- Cluster name input (required, validated for uniqueness)
- As user types, auto-populates router names in steps 2/3 as `{name}-1` / `{name}-2`

### Step 2: Primary Router

- Name (pre-filled from cluster name + "-1", editable)
- Hostname (required)
- Address (required, IP or hostname)
- Port (default 443)
- API Username (required)
- API Password (required)
- "Test Connection" button: calls backend, shows green check or red error inline
- Role is always master, not shown in UI

### Step 3: Secondary Router (Optional)

- Toggle at top: "Add backup router for HA"
- When on: same fields as step 2, name pre-filled as `{name}-2`
- When off: brief explanation, "Skip" to proceed
- Stepper label shows "(optional)"
- Role is always backup, not shown in UI

### Step 4: Review & Save

- Summary showing cluster name, mode (Standalone / HA)
- Cards for each router showing name, address, port, connection test status
- "Create Cluster" / "Save Changes" button
- On success: close drawer, invalidate queries, show toast

### Edit mode

- Step 1: cluster name pre-filled
- Steps 2/3: fields pre-filled, password field empty with "unchanged" placeholder
- Step 3: toggle reflects current state (off for standalone, on for HA). User can toggle to add/remove backup.
- Step 4: "Delete Cluster" button in footer with confirmation dialog

## Migration Path

### New

- `clusters` table and migration
- `cluster_id` and `role` columns on `routers` table
- `cluster` backend package (repo/service/handler)
- `ClusterDrawer` frontend component with stepper
- Cluster API hooks

### Modified

- `RoutersPage` reads `cluster_id`/`role` from backend data instead of mock-only fields
- `RouterSelector` works as-is once `cluster_id` comes from backend
- Mock data updated to use real cluster structure
- `routerGrouping.ts` keeps working, just reads real data now

### Removed

- `RouterForm` (simple modal, replaced by ClusterDrawer)
- Create/update/delete router API hooks (replaced by cluster hooks)
