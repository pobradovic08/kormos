# Firewall Mock UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mock UI page for Configure > Firewall with three chain tabs, drag-drop reordering, per-cell inline editing, detail drawer, and add/edit form.

**Architecture:** Types and mock data provide the data layer. TanStack Query hooks bridge mock/real API. The page component owns tabs and state. The table component handles dnd-kit sortable rows and inline cell editing. Detail and form drawers handle read-only view and CRUD. Column definitions separate display/edit renderers.

**Tech Stack:** React 19, Mantine UI 9, @dnd-kit/core + @dnd-kit/sortable, TanStack Query 5, TypeScript 5.9

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `frontend/src/api/types.ts` | Add FirewallRule, FirewallChain, FirewallAction, ConnectionState types |
| Create | `frontend/src/mocks/mockFirewallData.ts` | Seed data and CRUD + move operations |
| Create | `frontend/src/features/firewall/firewallApi.ts` | TanStack Query hooks |
| Create | `frontend/src/features/firewall/FirewallPage.tsx` | Main page: tabs, search, state management |
| Create | `frontend/src/features/firewall/FirewallTable.tsx` | Sortable table with dnd-kit and inline editing |
| Create | `frontend/src/features/firewall/FirewallDetail.tsx` | Detail drawer (read-only) |
| Create | `frontend/src/features/firewall/FirewallForm.tsx` | Add/edit form drawer |
| Modify | `frontend/src/features/configure/moduleConfig.ts` | Enable firewall module |
| Modify | `frontend/src/app/routes.tsx` | Add firewall route |

---

### Task 1: Create git branch and install dnd-kit

**Files:** None (git + npm only)

- [ ] **Step 1: Create and switch to branch**

```bash
git checkout -b 011-firewall-mock-ui
```

- [ ] **Step 2: Install dnd-kit dependencies**

```bash
cd frontend && pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "Add @dnd-kit dependencies for drag-drop table reordering"
```

---

### Task 2: Add types to api/types.ts

**Files:**
- Modify: `frontend/src/api/types.ts`

- [ ] **Step 1: Add firewall types at the end of the file**

```typescript
export type FirewallChain = 'forward' | 'input' | 'output';
export type FirewallAction = 'accept' | 'drop' | 'reject' | 'fasttrack-connection' | 'passthrough';
export type ConnectionState = 'established' | 'related' | 'new' | 'invalid' | 'untracked';

export interface FirewallRule {
  id: string;
  chain: FirewallChain;
  action: FirewallAction;
  protocol?: string;
  srcAddress?: string;
  dstAddress?: string;
  srcAddressList?: string;
  dstAddressList?: string;
  srcPort?: string;
  dstPort?: string;
  inInterface?: string;
  outInterface?: string;
  connectionState?: ConnectionState[];
  disabled: boolean;
  comment: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/types.ts
git commit -m "Add FirewallRule types"
```

---

### Task 3: Create mock data

**Files:**
- Create: `frontend/src/mocks/mockFirewallData.ts`

- [ ] **Step 1: Create the mock data file with seed data and CRUD operations**

```typescript
import type { FirewallRule } from '../api/types';

const seedData: Record<string, FirewallRule[]> = {
  'mock-1': [
    // ─── chain=input (Router inbound) ──────────────────────────
    {
      id: 'fw-1-1', chain: 'input', action: 'accept',
      connectionState: ['established', 'related', 'untracked'],
      disabled: false, comment: 'Accept established, related, untracked',
    },
    {
      id: 'fw-1-2', chain: 'input', action: 'drop',
      connectionState: ['invalid'],
      disabled: false, comment: 'Drop invalid',
    },
    {
      id: 'fw-1-3', chain: 'input', action: 'accept',
      protocol: 'icmp',
      disabled: false, comment: 'Accept ICMP',
    },
    {
      id: 'fw-1-4', chain: 'input', action: 'accept',
      srcAddressList: 'LAN',
      disabled: false, comment: 'Accept from LAN',
    },
    {
      id: 'fw-1-5', chain: 'input', action: 'drop',
      disabled: false, comment: 'Drop all other input',
    },
    // ─── chain=forward (Forwarding) ────────────────────────────
    {
      id: 'fw-1-6', chain: 'forward', action: 'fasttrack-connection',
      connectionState: ['established', 'related'],
      disabled: false, comment: 'Fasttrack established, related',
    },
    {
      id: 'fw-1-7', chain: 'forward', action: 'accept',
      connectionState: ['established', 'related', 'untracked'],
      disabled: false, comment: 'Accept established, related, untracked',
    },
    {
      id: 'fw-1-8', chain: 'forward', action: 'drop',
      connectionState: ['invalid'],
      disabled: false, comment: 'Drop invalid',
    },
    {
      id: 'fw-1-9', chain: 'forward', action: 'accept',
      srcAddressList: 'LAN', outInterface: 'ether1',
      disabled: false, comment: 'Accept LAN to WAN',
    },
    {
      id: 'fw-1-10', chain: 'forward', action: 'accept',
      protocol: 'tcp', dstPort: '443',
      connectionState: ['new'],
      disabled: false, comment: 'Accept HTTPS port forwarding',
    },
    {
      id: 'fw-1-11', chain: 'forward', action: 'accept',
      protocol: 'tcp', dstPort: '80',
      connectionState: ['new'],
      disabled: true, comment: 'HTTP port forwarding (disabled)',
    },
    {
      id: 'fw-1-12', chain: 'forward', action: 'drop',
      disabled: false, comment: 'Drop all other forward',
    },
    // ─── chain=output (Router outbound) ────────────────────────
    {
      id: 'fw-1-13', chain: 'output', action: 'accept',
      disabled: false, comment: 'Accept all outbound',
    },
  ],
  'mock-2': [
    {
      id: 'fw-2-1', chain: 'input', action: 'accept',
      connectionState: ['established', 'related'],
      disabled: false, comment: 'Accept established, related',
    },
    {
      id: 'fw-2-2', chain: 'input', action: 'drop',
      connectionState: ['invalid'],
      disabled: false, comment: 'Drop invalid',
    },
    {
      id: 'fw-2-3', chain: 'input', action: 'accept',
      protocol: 'icmp',
      disabled: false, comment: 'Accept ICMP',
    },
    {
      id: 'fw-2-4', chain: 'input', action: 'drop',
      disabled: false, comment: 'Drop all other input',
    },
    {
      id: 'fw-2-5', chain: 'forward', action: 'accept',
      connectionState: ['established', 'related'],
      disabled: false, comment: 'Accept established, related',
    },
    {
      id: 'fw-2-6', chain: 'forward', action: 'drop',
      disabled: false, comment: 'Drop all other forward',
    },
    {
      id: 'fw-2-7', chain: 'output', action: 'accept',
      disabled: false, comment: 'Accept all outbound',
    },
  ],
};

let data = structuredClone(seedData);
let nextId = 1000;

export function listFirewallRules(routerId: string): FirewallRule[] {
  return data[routerId] ?? [];
}

export function addFirewallRule(routerId: string, rule: Omit<FirewallRule, 'id'>): FirewallRule {
  if (!data[routerId]) data[routerId] = [];
  const newRule: FirewallRule = { ...rule, id: `fw-new-${nextId++}` };
  data[routerId].push(newRule);
  return newRule;
}

export function updateFirewallRule(
  routerId: string,
  id: string,
  updates: Partial<FirewallRule>,
): FirewallRule {
  const rules = data[routerId];
  if (!rules) throw new Error('Router not found');
  const index = rules.findIndex((r) => r.id === id);
  if (index === -1) throw new Error('Rule not found');
  rules[index] = { ...rules[index], ...updates, id };
  return rules[index];
}

export function deleteFirewallRule(routerId: string, id: string): void {
  if (!data[routerId]) return;
  data[routerId] = data[routerId].filter((r) => r.id !== id);
}

export function moveFirewallRule(
  routerId: string,
  ruleId: string,
  destinationId: string,
): void {
  const rules = data[routerId];
  if (!rules) return;
  const fromIndex = rules.findIndex((r) => r.id === ruleId);
  if (fromIndex === -1) return;
  const [rule] = rules.splice(fromIndex, 1);
  const toIndex = rules.findIndex((r) => r.id === destinationId);
  if (toIndex === -1) {
    rules.push(rule);
  } else {
    rules.splice(toIndex, 0, rule);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/mocks/mockFirewallData.ts
git commit -m "Add firewall mock data with seed rules and CRUD operations"
```

---

### Task 4: Create API hooks

**Files:**
- Create: `frontend/src/features/firewall/firewallApi.ts`

- [ ] **Step 1: Create the API hooks file**

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

export function useFirewallRules(routerId: string | null) {
  const isMock = useMockMode();

  return useQuery<FirewallRule[]>({
    queryKey: ['firewall-rules', routerId],
    queryFn: async () => {
      if (isMock) return listFirewallRules(routerId!);
      const response = await apiClient.get<FirewallRule[]>(
        `/routers/${routerId}/firewall/filter`,
      );
      return response.data;
    },
    enabled: !!routerId,
  });
}

export function useAddFirewallRule(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rule: Omit<FirewallRule, 'id'>) => {
      if (isMock) return addFirewallRule(routerId!, rule);
      const response = await apiClient.put(
        `/routers/${routerId}/firewall/filter`,
        rule,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firewall-rules', routerId] });
    },
  });
}

export function useUpdateFirewallRule(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FirewallRule> }) => {
      if (isMock) return updateFirewallRule(routerId!, id, updates);
      const response = await apiClient.patch(
        `/routers/${routerId}/firewall/filter/${id}`,
        updates,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firewall-rules', routerId] });
    },
  });
}

export function useDeleteFirewallRule(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (isMock) return deleteFirewallRule(routerId!, id);
      await apiClient.delete(`/routers/${routerId}/firewall/filter/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firewall-rules', routerId] });
    },
  });
}

export function useMoveFirewallRule(routerId: string | null) {
  const isMock = useMockMode();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ruleId, destinationId }: { ruleId: string; destinationId: string }) => {
      if (isMock) return moveFirewallRule(routerId!, ruleId, destinationId);
      await apiClient.post(`/routers/${routerId}/firewall/filter/move`, {
        '.id': ruleId,
        destination: destinationId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['firewall-rules', routerId] });
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/firewall/firewallApi.ts
git commit -m "Add firewall API hooks with mock and real API support"
```

---

### Task 5: Create FirewallDetail drawer

**Files:**
- Create: `frontend/src/features/firewall/FirewallDetail.tsx`

- [ ] **Step 1: Create the detail drawer component**

```tsx
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
import { IconPencil, IconChevronDown, IconTrash } from '@tabler/icons-react';
import MonoText from '../../components/common/MonoText';
import type { FirewallRule } from '../../api/types';

interface FirewallDetailProps {
  rule: FirewallRule | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (rule: FirewallRule) => void;
  onDelete: (rule: FirewallRule) => void;
}

const ACTION_COLORS: Record<string, string> = {
  accept: 'green',
  drop: 'red',
  reject: 'red',
  'fasttrack-connection': 'blue',
  passthrough: 'gray',
};

const CHAIN_LABELS: Record<string, string> = {
  forward: 'Forwarding',
  input: 'Router inbound',
  output: 'Router outbound',
};

const CONNECTION_STATE_ABBR: Record<string, string> = {
  established: 'est',
  related: 'rel',
  new: 'new',
  invalid: 'inv',
  untracked: 'unt',
};

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

export default function FirewallDetail({
  rule,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}: FirewallDetailProps) {
  if (!rule) return null;

  return (
    <Drawer
      opened={isOpen}
      onClose={onClose}
      title={
        <Group gap="sm">
          <Title order={4}>Rule Details</Title>
          <Badge variant="light" color={ACTION_COLORS[rule.action] ?? 'gray'} size="sm">
            {rule.action}
          </Badge>
        </Group>
      }
      position="right"
      size="xl"
      padding="xl"
    >
      <Stack gap="lg">
        <Box>
          <Text fw={600} size="sm" mb="sm">General</Text>
          <Stack gap="xs">
            <DetailField label="Chain">
              <Text size="sm">{CHAIN_LABELS[rule.chain] ?? rule.chain}</Text>
            </DetailField>
            <DetailField label="Action">
              <Badge variant="light" color={ACTION_COLORS[rule.action] ?? 'gray'} size="sm">
                {rule.action}
              </Badge>
            </DetailField>
            {rule.comment && (
              <DetailField label="Comment">
                <Text size="sm">{rule.comment}</Text>
              </DetailField>
            )}
            <DetailField label="Status">
              <Badge variant="light" color={rule.disabled ? 'gray' : 'green'} size="sm">
                {rule.disabled ? 'Disabled' : 'Enabled'}
              </Badge>
            </DetailField>
          </Stack>
        </Box>

        {(rule.srcAddress || rule.srcAddressList || rule.dstAddress || rule.dstAddressList) && (
          <>
            <Divider />
            <Box>
              <Text fw={600} size="sm" mb="sm">Addresses</Text>
              <Stack gap="xs">
                {rule.srcAddress && (
                  <DetailField label="Src Address">
                    <MonoText>{rule.srcAddress}</MonoText>
                  </DetailField>
                )}
                {rule.srcAddressList && (
                  <DetailField label="Src Address List">
                    <Badge variant="light" color="violet" size="sm">{rule.srcAddressList}</Badge>
                  </DetailField>
                )}
                {rule.dstAddress && (
                  <DetailField label="Dst Address">
                    <MonoText>{rule.dstAddress}</MonoText>
                  </DetailField>
                )}
                {rule.dstAddressList && (
                  <DetailField label="Dst Address List">
                    <Badge variant="light" color="violet" size="sm">{rule.dstAddressList}</Badge>
                  </DetailField>
                )}
              </Stack>
            </Box>
          </>
        )}

        {(rule.protocol || rule.srcPort || rule.dstPort) && (
          <>
            <Divider />
            <Box>
              <Text fw={600} size="sm" mb="sm">Protocol & Ports</Text>
              <Stack gap="xs">
                {rule.protocol && (
                  <DetailField label="Protocol">
                    <MonoText>{rule.protocol}</MonoText>
                  </DetailField>
                )}
                {rule.srcPort && (
                  <DetailField label="Src Port">
                    <MonoText>{rule.srcPort}</MonoText>
                  </DetailField>
                )}
                {rule.dstPort && (
                  <DetailField label="Dst Port">
                    <MonoText>{rule.dstPort}</MonoText>
                  </DetailField>
                )}
              </Stack>
            </Box>
          </>
        )}

        {(rule.inInterface || rule.outInterface) && (
          <>
            <Divider />
            <Box>
              <Text fw={600} size="sm" mb="sm">Interfaces</Text>
              <Stack gap="xs">
                {rule.inInterface && (
                  <DetailField label="In Interface">
                    <MonoText>{rule.inInterface}</MonoText>
                  </DetailField>
                )}
                {rule.outInterface && (
                  <DetailField label="Out Interface">
                    <MonoText>{rule.outInterface}</MonoText>
                  </DetailField>
                )}
              </Stack>
            </Box>
          </>
        )}

        {rule.connectionState && rule.connectionState.length > 0 && (
          <>
            <Divider />
            <Box>
              <Text fw={600} size="sm" mb="sm">Connection State</Text>
              <Group gap={4}>
                {rule.connectionState.map((s) => (
                  <Badge key={s} variant="light" color="cyan" size="xs">
                    {CONNECTION_STATE_ABBR[s] ?? s}
                  </Badge>
                ))}
              </Group>
            </Box>
          </>
        )}

        <Divider />
        <Button.Group>
          <Button
            variant="light" color="gray" size="xs"
            leftSection={<IconPencil size={14} />}
            onClick={() => onEdit(rule)}
          >
            Edit
          </Button>
          <Menu position="bottom-end">
            <Menu.Target>
              <Button
                variant="light" color="gray" size="xs"
                style={{ paddingLeft: 6, paddingRight: 6, borderLeft: '1px solid var(--mantine-color-gray-4)' }}
              >
                <IconChevronDown size={14} />
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                fz="xs" color="red"
                leftSection={<IconTrash size={14} />}
                onClick={() => onDelete(rule)}
              >
                Delete
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Button.Group>
      </Stack>
    </Drawer>
  );
}

export { ACTION_COLORS, CHAIN_LABELS, CONNECTION_STATE_ABBR };
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/firewall/FirewallDetail.tsx
git commit -m "Add FirewallDetail drawer component"
```

---

### Task 6: Create FirewallForm drawer

**Files:**
- Create: `frontend/src/features/firewall/FirewallForm.tsx`

- [ ] **Step 1: Create the form drawer component**

```tsx
import { useState, useEffect, useMemo } from 'react';
import {
  Drawer,
  TextInput,
  Select,
  MultiSelect,
  Switch,
  SegmentedControl,
  Button,
  Group,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconShieldCheck } from '@tabler/icons-react';
import type { FirewallRule, FirewallChain, FirewallAction, ConnectionState } from '../../api/types';
import { useAddFirewallRule, useUpdateFirewallRule } from './firewallApi';
import { useInterfaces } from '../interfaces/interfacesApi';
import { useAddressLists } from '../address-lists/addressListsApi';

interface FirewallFormProps {
  isOpen: boolean;
  onClose: () => void;
  routerId: string;
  chain: FirewallChain;
  editRule?: FirewallRule | null;
}

interface FormState {
  action: FirewallAction;
  comment: string;
  srcMode: 'address' | 'list';
  srcAddress: string;
  srcAddressList: string;
  dstMode: 'address' | 'list';
  dstAddress: string;
  dstAddressList: string;
  protocol: string;
  srcPort: string;
  dstPort: string;
  inInterface: string;
  outInterface: string;
  connectionState: ConnectionState[];
  disabled: boolean;
}

function getInitialState(rule?: FirewallRule | null): FormState {
  if (rule) {
    return {
      action: rule.action,
      comment: rule.comment,
      srcMode: rule.srcAddressList ? 'list' : 'address',
      srcAddress: rule.srcAddress ?? '',
      srcAddressList: rule.srcAddressList ?? '',
      dstMode: rule.dstAddressList ? 'list' : 'address',
      dstAddress: rule.dstAddress ?? '',
      dstAddressList: rule.dstAddressList ?? '',
      protocol: rule.protocol ?? '',
      srcPort: rule.srcPort ?? '',
      dstPort: rule.dstPort ?? '',
      inInterface: rule.inInterface ?? '',
      outInterface: rule.outInterface ?? '',
      connectionState: rule.connectionState ?? [],
      disabled: rule.disabled,
    };
  }
  return {
    action: 'accept',
    comment: '',
    srcMode: 'address',
    srcAddress: '',
    srcAddressList: '',
    dstMode: 'address',
    dstAddress: '',
    dstAddressList: '',
    protocol: '',
    srcPort: '',
    dstPort: '',
    inInterface: '',
    outInterface: '',
    connectionState: [],
    disabled: false,
  };
}

const ACTION_OPTIONS = [
  { value: 'accept', label: 'Accept' },
  { value: 'drop', label: 'Drop' },
  { value: 'reject', label: 'Reject' },
  { value: 'fasttrack-connection', label: 'Fasttrack' },
  { value: 'passthrough', label: 'Passthrough' },
];

const PROTOCOL_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'tcp', label: 'TCP' },
  { value: 'udp', label: 'UDP' },
  { value: 'icmp', label: 'ICMP' },
  { value: 'gre', label: 'GRE' },
  { value: 'ipsec-esp', label: 'IPsec ESP' },
  { value: 'ipsec-ah', label: 'IPsec AH' },
];

const CONNECTION_STATE_OPTIONS = [
  { value: 'established', label: 'Established' },
  { value: 'related', label: 'Related' },
  { value: 'new', label: 'New' },
  { value: 'invalid', label: 'Invalid' },
  { value: 'untracked', label: 'Untracked' },
];

export default function FirewallForm({
  isOpen,
  onClose,
  routerId,
  chain,
  editRule,
}: FirewallFormProps) {
  const isEdit = !!editRule;
  const [state, setState] = useState<FormState>(getInitialState(editRule));
  const [saving, setSaving] = useState(false);

  const addMutation = useAddFirewallRule(routerId);
  const updateMutation = useUpdateFirewallRule(routerId);
  const { data: interfaces } = useInterfaces(routerId);
  const { data: addressLists } = useAddressLists(routerId);

  const interfaceOptions = useMemo(() => {
    if (!interfaces) return [];
    return interfaces.map((i) => ({ value: i.name, label: i.name }));
  }, [interfaces]);

  const addressListOptions = useMemo(() => {
    if (!addressLists) return [];
    return addressLists.map((l) => ({ value: l.name, label: l.name }));
  }, [addressLists]);

  useEffect(() => {
    if (isOpen) {
      setState(getInitialState(editRule));
      setSaving(false);
    }
  }, [isOpen, editRule]);

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [field]: value }));
  }

  const portsEnabled = state.protocol === 'tcp' || state.protocol === 'udp';

  async function handleSubmit() {
    setSaving(true);
    try {
      const ruleData: Omit<FirewallRule, 'id'> = {
        chain: editRule?.chain ?? chain,
        action: state.action,
        comment: state.comment.trim(),
        protocol: state.protocol || undefined,
        srcAddress: state.srcMode === 'address' && state.srcAddress ? state.srcAddress.trim() : undefined,
        srcAddressList: state.srcMode === 'list' && state.srcAddressList ? state.srcAddressList : undefined,
        dstAddress: state.dstMode === 'address' && state.dstAddress ? state.dstAddress.trim() : undefined,
        dstAddressList: state.dstMode === 'list' && state.dstAddressList ? state.dstAddressList : undefined,
        srcPort: portsEnabled && state.srcPort ? state.srcPort.trim() : undefined,
        dstPort: portsEnabled && state.dstPort ? state.dstPort.trim() : undefined,
        inInterface: state.inInterface || undefined,
        outInterface: state.outInterface || undefined,
        connectionState: state.connectionState.length > 0 ? state.connectionState : undefined,
        disabled: state.disabled,
      };

      if (isEdit) {
        await updateMutation.mutateAsync({ id: editRule!.id, updates: ruleData });
      } else {
        await addMutation.mutateAsync(ruleData);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const title = isEdit ? 'Edit Firewall Rule' : 'Add Firewall Rule';

  return (
    <Drawer
      opened={isOpen}
      onClose={onClose}
      position="right"
      size="xl"
      padding="xl"
      title={<Group gap="xs"><IconShieldCheck size={20} /><Text fw={600}>{title}</Text></Group>}
    >
      <Stack gap="md">
        {/* General */}
        <Title order={6}>General</Title>
        <Select
          label="Action" required size="sm" radius="sm"
          data={ACTION_OPTIONS}
          value={state.action}
          onChange={(val) => update('action', (val ?? 'accept') as FirewallAction)}
        />
        <TextInput
          label="Comment" size="sm" radius="sm"
          placeholder="Optional description"
          value={state.comment}
          onChange={(e) => update('comment', e.currentTarget.value)}
        />

        {/* Addresses */}
        <Title order={6} mt="sm">Source</Title>
        <SegmentedControl
          fullWidth size="xs" radius="md"
          value={state.srcMode}
          onChange={(val) => update('srcMode', val as 'address' | 'list')}
          data={[
            { value: 'address', label: 'Address' },
            { value: 'list', label: 'Address List' },
          ]}
        />
        {state.srcMode === 'address' ? (
          <TextInput
            label="Source Address" size="sm" radius="sm"
            placeholder="e.g. 192.168.1.0/24"
            value={state.srcAddress}
            onChange={(e) => update('srcAddress', e.currentTarget.value)}
          />
        ) : (
          <Select
            label="Source Address List" size="sm" radius="sm"
            placeholder="Select address list"
            data={addressListOptions}
            value={state.srcAddressList || null}
            onChange={(val) => update('srcAddressList', val ?? '')}
            searchable clearable
          />
        )}

        <Title order={6} mt="sm">Destination</Title>
        <SegmentedControl
          fullWidth size="xs" radius="md"
          value={state.dstMode}
          onChange={(val) => update('dstMode', val as 'address' | 'list')}
          data={[
            { value: 'address', label: 'Address' },
            { value: 'list', label: 'Address List' },
          ]}
        />
        {state.dstMode === 'address' ? (
          <TextInput
            label="Destination Address" size="sm" radius="sm"
            placeholder="e.g. 10.0.0.0/8"
            value={state.dstAddress}
            onChange={(e) => update('dstAddress', e.currentTarget.value)}
          />
        ) : (
          <Select
            label="Destination Address List" size="sm" radius="sm"
            placeholder="Select address list"
            data={addressListOptions}
            value={state.dstAddressList || null}
            onChange={(val) => update('dstAddressList', val ?? '')}
            searchable clearable
          />
        )}

        {/* Protocol & Ports */}
        <Title order={6} mt="sm">Protocol & Ports</Title>
        <Select
          label="Protocol" size="sm" radius="sm"
          data={PROTOCOL_OPTIONS}
          value={state.protocol}
          onChange={(val) => update('protocol', val ?? '')}
        />
        <Group grow>
          <TextInput
            label="Src Port" size="sm" radius="sm"
            placeholder="e.g. 1024-65535"
            disabled={!portsEnabled}
            value={state.srcPort}
            onChange={(e) => update('srcPort', e.currentTarget.value)}
          />
          <TextInput
            label="Dst Port" size="sm" radius="sm"
            placeholder="e.g. 80 or 443"
            disabled={!portsEnabled}
            value={state.dstPort}
            onChange={(e) => update('dstPort', e.currentTarget.value)}
          />
        </Group>

        {/* Interfaces */}
        <Title order={6} mt="sm">Interfaces</Title>
        <Group grow>
          <Select
            label="In Interface" size="sm" radius="sm"
            placeholder="Any"
            data={interfaceOptions}
            value={state.inInterface || null}
            onChange={(val) => update('inInterface', val ?? '')}
            clearable
          />
          <Select
            label="Out Interface" size="sm" radius="sm"
            placeholder="Any"
            data={interfaceOptions}
            value={state.outInterface || null}
            onChange={(val) => update('outInterface', val ?? '')}
            clearable
          />
        </Group>

        {/* Connection State */}
        <Title order={6} mt="sm">Connection State</Title>
        <MultiSelect
          size="sm" radius="sm"
          placeholder="Select states"
          data={CONNECTION_STATE_OPTIONS}
          value={state.connectionState}
          onChange={(val) => update('connectionState', val as ConnectionState[])}
        />

        {/* Status */}
        <Switch
          label="Disabled"
          checked={state.disabled}
          onChange={(e) => update('disabled', e.currentTarget.checked)}
          mt="sm"
        />

        {/* Actions */}
        <Group justify="space-between" mt="md">
          <Button variant="default" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} loading={saving}>
            {isEdit ? 'Save' : 'Add Rule'}
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/firewall/FirewallForm.tsx
git commit -m "Add FirewallForm drawer for creating and editing rules"
```

---

### Task 7: Create FirewallTable with drag-drop and inline editing

**Files:**
- Create: `frontend/src/features/firewall/FirewallTable.tsx`

This is the most complex component. It renders a Mantine Table with `@dnd-kit/sortable` rows, a drag handle, per-cell inline editing on double-click, and action badges.

- [ ] **Step 1: Create the table component**

```tsx
import { useState, useCallback } from 'react';
import {
  Table,
  Badge,
  Group,
  Text,
  TextInput,
  Select,
  MultiSelect,
  Menu,
  Button,
  Skeleton,
  Stack,
} from '@mantine/core';
import {
  IconGripVertical,
  IconPencil,
  IconChevronDown,
  IconTrash,
} from '@tabler/icons-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import MonoText from '../../components/common/MonoText';
import type { FirewallRule, FirewallAction, ConnectionState } from '../../api/types';
import { ACTION_COLORS, CONNECTION_STATE_ABBR } from './FirewallDetail';

interface FirewallTableProps {
  rules: FirewallRule[];
  onRowClick: (rule: FirewallRule) => void;
  onUpdate: (id: string, updates: Partial<FirewallRule>) => void;
  onReorder: (activeId: string, overId: string) => void;
  onEdit: (rule: FirewallRule) => void;
  onDelete: (rule: FirewallRule) => void;
}

const tableWrapperStyle = {
  border: '1px solid var(--mantine-color-gray-3)',
  borderRadius: 4,
  overflow: 'hidden' as const,
};

const tableStyle = {
  borderCollapse: 'collapse' as const,
};

const headerRowStyle = {
  backgroundColor: 'var(--mantine-color-gray-0)',
  borderBottom: '1px solid var(--mantine-color-gray-3)',
};

function HeaderLabel({ children }: { children: string }) {
  return (
    <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: 0.5 }}>
      {children}
    </Text>
  );
}

// ─── Inline edit cell wrapper ──────────────────────────────────────────────

interface EditableCellProps {
  value: string;
  onSave: (value: string) => void;
  children: React.ReactNode;
  editComponent?: 'text' | 'select' | 'multiselect';
  selectData?: { value: string; label: string }[];
  multiValue?: string[];
  onMultiSave?: (values: string[]) => void;
}

function EditableCell({
  value,
  onSave,
  children,
  editComponent = 'text',
  selectData,
  multiValue,
  onMultiSave,
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(value);
    setEditing(true);
  };

  const handleSave = () => {
    setEditing(false);
    if (editValue !== value) onSave(editValue);
  };

  const handleCancel = () => {
    setEditing(false);
    setEditValue(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleCancel();
  };

  if (editing) {
    if (editComponent === 'select' && selectData) {
      return (
        <Select
          size="xs" radius="sm"
          data={selectData}
          value={editValue}
          onChange={(val) => {
            setEditing(false);
            if (val && val !== value) onSave(val);
          }}
          onBlur={handleSave}
          autoFocus
          styles={{ input: { minHeight: 28 } }}
        />
      );
    }
    if (editComponent === 'multiselect' && selectData && onMultiSave) {
      return (
        <MultiSelect
          size="xs" radius="sm"
          data={selectData}
          value={multiValue ?? []}
          onChange={(vals) => {
            onMultiSave(vals);
            setEditing(false);
          }}
          autoFocus
          styles={{ input: { minHeight: 28 } }}
        />
      );
    }
    return (
      <TextInput
        size="xs" radius="sm"
        value={editValue}
        onChange={(e) => setEditValue(e.currentTarget.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        autoFocus
        styles={{ input: { minHeight: 28 } }}
      />
    );
  }

  return (
    <div onDoubleClick={handleDoubleClick} style={{ cursor: 'default', minHeight: 24 }}>
      {children}
    </div>
  );
}

// ─── Action options for inline select ──────────────────────────────────────

const ACTION_OPTIONS = [
  { value: 'accept', label: 'Accept' },
  { value: 'drop', label: 'Drop' },
  { value: 'reject', label: 'Reject' },
  { value: 'fasttrack-connection', label: 'Fasttrack' },
  { value: 'passthrough', label: 'Passthrough' },
];

const PROTOCOL_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'tcp', label: 'TCP' },
  { value: 'udp', label: 'UDP' },
  { value: 'icmp', label: 'ICMP' },
  { value: 'gre', label: 'GRE' },
];

const CONN_STATE_OPTIONS = [
  { value: 'established', label: 'Established' },
  { value: 'related', label: 'Related' },
  { value: 'new', label: 'New' },
  { value: 'invalid', label: 'Invalid' },
  { value: 'untracked', label: 'Untracked' },
];

// ─── Sortable row ──────────────────────────────────────────────────────────

interface SortableRowProps {
  rule: FirewallRule;
  index: number;
  onClick: () => void;
  onUpdate: (id: string, updates: Partial<FirewallRule>) => void;
  onEdit: (rule: FirewallRule) => void;
  onDelete: (rule: FirewallRule) => void;
  isLast: boolean;
}

function SortableRow({ rule, index, onClick, onUpdate, onEdit, onDelete, isLast }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rule.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : rule.disabled ? 0.5 : 1,
    cursor: 'pointer',
    borderBottom: isLast ? undefined : '1px solid var(--mantine-color-gray-1)',
  };

  const srcDisplay = rule.srcAddressList || rule.srcAddress || 'any';
  const dstDisplay = rule.dstAddressList || rule.dstAddress || 'any';

  return (
    <Table.Tr ref={setNodeRef} style={style} {...attributes} onClick={onClick}>
      {/* Drag handle */}
      <Table.Td style={{ width: 32, cursor: 'grab' }} {...listeners}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <IconGripVertical size={14} color="var(--mantine-color-gray-5)" />
      </Table.Td>

      {/* # */}
      <Table.Td style={{ width: 40, textAlign: 'center' }}>
        <Text size="xs" c="dimmed">{index + 1}</Text>
      </Table.Td>

      {/* Action */}
      <Table.Td style={{ width: 90 }}>
        <EditableCell
          value={rule.action}
          onSave={(val) => onUpdate(rule.id, { action: val as FirewallAction })}
          editComponent="select"
          selectData={ACTION_OPTIONS}
        >
          <Badge variant="light" color={ACTION_COLORS[rule.action] ?? 'gray'} size="sm" radius="sm">
            {rule.action}
          </Badge>
        </EditableCell>
      </Table.Td>

      {/* Source */}
      <Table.Td>
        <EditableCell
          value={rule.srcAddress ?? rule.srcAddressList ?? ''}
          onSave={(val) => {
            if (rule.srcAddressList) {
              onUpdate(rule.id, { srcAddressList: val || undefined });
            } else {
              onUpdate(rule.id, { srcAddress: val || undefined });
            }
          }}
        >
          <div>
            {rule.srcAddressList ? (
              <Badge variant="light" color="violet" size="xs">{rule.srcAddressList}</Badge>
            ) : rule.srcAddress ? (
              <MonoText size="xs">{rule.srcAddress}</MonoText>
            ) : (
              <Text size="xs" c="dimmed">any</Text>
            )}
            {rule.srcPort && (
              <Text size="xs" c="dimmed">:{rule.srcPort}</Text>
            )}
          </div>
        </EditableCell>
      </Table.Td>

      {/* Destination */}
      <Table.Td>
        <EditableCell
          value={rule.dstAddress ?? rule.dstAddressList ?? ''}
          onSave={(val) => {
            if (rule.dstAddressList) {
              onUpdate(rule.id, { dstAddressList: val || undefined });
            } else {
              onUpdate(rule.id, { dstAddress: val || undefined });
            }
          }}
        >
          <div>
            {rule.dstAddressList ? (
              <Badge variant="light" color="violet" size="xs">{rule.dstAddressList}</Badge>
            ) : rule.dstAddress ? (
              <MonoText size="xs">{rule.dstAddress}</MonoText>
            ) : (
              <Text size="xs" c="dimmed">any</Text>
            )}
            {rule.dstPort && (
              <Text size="xs" c="dimmed">:{rule.dstPort}</Text>
            )}
          </div>
        </EditableCell>
      </Table.Td>

      {/* Protocol */}
      <Table.Td style={{ width: 80 }}>
        <EditableCell
          value={rule.protocol ?? ''}
          onSave={(val) => onUpdate(rule.id, { protocol: val || undefined })}
          editComponent="select"
          selectData={PROTOCOL_OPTIONS}
        >
          <MonoText size="xs">{rule.protocol ?? 'any'}</MonoText>
        </EditableCell>
      </Table.Td>

      {/* Interface */}
      <Table.Td style={{ width: 120 }}>
        <div>
          {rule.inInterface && (
            <Text size="xs" c="dimmed">in: <Text span size="xs" fw={500}>{rule.inInterface}</Text></Text>
          )}
          {rule.outInterface && (
            <Text size="xs" c="dimmed">out: <Text span size="xs" fw={500}>{rule.outInterface}</Text></Text>
          )}
          {!rule.inInterface && !rule.outInterface && (
            <Text size="xs" c="dimmed">any</Text>
          )}
        </div>
      </Table.Td>

      {/* Connection State */}
      <Table.Td style={{ width: 140 }}>
        <EditableCell
          value=""
          onSave={() => {}}
          editComponent="multiselect"
          selectData={CONN_STATE_OPTIONS}
          multiValue={rule.connectionState ?? []}
          onMultiSave={(vals) => onUpdate(rule.id, {
            connectionState: vals.length > 0 ? vals as ConnectionState[] : undefined,
          })}
        >
          {rule.connectionState && rule.connectionState.length > 0 ? (
            <Group gap={2} wrap="wrap">
              {rule.connectionState.map((s) => (
                <Badge key={s} variant="light" color="cyan" size="xs" radius="sm">
                  {CONNECTION_STATE_ABBR[s] ?? s}
                </Badge>
              ))}
            </Group>
          ) : (
            <Text size="xs" c="dimmed">any</Text>
          )}
        </EditableCell>
      </Table.Td>

      {/* Actions */}
      <Table.Td style={{ width: 80 }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <Group gap={6} wrap="nowrap">
          <Button.Group>
            <Button
              variant="light" color="gray" size="xs"
              leftSection={<IconPencil size={14} />}
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); onEdit(rule); }}
            >
              Edit
            </Button>
            <Menu position="bottom-end">
              <Menu.Target>
                <Button
                  variant="light" color="gray" size="xs"
                  style={{ paddingLeft: 6, paddingRight: 6, borderLeft: '1px solid var(--mantine-color-gray-2)' }}
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                  <IconChevronDown size={14} />
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  fz="xs" color="red"
                  leftSection={<IconTrash size={14} />}
                  onClick={(e: React.MouseEvent) => { e.stopPropagation(); onDelete(rule); }}
                >
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Button.Group>
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}

// ─── Main table ────────────────────────────────────────────────────────────

export default function FirewallTable({
  rules,
  onRowClick,
  onUpdate,
  onReorder,
  onEdit,
  onDelete,
}: FirewallTableProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(active.id as string, over.id as string);
    }
  }, [onReorder]);

  return (
    <div style={tableWrapperStyle}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rules.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <Table withRowBorders={false} style={tableStyle}>
            <Table.Thead>
              <Table.Tr style={headerRowStyle}>
                <Table.Th style={{ width: 32 }} />
                <Table.Th style={{ width: 40, textAlign: 'center' }}><HeaderLabel>#</HeaderLabel></Table.Th>
                <Table.Th style={{ width: 90 }}><HeaderLabel>Action</HeaderLabel></Table.Th>
                <Table.Th><HeaderLabel>Source</HeaderLabel></Table.Th>
                <Table.Th><HeaderLabel>Destination</HeaderLabel></Table.Th>
                <Table.Th style={{ width: 80 }}><HeaderLabel>Proto</HeaderLabel></Table.Th>
                <Table.Th style={{ width: 120 }}><HeaderLabel>Interface</HeaderLabel></Table.Th>
                <Table.Th style={{ width: 140 }}><HeaderLabel>Conn. State</HeaderLabel></Table.Th>
                <Table.Th style={{ width: 80 }}><HeaderLabel>Actions</HeaderLabel></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rules.map((rule, index) => (
                <SortableRow
                  key={rule.id}
                  rule={rule}
                  index={index}
                  onClick={() => onRowClick(rule)}
                  onUpdate={onUpdate}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  isLast={index === rules.length - 1}
                />
              ))}
              {rules.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={9}>
                    <Text size="sm" c="dimmed" ta="center" py="lg">
                      No rules in this chain
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </SortableContext>
      </DndContext>
    </div>
  );
}

export function FirewallTableSkeleton() {
  return (
    <div style={tableWrapperStyle}>
      <Table withRowBorders={false} style={tableStyle}>
        <Table.Thead>
          <Table.Tr style={headerRowStyle}>
            <Table.Th style={{ width: 32 }} />
            <Table.Th style={{ width: 40 }}><HeaderLabel>#</HeaderLabel></Table.Th>
            <Table.Th style={{ width: 90 }}><HeaderLabel>Action</HeaderLabel></Table.Th>
            <Table.Th><HeaderLabel>Source</HeaderLabel></Table.Th>
            <Table.Th><HeaderLabel>Destination</HeaderLabel></Table.Th>
            <Table.Th style={{ width: 80 }}><HeaderLabel>Proto</HeaderLabel></Table.Th>
            <Table.Th style={{ width: 120 }}><HeaderLabel>Interface</HeaderLabel></Table.Th>
            <Table.Th style={{ width: 140 }}><HeaderLabel>Conn. State</HeaderLabel></Table.Th>
            <Table.Th style={{ width: 80 }}><HeaderLabel>Actions</HeaderLabel></Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {Array.from({ length: 5 }).map((_, i) => (
            <Table.Tr key={i} style={{ borderBottom: '1px solid var(--mantine-color-gray-1)' }}>
              <Table.Td><Skeleton height={14} width={14} /></Table.Td>
              <Table.Td><Skeleton height={14} width={20} mx="auto" /></Table.Td>
              <Table.Td><Skeleton height={20} width={60} radius="sm" /></Table.Td>
              <Table.Td><Skeleton height={14} width={120} /></Table.Td>
              <Table.Td><Skeleton height={14} width={120} /></Table.Td>
              <Table.Td><Skeleton height={14} width={40} /></Table.Td>
              <Table.Td><Skeleton height={14} width={80} /></Table.Td>
              <Table.Td><Skeleton height={20} width={80} /></Table.Td>
              <Table.Td><Skeleton height={28} width={70} /></Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/firewall/FirewallTable.tsx
git commit -m "Add FirewallTable with drag-drop reordering and inline editing"
```

---

### Task 8: Create FirewallPage

**Files:**
- Create: `frontend/src/features/firewall/FirewallPage.tsx`

- [ ] **Step 1: Create the main page component**

```tsx
import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Title,
  Button,
  Group,
  Text,
  Stack,
  Tabs,
  TextInput,
} from '@mantine/core';
import {
  IconPlus,
  IconSearch,
  IconShieldCheck,
} from '@tabler/icons-react';
import { useClusterId } from '../../hooks/useClusterId';
import {
  useFirewallRules,
  useUpdateFirewallRule,
  useDeleteFirewallRule,
  useMoveFirewallRule,
} from './firewallApi';
import FirewallTable, { FirewallTableSkeleton } from './FirewallTable';
import FirewallDetail from './FirewallDetail';
import FirewallForm from './FirewallForm';
import EmptyState from '../../components/common/EmptyState';
import ErrorBanner from '../../components/common/ErrorBanner';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import type { FirewallRule, FirewallChain } from '../../api/types';

const TAB_CHAINS: { value: FirewallChain; label: string }[] = [
  { value: 'forward', label: 'Forwarding' },
  { value: 'input', label: 'Router inbound' },
  { value: 'output', label: 'Router outbound' },
];

function matchesRule(rule: FirewallRule, query: string): boolean {
  if (rule.comment.toLowerCase().includes(query)) return true;
  if (rule.action.toLowerCase().includes(query)) return true;
  if (rule.protocol?.toLowerCase().includes(query)) return true;
  if (rule.srcAddress?.toLowerCase().includes(query)) return true;
  if (rule.dstAddress?.toLowerCase().includes(query)) return true;
  if (rule.srcAddressList?.toLowerCase().includes(query)) return true;
  if (rule.dstAddressList?.toLowerCase().includes(query)) return true;
  if (rule.srcPort?.includes(query)) return true;
  if (rule.dstPort?.includes(query)) return true;
  if (rule.inInterface?.toLowerCase().includes(query)) return true;
  if (rule.outInterface?.toLowerCase().includes(query)) return true;
  return false;
}

export default function FirewallPage() {
  const selectedRouterId = useClusterId();
  const { data: rules, isLoading, error, refetch } = useFirewallRules(selectedRouterId);
  const updateMutation = useUpdateFirewallRule(selectedRouterId);
  const deleteMutation = useDeleteFirewallRule(selectedRouterId);
  const moveMutation = useMoveFirewallRule(selectedRouterId);

  const [activeTab, setActiveTab] = useState<string | null>('forward');
  const [search, setSearch] = useState('');
  const [selectedRule, setSelectedRule] = useState<FirewallRule | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editRule, setEditRule] = useState<FirewallRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FirewallRule | null>(null);

  const prevRouterId = useRef(selectedRouterId);
  useEffect(() => {
    if (prevRouterId.current !== selectedRouterId) {
      setSearch('');
      setSelectedRule(null);
      setDetailOpen(false);
      setFormOpen(false);
      setEditRule(null);
      setDeleteTarget(null);
      setActiveTab('forward');
      prevRouterId.current = selectedRouterId;
    }
  }, [selectedRouterId]);

  const activeChain = (activeTab ?? 'forward') as FirewallChain;

  const chainRules = useMemo(() => {
    if (!rules) return [];
    return rules.filter((r) => r.chain === activeChain);
  }, [rules, activeChain]);

  const filteredRules = useMemo(() => {
    if (!search.trim()) return chainRules;
    const query = search.toLowerCase();
    return chainRules.filter((r) => matchesRule(r, query));
  }, [chainRules, search]);

  const handleRowClick = (rule: FirewallRule) => {
    setSelectedRule(rule);
    setDetailOpen(true);
  };

  const handleEdit = (rule: FirewallRule) => {
    setDetailOpen(false);
    setEditRule(rule);
    setFormOpen(true);
  };

  const handleDelete = (rule: FirewallRule) => {
    setDetailOpen(false);
    setDeleteTarget(rule);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          setDeleteTarget(null);
          setSelectedRule(null);
        },
      },
    );
  };

  const handleUpdate = (id: string, updates: Partial<FirewallRule>) => {
    updateMutation.mutate({ id, updates });
  };

  const handleReorder = (activeId: string, overId: string) => {
    moveMutation.mutate({ ruleId: activeId, destinationId: overId });
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditRule(null);
  };

  const handleAddRule = () => {
    setEditRule(null);
    setFormOpen(true);
  };

  if (isLoading) {
    return (
      <>
        <Group justify="space-between" align="flex-start" mb="lg">
          <Stack gap={4}>
            <Title order={2}>Firewall</Title>
            <Text size="sm" c="dimmed">Firewall filter rules</Text>
          </Stack>
        </Group>
        <FirewallTableSkeleton />
      </>
    );
  }

  if (error) {
    return (
      <ErrorBanner
        message="Failed to load firewall rules. Please try again later."
        onRetry={() => void refetch()}
      />
    );
  }

  const hasRules = rules && rules.length > 0;

  return (
    <>
      <Group justify="space-between" align="flex-start" mb="lg">
        <Stack gap={4}>
          <Title order={2}>Firewall</Title>
          <Text size="sm" c="dimmed">Firewall filter rules</Text>
        </Stack>
        <Button leftSection={<IconPlus size={16} />} onClick={handleAddRule}>
          Add Rule
        </Button>
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab} mb="md">
        <Tabs.List>
          {TAB_CHAINS.map((tab) => (
            <Tabs.Tab key={tab.value} value={tab.value}>
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>

      {chainRules.length > 0 ? (
        <>
          <TextInput
            placeholder="Search rules..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            radius="sm"
            mb="md"
          />
          <FirewallTable
            rules={filteredRules}
            onRowClick={handleRowClick}
            onUpdate={handleUpdate}
            onReorder={handleReorder}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </>
      ) : (
        <EmptyState
          icon={IconShieldCheck}
          title="No rules in this chain"
          description={`No firewall rules configured for the ${TAB_CHAINS.find((t) => t.value === activeChain)?.label ?? activeChain} chain.`}
          action={
            <Button leftSection={<IconPlus size={16} />} onClick={handleAddRule}>
              Add Rule
            </Button>
          }
        />
      )}

      <FirewallDetail
        rule={selectedRule}
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <FirewallForm
        isOpen={formOpen}
        onClose={handleFormClose}
        routerId={selectedRouterId}
        chain={activeChain}
        editRule={editRule}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Firewall Rule"
        message={`Are you sure you want to delete this rule${deleteTarget?.comment ? ` ("${deleteTarget.comment}")` : ''}? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmColor="red"
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/features/firewall/FirewallPage.tsx
git commit -m "Add FirewallPage with tabs, search, and CRUD state management"
```

---

### Task 9: Enable firewall route and module

**Files:**
- Modify: `frontend/src/features/configure/moduleConfig.ts`
- Modify: `frontend/src/app/routes.tsx`

- [ ] **Step 1: Enable firewall in moduleConfig**

In `moduleConfig.ts`, change the Firewall entry from `isEnabled: false` to `isEnabled: true`:

```typescript
  { title: 'Firewall', subtitle: 'Configure firewall filter rules', icon: IconShieldCheck, route: 'firewall', isEnabled: true },
```

- [ ] **Step 2: Add FirewallPage import and route in routes.tsx**

Add the import near the other page imports:

```typescript
import FirewallPage from '../features/firewall/FirewallPage';
```

Add the route inside the `configure/:clusterId` children, after the `routes` entry:

```typescript
              {
                path: 'firewall',
                element: <FirewallPage />,
              },
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/configure/moduleConfig.ts frontend/src/app/routes.tsx
git commit -m "Enable firewall route and module config"
```

---

### Task 10: Final compilation check and cleanup

**Files:** All modified files

- [ ] **Step 1: Type check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no new errors (only pre-existing WireGuard-related errors).

- [ ] **Step 2: Run the dev server and smoke test**

```bash
cd frontend && npm run dev
```

Manually verify:
- Navigate to `/configure/{clusterId}/firewall`
- Three tabs show with rules filtered by chain
- Drag a rule row to reorder
- Double-click a cell to inline-edit (action badge, protocol, connection state)
- Single-click a row to open detail drawer
- Click "Add Rule" to open form, create a rule
- Edit and delete rules via the detail drawer
- Search filters rules correctly
- Disabled rules show at 50% opacity

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -u
git commit -m "Fix lint and type errors from firewall UI implementation"
```
