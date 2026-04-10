import { useState, useEffect, useMemo } from 'react';
import {
  Drawer,
  TextInput,
  Autocomplete,
  Select,
  MultiSelect,
  Input,
  Button,
  Group,
  Stack,
  Text,
  Divider,
  Paper,
  Badge,
  CloseButton,
} from '@mantine/core';
import {
  IconShield,
  IconSettings,
  IconArrowUpRight,
  IconArrowDownLeft,
  IconCircleCheck,
  IconCircleX,
  IconBan,
  IconBolt,
  IconArrowRight,
} from '@tabler/icons-react';
import type { FirewallRule, FirewallChain, FirewallAction, ConnectionState } from '../../api/types';
import { looksLikeCIDR } from '../../utils/cidr';
import { useAddFirewallRule, useUpdateFirewallRule } from './firewallApi';
import { useAddressLists } from '../address-lists/addressListsApi';
import { useMergedInterfaces } from '../interfaces/interfacesApi';
import { ACTION_OPTIONS, PROTOCOL_OPTIONS, CONNECTION_STATE_OPTIONS } from './FirewallDetail';

// ─── Form state ───────────────────────────────────────────────────────────────

interface FirewallFormState {
  action: FirewallAction;
  comment: string;
  src: string;
  dst: string;
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
      src: editRule.srcAddressList ?? editRule.srcAddress ?? '',
      dst: editRule.dstAddressList ?? editRule.dstAddress ?? '',
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
    src: '',
    dst: '',
    protocol: '',
    srcPort: '',
    dstPort: '',
    inInterface: '',
    outInterface: '',
    connectionState: [],
    disabled: true,
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateAddress(value: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (looksLikeCIDR(trimmed)) return null;
  return 'Must be an IPv4 address or CIDR prefix (e.g. 10.0.0.1 or 10.0.0.0/24)';
}

// ─── Action dropdown styling ──────────────────────────────────────────────────

const ACTION_ICON_MAP: Record<string, { icon: React.ComponentType<any>; color: string }> = {
  accept: { icon: IconCircleCheck, color: 'var(--mantine-color-green-6)' },
  drop: { icon: IconCircleX, color: 'var(--mantine-color-red-6)' },
  reject: { icon: IconBan, color: 'var(--mantine-color-red-6)' },
  'fasttrack-connection': { icon: IconBolt, color: 'var(--mantine-color-blue-6)' },
  passthrough: { icon: IconArrowRight, color: 'var(--mantine-color-gray-5)' },
};

function renderActionOption({ option }: { option: { value: string; label: string } }) {
  const config = ACTION_ICON_MAP[option.value];
  if (!config) return <Text size="sm">{option.label}</Text>;
  const Icon = config.icon;
  return (
    <Group gap={8} wrap="nowrap">
      <Icon size={16} color={config.color} />
      <Text size="sm">{option.label}</Text>
    </Group>
  );
}

// ─── Address input with badge for lists ───────────────────────────────────────

function AddressInput({
  label,
  value,
  onChange,
  onBlur,
  error,
  addressListNames,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  onBlur: () => void;
  error?: string | null;
  addressListNames: string[];
}) {
  const isList = addressListNames.includes(value);

  if (isList) {
    return (
      <Input.Wrapper label={label} size="sm">
        <div style={{ height: 36, display: 'flex', alignItems: 'center' }}>
          <Badge variant="light" color="violet" size="lg" radius="sm" rightSection={
            <CloseButton size={14} variant="transparent" c="violet" onClick={() => onChange('')} />
          }>
            {value}
          </Badge>
        </div>
      </Input.Wrapper>
    );
  }

  return (
    <Autocomplete
      label={label}
      placeholder="IP address or address list"
      size="sm"
      radius="sm"
      data={addressListNames}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      error={error}
    />
  );
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
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const addMutation = useAddFirewallRule(routerId);
  const updateMutation = useUpdateFirewallRule(routerId);

  const { data: addressLists } = useAddressLists(routerId);
  const { data: interfaces } = useMergedInterfaces(routerId);

  const addressListNames = useMemo(() => {
    if (!addressLists) return [];
    return addressLists.map((list) => list.name);
  }, [addressLists]);

  const isAddressList = (value: string) => addressListNames.includes(value);

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
      setErrors({});
    }
  }, [isOpen, editRule]);

  function update<K extends keyof FirewallFormState>(field: K, value: FirewallFormState[K]) {
    setState((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit() {
    const newErrors: Record<string, string | null> = {};
    if (state.src && !isAddressList(state.src)) {
      newErrors.src = validateAddress(state.src);
    }
    if (state.dst && !isAddressList(state.dst)) {
      newErrors.dst = validateAddress(state.dst);
    }
    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;

    setSaving(true);
    try {
      const srcIsList = isAddressList(state.src);
      const dstIsList = isAddressList(state.dst);

      // RouterOS expects kebab-case field names
      const ruleData: Record<string, unknown> = {
        chain: isEdit ? editRule!.chain : chain,
        action: state.action,
        disabled: state.disabled ? 'true' : 'false',
      };
      if (state.comment) ruleData['comment'] = state.comment;
      if (state.protocol) ruleData['protocol'] = state.protocol;
      if (!srcIsList && state.src) ruleData['src-address'] = state.src;
      if (srcIsList) ruleData['src-address-list'] = state.src;
      if (!dstIsList && state.dst) ruleData['dst-address'] = state.dst;
      if (dstIsList) ruleData['dst-address-list'] = state.dst;
      if (portsEnabled && state.srcPort) ruleData['src-port'] = state.srcPort;
      if (portsEnabled && state.dstPort) ruleData['dst-port'] = state.dstPort;
      if (state.inInterface) ruleData['in-interface'] = state.inInterface;
      if (state.outInterface) ruleData['out-interface'] = state.outInterface;
      if (state.connectionState.length > 0) ruleData['connection-state'] = state.connectionState.join(',');

      if (isEdit) {
        await updateMutation.mutateAsync({ id: editRule!.id, updates: ruleData as any });
      } else {
        await addMutation.mutateAsync(ruleData as any);
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
          <Group gap={6}>
            <IconSettings size={18} color="var(--mantine-color-dimmed)" />
            <Text fw={600} size="sm">General</Text>
          </Group>
          <TextInput
            label="Comment"
            placeholder="Optional description"
            size="sm"
            radius="sm"
            value={state.comment}
            onChange={(e) => update('comment', e.currentTarget.value)}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '25% 1fr', gap: 'var(--mantine-spacing-sm)' }}>
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
            <MultiSelect
              label="Connection State"
              placeholder={state.connectionState.length === 0 ? 'Any' : ''}
              size="sm"
              radius="sm"
              data={CONNECTION_STATE_OPTIONS}
              value={state.connectionState}
              onChange={(val) => update('connectionState', val as ConnectionState[])}
              hidePickedOptions
            />
          </div>
        </Stack>

        {/* Section 2: Source */}
        <Paper
          withBorder
          p="md"
          radius="md"
          style={{ borderLeft: '3px solid var(--mantine-color-blue-3)' }}
        >
          <Stack gap="sm">
            <Group gap={6}>
              <IconArrowUpRight size={18} color="var(--mantine-color-blue-6)" />
              <Text fw={600} size="sm" c="blue.6">Source</Text>
            </Group>
            <Select
              label="In Interface"
              size="sm"
              radius="sm"
              data={interfaceOptions}
              value={state.inInterface || ''}
              onChange={(val) => update('inInterface', val ?? '')}
            />
            <AddressInput
              label="Address"
              value={state.src}
              onChange={(val) => { update('src', val); setErrors((prev) => ({ ...prev, src: null })); }}
              onBlur={() => { if (state.src && !isAddressList(state.src)) setErrors((prev) => ({ ...prev, src: validateAddress(state.src) })); }}
              error={errors.src}
              addressListNames={addressListNames}
            />
            <TextInput
              label="Port"
              placeholder="e.g. 1024-65535"
              size="sm"
              radius="sm"
              disabled={!portsEnabled}
              value={state.srcPort}
              onChange={(e) => update('srcPort', e.currentTarget.value)}
            />
          </Stack>
        </Paper>

        {/* Section 3: Destination */}
        <Paper
          withBorder
          p="md"
          radius="md"
          style={{ borderLeft: '3px solid var(--mantine-color-pink-3)' }}
        >
          <Stack gap="sm">
            <Group gap={6}>
              <IconArrowDownLeft size={18} color="var(--mantine-color-pink-6)" />
              <Text fw={600} size="sm" c="pink.6">Destination</Text>
            </Group>
            <Select
              label="Out Interface"
              size="sm"
              radius="sm"
              data={interfaceOptions}
              value={state.outInterface || ''}
              onChange={(val) => update('outInterface', val ?? '')}
            />
            <AddressInput
              label="Address"
              value={state.dst}
              onChange={(val) => { update('dst', val); setErrors((prev) => ({ ...prev, dst: null })); }}
              onBlur={() => { if (state.dst && !isAddressList(state.dst)) setErrors((prev) => ({ ...prev, dst: validateAddress(state.dst) })); }}
              error={errors.dst}
              addressListNames={addressListNames}
            />
            <TextInput
              label="Port"
              placeholder="e.g. 80,443"
              size="sm"
              radius="sm"
              disabled={!portsEnabled}
              value={state.dstPort}
              onChange={(e) => update('dstPort', e.currentTarget.value)}
            />
          </Stack>
        </Paper>

        <Divider />

        <Group align="end" gap="sm" wrap="nowrap">
          <Select
            label="Action"
            size="sm"
            radius="sm"
            data={ACTION_OPTIONS}
            value={state.action}
            onChange={(val) => update('action', (val as FirewallAction) ?? 'accept')}
            renderOption={renderActionOption}
            leftSection={ACTION_ICON_MAP[state.action] ? (() => { const Icon = ACTION_ICON_MAP[state.action].icon; return <Icon size={16} color={ACTION_ICON_MAP[state.action].color} />; })() : undefined}
            style={{ flex: 1 }}
          />
          <Select
            label="Rule disabled"
            size="sm"
            radius="sm"
            data={[
              { value: 'no', label: 'No' },
              { value: 'yes', label: 'Yes' },
            ]}
            value={state.disabled ? 'yes' : 'no'}
            onChange={(val) => update('disabled', val === 'yes')}
            style={{ width: 120 }}
          />
        </Group>

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
