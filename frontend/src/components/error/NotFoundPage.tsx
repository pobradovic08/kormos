import { useLocation, useNavigate } from 'react-router-dom';
import { Center, Stack, Text, Button, ThemeIcon, Code } from '@mantine/core';
import { IconFileUnknown } from '@tabler/icons-react';

export default function NotFoundPage() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <Center mih="calc(100vh - 120px)">
      <Stack align="center" gap="md">
        <ThemeIcon size={64} radius="xl" variant="light" color="red">
          <IconFileUnknown size={32} />
        </ThemeIcon>
        <Text fw={600} size="lg">
          Page Not Found
        </Text>
        <Text c="dimmed" size="sm" ta="center" maw={400}>
          The page at <Code>{location.pathname}</Code> does not exist.
        </Text>
        <Button
          variant="light"
          onClick={() => void navigate('/dashboard')}
        >
          Go to Dashboard
        </Button>
      </Stack>
    </Center>
  );
}
