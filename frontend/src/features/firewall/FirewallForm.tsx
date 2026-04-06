import { useState, useEffect, useMemo } from 'react';
import {
  Drawer,
  TextInput,
  Select,
  MultiSelect,
  SegmentedControl,
  Switch,
  Button,
  Group,
  Stack,
  Text,
  Divider,
} from '@mantine/core';
import { IconShield } from '@tabler/icons-react';
import type { FirewallRule, FirewallChain, FirewallAction, ConnectionState } from '../../api/types';
import { useAddFirewallRule, useUpdateFirewallRule } from './firewallApi';
import { useAddressLists } from '../address-lists/addressListsApi';
import { useInterfaces } from '../interfaces/interfacesApi';
import { ACTION_OPTIONS, PROTOCOL_OPTIONS, CONNECTION_STATE_OPTIONS } from './FirewallDetail';

// ─── Form state ───────────────────────────────────────────────────────────────

type AddressMode = 'address' | 'list';

interface FirewallFormState {
  action: FirewallAction;
  comment: string;
  srcMode: AddressMode;
  srcAddress: string;
  srcAddressList: string;
  dstMode: AddressMode;
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

function getInitialState(editRule?: FirewallRule | null): FirewallFormState {
  if (editRule) {
    return {
      action: editRule.action,
      comment: editRule.comment,
      srcMode: editRule.srcAddressList ? 'list' : 'address',
      srcAddress: editRule.srcAddress ?? '',
      srcAddressList: editRule.srcAddressList ?? '',
      dstMode: editRule.dstAddressList ? 'list' : 'address',
      dstAddress: editRule.dstAddress ?? '',
      dstAddressList: editRule.dstAddressList ?? '',
      protocol: editRule.protocol ?? '',
      srcPort: editRule.srcPort ?? '',
      dstPort: editRule.dstPort ?? '',
      inInterface: editRule.inInterface ?? '',
      outInterface: editRule.outInterface ?? '',
      connectionState: editRule.connectionState ?? [],
      disabled: editRule.disabled,
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

// ─── Props ────────────────────────────────────────────────────────────────────

interface FirewallFormProps {
  isOpen: boolean;
  onClose: () => void;
  routerId: string;
  chain: FirewallChain;
  editRule?: FirewallRule | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FirewallForm({
  isOpen,
  onClose,
  routerId,
  chain,
  editRule,
}: FirewallFormProps) {
  const isEdit = !!editRule;
  const [state, setState] = useState<FirewallFormState>(getInitialState(editRule));
  const [saving, setSaving] = useState(false);

  const addMutation = useAddFirewallRule(routerId);
  const updateMutation = useUpdateFirewallRule(routerId);

  const { data: addressLists } = useAddressLists(routerId);
  const { data: interfaces } = useInterfaces(routerId);

  const addressListOptions = useMemo(() => {
    if (!addressLists) return [];
    return addressLists.map((list) => ({ value: list.name, label: list.name }));
  }, [addressLists]);

  const interfaceOptions = useMemo(() => {
    const none = { value: '', label: 'Any' };
    if (!interfaces) return [none];
    return [none, ...interfaces.map((iface) => ({ value: iface.name, label: iface.name }))];
  }, [interfaces]);

  const portsEnabled = state.protocol === 'tcp' || state.protocol === 'udp';

  // Reset form when drawer opens
  useEffect(() => {
    if (isOpen) {
      setState(getInitialState(editRule));
      setSaving(false);
    }
  }, [isOpen, editRule]);

  function update<K extends keyof FirewallFormState>(field: K, value: FirewallFormState[K]) {
    setState((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    setSaving(true);
    try {
      const ruleData: Omit<FirewallRule, 'id'> = {
        chain: isEdit ? editRule!.chain : chain,
        action: state.action,
        comment: state.comment,
        disabled: state.disabled,
        protocol: state.protocol || undefined,
        srcAddress: state.srcMode === 'address' && state.srcAddress ? state.srcAddress : undefined,
        srcAddressList: state.srcMode === 'list' && state.srcAddressList ? state.srcAddressList : undefined,
        dstAddress: state.dstMode === 'address' && state.dstAddress ? state.dstAddress : undefined,
        dstAddressList: state.dstMode === 'list' && state.dstAddressList ? state.dstAddressList : undefined,
        srcPort: portsEnabled && state.srcPort ? state.srcPort : undefined,
        dstPort: portsEnabled && state.dstPort ? state.dstPort : undefined,
        inInterface: state.inInterface || undefined,
        outInterface: state.outInterface || undefined,
        connectionState: state.connectionState.length > 0 ? state.connectionState : undefined,
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

  const title = isEdit ? 'Edit Rule' : 'Add Rule';

  return (
    <Drawer
      opened={isOpen}
      onClose={onClose}
      position="right"
      size="xl"
      padding="xl"
      title={
        <Group gap="xs">
          <IconShield size={20} />
          <Text fw={600}>{title}</Text>
        </Group>
      }
    >
      <Stack gap="md">
        {/* Section 1: General */}
        <Stack gap="sm">
          <Text fw={600} size="sm">General</Text>
          <Select
            label="Action"
            size="sm"
            radius="sm"
            data={ACTION_OPTIONS}
            value={state.action}
            onChange={(val) => update('action', (val as FirewallAction) ?? 'accept')}
          />
          <TextInput
            label="Comment"
            placeholder="Optional description"
            size="sm"
            radius="sm"
            value={state.comment}
            onChange={(e) => update('comment', e.currentTarget.value)}
          />
        </Stack>

        <Divider />

        {/* Section 2: Source */}
        <Stack gap="sm">
          <Text fw={600} size="sm">Source</Text>
          <div>
            <Text size="sm" fw={500} mb={4}>Type</Text>
            <SegmentedControl
              fullWidth
              size="sm"
              radius="md"
              styles={{ indicator: { boxShadow: 'none' } }}
              value={state.srcMode}
              onChange={(val) => update('srcMode', val as AddressMode)}
              data={[
                { value: 'address', label: 'Address' },
                { value: 'list', label: 'Address List' },
              ]}
            />
          </div>
          {state.srcMode === 'address' ? (
            <TextInput
              label="Source Address"
              placeholder="e.g. 192.168.1.0/24"
              size="sm"
              radius="sm"
              value={state.srcAddress}
              onChange={(e) => update('srcAddress', e.currentTarget.value)}
            />
          ) : (
            <Select
              label="Source Address List"
              placeholder="Select a list"
              size="sm"
              radius="sm"
              data={addressListOptions}
              value={state.srcAddressList || null}
              onChange={(val) => update('srcAddressList', val ?? '')}
              clearable
            />
          )}
        </Stack>

        <Divider />

        {/* Section 3: Destination */}
        <Stack gap="sm">
          <Text fw={600} size="sm">Destination</Text>
          <div>
            <Text size="sm" fw={500} mb={4}>Type</Text>
            <SegmentedControl
              fullWidth
              size="sm"
              radius="md"
              styles={{ indicator: { boxShadow: 'none' } }}
              value={state.dstMode}
              onChange={(val) => update('dstMode', val as AddressMode)}
              data={[
                { value: 'address', label: 'Address' },
                { value: 'list', label: 'Address List' },
              ]}
            />
          </div>
          {state.dstMode === 'address' ? (
            <TextInput
              label="Destination Address"
              placeholder="e.g. 10.0.0.0/8"
              size="sm"
              radius="sm"
              value={state.dstAddress}
              onChange={(e) => update('dstAddress', e.currentTarget.value)}
            />
          ) : (
            <Select
              label="Destination Address List"
              placeholder="Select a list"
              size="sm"
              radius="sm"
              data={addressListOptions}
              value={state.dstAddressList || null}
              onChange={(val) => update('dstAddressList', val ?? '')}
              clearable
            />
          )}
        </Stack>

        <Divider />

        {/* Section 4: Protocol & Ports */}
        <Stack gap="sm">
          <Text fw={600} size="sm">Protocol &amp; Ports</Text>
          <Select
            label="Protocol"
            size="sm"
            radius="sm"
            data={PROTOCOL_OPTIONS}
            value={state.protocol}
            onChange={(val) => {
              const proto = val ?? '';
              if (proto !== 'tcp' && proto !== 'udp') {
                setState((prev) => ({ ...prev, protocol: proto, srcPort: '', dstPort: '' }));
              } else {
                update('protocol', proto);
              }
            }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--mantine-spacing-sm)' }}>
            <TextInput
              label="Source Port"
              placeholder="e.g. 1024-65535"
              size="sm"
              radius="sm"
              disabled={!portsEnabled}
              value={state.srcPort}
              onChange={(e) => update('srcPort', e.currentTarget.value)}
            />
            <TextInput
              label="Destination Port"
              placeholder="e.g. 80,443"
              size="sm"
              radius="sm"
              disabled={!portsEnabled}
              value={state.dstPort}
              onChange={(e) => update('dstPort', e.currentTarget.value)}
            />
          </div>
        </Stack>

        <Divider />

        {/* Section 5: Interfaces */}
        <Stack gap="sm">
          <Text fw={600} size="sm">Interfaces</Text>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--mantine-spacing-sm)' }}>
            <Select
              label="In Interface"
              size="sm"
              radius="sm"
              data={interfaceOptions}
              value={state.inInterface || ''}
              onChange={(val) => update('inInterface', val ?? '')}
            />
            <Select
              label="Out Interface"
              size="sm"
              radius="sm"
              data={interfaceOptions}
              value={state.outInterface || ''}
              onChange={(val) => update('outInterface', val ?? '')}
            />
          </div>
        </Stack>

        <Divider />

        {/* Section 6: Connection State */}
        <Stack gap="sm">
          <Text fw={600} size="sm">Connection State</Text>
          <MultiSelect
            label="Match states"
            placeholder="Any state"
            size="sm"
            radius="sm"
            data={CONNECTION_STATE_OPTIONS}
            value={state.connectionState}
            onChange={(val) => update('connectionState', val as ConnectionState[])}
          />
        </Stack>

        <Divider />

        {/* Section 7: Status */}
        <Stack gap="sm">
          <Text fw={600} size="sm">Status</Text>
          <Switch
            label="Disabled"
            size="sm"
            checked={state.disabled}
            onChange={(e) => update('disabled', e.currentTarget.checked)}
          />
        </Stack>

        {/* Footer */}
        <Group justify="space-between" mt="xs">
          <Button variant="default" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} loading={saving}>
            {isEdit ? 'Save' : 'Create'}
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
