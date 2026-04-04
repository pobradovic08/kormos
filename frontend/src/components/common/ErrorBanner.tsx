import { Alert, Button, Group } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

/**
 * ErrorBanner displays a prominent red alert banner for error states such as
 * "Router unreachable" or network failures. An optional retry button allows
 * the user to re-attempt the failed operation.
 */
export default function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <Alert
      icon={<IconAlertTriangle size={20} />}
      title="Error"
      color="red"
      variant="filled"
      mb="md"
    >
      <Group justify="space-between" align="center">
        {message}
        {onRetry && (
          <Button
            variant="white"
            color="red"
            size="xs"
            onClick={onRetry}
          >
            Retry
          </Button>
        )}
      </Group>
    </Alert>
  );
}
