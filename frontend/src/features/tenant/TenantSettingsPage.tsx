import {
  Alert,
  Button,
  Card,
  Loader,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconAlertCircle } from '@tabler/icons-react';
import { useEffect } from 'react';
import { useTenant, useUpdateTenant } from './tenantApi';

export default function TenantSettingsPage() {
  const { data: tenant, isLoading, error } = useTenant();
  const updateMutation = useUpdateTenant();

  const form = useForm({
    initialValues: {
      name: '',
    },
    validate: {
      name: (value) =>
        value.trim().length === 0 ? 'Tenant name is required' : null,
    },
  });

  useEffect(() => {
    if (tenant) {
      form.setFieldValue('name', tenant.name);
    }
    // Only reset form when tenant data loads, not on every form change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  const handleSubmit = (values: { name: string }) => {
    updateMutation.mutate(
      { name: values.name },
      {
        onSuccess: (updated) => {
          notifications.show({
            title: 'Settings saved',
            message: `Tenant name updated to "${updated.name}".`,
            color: 'green',
          });
        },
        onError: (err) => {
          notifications.show({
            title: 'Error',
            message:
              err instanceof Error
                ? err.message
                : 'Failed to update tenant settings',
            color: 'red',
          });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <Stack align="center" mt="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading settings...</Text>
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert
        icon={<IconAlertCircle size={16} />}
        title="Error"
        color="red"
        mt="md"
      >
        Failed to load tenant settings. Please try again later.
      </Alert>
    );
  }

  return (
    <>
      <Title order={2} mb="md">
        Settings
      </Title>

      <Card shadow="sm" padding="lg" radius="md" withBorder maw={500}>
        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="md">
            <TextInput
              label="Tenant Name"
              placeholder="Enter tenant name"
              required
              {...form.getInputProps('name')}
            />
            <Text size="xs" c="dimmed">
              Slug: {tenant?.slug}
            </Text>
            <Button
              type="submit"
              loading={updateMutation.isPending}
              w="fit-content"
            >
              Save
            </Button>
          </Stack>
        </form>
      </Card>
    </>
  );
}
