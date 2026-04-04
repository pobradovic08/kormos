import { Button, Group, Select, Stack, Text, TextInput, Title } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEffect } from 'react';

export interface PortalValues {
  portalName: string;
  timezone: string;
  supportEmail: string;
}

interface PortalStepProps {
  values: PortalValues;
  onNext: (values: PortalValues) => void;
  onBack: () => void;
  serverErrors?: Record<string, string>;
  disabled?: boolean;
}

const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
  { value: 'Europe/Belgrade', label: 'Europe/Belgrade (CET/CEST)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET/CEST)' },
  { value: 'Europe/Paris', label: 'Europe/Paris (CET/CEST)' },
  { value: 'Europe/Amsterdam', label: 'Europe/Amsterdam (CET/CEST)' },
  { value: 'Europe/Zurich', label: 'Europe/Zurich (CET/CEST)' },
  { value: 'Europe/Moscow', label: 'Europe/Moscow (MSK)' },
  { value: 'Europe/Istanbul', label: 'Europe/Istanbul (TRT)' },
  { value: 'America/New_York', label: 'America/New York (EST/EDT)' },
  { value: 'America/Chicago', label: 'America/Chicago (CST/CDT)' },
  { value: 'America/Denver', label: 'America/Denver (MST/MDT)' },
  { value: 'America/Los_Angeles', label: 'America/Los Angeles (PST/PDT)' },
  { value: 'America/Toronto', label: 'America/Toronto (EST/EDT)' },
  { value: 'America/Sao_Paulo', label: 'America/Sao Paulo (BRT)' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
  { value: 'Asia/Singapore', label: 'Asia/Singapore (SGT)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
  { value: 'Asia/Seoul', label: 'Asia/Seoul (KST)' },
  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST/AEDT)' },
  { value: 'Australia/Melbourne', label: 'Australia/Melbourne (AEST/AEDT)' },
  { value: 'Pacific/Auckland', label: 'Pacific/Auckland (NZST/NZDT)' },
  { value: 'Africa/Johannesburg', label: 'Africa/Johannesburg (SAST)' },
];

export default function PortalStep({ values, onNext, onBack, serverErrors, disabled }: PortalStepProps) {
  const form = useForm<PortalValues>({
    initialValues: values,
    validate: {
      portalName: (value) =>
        value.trim().length === 0 ? 'Portal name is required' : null,
      timezone: (value) =>
        !value ? 'Timezone is required' : null,
      supportEmail: (value) => {
        if (value.trim().length === 0) return 'Support email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Invalid email format';
        return null;
      },
    },
    validateInputOnChange: true,
  });

  // Apply server-side errors when they change.
  useEffect(() => {
    if (serverErrors) {
      for (const [field, message] of Object.entries(serverErrors)) {
        form.setFieldError(field, message);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverErrors]);

  const handleSubmit = (formValues: PortalValues) => {
    onNext(formValues);
  };

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="md">
        <div>
          <Title order={3}>Portal Settings</Title>
          <Text c="dimmed" size="sm" mt={4}>
            Configure your platform name, timezone, and support contact.
          </Text>
        </div>

        <TextInput
          label="Portal Name"
          placeholder="Kormos"
          required
          disabled={disabled}
          {...form.getInputProps('portalName')}
        />

        <Select
          label="Default Timezone"
          placeholder="Select a timezone"
          required
          searchable
          disabled={disabled}
          data={TIMEZONE_OPTIONS}
          {...form.getInputProps('timezone')}
        />

        <TextInput
          label="Support Email"
          placeholder="support@example.com"
          required
          disabled={disabled}
          {...form.getInputProps('supportEmail')}
        />

        <Group justify="space-between" mt="sm">
          <Button variant="default" onClick={onBack} disabled={disabled}>
            Back
          </Button>
          <Button type="submit" disabled={disabled}>Next</Button>
        </Group>
      </Stack>
    </form>
  );
}
