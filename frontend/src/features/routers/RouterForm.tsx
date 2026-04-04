import {
  Modal,
  TextInput,
  NumberInput,
  PasswordInput,
  Button,
  Group,
  Stack,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useCreateRouter, useUpdateRouter, useRouters } from './routersApi';
import type { Router } from '../../api/types';

interface RouterFormProps {
  isOpen: boolean;
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

export default function RouterForm({
  isOpen,
  onClose,
  router,
}: RouterFormProps) {
  const isEditing = !!router;
  const createMutation = useCreateRouter();
  const updateMutation = useUpdateRouter();
  const { data: routers } = useRouters();

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
      name: (value) => {
        if (value.trim().length === 0) return 'Name is required';
        // Duplicate name validation on add
        if (!isEditing && routers) {
          const duplicate = routers.some(
            (r) => r.name.toLowerCase() === value.trim().toLowerCase(),
          );
          if (duplicate) return 'A router with this name already exists';
        }
        // In edit mode, allow same name for the current router
        if (isEditing && routers && router) {
          const duplicate = routers.some(
            (r) =>
              r.id !== router.id &&
              r.name.toLowerCase() === value.trim().toLowerCase(),
          );
          if (duplicate) return 'A router with this name already exists';
        }
        return null;
      },
      hostname: (value) =>
        value.trim().length === 0 ? 'Hostname is required' : null,
      host: (value) =>
        value.trim().length === 0 ? 'Address is required' : null,
      port: (value) => {
        if (value < 1 || value > 65535)
          return 'Port must be between 1 and 65535';
        return null;
      },
      username: (value) =>
        value.trim().length === 0 ? 'Username is required' : null,
      password: (value) =>
        value.trim().length === 0 ? 'Password is required' : null,
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
              message:
                error instanceof Error
                  ? error.message
                  : 'Failed to update router',
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
            message:
              error instanceof Error
                ? error.message
                : 'Failed to create router',
            color: 'red',
          });
        },
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Router' : 'Add Router'}
      size="md"
      centered
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <TextInput
            label="Router Name"
            placeholder="e.g., edge-gw-01"
            withAsterisk
            key={form.key('name')}
            {...form.getInputProps('name')}
          />
          <TextInput
            label="Hostname"
            placeholder="e.g., edge-gw-01.dc1.local"
            withAsterisk
            key={form.key('hostname')}
            {...form.getInputProps('hostname')}
          />
          <TextInput
            label="Address"
            placeholder="IP address or FQDN, e.g., 10.0.1.1"
            withAsterisk
            key={form.key('host')}
            {...form.getInputProps('host')}
          />
          <NumberInput
            label="Port"
            placeholder="443"
            min={1}
            max={65535}
            withAsterisk
            key={form.key('port')}
            {...form.getInputProps('port')}
          />
          <TextInput
            label="API Username"
            placeholder="admin"
            withAsterisk
            key={form.key('username')}
            {...form.getInputProps('username')}
          />
          <PasswordInput
            label="API Password"
            placeholder="Enter password"
            withAsterisk
            key={form.key('password')}
            {...form.getInputProps('password')}
            styles={{ innerInput: { fontSize: 'var(--mantine-font-size-sm)' } }}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" variant="filled" loading={isPending}>
              {isEditing ? 'Save Changes' : 'Add Router'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
