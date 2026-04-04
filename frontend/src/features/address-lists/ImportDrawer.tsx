import { useState, useMemo } from 'react';
import {
  Drawer,
  Stepper,
  Textarea,
  TextInput,
  Button,
  Group,
  Table,
  Badge,
  Text,
} from '@mantine/core';
import MonoText from '../../components/common/MonoText';
import { parseCSV } from './csvParser';
import type { ParsedEntry } from './csvParser';
import { useAddEntry, useUpdateEntry } from './addressListsApi';

interface ImportDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  routerId: string;
  listName: string;
  existingPrefixes: string[];
}

const SAMPLE_CSV = '192.0.2.1/32,Sample import 1\n198.51.100.0/24,Sample import 2\n203.0.113.50/32,Sample import 3';

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

export default function ImportDrawer({
  isOpen,
  onClose,
  routerId,
  listName,
  existingPrefixes,
}: ImportDrawerProps) {
  const [active, setActive] = useState(0);
  const [csvText, setCsvText] = useState('');
  const [url, setUrl] = useState('');
  const [parsedEntries, setParsedEntries] = useState<ParsedEntry[]>([]);
  const [overwrites, setOverwrites] = useState<Record<string, boolean>>({});
  const [importing, setImporting] = useState(false);

  const addMutation = useAddEntry(routerId);
  const updateMutation = useUpdateEntry(routerId);

  const handleNext = () => {
    let text = csvText.trim();
    if (!text && url.trim()) {
      // In mock mode, use sample data when a URL is provided
      text = SAMPLE_CSV;
    }
    const entries = parseCSV(text, existingPrefixes);
    setParsedEntries(entries);
    // Initialize overwrite decisions: default to false (skip)
    const initial: Record<string, boolean> = {};
    for (const entry of entries) {
      if (entry.status === 'duplicate') {
        initial[entry.prefix] = false;
      }
    }
    setOverwrites(initial);
    setActive(1);
  };

  const summary = useMemo(() => {
    let newCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;
    for (const entry of parsedEntries) {
      if (entry.status === 'valid') newCount++;
      else if (entry.status === 'duplicate') duplicateCount++;
      else if (entry.status === 'invalid') invalidCount++;
    }
    return { newCount, duplicateCount, invalidCount };
  }, [parsedEntries]);

  const handleImport = async () => {
    setImporting(true);
    try {
      for (const entry of parsedEntries) {
        if (entry.status === 'valid') {
          await addMutation.mutateAsync({
            listName,
            prefix: entry.prefix,
            comment: entry.comment,
          });
        } else if (entry.status === 'duplicate' && overwrites[entry.prefix]) {
          // For overwrite, we update the comment of the existing entry
          // In a real implementation we'd find the entry ID; for mock, the mutation handles it
          await updateMutation.mutateAsync({
            listName,
            entryId: entry.prefix, // placeholder - real impl would resolve ID
            comment: entry.comment,
          });
        }
      }
      handleClose();
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setActive(0);
    setCsvText('');
    setUrl('');
    setParsedEntries([]);
    setOverwrites({});
    setImporting(false);
    onClose();
  };

  const canProceed = csvText.trim() !== '' || url.trim() !== '';

  return (
    <Drawer
      opened={isOpen}
      onClose={handleClose}
      position="right"
      size="lg"
      padding="xl"
      title={`Import Entries to ${listName}`}
    >
      <Stepper active={active} size="sm" mb="xl">
        <Stepper.Step label="Input" />
        <Stepper.Step label="Preview" />
      </Stepper>

      {active === 0 && (
        <>
          <Textarea
            label="Paste CSV"
            placeholder={'Paste entries, one per line:\nprefix,comment'}
            rows={10}
            value={csvText}
            onChange={(e) => setCsvText(e.currentTarget.value)}
            mb="md"
          />
          <TextInput
            label="Or import from URL"
            placeholder="Or enter URL to CSV file"
            value={url}
            onChange={(e) => setUrl(e.currentTarget.value)}
            mb="xl"
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleNext} disabled={!canProceed}>
              Next
            </Button>
          </Group>
        </>
      )}

      {active === 1 && (
        <>
          <Text size="sm" mb="md">
            {summary.newCount} new, {summary.duplicateCount} duplicates, {summary.invalidCount} invalid
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
                <Table.Th style={{ width: 120 }}>
                  <HeaderLabel>Action</HeaderLabel>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {parsedEntries.map((entry, index) => {
                const badge = statusBadge[entry.status];
                const isLast = index === parsedEntries.length - 1;
                return (
                  <Table.Tr
                    key={`${entry.prefix}-${index}`}
                    style={{
                      borderBottom: isLast
                        ? '1px solid var(--mantine-color-gray-2)'
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
                    <Table.Td>
                      {entry.status === 'duplicate' && (
                        <Group gap={4}>
                          <Button
                            size="compact-xs"
                            variant={!overwrites[entry.prefix] ? 'filled' : 'light'}
                            color="gray"
                            onClick={() =>
                              setOverwrites((prev) => ({ ...prev, [entry.prefix]: false }))
                            }
                          >
                            Skip
                          </Button>
                          <Button
                            size="compact-xs"
                            variant={overwrites[entry.prefix] ? 'filled' : 'light'}
                            color="blue"
                            onClick={() =>
                              setOverwrites((prev) => ({ ...prev, [entry.prefix]: true }))
                            }
                          >
                            Overwrite
                          </Button>
                        </Group>
                      )}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>

          <Group justify="flex-end" mt="xl">
            <Button variant="default" onClick={() => setActive(0)}>
              Back
            </Button>
            <Button onClick={handleImport} loading={importing}>
              Import
            </Button>
          </Group>
        </>
      )}
    </Drawer>
  );
}
