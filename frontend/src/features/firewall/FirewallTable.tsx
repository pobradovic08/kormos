import { useState, useCallback } from 'react';
import {
  Table,
  Text,
  Badge,
  Group,
  Skeleton,
  Button,
  Menu,
  Select,
  MultiSelect,
  Autocomplete,
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
  IconCloudNetwork, IconAddressBook,
  IconCircleCheck, IconCircleX, IconBan, IconBolt, IconArrowRight,
} from '@tabler/icons-react';
import MonoText from '../../components/common/MonoText';
import type { FirewallRule, FirewallAction, ConnectionState } from '../../api/types';
import {
  CONNECTION_STATE_ABBR,
  ACTION_OPTIONS,
  PROTOCOL_OPTIONS,
  CONNECTION_STATE_OPTIONS,
} from './FirewallDetail';

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
  interfaceOptions: { value: string; label: string }[];
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
  interfaceOptions: { value: string; label: string }[];
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
  interfaceOptions,
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
    borderBottom: isLast ? undefined : '1px solid var(--mantine-color-gray-1)',
    backgroundColor: isDragging ? 'var(--mantine-color-gray-0)' : undefined,
  };

  // ─── Inline edit state ───────────────────────────────────────────────────

  const [editingAction, setEditingAction] = useState(false);
  const [editingSrcIface, setEditingSrcIface] = useState(false);
  const [editingSrc, setEditingSrc] = useState(false);
  const [editingDstIface, setEditingDstIface] = useState(false);
  const [editingDst, setEditingDst] = useState(false);
  const [editingProtocol, setEditingProtocol] = useState(false);
  const [editingConnState, setEditingConnState] = useState(false);

  const [srcValue, setSrcValue] = useState(rule.srcAddress ?? rule.srcAddressList ?? '');
  const [dstValue, setDstValue] = useState(rule.dstAddress ?? rule.dstAddressList ?? '');
  const [srcError, setSrcError] = useState('');
  const [dstError, setDstError] = useState('');
  const [protocolValue, setProtocolValue] = useState(rule.protocol ?? '');
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
            {port && (
              <MonoText size="xs" c="dimmed">:{port}</MonoText>
            )}
          </Group>
        ) : address ? (
          <div>
            <MonoText size="xs">{address}</MonoText>
            {port && (
              <MonoText size="xs" c="dimmed">:{port}</MonoText>
            )}
          </div>
        ) : (
          <Text size="xs" c="dimmed">any</Text>
        )}
      </EditableCell>
    );
  }

  return (
    <Table.Tr
      ref={setNodeRef}
      style={style}
      {...attributes}
    >
      {/* Drag handle */}
      <Table.Td style={{ padding: '0 4px' }}>
        <div
          {...listeners}
          style={{ cursor: 'grab', color: 'var(--mantine-color-gray-5)', display: 'flex', alignItems: 'center' }}
          onClick={(e) => e.stopPropagation()}
        >
          <IconGripVertical size={14} />
        </div>
      </Table.Td>

      {/* # + ID */}
      <Table.Td style={{ textAlign: 'center' }}>
        <MonoText size="xs" fw={700}>{index + 1}</MonoText>
        <MonoText size="xs" c="dimmed">{rule.id}</MonoText>
      </Table.Td>

      {/* Source (address + in-interface) */}
      <Table.Td style={{ verticalAlign: 'top' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ height: 28, display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconAddressBook size={16} color="var(--mantine-color-gray-5)" style={{ flexShrink: 0 }} />
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
          <IconCloudNetwork size={16} color="var(--mantine-color-gray-5)" style={{ flexShrink: 0 }} />
          {editingSrcIface ? (
            <Select
              autoFocus
              defaultDropdownOpened
              size="xs"
              radius="sm"
              placeholder="Any"
              data={interfaceOptions}
              value={rule.inInterface ?? ''}
              onChange={(val) => {
                setEditingSrcIface(false);
                onUpdate(rule.id, { inInterface: val || undefined });
              }}
              onBlur={() => setEditingSrcIface(false)}
              onClick={(e) => e.stopPropagation()}
              clearable
              style={{ flex: 1 }}
            />
          ) : (
            <EditableCell onEdit={() => setEditingSrcIface(true)}>
              <Text size="xs" c="dimmed">{rule.inInterface ?? 'any'}</Text>
            </EditableCell>
          )}
        </div>
        </div>
      </Table.Td>

      {/* Destination (address + out-interface) */}
      <Table.Td style={{ verticalAlign: 'top' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        <div style={{ height: 28, display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconAddressBook size={16} color="var(--mantine-color-gray-5)" style={{ flexShrink: 0 }} />
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
          <IconCloudNetwork size={16} color="var(--mantine-color-gray-5)" style={{ flexShrink: 0 }} />
          {editingDstIface ? (
            <Select
              autoFocus
              defaultDropdownOpened
              size="xs"
              radius="sm"
              placeholder="Any"
              data={interfaceOptions}
              value={rule.outInterface ?? ''}
              onChange={(val) => {
                setEditingDstIface(false);
                onUpdate(rule.id, { outInterface: val || undefined });
              }}
              onBlur={() => setEditingDstIface(false)}
              onClick={(e) => e.stopPropagation()}
              clearable
              style={{ flex: 1 }}
            />
          ) : (
            <EditableCell onEdit={() => setEditingDstIface(true)}>
              <Text size="xs" c="dimmed">{rule.outInterface ?? 'any'}</Text>
            </EditableCell>
          )}
        </div>
        </div>
      </Table.Td>

      {/* Protocol */}
      <Table.Td>
        <div style={{ height: 28, display: 'flex', alignItems: 'center' }}>
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
          <EditableCell onEdit={() => { setProtocolValue(rule.protocol ?? ''); setEditingProtocol(true); }}>
            <MonoText size="xs">{rule.protocol ?? 'any'}</MonoText>
          </EditableCell>
        )}
        </div>
      </Table.Td>

      {/* Conn. State */}
      <Table.Td>
        <div style={{ height: 28, display: 'flex', alignItems: 'center' }}>
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
          <EditableCell onEdit={() => { setConnStateValue(rule.connectionState ?? []); setEditingConnState(true); }}>
            {rule.connectionState && rule.connectionState.length > 0 ? (
              <Group gap={2} wrap="wrap">
                {rule.connectionState.map((state) => (
                  <Badge key={state} variant="light" size="sm" radius="sm" color="blue">
                    {CONNECTION_STATE_ABBR[state]}
                  </Badge>
                ))}
              </Group>
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
              leftSection={<IconPencil size={14} />}
              onClick={() => onEdit(rule)}
            >
              Edit
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
  );
}

// ─── FirewallTable ────────────────────────────────────────────────────────────

export default function FirewallTable({
  rules,
  interfaceOptions,
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
      <style>{`tr:hover .editable-cell { border-color: var(--mantine-color-gray-3) !important; }`}</style>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rules.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <Table withRowBorders={false} style={tableStyle}>
            <Table.Thead>
              <Table.Tr style={headerRowStyle}>
                <Table.Th style={{ width: 32 }} />
                <Table.Th style={{ width: 44, textAlign: 'center' }}>
                  <HeaderLabel>#</HeaderLabel>
                </Table.Th>
                <Table.Th style={{ width: '25%' }}>
                  <HeaderLabel>Source</HeaderLabel>
                </Table.Th>
                <Table.Th style={{ width: '25%' }}>
                  <HeaderLabel>Destination</HeaderLabel>
                </Table.Th>
                <Table.Th style={{ width: 70 }}>
                  <HeaderLabel>Proto</HeaderLabel>
                </Table.Th>
                <Table.Th style={{ width: 150 }}>
                  <HeaderLabel>Conn. State</HeaderLabel>
                </Table.Th>
                <Table.Th style={{ width: 50, textAlign: 'center' }}>
                  <HeaderLabel>Action</HeaderLabel>
                </Table.Th>
                <Table.Th style={{ width: 140 }}>
                  <HeaderLabel>Actions</HeaderLabel>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rules.map((rule, index) => (
                <SortableRow
                  key={rule.id}
                  rule={rule}
                  index={index}
                  isLast={index === rules.length - 1}
                  interfaceOptions={interfaceOptions}
                  addressListNames={addressListNames}
                  onInfo={onInfo}
                  onUpdate={onUpdate}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
              {rules.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={8}>
                    <Text size="sm" c="dimmed" ta="center" py="lg">
                      No rules defined
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

// ─── FirewallTableSkeleton ────────────────────────────────────────────────────

export function FirewallTableSkeleton() {
  return (
    <div style={tableWrapperStyle}>
      <Table withRowBorders={false} style={tableStyle}>
        <Table.Thead>
          <Table.Tr style={headerRowStyle}>
            <Table.Th style={{ width: 32 }} />
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
