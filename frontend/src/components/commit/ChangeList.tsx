import { ActionIcon, Badge, Group, Stack, Text } from '@mantine/core';
import { IconX } from '@tabler/icons-react';
import type { PendingChange } from '../../api/types';

interface ChangeListProps {
  changes: PendingChange[];
  onDiscard: (changeId: string) => void;
  expandedId: string | null;
  onToggleExpand: (changeId: string) => void;
}

const operationColor: Record<PendingChange['operation'], string> = {
  add: 'green',
  modify: 'blue',
  delete: 'red',
};

const operationLabel: Record<PendingChange['operation'], string> = {
  add: 'Add',
  modify: 'Modify',
  delete: 'Delete',
};

function describeChange(change: PendingChange): string {
  const name =
    (change.after?.['name'] as string | undefined) ??
    (change.before?.['name'] as string | undefined) ??
    change.resourceId ??
    'new resource';
  return `${change.resourcePath} — ${name}`;
}

export default function ChangeList({
  changes,
  onDiscard,
  expandedId,
  onToggleExpand,
}: ChangeListProps) {
  const grouped = new Map<string, PendingChange[]>();
  for (const change of changes) {
    const existing = grouped.get(change.module);
    if (existing) {
      existing.push(change);
    } else {
      grouped.set(change.module, [change]);
    }
  }

  if (changes.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No pending changes
      </Text>
    );
  }

  return (
    <Stack gap="md">
      {[...grouped.entries()].map(([module, moduleChanges]) => (
        <Stack key={module} gap="xs">
          <Text size="sm" fw={600} tt="capitalize">
            {module}
          </Text>
          {moduleChanges.map((change) => (
            <Group
              key={change.id}
              gap="xs"
              wrap="nowrap"
              justify="space-between"
              style={{
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: 4,
                backgroundColor:
                  expandedId === change.id
                    ? 'var(--color-bg-surface-hover)'
                    : undefined,
              }}
              onClick={() => onToggleExpand(change.id)}
            >
              <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                <Badge
                  size="sm"
                  variant="filled"
                  color={operationColor[change.operation]}
                  style={{ flexShrink: 0 }}
                >
                  {operationLabel[change.operation]}
                </Badge>
                <Text size="xs" truncate>
                  {describeChange(change)}
                </Text>
              </Group>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="red"
                onClick={(e) => {
                  e.stopPropagation();
                  onDiscard(change.id);
                }}
                aria-label="Discard change"
              >
                <IconX size={14} />
              </ActionIcon>
            </Group>
          ))}
        </Stack>
      ))}
    </Stack>
  );
}
