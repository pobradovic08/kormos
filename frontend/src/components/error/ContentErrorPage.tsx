import { isRouteErrorResponse, useRouteError, useNavigate, useLocation } from 'react-router-dom';
import {
  Center,
  Stack,
  Text,
  Button,
  ThemeIcon,
  Code,
  Group,
} from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

export default function ContentErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();
  const location = useLocation();

  const isRouteError = isRouteErrorResponse(error);
  const message = isRouteError
    ? error.statusText
    : error instanceof Error
      ? error.message
      : 'An unexpected error occurred';

  return (
    <Center mih="calc(100vh - 120px)">
      <Stack align="center" gap="md" maw={480}>
        <ThemeIcon size={64} radius="xl" variant="light" color="red">
          <IconAlertTriangle size={32} />
        </ThemeIcon>
        <Text fw={600} size="lg">
          Something went wrong
        </Text>
        <Text c="dimmed" size="sm" ta="center" maw={400}>
          This page encountered an error. You can try again or navigate to a
          different page.
        </Text>
        {import.meta.env.DEV && (
          <Code block w="100%">
            {message}
          </Code>
        )}
        <Group>
          <Button
            variant="filled"
            onClick={() => void navigate(location.pathname, { replace: true })}
          >
            Try Again
          </Button>
          <Button
            variant="light"
            color="gray"
            onClick={() => void navigate('/dashboard')}
          >
            Go to Dashboard
          </Button>
        </Group>
      </Stack>
    </Center>
  );
}
