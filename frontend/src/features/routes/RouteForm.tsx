import {
  Drawer,
  TextInput,
  NumberInput,
  Textarea,
  Button,
  Group,
  Stack,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useEffect } from 'react';
import { useCreateRoute } from './routesApi';

interface RouteFormProps {
  isOpen: boolean;
  onClose: () => void;
  routerId: string | null;
}

interface FormValues {
  destination: string;
  gateway: string;
  distance: number;
  comment: string;
}

export default function RouteForm({ isOpen, onClose, routerId }: RouteFormProps) {
  const createMutation = useCreateRoute(routerId);

  const form = useForm<FormValues>({
    mode: 'controlled',
    initialValues: {
      destination: '',
      gateway: '',
      distance: 1,
      comment: '',
    },
    validate: {
      destination: (value) => {
        if (!value.trim()) return 'Destination is required';
        if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/.test(value.trim()))
          return 'Must be a CIDR prefix (e.g., 10.0.0.0/24)';
        return null;
      },
      gateway: (value) => {
        if (!value.trim()) return 'Gateway is required';
        return null;
      },
      distance: (value) => {
        if (value < 1 || value > 255) return 'Distance must be between 1 and 255';
        return null;
      },
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSubmit = (values: FormValues) => {
    createMutation.mutate(
      {
        destination: values.destination.trim(),
        gateway: values.gateway.trim(),
        distance: values.distance,
        comment: values.comment.trim() || undefined,
      },
      {
        onSuccess: () => {
          notifications.show({
            title: 'Route created',
            message: `Static route to ${values.destination} created successfully.`,
            color: 'green',
          });
          form.reset();
          onClose();
        },
        onError: (error) => {
          notifications.show({
            title: 'Error',
            message: error instanceof Error ? error.message : 'Failed to create route',
            color: 'red',
          });
        },
      },
    );
  };

  return (
    <Drawer
      opened={isOpen}
      onClose={onClose}
      title="Add Static Route"
      position="right"
      size="md"
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <TextInput
            label="Destination"
            placeholder="e.g., 10.0.0.0/24"
            withAsterisk
            {...form.getInputProps('destination')}
          />
          <TextInput
            label="Gateway"
            placeholder="e.g., 172.16.4.113 or WAN"
            withAsterisk
            {...form.getInputProps('gateway')}
          />
          <NumberInput
            label="Distance"
            min={1}
            max={255}
            withAsterisk
            {...form.getInputProps('distance')}
          />
          <Textarea
            label="Comment"
            placeholder="Optional description"
            autosize
            minRows={2}
            maxRows={4}
            {...form.getInputProps('comment')}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              Create Route
            </Button>
          </Group>
        </Stack>
      </form>
    </Drawer>
  );
}
