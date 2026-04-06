# Firewall Filter Rules Mock UI

## Problem

The Configure > Firewall page is registered in `moduleConfig.ts` but disabled (`isEnabled: false`). Users need a UI to view, create, edit, reorder, and delete firewall filter rules — the core network security primitive in MikroTik RouterOS.

## Solution

Build a mock UI page at `/configure/:clusterId/firewall` that displays firewall filter rules split into three tabs by chain (Forwarding, Router inbound, Router outbound). The table supports drag-and-drop reordering via `@dnd-kit`, per-cell inline editing on double-click, and a detail drawer on single-click. The data model maps directly to MikroTik's `/ip/firewall/filter` REST API resource.

## Data Model

```typescript
export type FirewallChain = 'forward' | 'input' | 'output';
export type FirewallAction = 'accept' | 'drop' | 'reject' | 'fasttrack-connection' | 'passthrough';
export type ConnectionState = 'established' | 'related' | 'new' | 'invalid' | 'untracked';

export interface FirewallRule {
  id: string;
  chain: FirewallChain;
  action: FirewallAction;
  protocol?: string;              // tcp, udp, icmp, gre, ipsec-esp, etc.
  srcAddress?: string;            // IP or CIDR
  dstAddress?: string;
  srcAddressList?: string;        // reference to address list name
  dstAddressList?: string;
  srcPort?: string;               // single port or range (e.g. "80" or "1024-65535")
  dstPort?: string;
  inInterface?: string;           // e.g. "ether1"
  outInterface?: string;
  connectionState?: ConnectionState[];
  disabled: boolean;
  comment: string;
}
```

Design notes:
- `srcPort`/`dstPort` are strings to support ranges like `"1024-65535"` (matching MikroTik API).
- `srcAddress` and `srcAddressList` are mutually exclusive — the form enforces this via a toggle. Same for destination.
- `protocol` is a free string to support the full range MikroTik offers (tcp, udp, icmp, gre, ipsec-esp, etc.).
- Rules are ordered — position within a chain determines evaluation priority. The table shows a `#` column with the position number.

## API Endpoints

These map to MikroTik's REST API at `/rest/ip/firewall/filter`:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/routers/{routerId}/firewall/filter` | List all rules |
| PUT | `/routers/{routerId}/firewall/filter` | Add a rule |
| PATCH | `/routers/{routerId}/firewall/filter/{id}` | Update a rule |
| DELETE | `/routers/{routerId}/firewall/filter/{id}` | Delete a rule |
| POST | `/routers/{routerId}/firewall/filter/move` | Reorder a rule (`{ ".id": ruleId, "destination": targetId }`) |

The mock layer implements these as in-memory CRUD operations on seed data, following the same pattern as `mockTunnelsData.ts` and `mockWireGuardData.ts`.

## Page Layout

Top-to-bottom:

1. **Header row**: Title "Firewall" + subtitle "Firewall filter rules" | "Add Rule" button (right-aligned)
2. **Tabs bar**: Forwarding | Router inbound | Router outbound
3. **Search bar**: Filters visible rules by address, port, comment, interface
4. **Rule table**: Drag-sortable rows with per-cell inline editing
5. **Empty state**: When no rules exist for the active chain

### Tabs

Three tabs map to MikroTik firewall chains:

| Tab | Chain | Description |
|-----|-------|-------------|
| Forwarding | `forward` | Traffic passing through the router between interfaces |
| Router inbound | `input` | Traffic destined to the router itself |
| Router outbound | `output` | Traffic originating from the router |

The API returns all rules; the page filters client-side by `chain`. Each tab maintains its own rule ordering independently.

### Table Columns

| Column | Width | Content | Inline Edit |
|--------|-------|---------|-------------|
| Drag handle | 32px | Grip icon, always visible | No |
| # | 40px | Row position number in chain | No |
| Action | 90px | Badge — green=accept, red=drop/reject, blue=fasttrack, gray=passthrough | Select |
| Source | flex | Address or address list name (badge), port below if set | TextInput |
| Destination | flex | Address or address list name (badge), port below if set | TextInput |
| Protocol | 80px | `tcp`, `udp`, `icmp`, etc. or `any` | Select |
| Interface | 120px | `in: ether1` / `out: ether2` | Select |
| Conn. State | 140px | Abbreviated badges: `est`, `rel`, `new`, etc. | MultiSelect |
| Actions | 80px | Edit/Delete dropdown menu | No |

### Interactions

**Single click row**: Opens a detail drawer (read-only view of all fields, Edit/Delete buttons at bottom).

**Double click cell**: That cell enters inline edit mode:
- Text fields (address, port): render `TextInput` — for Source/Destination, inline edit modifies the address value directly (the address vs. address-list toggle is only available in the full form drawer)
- Select fields (action, protocol): render `Select`
- Multi-select (connection-state): render `MultiSelect`
- Enter saves, Escape cancels, click-away saves
- Calls the update mutation on save

**Drag row**: Grab the drag handle, drag to reorder within the current chain tab. On drop, calls the `move` mutation. Position numbers update immediately (optimistic).

**Disabled rules**: Row rendered at 50% opacity (matching RoutesPage pattern for disabled routes).

## Add/Edit Form

Opens as a drawer from the right side. Fields grouped in sections:

**General**:
- Action (select: accept/drop/reject/fasttrack-connection/passthrough)
- Comment (text input)

**Addresses**:
- Source: segmented control toggling between "Address" (TextInput for IP/CIDR) and "Address List" (Select populated from the router's existing address lists). Same for Destination.

**Ports & Protocol**:
- Protocol (select: tcp, udp, icmp, gre, ipsec-esp, or blank for any)
- Src port (text input, disabled unless protocol is tcp or udp)
- Dst port (text input, disabled unless protocol is tcp or udp)

**Interfaces**:
- In interface (select from router's interfaces)
- Out interface (select from router's interfaces)

**Connection State**:
- Multi-select: established, related, new, invalid, untracked

**Status**:
- Disabled toggle

Chain is not in the form — it is implicitly set from the currently active tab when adding a new rule. When editing, the chain is preserved from the existing rule.

## Detail Drawer

Read-only key-value display of all rule fields, following the same pattern as TunnelDetail and WireGuardInterfaceDetail. Edit and Delete action buttons at the bottom. Edit opens the form drawer pre-filled. Delete shows a ConfirmDialog.

## Mock Data

`mockFirewallData.ts` seeds realistic rules per router reflecting a typical MikroTik default firewall configuration:

**chain=input** (Router inbound):
1. Accept established,related,untracked
2. Drop invalid
3. Accept ICMP
4. Accept from LAN (src-address-list: "LAN")
5. Drop all (catch-all)

**chain=forward** (Forwarding):
1. Fasttrack established,related
2. Accept established,related,untracked
3. Drop invalid
4. Accept LAN to WAN (src-address-list: "LAN", out-interface: "ether1")
5. Accept port forwarding (dst-port: "443", protocol: "tcp", connection-state: new)
6. Drop all (catch-all)

**chain=output** (Router outbound):
1. Accept all (default permissive outbound)

CRUD operations follow the existing mock pattern (`structuredClone` of seed data, counter-based ID generation). A `moveRule(routerId, ruleId, destinationId)` function handles reordering.

## Dependencies

New npm dependency: `@dnd-kit/core` and `@dnd-kit/sortable` for drag-and-drop table row reordering.

## File Structure

| File | Responsibility |
|------|----------------|
| `frontend/src/api/types.ts` | Add `FirewallRule`, `FirewallChain`, `FirewallAction`, `ConnectionState` types |
| `frontend/src/mocks/mockFirewallData.ts` | Seed data and CRUD operations |
| `frontend/src/features/firewall/firewallApi.ts` | TanStack Query hooks (mock + real API) |
| `frontend/src/features/firewall/FirewallPage.tsx` | Main page: tabs, search, state management |
| `frontend/src/features/firewall/FirewallTable.tsx` | Sortable table with drag-drop and inline editing |
| `frontend/src/features/firewall/FirewallDetail.tsx` | Detail drawer (read-only view) |
| `frontend/src/features/firewall/FirewallForm.tsx` | Add/edit form drawer |
| `frontend/src/features/firewall/firewallColumns.tsx` | Column definitions with display and edit renderers |
| `frontend/src/features/configure/moduleConfig.ts` | Enable firewall module (`isEnabled: true`) |
| `frontend/src/app/routes.tsx` | Add firewall route under `configure/:clusterId` |

## What doesn't change

- `useRouterStore`, `useClusterId`, `configurePath` — all reused as-is
- Address lists mock data — referenced by firewall rules but not modified
- Other configure pages — no changes
- AppShell navigation — automatically picks up the enabled module from `moduleConfig`
