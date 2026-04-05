import { useState, useMemo } from 'react';
import {
  Drawer,
  TextInput,
  Textarea,
  Group,
  Button,
  Table,
  Tabs,
  Text,
  Badge,
  Stack,
  ActionIcon,
} from '@mantine/core';
import {
  IconPlus,
  IconTrash,
  IconFileImport,
  IconKeyboard,
} from '@tabler/icons-react';
import MonoText from '../../components/common/MonoText';
import { looksLikeCIDR } from '../../utils/cidr';
import { parseCSV } from './csvParser';
import type { ParsedEntry } from './csvParser';
import { useCreateAddressList, useAddEntry } from './addressListsApi';

interface AddressListFormProps {
  isOpen: boolean;
  onClose: () => void;
  routerId: string;
  existingNames: string[];
  /** When set, the drawer adds entries to this existing list instead of creating a new one */
  targetListName?: string;
  /** Existing prefixes in the target list (for duplicate detection) */
  targetExistingPrefixes?: string[];
}

interface ManualEntry {
  prefix: string;
  comment: string;
}

const NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

const SAMPLE_CSV =
  '192.0.2.1/32,Sample import 1\n198.51.100.0/24,Sample import 2\n203.0.113.50/32,Sample import 3';

const tableStyle = {
  borderCollapse: 'collapse' as const,
  border: '1px solid var(--mantine-color-gray-3)',
  borderRadius: 4,
  overflow: 'hidden',
};

const headerRowStyle = {
  backgroundColor: 'var(--mantine-color-gray-0)',
  borderBottom: '1px solid var(--mantine-color-gray-3)',
};

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

const statusBadge: Record<ParsedEntry['status'], { color: string; label: string }> = {
  valid: { color: 'green', label: 'New' },
  invalid: { color: 'red', label: 'Invalid' },
  duplicate: { color: 'yellow', label: 'Duplicate' },
};

export default function AddressListForm({
  isOpen,
  onClose,
  routerId,
  existingNames,
  targetListName,
  targetExistingPrefixes = [],
}: AddressListFormProps) {
  const isAddEntryMode = !!targetListName;
  // Name state
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  // Manual entries
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([]);
  const [prefix, setPrefix] = useState('');
  const [comment, setComment] = useState('');
  const [entryError, setEntryError] = useState<string | null>(null);

  // Import state
  const [csvText, setCsvText] = useState('');
  const [url, setUrl] = useState('');
  const [importedEntries, setImportedEntries] = useState<ParsedEntry[]>([]);
  const [importParsed, setImportParsed] = useState(false);

  const [creating, setCreating] = useState(false);

  const createMutation = useCreateAddressList(routerId);
  const addMutation = useAddEntry(routerId);

  const validateName = (value: string): string | null => {
    if (!value.trim()) return 'Name is required';
    if (!NAME_PATTERN.test(value.trim()))
      return 'Only letters, numbers, hyphens, and underscores';
    if (existingNames.includes(value.trim()))
      return 'A list with this name already exists';
    return null;
  };

  const allPrefixes = useMemo(() => {
    const prefixes = targetExistingPrefixes.map((p) => p.toLowerCase());
    for (const e of manualEntries) prefixes.push(e.prefix.toLowerCase());
    for (const e of importedEntries) {
      if (e.status === 'valid') prefixes.push(e.prefix.toLowerCase());
    }
    return prefixes;
  }, [manualEntries, importedEntries]);

  const handleAddEntry = () => {
    const trimmedPrefix = prefix.trim();
    if (!trimmedPrefix) {
      setEntryError('Prefix is required');
      return;
    }
    if (!looksLikeCIDR(trimmedPrefix)) {
      setEntryError('Invalid prefix format');
      return;
    }
    if (allPrefixes.includes(trimmedPrefix.toLowerCase())) {
      setEntryError('Duplicate prefix');
      return;
    }
    setManualEntries((prev) => [...prev, { prefix: trimmedPrefix, comment: comment.trim() }]);
    setPrefix('');
    setComment('');
    setEntryError(null);
  };

  const handleRemoveEntry = (index: number) => {
    setManualEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const handleParseImport = () => {
    let text = csvText.trim();
    if (!text && url.trim()) {
      text = SAMPLE_CSV;
    }
    const existing = [
      ...targetExistingPrefixes,
      ...manualEntries.map((e) => e.prefix),
    ];
    const parsed = parseCSV(text, existing);
    setImportedEntries(parsed);
    setImportParsed(true);
  };

  const validImportedEntries = useMemo(
    () => importedEntries.filter((e) => e.status === 'valid'),
    [importedEntries],
  );

  const importSummary = useMemo(() => {
    let newCount = 0;
    let invalidCount = 0;
    let duplicateCount = 0;
    for (const e of importedEntries) {
      if (e.status === 'valid') newCount++;
      else if (e.status === 'invalid') invalidCount++;
      else if (e.status === 'duplicate') duplicateCount++;
    }
    return { newCount, invalidCount, duplicateCount };
  }, [importedEntries]);

  const totalEntries = manualEntries.length + validImportedEntries.length;

  const handleSubmit = async () => {
    const listName = isAddEntryMode ? targetListName! : name.trim();

    if (!isAddEntryMode) {
      const nameErr = validateName(name);
      if (nameErr) {
        setNameError(nameErr);
        return;
      }
    }

    setCreating(true);
    try {
      if (!isAddEntryMode) {
        await createMutation.mutateAsync({ name: listName });
      }

      for (const entry of manualEntries) {
        await addMutation.mutateAsync({
          listName,
          prefix: entry.prefix,
          comment: entry.comment,
        });
      }

      for (const entry of validImportedEntries) {
        await addMutation.mutateAsync({
          listName,
          prefix: entry.prefix,
          comment: entry.comment,
        });
      }

      handleClose();
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setName('');
    setNameError(null);
    setManualEntries([]);
    setPrefix('');
    setComment('');
    setEntryError(null);
    setCsvText('');
    setUrl('');
    setImportedEntries([]);
    setImportParsed(false);
    setCreating(false);
    onClose();
  };

  const canSubmit = isAddEntryMode
    ? totalEntries > 0
    : name.trim() !== '' && !validateName(name);

  return (
    <Drawer
      opened={isOpen}
      onClose={handleClose}
      position="right"
      size="xl"
      padding="xl"
      title={isAddEntryMode ? `Add Entries to ${targetListName}` : 'Add Address List'}
    >
      <Stack gap="lg">
        {/* List Name — only when creating a new list */}
        {!isAddEntryMode && (
        <TextInput
          label="List name"
          placeholder="e.g., blocked-ips"
          value={name}
          onChange={(e) => {
            setName(e.currentTarget.value);
            setNameError(null);
          }}
          onBlur={() => {
            if (name.trim()) setNameError(validateName(name));
          }}
          error={nameError}
        />
        )}

        {/* Entries Tabs */}
        <Tabs defaultValue="manual">
          <Tabs.List>
            <Tabs.Tab value="manual" leftSection={<IconKeyboard size={14} />}>
              Manual
            </Tabs.Tab>
            <Tabs.Tab value="import" leftSection={<IconFileImport size={14} />}>
              Import
            </Tabs.Tab>
          </Tabs.List>

          {/* Manual Tab */}
          <Tabs.Panel value="manual" pt="md">
            <Group gap="sm" align="flex-start" mb="md">
              <TextInput
                placeholder="e.g., 10.0.0.0/8"
                value={prefix}
                onChange={(e) => {
                  setPrefix(e.currentTarget.value);
                  setEntryError(null);
                }}
                error={entryError}
                style={{ flex: 1 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddEntry();
                }}
              />
              <TextInput
                placeholder="Comment (optional)"
                value={comment}
                onChange={(e) => setComment(e.currentTarget.value)}
                style={{ flex: 1 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddEntry();
                }}
              />
              <Button
                leftSection={<IconPlus size={14} />}
                onClick={handleAddEntry}
                variant="light"
              >
                Add
              </Button>
            </Group>

            {manualEntries.length > 0 && (
              <Table withRowBorders={false} style={tableStyle}>
                <Table.Thead>
                  <Table.Tr style={headerRowStyle}>
                    <Table.Th style={{ width: 400 }}>
                      <HeaderLabel>Prefix</HeaderLabel>
                    </Table.Th>
                    <Table.Th>
                      <HeaderLabel>Comment</HeaderLabel>
                    </Table.Th>
                    <Table.Th style={{ width: 50 }} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {manualEntries.map((entry, index) => (
                    <Table.Tr
                      key={`${entry.prefix}-${index}`}
                      style={{
                        borderBottom:
                          index === manualEntries.length - 1
                            ? undefined
                            : '1px solid var(--mantine-color-gray-1)',
                      }}
                    >
                      <Table.Td>
                        <MonoText size="xs">{entry.prefix}</MonoText>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {entry.comment || '\u2014'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={() => handleRemoveEntry(index)}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}

            {manualEntries.length === 0 && (
              <Text size="sm" c="dimmed" ta="center" py="lg">
                No entries added yet. Use the fields above to add prefixes.
              </Text>
            )}
          </Tabs.Panel>

          {/* Import Tab */}
          <Tabs.Panel value="import" pt="md">
            <Textarea
              label="Paste CSV"
              placeholder={'Paste entries, one per line:\nprefix,comment'}
              rows={8}
              value={csvText}
              onChange={(e) => {
                setCsvText(e.currentTarget.value);
                setImportParsed(false);
              }}
              mb="md"
            />
            <TextInput
              label="Or import from URL"
              placeholder="Enter URL to CSV file"
              value={url}
              onChange={(e) => {
                setUrl(e.currentTarget.value);
                setImportParsed(false);
              }}
              mb="md"
            />
            <Button
              variant="light"
              onClick={handleParseImport}
              disabled={!csvText.trim() && !url.trim()}
              mb="md"
            >
              Parse
            </Button>

            {importParsed && importedEntries.length > 0 && (
              <>
                <Text size="sm" mb="sm">
                  {importSummary.newCount} new, {importSummary.duplicateCount} duplicates,{' '}
                  {importSummary.invalidCount} invalid
                </Text>
                <Table withRowBorders={false} style={tableStyle}>
                  <Table.Thead>
                    <Table.Tr style={headerRowStyle}>
                      <Table.Th style={{ width: 100 }}>
                        <HeaderLabel>Status</HeaderLabel>
                      </Table.Th>
                      <Table.Th>
                        <HeaderLabel>Prefix</HeaderLabel>
                      </Table.Th>
                      <Table.Th>
                        <HeaderLabel>Comment</HeaderLabel>
                      </Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {importedEntries.map((entry, index) => {
                      const badge = statusBadge[entry.status];
                      return (
                        <Table.Tr
                          key={`${entry.prefix}-${index}`}
                          style={{
                            borderBottom:
                              index === importedEntries.length - 1
                                ? undefined
                                : '1px solid var(--mantine-color-gray-1)',
                          }}
                        >
                          <Table.Td>
                            <Badge variant="light" color={badge.color} size="sm">
                              {badge.label}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <MonoText size="xs">{entry.prefix}</MonoText>
                          </Table.Td>
                          <Table.Td>
                            <Text size="xs" c="dimmed">
                              {entry.comment || '\u2014'}
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </>
            )}

            {importParsed && importedEntries.length === 0 && (
              <Text size="sm" c="dimmed" ta="center" py="lg">
                No entries found in CSV.
              </Text>
            )}
          </Tabs.Panel>
        </Tabs>

        {/* Footer */}
        <Group justify="space-between" mt="md">
          <Text size="sm" c="dimmed">
            {totalEntries} {totalEntries === 1 ? 'entry' : 'entries'} will be added
          </Text>
          <Group gap="sm">
            <Button variant="default" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={creating} disabled={!canSubmit}>
              {isAddEntryMode ? 'Add Entries' : 'Create'}
            </Button>
          </Group>
        </Group>
      </Stack>
    </Drawer>
  );
}
