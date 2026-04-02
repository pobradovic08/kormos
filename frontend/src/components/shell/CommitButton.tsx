import { Badge, UnstyledButton, Text } from '@mantine/core';
import { IconGitCommit } from '@tabler/icons-react';
import { useCommitStore } from '../../stores/useCommitStore';
import { useRouterStore } from '../../stores/useRouterStore';

interface CommitButtonProps {
  onClick: () => void;
}

export default function CommitButton({ onClick }: CommitButtonProps) {
  const selectedRouterId = useRouterStore((s) => s.selectedRouterId);
  const count = useCommitStore((s) =>
    selectedRouterId ? s.getTotalCount(selectedRouterId) : 0,
  );

  const hasPending = count > 0;

  return (
    <UnstyledButton
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: 'var(--mantine-radius-sm)',
        color: hasPending ? '#ffffff' : 'var(--mantine-color-dark-1)',
        backgroundColor: hasPending
          ? 'var(--mantine-color-green-7)'
          : 'transparent',
        fontSize: 'var(--mantine-font-size-sm)',
        fontWeight: hasPending ? 600 : 500,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        transition: 'background-color 150ms ease, color 150ms ease',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        if (!hasPending) {
          e.currentTarget.style.backgroundColor = 'var(--mantine-color-dark-5)';
          e.currentTarget.style.color = '#ffffff';
        } else {
          e.currentTarget.style.backgroundColor = 'var(--mantine-color-green-8)';
        }
      }}
      onMouseLeave={(e) => {
        if (!hasPending) {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = 'var(--mantine-color-dark-1)';
        } else {
          e.currentTarget.style.backgroundColor = 'var(--mantine-color-green-7)';
        }
      }}
    >
      <IconGitCommit size={16} />
      <Text size="sm" fw="inherit" c="inherit">Commit</Text>
      {hasPending && (
        <Badge
          size="sm"
          variant="filled"
          color="white"
          c="green"
          circle
          style={{ fontWeight: 700 }}
        >
          {count}
        </Badge>
      )}
    </UnstyledButton>
  );
}
