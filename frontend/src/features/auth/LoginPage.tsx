import {
  Button,
  Card,
  Center,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../../api/client';
import type { LoginResponse } from '../../api/types';
import { useAuthStore } from '../../stores/useAuthStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(false);

  const form = useForm({
    initialValues: {
      email: '',
      password: '',
    },
    validate: {
      email: (value) =>
        value.trim().length === 0 ? 'Email is required' : null,
      password: (value) =>
        value.length === 0 ? 'Password is required' : null,
    },
  });

  const handleSubmit = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const response = await client.post<LoginResponse>('/auth/login', values);
      const { access_token, user } = response.data;
      setAuth(user, access_token);
      navigate('/dashboard');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Login failed. Please try again.';
      notifications.show({
        title: 'Login failed',
        message,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Center h="100vh" bg="var(--color-bg-primary)">
      <Card shadow="sm" padding="xl" radius="md" w={400} withBorder>
        <Stack gap="lg">
          <div>
            <Title order={2} ta="center">
              Sign in
            </Title>
            <Text c="dimmed" size="sm" ta="center" mt={4}>
              Sign in to your Kormos account
            </Text>
          </div>

          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="md">
              <TextInput
                label="Email"
                placeholder="you@example.com"
                required
                {...form.getInputProps('email')}
              />
              <PasswordInput
                label="Password"
                placeholder="Your password"
                required
                {...form.getInputProps('password')}
              />
              <Button type="submit" fullWidth loading={loading}>
                Sign in
              </Button>
            </Stack>
          </form>
        </Stack>
      </Card>
    </Center>
  );
}
