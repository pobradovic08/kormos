import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
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

export default function ErrorPage() {
  const error = useRouteError();

  const isRouteError = isRouteErrorResponse(error);
  const message = isRouteError
    ? error.statusText
    : error instanceof Error
      ? error.message
      : 'An unexpected error occurred';

  return (
    <Center h="100vh">
      <Stack align="center" gap="md" maw={480} px="md">
        <ThemeIcon size={64} radius="xl" variant="light" color="red">
          <IconAlertTriangle size={32} />
        </ThemeIcon>
        <Text fw={600} size="lg">
          Something went wrong
        </Text>
        <Text c="dimmed" size="sm" ta="center">
          An unexpected error occurred. You can try reloading the page or
          returning to the dashboard.
        </Text>
        {import.meta.env.DEV && (
          <Code block w="100%">
            {message}
          </Code>
        )}
        <Group>
          <Button
            variant="filled"
            onClick={() => window.location.reload()}
          >
            Reload Page
          </Button>
          <Button
            variant="light"
            color="gray"
            component="a"
            href="/"
          >
            Go to Dashboard
          </Button>
        </Group>
      </Stack>
    </Center>
  );
}
