import {
  Table,
  Text,
  Badge,
  Button,
  Checkbox,
  Group,
  Box,
} from '@mantine/core';
import {
  IconChevronRight,
  IconChevronDown,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import MonoText from '../../components/common/MonoText';
import type { AddressList } from '../../api/types';

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

const wrapperStyle = {
  border: '1px solid var(--mantine-color-gray-1)',
  borderRadius: 4,
  overflow: 'hidden',
};

const tableStyle = {
  borderCollapse: 'collapse' as const,
};

interface AddressListGroupProps {
  list: AddressList;
  isCollapsed: boolean;
  onToggle: () => void;
  routerId: string;
  selectedEntries: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
  onAddEntry: (listName: string) => void;
  onDelete: (listName: string) => void;
  onDeleteEntries: (listName: string) => void;
}

export default function AddressListGroup({
  list,
  isCollapsed,
  onToggle,
  selectedEntries,
  onSelectionChange,
  onAddEntry,
  onDelete: _onDelete,
  onDeleteEntries,
}: AddressListGroupProps) {
  const ToggleIcon = isCollapsed ? IconChevronRight : IconChevronDown;
  const allSelected = list.entries.length > 0 && selectedEntries.size === list.entries.length;
  const someSelected = selectedEntries.size > 0 && !allSelected;

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(list.entries.map((e) => e.id)));
    }
  };

  const handleSelectEntry = (entryId: string) => {
    const next = new Set(selectedEntries);
    if (next.has(entryId)) {
      next.delete(entryId);
    } else {
      next.add(entryId);
    }
    onSelectionChange(next);
  };

  return (
    <Box style={wrapperStyle}>
    <Table withRowBorders={false} style={tableStyle}>
      <Table.Tbody>
        {/* Parent Row */}
        <Table.Tr
          style={{
            backgroundColor: 'var(--mantine-color-gray-0)',
            cursor: 'pointer',
            borderBottom: isCollapsed
              ? undefined
              : '1px solid var(--mantine-color-gray-1)',
          }}
          onClick={onToggle}
        >
          <Table.Td style={{ width: 32, verticalAlign: 'middle', textAlign: 'center', paddingRight: 0 }}>
            <ToggleIcon size={16} color="#495057" style={{ display: 'block', margin: '0 auto' }} />
          </Table.Td>
          <Table.Td>
            <Text fw={600} size="sm">
              {list.name}
            </Text>
          </Table.Td>
          <Table.Td />
          <Table.Td style={{ textAlign: 'right' }}>
            <Group justify="flex-end">
              <Badge variant="outline" color="blue" size="sm">
                {list.entries.length} {list.entries.length === 1 ? 'entry' : 'entries'}
              </Badge>
            </Group>
          </Table.Td>
        </Table.Tr>

        {/* Child Area */}
        {!isCollapsed && (
          <>
            {/* Entry header row */}
            {list.entries.length > 0 && (
              <Table.Tr
                style={{
                  borderBottom: '1px solid var(--mantine-color-gray-1)',
                }}
              >
                <Table.Td style={{ width: 32, textAlign: 'center', paddingRight: 0 }}>
                  <Checkbox
                    size="xs"
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={handleSelectAll}
                    style={{ display: 'flex', justifyContent: 'center' }}
                  />
                </Table.Td>
                <Table.Td style={{ paddingLeft: 40, width: 400 }}>
                  <HeaderLabel>Prefix</HeaderLabel>
                </Table.Td>
                <Table.Td>
                  <HeaderLabel>Comment</HeaderLabel>
                </Table.Td>
                <Table.Td />
              </Table.Tr>
            )}

            {/* Entry rows */}
            {list.entries.map((entry, index) => {
              const isLast = index === list.entries.length - 1;
              const isSelected = selectedEntries.has(entry.id);
              return (
                <Table.Tr
                  key={entry.id}
                  style={{
                    borderBottom: isLast
                      ? undefined
                      : '1px solid var(--mantine-color-gray-1)',
                    backgroundColor: isSelected
                      ? 'var(--mantine-color-blue-0)'
                      : undefined,
                  }}
                >
                  <Table.Td style={{ width: 32, textAlign: 'center', paddingRight: 0 }}>
                    <Checkbox
                      size="xs"
                      checked={isSelected}
                      onChange={() => handleSelectEntry(entry.id)}
                      style={{ display: 'flex', justifyContent: 'center' }}
                    />
                  </Table.Td>
                  <Table.Td
                    style={{
                      paddingLeft: 40,
                      opacity: entry.disabled ? 0.5 : undefined,
                    }}
                  >
                    <MonoText size="xs">{entry.prefix}</MonoText>
                  </Table.Td>
                  <Table.Td
                    style={{
                      opacity: entry.disabled ? 0.5 : undefined,
                    }}
                  >
                    <Text size="xs" c="dimmed">
                      {entry.comment || '\u2014'}
                    </Text>
                  </Table.Td>
                  <Table.Td />
                </Table.Tr>
              );
            })}

            {/* Empty list */}
            {list.entries.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text size="sm" c="dimmed" ta="center" py="md">
                    No entries
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}

            {/* Bulk action footer */}
            {list.entries.length > 0 && (
              <Table.Tr
                style={{
                  borderTop: '1px solid var(--mantine-color-gray-1)',
                }}
              >
                <Table.Td colSpan={4} style={{ paddingLeft: 40 }}>
                  <Group gap={8}>
                    <Button
                      variant="light"
                      size="xs"
                      leftSection={<IconPlus size={14} />}
                      onClick={() => onAddEntry(list.name)}
                    >
                      Add Entry
                    </Button>
                    <Button
                      color="red"
                      variant="light"
                      size="xs"
                      leftSection={<IconTrash size={14} />}
                      disabled={selectedEntries.size === 0}
                      onClick={() => onDeleteEntries(list.name)}
                    >
                      Delete Selected{selectedEntries.size > 0 ? ` (${selectedEntries.size})` : ''}
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            )}
          </>
        )}
      </Table.Tbody>
    </Table>
    </Box>
  );
}
