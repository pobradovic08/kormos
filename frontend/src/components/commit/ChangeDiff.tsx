import { Paper, Stack, Group, Text } from '@mantine/core';
import MonoText from '../common/MonoText';

interface ChangeDiffProps {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  operation: 'add' | 'modify' | 'delete';
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function AddDiff({ after }: { after: Record<string, unknown> }) {
  return (
    <Stack gap={2}>
      {Object.entries(after).map(([key, value]) => (
        <Paper
          key={key}
          p="xs"
          style={{
            backgroundColor: 'var(--color-diff-add-bg)',
          }}
        >
          <Group gap="xs" wrap="nowrap">
            <Text size="xs" fw={500} style={{ color: 'var(--color-diff-add-text)' }}>
              + {key}:
            </Text>
            <MonoText size="xs">{formatValue(value)}</MonoText>
          </Group>
        </Paper>
      ))}
    </Stack>
  );
}

function DeleteDiff({ before }: { before: Record<string, unknown> }) {
  return (
    <Stack gap={2}>
      {Object.entries(before).map(([key, value]) => (
        <Paper
          key={key}
          p="xs"
          style={{
            backgroundColor: 'var(--color-diff-remove-bg)',
          }}
        >
          <Group gap="xs" wrap="nowrap">
            <Text size="xs" fw={500} style={{ color: 'var(--color-diff-remove-text)' }}>
              - {key}:
            </Text>
            <MonoText size="xs">{formatValue(value)}</MonoText>
          </Group>
        </Paper>
      ))}
    </Stack>
  );
}

function ModifyDiff({
  before,
  after,
}: {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}) {
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  return (
    <Stack gap={2}>
      {[...allKeys].map((key) => {
        const oldVal = before[key];
        const newVal = after[key];
        const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);

        if (!changed) {
          return (
            <Paper key={key} p="xs">
              <Group gap="xs" wrap="nowrap">
                <Text size="xs" fw={500} c="dimmed">
                  &nbsp; {key}:
                </Text>
                <MonoText size="xs">{formatValue(oldVal)}</MonoText>
              </Group>
            </Paper>
          );
        }

        return (
          <Stack key={key} gap={0}>
            {oldVal !== undefined && (
              <Paper
                p="xs"
                style={{
                  backgroundColor: 'var(--color-diff-remove-bg)',
                }}
              >
                <Group gap="xs" wrap="nowrap">
                  <Text
                    size="xs"
                    fw={500}
                    style={{ color: 'var(--color-diff-remove-text)' }}
                  >
                    - {key}:
                  </Text>
                  <MonoText size="xs">{formatValue(oldVal)}</MonoText>
                </Group>
              </Paper>
            )}
            {newVal !== undefined && (
              <Paper
                p="xs"
                style={{
                  backgroundColor: 'var(--color-diff-add-bg)',
                }}
              >
                <Group gap="xs" wrap="nowrap">
                  <Text
                    size="xs"
                    fw={500}
                    style={{ color: 'var(--color-diff-add-text)' }}
                  >
                    + {key}:
                  </Text>
                  <MonoText size="xs">{formatValue(newVal)}</MonoText>
                </Group>
              </Paper>
            )}
          </Stack>
        );
      })}
    </Stack>
  );
}

export default function ChangeDiff({ before, after, operation }: ChangeDiffProps) {
  switch (operation) {
    case 'add':
      return after ? <AddDiff after={after} /> : null;
    case 'delete':
      return before ? <DeleteDiff before={before} /> : null;
    case 'modify':
      return before && after ? <ModifyDiff before={before} after={after} /> : null;
  }
}
