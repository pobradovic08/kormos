import { Modal, TextInput, NumberInput, PasswordInput, Button, Group, Stack } from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useCreateRouter, useUpdateRouter } from './routersApi';
import type { Router } from '../../api/types';

interface RouterFormProps {
  opened: boolean;
  onClose: () => void;
  router?: Router | null;
}

interface FormValues {
  name: string;
  hostname: string;
  host: string;
  port: number;
  username: string;
  password: string;
}

export default function RouterForm({ opened, onClose, router }: RouterFormProps) {
  const isEditing = !!router;
  const createMutation = useCreateRouter();
  const updateMutation = useUpdateRouter();

  const form = useForm<FormValues>({
    mode: 'uncontrolled',
    initialValues: {
      name: router?.name ?? '',
      hostname: router?.hostname ?? '',
      host: router?.host ?? '',
      port: router?.port ?? 443,
      username: '',
      password: '',
    },
    validate: {
      name: (value) => (value.trim().length === 0 ? 'Name is required' : null),
      host: (value) => (value.trim().length === 0 ? 'Host is required' : null),
      port: (value) => {
        if (value < 1 || value > 65535) return 'Port must be between 1 and 65535';
        return null;
      },
      username: (value) => (value.trim().length === 0 ? 'Username is required' : null),
      password: (value) => (value.trim().length === 0 ? 'Password is required' : null),
    },
  });

  const handleSubmit = (values: FormValues) => {
    if (isEditing && router) {
      updateMutation.mutate(
        { id: router.id, ...values },
        {
          onSuccess: () => {
            notifications.show({
              title: 'Router updated',
              message: `Router "${values.name}" has been updated successfully.`,
              color: 'green',
            });
            form.reset();
            onClose();
          },
          onError: (error) => {
            notifications.show({
              title: 'Error',
              message: error instanceof Error ? error.message : 'Failed to update router',
              color: 'red',
            });
          },
        },
      );
    } else {
      createMutation.mutate(values, {
        onSuccess: () => {
          notifications.show({
            title: 'Router created',
            message: `Router "${values.name}" has been created successfully.`,
            color: 'green',
          });
          form.reset();
          onClose();
        },
        onError: (error) => {
          notifications.show({
            title: 'Error',
            message: error instanceof Error ? error.message : 'Failed to create router',
            color: 'red',
          });
        },
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEditing ? 'Edit Router' : 'Add Router'}
      size="md"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="sm">
          <TextInput
            label="Name"
            placeholder="my-router"
            withAsterisk
            key={form.key('name')}
            {...form.getInputProps('name')}
          />
          <TextInput
            label="Hostname"
            placeholder="router.example.com"
            key={form.key('hostname')}
            {...form.getInputProps('hostname')}
          />
          <TextInput
            label="Host"
            placeholder="192.168.1.1"
            withAsterisk
            key={form.key('host')}
            {...form.getInputProps('host')}
          />
          <NumberInput
            label="Port"
            placeholder="443"
            min={1}
            max={65535}
            key={form.key('port')}
            {...form.getInputProps('port')}
          />
          <TextInput
            label="Username"
            placeholder="admin"
            withAsterisk
            key={form.key('username')}
            {...form.getInputProps('username')}
          />
          <PasswordInput
            label="Password"
            placeholder="Enter password"
            withAsterisk
            key={form.key('password')}
            {...form.getInputProps('password')}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={isPending}>
              {isEditing ? 'Update' : 'Create'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
