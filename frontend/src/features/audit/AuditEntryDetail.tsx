import {
  Drawer,
  Stack,
  Group,
  Text,
  Badge,
  Divider,
  Paper,
  Title,
} from '@mantine/core';
import ChangeDiff from '../../components/commit/ChangeDiff';
import type { AuditEntry, AuditOperation } from '../../api/types';

interface AuditEntryDetailProps {
  entry: AuditEntry | null;
  opened: boolean;
  onClose: () => void;
}

function parseOperations(ops: string | AuditOperation[]): AuditOperation[] {
  if (Array.isArray(ops)) return ops;
  if (typeof ops === 'string') {
    try {
      const parsed = JSON.parse(ops);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function statusColor(status: string): string {
  switch (status) {
    case 'success':
      return 'green';
    case 'partial':
      return 'yellow';
    case 'failure':
      return 'red';
    default:
      return 'gray';
  }
}

function opTypeLabel(opType: string): string {
  switch (opType) {
    case 'add':
      return 'Add';
    case 'modify':
      return 'Modify';
    case 'delete':
      return 'Delete';
    default:
      return opType;
  }
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Group justify="space-between" wrap="nowrap" align="flex-start">
      <Text size="sm" c="dimmed" style={{ minWidth: 120 }}>
        {label}
      </Text>
      <div style={{ textAlign: 'right' }}>{children}</div>
    </Group>
  );
}

export default function AuditEntryDetail({ entry, opened, onClose }: AuditEntryDetailProps) {
  if (!entry) return null;

  const operations = parseOperations(entry.operations);
  const timestamp = new Date(entry.created_at).toLocaleString();

  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={
        <Text fw={600} size="lg">
          Audit Entry Details
        </Text>
      }
      position="right"
      size="lg"
    >
      <Stack gap="md">
        <DetailField label="Timestamp">
          <Text size="sm">{timestamp}</Text>
        </DetailField>

        <DetailField label="User">
          <Text size="sm">{entry.user.name}</Text>
        </DetailField>

        <DetailField label="Router">
          <Text size="sm">{entry.router.name}</Text>
        </DetailField>

        <DetailField label="Module">
          <Badge variant="light" size="sm">
            {entry.module}
          </Badge>
        </DetailField>

        <DetailField label="Status">
          <Badge color={statusColor(entry.status)} variant="filled" size="sm">
            {entry.status}
          </Badge>
        </DetailField>

        {entry.commit_message && (
          <DetailField label="Commit Message">
            <Text size="sm">{entry.commit_message}</Text>
          </DetailField>
        )}

        {entry.error_details && (
          <>
            <Divider label="Error Details" labelPosition="left" />
            <Paper p="sm" bg="red.0" style={{ borderLeft: '3px solid var(--mantine-color-red-6)' }}>
              <Text size="sm" c="red.8">
                {entry.error_details}
              </Text>
            </Paper>
          </>
        )}

        <Divider label="Operations" labelPosition="left" />

        {operations.length > 0 ? (
          <Stack gap="sm">
            {operations.map((op, idx) => (
              <Paper key={idx} p="sm" withBorder>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Group gap="xs">
                      <Title order={6}>#{op.index ?? idx}</Title>
                      <Badge variant="light" size="xs">
                        {op.module || 'unknown'}
                      </Badge>
                    </Group>
                    <Badge
                      color={
                        op.operation === 'add'
                          ? 'green'
                          : op.operation === 'delete'
                            ? 'red'
                            : 'blue'
                      }
                      variant="light"
                      size="sm"
                    >
                      {opTypeLabel(op.operation)}
                    </Badge>
                  </Group>

                  <Text size="xs" c="dimmed" ff="monospace">
                    {op.resource_path}
                  </Text>

                  {op.body && Object.keys(op.body).length > 0 && (
                    <ChangeDiff
                      before={op.operation === 'delete' ? op.body : null}
                      after={op.operation !== 'delete' ? op.body : null}
                      operation={
                        (op.operation as 'add' | 'modify' | 'delete') || 'modify'
                      }
                    />
                  )}
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            No operation details available.
          </Text>
        )}
      </Stack>
    </Drawer>
  );
}
