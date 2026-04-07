import { UnstyledButton, Text, Badge } from '@mantine/core';
import { IconHistory } from '@tabler/icons-react';
import { useOperationHistory } from '../../api/operationsApi';
import { useRouterStore } from '../../stores/useRouterStore';

interface UndoHistoryButtonProps {
  onClick: () => void;
}

export default function UndoHistoryButton({ onClick }: UndoHistoryButtonProps) {
  const selectedRouterId = useRouterStore((s) => s.selectedRouterId);
  const { data } = useOperationHistory(selectedRouterId, 1, 50);

  const undoableCount =
    data?.groups.filter((g) => g.can_undo).length ?? 0;

  return (
    <UnstyledButton
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: 'var(--mantine-radius-sm)',
        color: 'var(--mantine-color-dark-1)',
        backgroundColor: undoableCount > 0
          ? 'var(--mantine-color-blue-9)'
          : 'transparent',
        fontSize: 'var(--mantine-font-size-sm)',
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        transition: 'background-color 150ms ease, color 150ms ease',
      }}
    >
      <IconHistory size={16} />
      <Text size="sm" fw="inherit" c="inherit">
        History
      </Text>
      {undoableCount > 0 && (
        <Badge size="sm" variant="filled" color="blue" circle>
          {undoableCount}
        </Badge>
      )}
    </UnstyledButton>
  );
}
