import { Badge, Button } from '@mantine/core';
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

  return (
    <Button
      variant={count > 0 ? 'filled' : 'subtle'}
      color={count > 0 ? 'green' : 'gray'}
      size="compact-sm"
      onClick={onClick}
      rightSection={
        count > 0 ? (
          <Badge size="sm" variant="filled" color="white" c="green" circle>
            {count}
          </Badge>
        ) : undefined
      }
    >
      Commit changes
    </Button>
  );
}
