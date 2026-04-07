import { useState, useCallback, useMemo } from 'react';
import {
  Table,
  Text,
  Badge,
  Box,
  Group,
  Skeleton,
  Button,
  Menu,
  Select,
  MultiSelect,
  TextInput,
  Autocomplete,
  Tooltip,
} from '@mantine/core';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  IconGripVertical, IconPencil, IconChevronDown, IconTrash, IconInfoCircle,
  IconCloudNetwork, IconAddressBook, IconLogout, IconLogin2, IconArrowDownRight,
  IconCircleCheck, IconCircleX, IconBan, IconBolt, IconArrowRight,
} from '@tabler/icons-react';
import MonoText from '../../components/common/MonoText';
import type { FirewallRule, FirewallAction, ConnectionState, RouterInterface } from '../../api/types';
import {
  CONNECTION_STATE_ABBR,
  ACTION_OPTIONS,
  PROTOCOL_OPTIONS,
  CONNECTION_STATE_OPTIONS,
} from './FirewallDetail';

const PROTOCOL_COLORS: Record<string, string> = {
  tcp: 'blue',
  udp: 'teal',
  icmp: 'orange',
  icmpv6: 'orange',
  gre: 'violet',
  ospf: 'cyan',
  'ipsec-esp': 'indigo',
  'ipsec-ah': 'indigo',
};

// ─── Action icons ─────────────────────────────────────────────────────────────

const ACTION_ICON_MAP: Record<string, { icon: React.ComponentType<any>; color: string }> = {
  accept: { icon: IconCircleCheck, color: 'var(--mantine-color-green-6)' },
  drop: { icon: IconCircleX, color: 'var(--mantine-color-red-6)' },
  reject: { icon: IconBan, color: 'var(--mantine-color-red-6)' },
  'fasttrack-connection': { icon: IconBolt, color: 'var(--mantine-color-blue-6)' },
  passthrough: { icon: IconArrowRight, color: 'var(--mantine-color-gray-5)' },
};

function ActionIcon({ action }: { action: string }) {
  const config = ACTION_ICON_MAP[action];
  if (!config) return <Text size="xs">{action}</Text>;
  const Icon = config.icon;
  return <Icon size={20} color={config.color} />;
}

function renderSelectOption({ option }: { option: { value: string; label: string } }) {
  const config = ACTION_ICON_MAP[option.value];
  if (!config) return <Text size="xs">{option.label}</Text>;
  const Icon = config.icon;
  return (
    <Group gap={8} wrap="nowrap">
      <Icon size={16} color={config.color} />
      <Text size="xs">{option.label}</Text>
    </Group>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const tableWrapperStyle = {
  border: '1px solid var(--mantine-color-gray-3)',
  borderRadius: 4,
  overflow: 'hidden' as const,
};

const tableStyle = { borderCollapse: 'collapse' as const, tableLayout: 'fixed' as const };

const headerRowStyle = {
  backgroundColor: 'var(--mantine-color-gray-0)',
  borderBottom: '1px solid var(--mantine-color-gray-3)',
};

// ─── Header label ─────────────────────────────────────────────────────────────

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

// ─── EditableCell ─────────────────────────────────────────────────────────────

interface EditableCellProps {
  children: React.ReactNode;
  onEdit: () => void;
  centered?: boolean;
}

function EditableCell({ children, onEdit, centered }: EditableCellProps) {
  return (
    <div
      className="editable-cell"
      onDoubleClick={(e) => {
        e.stopPropagation();
        onEdit();
      }}
      style={{
        cursor: 'pointer',
        height: '100%',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: centered ? 'center' : undefined,
        border: '1px dashed transparent',
        borderRadius: 4,
        padding: '2px 6px',
      }}
    >
      {children}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface FirewallTableProps {
  rules: FirewallRule[];
  routerInterfaces: RouterInterface[];
  addressListNames: string[];
  onInfo: (rule: FirewallRule) => void;
  onUpdate: (id: string, updates: Partial<FirewallRule>) => void;
  onReorder: (activeId: string, overId: string) => void;
  onEdit: (rule: FirewallRule) => void;
  onDelete: (rule: FirewallRule) => void;
}

// ─── Sortable Row ─────────────────────────────────────────────────────────────

interface SortableRowProps {
  rule: FirewallRule;
  index: number;
  isLast: boolean;
  routerInterfaces: RouterInterface[];
  addressListNames: string[];
  onInfo: (rule: FirewallRule) => void;
  onUpdate: (id: string, updates: Partial<FirewallRule>) => void;
  onEdit: (rule: FirewallRule) => void;
  onDelete: (rule: FirewallRule) => void;
}

function SortableRow({
  rule,
  index,
  isLast,
  routerInterfaces,
  addressListNames,
  onInfo,
  onUpdate,
  onEdit,
  onDelete,
}: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: rule.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : rule.disabled ? 0.5 : undefined,
    backgroundColor: isDragging ? 'var(--mantine-color-gray-0)' : undefined,
  };

  // ─── Inline edit state ───────────────────────────────────────────────────

  const [editingAction, setEditingAction] = useState(false);
  const [editingSrcIface, setEditingSrcIface] = useState(false);
  const [editingSrc, setEditingSrc] = useState(false);
  const [editingDstIface, setEditingDstIface] = useState(false);
  const [editingDst, setEditingDst] = useState(false);
  const [editingProtocol, setEditingProtocol] = useState(false);
  const [editingSrcPort, setEditingSrcPort] = useState(false);
  const [editingDstPort, setEditingDstPort] = useState(false);
  const [editingConnState, setEditingConnState] = useState(false);

  const [srcValue, setSrcValue] = useState(rule.srcAddress ?? rule.srcAddressList ?? '');
  const [dstValue, setDstValue] = useState(rule.dstAddress ?? rule.dstAddressList ?? '');
  const [srcError, setSrcError] = useState('');
  const [dstError, setDstError] = useState('');
  const [protocolValue, setProtocolValue] = useState(rule.protocol ?? '');
  const [srcPortValue, setSrcPortValue] = useState(rule.srcPort ?? '');
  const [dstPortValue, setDstPortValue] = useState(rule.dstPort ?? '');
  const [connStateValue, setConnStateValue] = useState<string[]>(rule.connectionState ?? []);

  const validateAddress = useCallback(
    (val: string): string => {
      if (!val) return '';
      if (addressListNames.includes(val)) return '';
      // IPv4: 0-255 dotted quad, optional /0-32
      const ipv4 = /^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)(\/([0-9]|[12]\d|3[0-2]))?$/;
      if (ipv4.test(val)) return '';
      // IPv6: full or compressed, optional /0-128
      const ipv6 = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(\/([0-9]|[1-9]\d|1[0-1]\d|12[0-8]))?$/;
      if (ipv6.test(val)) return '';
      return 'Invalid IP address or prefix';
    },
    [addressListNames],
  );

  const saveSource = useCallback(
    (val: string) => {
      const trimmed = val.trim();
      const error = validateAddress(trimmed);
      if (error) {
        setSrcError(error);
        return;
      }
      setSrcError('');
      setEditingSrc(false);
      if (trimmed !== (rule.srcAddress ?? rule.srcAddressList ?? '')) {
        if (addressListNames.includes(trimmed)) {
          onUpdate(rule.id, { srcAddressList: trimmed, srcAddress: undefined });
        } else {
          onUpdate(rule.id, { srcAddress: trimmed || undefined, srcAddressList: undefined });
        }
      }
    },
    [rule, onUpdate, addressListNames, validateAddress],
  );

  const saveDest = useCallback(
    (val: string) => {
      const trimmed = val.trim();
      const error = validateAddress(trimmed);
      if (error) {
        setDstError(error);
        return;
      }
      setDstError('');
      setEditingDst(false);
      if (trimmed !== (rule.dstAddress ?? rule.dstAddressList ?? '')) {
        if (addressListNames.includes(trimmed)) {
          onUpdate(rule.id, { dstAddressList: trimmed, dstAddress: undefined });
        } else {
          onUpdate(rule.id, { dstAddress: trimmed || undefined, dstAddressList: undefined });
        }
      }
    },
    [rule, onUpdate, addressListNames, validateAddress],
  );

  const saveProtocol = useCallback(
    (val: string) => {
      setEditingProtocol(false);
      const trimmed = val.trim();
      if (trimmed !== (rule.protocol ?? '')) {
        onUpdate(rule.id, { protocol: trimmed || undefined });
      }
    },
    [rule, onUpdate],
  );

  const [srcPortError, setSrcPortError] = useState(false);
  const [dstPortError, setDstPortError] = useState(false);

  const validatePort = useCallback((val: string): boolean => {
    if (!val) return true;
    const parts = val.split(',');
    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) return false;
      if (trimmed.includes('-')) {
        const [startStr, endStr, ...rest] = trimmed.split('-');
        if (rest.length > 0) return false;
        const start = Number(startStr);
        const end = Number(endStr);
        if (!Number.isInteger(start) || !Number.isInteger(end)) return false;
        if (start < 0 || start > 65535 || end < 0 || end > 65535) return false;
        if (start >= end) return false;
      } else {
        const port = Number(trimmed);
        if (!Number.isInteger(port) || port < 0 || port > 65535) return false;
      }
    }
    return true;
  }, []);

  const saveSrcPort = useCallback(
    (val: string) => {
      const trimmed = val.trim();
      if (!validatePort(trimmed)) {
        setSrcPortError(true);
        return;
      }
      setSrcPortError(false);
      setEditingSrcPort(false);
      if (trimmed !== (rule.srcPort ?? '')) {
        onUpdate(rule.id, { srcPort: trimmed || undefined });
      }
    },
    [rule, onUpdate, validatePort],
  );

  const saveDstPort = useCallback(
    (val: string) => {
      const trimmed = val.trim();
      if (!validatePort(trimmed)) {
        setDstPortError(true);
        return;
      }
      setDstPortError(false);
      setEditingDstPort(false);
      if (trimmed !== (rule.dstPort ?? '')) {
        onUpdate(rule.id, { dstPort: trimmed || undefined });
      }
    },
    [rule, onUpdate, validatePort],
  );

  const interfaceSelectData = useMemo(() =>
    routerInterfaces.map((i) => ({ value: i.name, label: i.name })),
    [routerInterfaces],
  );

  const interfaceLookup = useMemo(() => {
    const map = new Map<string, RouterInterface>();
    for (const i of routerInterfaces) map.set(i.name, i);
    return map;
  }, [routerInterfaces]);

  function getInterfaceIconColor(ifaceName: string | undefined): string {
    if (!ifaceName) return 'var(--mantine-color-gray-5)';
    const iface = interfaceLookup.get(ifaceName);
    if (!iface) return 'var(--mantine-color-gray-5)';
    return iface.running && !iface.disabled ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-red-6)';
  }

  function renderInterfaceOption({ option }: { option: { value: string; label: string } }) {
    const iface = interfaceLookup.get(option.value);
    const isUp = iface ? iface.running && !iface.disabled : false;
    const addrs = iface?.addresses.map((a) => a.address).join(', ') ?? '';
    return (
      <Group gap={8} wrap="nowrap" align="center">
        <Box w={7} h={7} style={{ borderRadius: '50%', flexShrink: 0 }} bg={isUp ? 'green.6' : 'red.6'} />
        <div>
          <Text size="xs" fw={600}>{option.label}</Text>
          {addrs && <Text size="xs" c="dimmed" ff="monospace">{addrs}</Text>}
        </div>
      </Group>
    );
  }

  // ─── Render helpers ──────────────────────────────────────────────────────

  function renderAddressCell(
    address: string | undefined,
    addressList: string | undefined,
    port: string | undefined,
    isEditing: boolean,
    value: string,
    setValue: (v: string) => void,
    onSave: (v: string) => void,
    onCancel: () => void,
    onStartEdit: () => void,
    error: string,
    setError: (e: string) => void,
  ) {
    if (isEditing) {
      return (
        <Autocomplete
          autoFocus
          defaultDropdownOpened
          size="xs"
          radius="sm"
          styles={error ? { input: { borderColor: 'var(--mantine-color-red-6)', color: 'var(--mantine-color-red-6)' } } : undefined}
          placeholder="IP address or address list"
          data={addressListNames}
          value={value}
          onChange={(val) => { setValue(val); if (error) setError(''); }}
          onOptionSubmit={(val) => onSave(val)}
          onBlur={() => onSave(value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave(value);
            if (e.key === 'Escape') {
              e.currentTarget.blur();
              onCancel();
            }
          }}
          onClick={(e) => e.stopPropagation()}
          style={{ width: '100%' }}
        />
      );
    }

    return (
      <EditableCell onEdit={onStartEdit}>
        {addressList ? (
          <Group gap={4} wrap="nowrap">
            <Badge variant="light" size="sm" radius="sm" color="violet">
              {addressList}
            </Badge>
          </Group>
        ) : address ? (
          <MonoText size="xs">{address}</MonoText>
        ) : (
          <Text size="xs" c="dimmed">any</Text>
        )}
      </EditableCell>
    );
  }

  return (
    <tbody
      ref={setNodeRef}
      style={style}
      {...attributes}
    >
      {/* Comment row — only shown if rule has a comment */}
      {rule.comment ? (
        <Table.Tr style={{ borderBottom: 'none', backgroundColor: 'var(--mantine-color-gray-0)' }}>
          <Table.Td colSpan={9} style={{ paddingTop: 4, paddingBottom: 4, borderTop: '2px solid var(--mantine-color-gray-3)' }}>
            <Group gap={4} wrap="nowrap">
              <IconArrowDownRight size={14} color="var(--mantine-color-gray-5)" style={{ flexShrink: 0 }} />
              <Text size="xs" fw={700} truncate>
                {rule.comment}
              </Text>
            </Group>
          </Table.Td>
        </Table.Tr>
      ) : null}

      {/* Data row */}
      <Table.Tr style={{ borderBottom: isLast ? undefined : '1px solid var(--mantine-color-gray-1)' }}>
      {/* Drag handle */}
      <Table.Td style={{ padding: 0, textAlign: 'center' }}>
        <div
          {...listeners}
          style={{ cursor: 'grab', color: 'var(--mantine-color-gray-5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => e.stopPropagation()}
        >
          <IconGripVertical size={14} />
        </div>
      </Table.Td>

      {/* # + ID */}
      <Table.Td style={{ textAlign: 'center' }}>
        <MonoText size="xs" fw={700}>#{index + 1}</MonoText>
        <Badge variant="outline" color="gray" size="sm" radius="sm" styles={{ label: { fontFamily: 'monospace' } }}>{rule.id}</Badge>
      </Table.Td>

      {/* Source (address + in-interface) */}
      <Table.Td style={{ verticalAlign: 'top' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 28, display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconAddressBook size={16} color={rule.srcAddressList ? 'var(--mantine-color-violet-6)' : rule.srcAddress ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-gray-5)'} style={{ flexShrink: 0 }} />
          {renderAddressCell(
            rule.srcAddress,
            rule.srcAddressList,
            rule.srcPort,
            editingSrc,
            srcValue,
            setSrcValue,
            saveSource,
            () => { setSrcValue(rule.srcAddress ?? rule.srcAddressList ?? ''); setSrcError(''); setEditingSrc(false); },
            () => { setSrcValue(rule.srcAddress ?? rule.srcAddressList ?? ''); setSrcError(''); setEditingSrc(true); },
            srcError,
            setSrcError,
          )}
        </div>
        <div style={{ height: 28, display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconCloudNetwork size={16} color={getInterfaceIconColor(rule.inInterface)} style={{ flexShrink: 0 }} />
          {editingSrcIface ? (
            <Select
              autoFocus
              defaultDropdownOpened
              size="xs"
              radius="sm"
              placeholder="Any"
              data={interfaceSelectData}
              value={rule.inInterface ?? ''}
              renderOption={renderInterfaceOption}
              onChange={(val) => {
                setEditingSrcIface(false);
                onUpdate(rule.id, { inInterface: val || undefined });
              }}
              onBlur={() => setEditingSrcIface(false)}
              onClick={(e) => e.stopPropagation()}
              clearable
              comboboxProps={{ width: 250, position: 'bottom-start' }}
              style={{ flex: 1 }}
            />
          ) : (
            <EditableCell onEdit={() => setEditingSrcIface(true)}>
              <Text size="xs" c={rule.inInterface ? undefined : 'dimmed'} fw={rule.inInterface ? 600 : undefined}>{rule.inInterface ?? 'any'}</Text>
            </EditableCell>
          )}
        </div>
        </div>
      </Table.Td>

      {/* Destination (address + out-interface) */}
      <Table.Td style={{ verticalAlign: 'top' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 28, display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconAddressBook size={16} color={rule.dstAddressList ? 'var(--mantine-color-violet-6)' : rule.dstAddress ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-gray-5)'} style={{ flexShrink: 0 }} />
          {renderAddressCell(
            rule.dstAddress,
            rule.dstAddressList,
            rule.dstPort,
            editingDst,
            dstValue,
            setDstValue,
            saveDest,
            () => { setDstValue(rule.dstAddress ?? rule.dstAddressList ?? ''); setDstError(''); setEditingDst(false); },
            () => { setDstValue(rule.dstAddress ?? rule.dstAddressList ?? ''); setDstError(''); setEditingDst(true); },
            dstError,
            setDstError,
          )}
        </div>
        <div style={{ height: 28, display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconCloudNetwork size={16} color={getInterfaceIconColor(rule.outInterface)} style={{ flexShrink: 0 }} />
          {editingDstIface ? (
            <Select
              autoFocus
              defaultDropdownOpened
              size="xs"
              radius="sm"
              placeholder="Any"
              data={interfaceSelectData}
              value={rule.outInterface ?? ''}
              renderOption={renderInterfaceOption}
              onChange={(val) => {
                setEditingDstIface(false);
                onUpdate(rule.id, { outInterface: val || undefined });
              }}
              onBlur={() => setEditingDstIface(false)}
              onClick={(e) => e.stopPropagation()}
              clearable
              comboboxProps={{ width: 250, position: 'bottom-start' }}
              style={{ flex: 1 }}
            />
          ) : (
            <EditableCell onEdit={() => setEditingDstIface(true)}>
              <Text size="xs" c={rule.outInterface ? undefined : 'dimmed'} fw={rule.outInterface ? 600 : undefined}>{rule.outInterface ?? 'any'}</Text>
            </EditableCell>
          )}
        </div>
        </div>
      </Table.Td>

      {/* Protocol */}
      <Table.Td>
        <div style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {editingProtocol ? (
          <Select
            autoFocus
            defaultDropdownOpened
            size="xs"
            radius="sm"
            data={PROTOCOL_OPTIONS}
            value={protocolValue}
            onChange={(val) => {
              const newVal = val ?? '';
              setProtocolValue(newVal);
              saveProtocol(newVal);
            }}
            onBlur={() => saveProtocol(protocolValue)}
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%' }}
          />
        ) : (
          <EditableCell onEdit={() => { setProtocolValue(rule.protocol ?? ''); setEditingProtocol(true); }} centered>
            {rule.protocol ? (
              <Badge variant="light" size="sm" radius="sm" color={PROTOCOL_COLORS[rule.protocol] ?? 'gray'} styles={{ label: { fontFamily: 'monospace' } }}>{PROTOCOL_OPTIONS.find((o) => o.value === rule.protocol)?.label ?? rule.protocol}</Badge>
            ) : (
              <Text size="xs" c="dimmed">any</Text>
            )}
          </EditableCell>
        )}
        </div>
      </Table.Td>

      {/* Ports (src above, dst below) */}
      <Table.Td style={{ verticalAlign: 'top' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <IconLogout size={14} color={rule.srcPort ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-gray-4)'} style={{ flexShrink: 0, marginLeft: 3 }} />
          {editingSrcPort ? (
            <TextInput
              autoFocus
              size="xs"
              radius="sm"
              placeholder="any"
              value={srcPortValue}
              onChange={(e) => { setSrcPortValue(e.currentTarget.value); if (srcPortError) setSrcPortError(false); }}
              onBlur={() => saveSrcPort(srcPortValue)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveSrcPort(srcPortValue);
                if (e.key === 'Escape') { setSrcPortValue(rule.srcPort ?? ''); setSrcPortError(false); setEditingSrcPort(false); }
              }}
              onClick={(e) => e.stopPropagation()}
              styles={srcPortError ? { input: { borderColor: 'var(--mantine-color-red-6)', color: 'var(--mantine-color-red-6)' } } : undefined}
              style={{ width: '100%' }}
            />
          ) : (
            <EditableCell onEdit={() => { setSrcPortValue(rule.srcPort ?? ''); setEditingSrcPort(true); }} centered>
              <MonoText size="xs" fw={rule.srcPort ? 700 : undefined} c={rule.srcPort ? undefined : 'dimmed'}>{rule.srcPort ?? 'any'}</MonoText>
            </EditableCell>
          )}
        </div>
        <div style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <IconLogin2 size={14} color={rule.dstPort ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-gray-4)'} style={{ flexShrink: 0 }} />
          {editingDstPort ? (
            <TextInput
              autoFocus
              size="xs"
              radius="sm"
              placeholder="any"
              value={dstPortValue}
              onChange={(e) => { setDstPortValue(e.currentTarget.value); if (dstPortError) setDstPortError(false); }}
              onBlur={() => saveDstPort(dstPortValue)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveDstPort(dstPortValue);
                if (e.key === 'Escape') { setDstPortValue(rule.dstPort ?? ''); setDstPortError(false); setEditingDstPort(false); }
              }}
              onClick={(e) => e.stopPropagation()}
              styles={dstPortError ? { input: { borderColor: 'var(--mantine-color-red-6)', color: 'var(--mantine-color-red-6)' } } : undefined}
              style={{ width: '100%' }}
            />
          ) : (
            <EditableCell onEdit={() => { setDstPortValue(rule.dstPort ?? ''); setEditingDstPort(true); }} centered>
              <MonoText size="xs" fw={rule.dstPort ? 700 : undefined} c={rule.dstPort ? undefined : 'dimmed'}>{rule.dstPort ?? 'any'}</MonoText>
            </EditableCell>
          )}
        </div>
        </div>
      </Table.Td>

      {/* Conn. State */}
      <Table.Td>
        <div style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {editingConnState ? (
          <MultiSelect
            autoFocus
            defaultDropdownOpened
            size="xs"
            radius="sm"
            data={CONNECTION_STATE_OPTIONS}
            value={connStateValue}
            onChange={(val) => {
              setConnStateValue(val);
              setEditingConnState(false);
              onUpdate(rule.id, { connectionState: val.length > 0 ? val as ConnectionState[] : undefined });
            }}
            onBlur={() => setEditingConnState(false)}
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%' }}
          />
        ) : (
          <EditableCell onEdit={() => { setConnStateValue(rule.connectionState ?? []); setEditingConnState(true); }} centered>
            {rule.connectionState && rule.connectionState.length > 0 ? (
              <Tooltip
                label={rule.connectionState.map((s) => CONNECTION_STATE_ABBR[s]).join(', ')}
                position="top"
                withArrow
              >
                <Badge variant="light" size="sm" radius="sm" color="blue">
                  {rule.connectionState.length === 1
                    ? CONNECTION_STATE_ABBR[rule.connectionState[0]]
                    : `${rule.connectionState.length} states`}
                </Badge>
              </Tooltip>
            ) : (
              <Text size="xs" c="dimmed">—</Text>
            )}
          </EditableCell>
        )}
        </div>
      </Table.Td>

      {/* Action */}
      <Table.Td>
        <div style={{ height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {editingAction ? (
          <Select
            autoFocus
            defaultDropdownOpened
            size="xs"
            radius="sm"
            data={ACTION_OPTIONS}
            value={rule.action}
            renderOption={renderSelectOption}
            leftSection={<ActionIcon action={rule.action} />}
            onChange={(val) => {
              setEditingAction(false);
              if (val && val !== rule.action) {
                onUpdate(rule.id, { action: val as FirewallAction });
              }
            }}
            onBlur={() => setEditingAction(false)}
            onClick={(e) => e.stopPropagation()}
            comboboxProps={{ width: 180, position: 'bottom-start' }}
            styles={{ input: { color: 'transparent' } }}
            style={{ width: '100%' }}
          />
        ) : (
          <EditableCell onEdit={() => setEditingAction(true)} centered>
            <ActionIcon action={rule.action} />
          </EditableCell>
        )}
        </div>
      </Table.Td>

      {/* Actions */}
      <Table.Td>
        <Group gap={4} wrap="nowrap">
          <Button
            variant="light"
            color="gray"
            size="xs"
            style={{ paddingLeft: 6, paddingRight: 6 }}
            onClick={() => onInfo(rule)}
            title="Details"
          >
            <IconInfoCircle size={14} />
          </Button>
          <Button.Group>
            <Button
              variant="light"
              color="gray"
              size="xs"
              style={{ paddingLeft: 6, paddingRight: 6 }}
              onClick={() => onEdit(rule)}
              title="Edit"
            >
              <IconPencil size={14} />
            </Button>
            <Menu position="bottom-end">
              <Menu.Target>
                <Button
                  variant="light"
                  color="gray"
                  size="xs"
                  style={{
                    paddingLeft: 6,
                    paddingRight: 6,
                    borderLeft: '1px solid var(--mantine-color-gray-2)',
                  }}
                >
                  <IconChevronDown size={14} />
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  fz="xs"
                  color="red"
                  leftSection={<IconTrash size={14} />}
                  onClick={() => onDelete(rule)}
                >
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Button.Group>
        </Group>
      </Table.Td>
    </Table.Tr>
    </tbody>
  );
}

// ─── FirewallTable ────────────────────────────────────────────────────────────

export default function FirewallTable({
  rules,
  routerInterfaces,
  addressListNames,
  onInfo,
  onUpdate,
  onReorder,
  onEdit,
  onDelete,
}: FirewallTableProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorder(String(active.id), String(over.id));
    }
  }

  return (
    <div style={tableWrapperStyle}>
      <style>{`.editable-cell:hover { border-color: var(--mantine-color-gray-3) !important; }
.editable-cell * { cursor: pointer !important; }`}</style>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rules.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <Table withRowBorders={false} style={tableStyle}>
            <Table.Thead>
              <Table.Tr style={headerRowStyle}>
                <Table.Th style={{ width: 20, padding: 0 }} />
                <Table.Th style={{ width: 55, textAlign: 'center' }}>
                  <HeaderLabel>#</HeaderLabel>
                </Table.Th>
                <Table.Th style={{ width: '25%' }}>
                  <HeaderLabel>Source</HeaderLabel>
                </Table.Th>
                <Table.Th style={{ width: '25%' }}>
                  <HeaderLabel>Destination</HeaderLabel>
                </Table.Th>
                <Table.Th style={{ width: 70, textAlign: 'center' }}>
                  <HeaderLabel>Proto</HeaderLabel>
                </Table.Th>
                <Table.Th style={{ width: 120, textAlign: 'center' }}>
                  <HeaderLabel>Ports</HeaderLabel>
                </Table.Th>
                <Table.Th style={{ width: 90, textAlign: 'center' }}>
                  <HeaderLabel>State</HeaderLabel>
                </Table.Th>
                <Table.Th style={{ width: 50, textAlign: 'center' }}>
                  <HeaderLabel>Action</HeaderLabel>
                </Table.Th>
                <Table.Th style={{ width: 90 }}>
                  <HeaderLabel>Actions</HeaderLabel>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
              {rules.map((rule, index) => (
                <SortableRow
                  key={rule.id}
                  rule={rule}
                  index={index}
                  isLast={index === rules.length - 1}
                  routerInterfaces={routerInterfaces}
                  addressListNames={addressListNames}
                  onInfo={onInfo}
                  onUpdate={onUpdate}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
              {rules.length === 0 && (
                <Table.Tbody>
                  <Table.Tr>
                    <Table.Td colSpan={9}>
                      <Text size="sm" c="dimmed" ta="center" py="lg">
                        No rules defined
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              )}
          </Table>
        </SortableContext>
      </DndContext>
    </div>
  );
}

// ─── FirewallTableSkeleton ────────────────────────────────────────────────────

export function FirewallTableSkeleton() {
  return (
    <div style={tableWrapperStyle}>
      <Table withRowBorders={false} style={tableStyle}>
        <Table.Thead>
          <Table.Tr style={headerRowStyle}>
            <Table.Th style={{ width: 20, padding: 0 }} />
            <Table.Th style={{ width: 40 }}>
              <HeaderLabel>#</HeaderLabel>
            </Table.Th>
            <Table.Th>
              <HeaderLabel>Source</HeaderLabel>
            </Table.Th>
            <Table.Th>
              <HeaderLabel>Destination</HeaderLabel>
            </Table.Th>
            <Table.Th style={{ width: 70 }}>
              <HeaderLabel>Proto</HeaderLabel>
            </Table.Th>
            <Table.Th style={{ width: 150 }}>
              <HeaderLabel>Conn. State</HeaderLabel>
            </Table.Th>
            <Table.Th style={{ width: 50 }}>
              <HeaderLabel>Action</HeaderLabel>
            </Table.Th>
            <Table.Th style={{ width: 140 }}>
              <HeaderLabel>Actions</HeaderLabel>
            </Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {Array.from({ length: 5 }).map((_, i) => (
            <Table.Tr
              key={i}
              style={{ borderBottom: '1px solid var(--mantine-color-gray-1)' }}
            >
              {/* Drag */}
              <Table.Td><Skeleton height={14} width={14} radius="sm" /></Table.Td>
              {/* # + ID */}
              <Table.Td>
                <Skeleton height={14} width={20} radius="sm" />
                <Skeleton height={10} width={24} radius="sm" mt={2} />
              </Table.Td>
              {/* Source */}
              <Table.Td>
                <Skeleton height={10} width={50} radius="sm" mb={2} />
                <Skeleton height={14} width={120} radius="sm" />
              </Table.Td>
              {/* Destination */}
              <Table.Td>
                <Skeleton height={10} width={50} radius="sm" mb={2} />
                <Skeleton height={14} width={120} radius="sm" />
              </Table.Td>
              {/* Proto */}
              <Table.Td><Skeleton height={14} width={40} radius="sm" /></Table.Td>
              {/* Ports */}
              <Table.Td>
                <Skeleton height={14} width={40} radius="sm" />
                <Skeleton height={14} width={40} radius="sm" mt={4} />
              </Table.Td>
              {/* Conn. State */}
              <Table.Td><Skeleton height={18} width={100} radius="sm" /></Table.Td>
              {/* Action */}
              <Table.Td><Skeleton height={18} width={60} radius="sm" /></Table.Td>
              {/* Actions */}
              <Table.Td><Skeleton height={22} width={100} radius="sm" /></Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </div>
  );
}
