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
  TextInput,
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
import { IconGripVertical, IconPencil, IconChevronDown, IconTrash, IconInfoCircle } from '@tabler/icons-react';
import MonoText from '../../components/common/MonoText';
import type { FirewallRule, FirewallAction, ConnectionState } from '../../api/types';
import {
  ACTION_COLORS,
  CONNECTION_STATE_ABBR,
  ACTION_OPTIONS,
  PROTOCOL_OPTIONS,
  CONNECTION_STATE_OPTIONS,
} from './FirewallDetail';

// ─── Styles ───────────────────────────────────────────────────────────────────

const tableWrapperStyle = {
  border: '1px solid var(--mantine-color-gray-3)',
  borderRadius: 4,
  overflow: 'hidden' as const,
};

const tableStyle = { borderCollapse: 'collapse' as const };

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
}

function EditableCell({ children, onEdit }: EditableCellProps) {
  return (
    <div
      onDoubleClick={(e) => {
        e.stopPropagation();
        onEdit();
      }}
      style={{ cursor: 'default', minHeight: 24 }}
    >
      {children}
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface FirewallTableProps {
  rules: FirewallRule[];
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
  onInfo: (rule: FirewallRule) => void;
  onUpdate: (id: string, updates: Partial<FirewallRule>) => void;
  onEdit: (rule: FirewallRule) => void;
  onDelete: (rule: FirewallRule) => void;
}

function SortableRow({
  rule,
  index,
  isLast,
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
  const [editingSrc, setEditingSrc] = useState(false);
  const [editingDst, setEditingDst] = useState(false);
  const [editingProtocol, setEditingProtocol] = useState(false);
  const [editingConnState, setEditingConnState] = useState(false);

  const [srcValue, setSrcValue] = useState(rule.srcAddress ?? rule.srcAddressList ?? '');
  const [dstValue, setDstValue] = useState(rule.dstAddress ?? rule.dstAddressList ?? '');
  const [protocolValue, setProtocolValue] = useState(rule.protocol ?? '');
  const [connStateValue, setConnStateValue] = useState<string[]>(rule.connectionState ?? []);

  const saveSource = useCallback(
    (val: string) => {
      setEditingSrc(false);
      const trimmed = val.trim();
      if (trimmed !== (rule.srcAddress ?? rule.srcAddressList ?? '')) {
        onUpdate(rule.id, { srcAddress: trimmed || undefined, srcAddressList: undefined });
      }
    },
    [rule, onUpdate],
  );

  const saveDest = useCallback(
    (val: string) => {
      setEditingDst(false);
      const trimmed = val.trim();
      if (trimmed !== (rule.dstAddress ?? rule.dstAddressList ?? '')) {
        onUpdate(rule.id, { dstAddress: trimmed || undefined, dstAddressList: undefined });
      }
    },
    [rule, onUpdate],
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
  ) {
    if (isEditing) {
      return (
        <TextInput
          autoFocus
          size="xs"
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          onBlur={() => onSave(value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave(value);
            if (e.key === 'Escape') {
              e.currentTarget.blur();
              onCancel();
            }
          }}
          onClick={(e) => e.stopPropagation()}
          style={{ minWidth: 120 }}
        />
      );
    }

    return (
      <EditableCell onEdit={onStartEdit}>
        {addressList ? (
          <div>
            <Badge variant="light" size="sm" radius="sm" color="violet">
              {addressList}
            </Badge>
            {port && (
              <MonoText size="xs" c="dimmed">
                :{port}
              </MonoText>
            )}
          </div>
        ) : address ? (
          <div>
            <MonoText size="xs">{address}</MonoText>
            {port && (
              <MonoText size="xs" c="dimmed">
                :{port}
              </MonoText>
            )}
          </div>
        ) : (
          <Text size="xs" c="dimmed">
            any
          </Text>
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
      <Table.Td style={{ width: 32, padding: '0 4px' }}>
        <div
          {...listeners}
          style={{ cursor: 'grab', color: 'var(--mantine-color-gray-5)', display: 'flex', alignItems: 'center' }}
          onClick={(e) => e.stopPropagation()}
        >
          <IconGripVertical size={14} />
        </div>
      </Table.Td>

      {/* # */}
      <Table.Td style={{ width: 40 }}>
        <MonoText size="xs" c="dimmed">
          {index + 1}
        </MonoText>
      </Table.Td>

      {/* Action */}
      <Table.Td style={{ width: 90 }}>
        {editingAction ? (
          <Select
            autoFocus
            size="xs"
            data={ACTION_OPTIONS}
            value={rule.action}
            onChange={(val) => {
              setEditingAction(false);
              if (val && val !== rule.action) {
                onUpdate(rule.id, { action: val as FirewallAction });
              }
            }}
            onBlur={() => setEditingAction(false)}
            onClick={(e) => e.stopPropagation()}
            style={{ minWidth: 80 }}
          />
        ) : (
          <EditableCell onEdit={() => setEditingAction(true)}>
            <Badge
              variant="light"
              size="sm"
              radius="sm"
              color={ACTION_COLORS[rule.action]}
            >
              {rule.action}
            </Badge>
          </EditableCell>
        )}
      </Table.Td>

      {/* Source */}
      <Table.Td>
        {renderAddressCell(
          rule.srcAddress,
          rule.srcAddressList,
          rule.srcPort,
          editingSrc,
          srcValue,
          setSrcValue,
          saveSource,
          () => { setSrcValue(rule.srcAddress ?? rule.srcAddressList ?? ''); setEditingSrc(false); },
          () => { setSrcValue(rule.srcAddress ?? rule.srcAddressList ?? ''); setEditingSrc(true); },
        )}
      </Table.Td>

      {/* Destination */}
      <Table.Td>
        {renderAddressCell(
          rule.dstAddress,
          rule.dstAddressList,
          rule.dstPort,
          editingDst,
          dstValue,
          setDstValue,
          saveDest,
          () => { setDstValue(rule.dstAddress ?? rule.dstAddressList ?? ''); setEditingDst(false); },
          () => { setDstValue(rule.dstAddress ?? rule.dstAddressList ?? ''); setEditingDst(true); },
        )}
      </Table.Td>

      {/* Protocol */}
      <Table.Td style={{ width: 80 }}>
        {editingProtocol ? (
          <Select
            autoFocus
            size="xs"
            data={PROTOCOL_OPTIONS}
            value={protocolValue}
            onChange={(val) => {
              const newVal = val ?? '';
              setProtocolValue(newVal);
              saveProtocol(newVal);
            }}
            onBlur={() => saveProtocol(protocolValue)}
            onClick={(e) => e.stopPropagation()}
            style={{ minWidth: 80 }}
          />
        ) : (
          <EditableCell onEdit={() => { setProtocolValue(rule.protocol ?? ''); setEditingProtocol(true); }}>
            <MonoText size="xs">{rule.protocol ?? 'any'}</MonoText>
          </EditableCell>
        )}
      </Table.Td>

      {/* Interface */}
      <Table.Td style={{ width: 120 }}>
        {(rule.inInterface || rule.outInterface) ? (
          <div>
            {rule.inInterface && (
              <MonoText size="xs">
                <Text component="span" size="xs" c="dimmed">in: </Text>
                {rule.inInterface}
              </MonoText>
            )}
            {rule.outInterface && (
              <MonoText size="xs">
                <Text component="span" size="xs" c="dimmed">out: </Text>
                {rule.outInterface}
              </MonoText>
            )}
          </div>
        ) : (
          <Text size="xs" c="dimmed">—</Text>
        )}
      </Table.Td>

      {/* Conn. State */}
      <Table.Td style={{ width: 140 }}>
        {editingConnState ? (
          <MultiSelect
            autoFocus
            size="xs"
            data={CONNECTION_STATE_OPTIONS}
            value={connStateValue}
            onChange={(val) => {
              setConnStateValue(val);
              setEditingConnState(false);
              onUpdate(rule.id, { connectionState: val.length > 0 ? val as ConnectionState[] : undefined });
            }}
            onBlur={() => setEditingConnState(false)}
            onClick={(e) => e.stopPropagation()}
            style={{ minWidth: 120 }}
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
      </Table.Td>

      {/* Actions */}
      <Table.Td style={{ width: 120 }}>
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
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rules.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <Table withRowBorders={false} style={tableStyle}>
            <Table.Thead>
              <Table.Tr style={headerRowStyle}>
                <Table.Th style={{ width: 32 }} />
                <Table.Th style={{ width: 40 }}>
                  <HeaderLabel>#</HeaderLabel>
                </Table.Th>
                <Table.Th style={{ width: 90 }}>
                  <HeaderLabel>Action</HeaderLabel>
                </Table.Th>
                <Table.Th>
                  <HeaderLabel>Source</HeaderLabel>
                </Table.Th>
                <Table.Th>
                  <HeaderLabel>Destination</HeaderLabel>
                </Table.Th>
                <Table.Th style={{ width: 80 }}>
                  <HeaderLabel>Protocol</HeaderLabel>
                </Table.Th>
                <Table.Th style={{ width: 120 }}>
                  <HeaderLabel>Interface</HeaderLabel>
                </Table.Th>
                <Table.Th style={{ width: 140 }}>
                  <HeaderLabel>Conn. State</HeaderLabel>
                </Table.Th>
                <Table.Th style={{ width: 120 }}>
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
                  onInfo={onInfo}
                  onUpdate={onUpdate}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
              {rules.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={9}>
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
            <Table.Th style={{ width: 90 }}>
              <HeaderLabel>Action</HeaderLabel>
            </Table.Th>
            <Table.Th>
              <HeaderLabel>Source</HeaderLabel>
            </Table.Th>
            <Table.Th>
              <HeaderLabel>Destination</HeaderLabel>
            </Table.Th>
            <Table.Th style={{ width: 80 }}>
              <HeaderLabel>Protocol</HeaderLabel>
            </Table.Th>
            <Table.Th style={{ width: 120 }}>
              <HeaderLabel>Interface</HeaderLabel>
            </Table.Th>
            <Table.Th style={{ width: 140 }}>
              <HeaderLabel>Conn. State</HeaderLabel>
            </Table.Th>
            <Table.Th style={{ width: 80 }}>
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
              <Table.Td style={{ width: 32 }}>
                <Skeleton height={14} width={14} radius="sm" />
              </Table.Td>
              <Table.Td style={{ width: 40 }}>
                <Skeleton height={14} width={20} radius="sm" />
              </Table.Td>
              <Table.Td style={{ width: 90 }}>
                <Skeleton height={18} width={60} radius="sm" />
              </Table.Td>
              <Table.Td>
                <Skeleton height={14} width={110} radius="sm" />
              </Table.Td>
              <Table.Td>
                <Skeleton height={14} width={110} radius="sm" />
              </Table.Td>
              <Table.Td style={{ width: 80 }}>
                <Skeleton height={14} width={40} radius="sm" />
              </Table.Td>
              <Table.Td style={{ width: 120 }}>
                <Skeleton height={14} width={80} radius="sm" />
              </Table.Td>
              <Table.Td style={{ width: 140 }}>
                <Skeleton height={18} width={100} radius="sm" />
              </Table.Td>
              <Table.Td style={{ width: 120 }}>
                <Skeleton height={22} width={100} radius="sm" />
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </div>
  );
}
