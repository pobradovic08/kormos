import { useEffect } from 'react';
import { Center, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconCircleCheck } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import type { AuthUser } from '../../api/types';
import { useAuthStore } from '../../stores/useAuthStore';

interface CompletionStepProps {
  user: AuthUser;
  accessToken: string;
}

export default function CompletionStep({ user, accessToken }: CompletionStepProps) {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  useEffect(() => {
    setAuth(user, accessToken);

    const timer = setTimeout(() => {
      navigate('/dashboard', { replace: true });
    }, 2000);

    return () => clearTimeout(timer);
  }, [user, accessToken, setAuth, navigate]);

  return (
    <Center py="xl">
      <Stack align="center" gap="md">
        <ThemeIcon size={64} radius="xl" color="green" variant="light">
          <IconCircleCheck size={40} />
        </ThemeIcon>

        <Title order={3}>Setup Complete!</Title>

        <Text size="lg" ta="center">
          Welcome, {user.name}! Your platform is ready.
        </Text>

        <Text c="dimmed" size="sm" ta="center">
          You'll be redirected to the dashboard in a moment...
        </Text>
      </Stack>
    </Center>
  );
}
