import {
  Button,
  PasswordInput,
  Progress,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { useEffect } from 'react';

export interface AdminValues {
  email: string;
  name: string;
  password: string;
  confirmPassword: string;
}

interface AdminStepProps {
  values: AdminValues;
  onNext: (values: AdminValues) => void;
  serverErrors?: Record<string, string>;
  disabled?: boolean;
}

function getPasswordStrength(password: string): {
  score: number;
  color: string;
  label: string;
} {
  if (password.length === 0) {
    return { score: 0, color: 'gray', label: '' };
  }

  let score = 0;
  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    digit: /[0-9]/.test(password),
  };

  if (checks.length) score += 25;
  if (checks.lowercase) score += 25;
  if (checks.uppercase) score += 25;
  if (checks.digit) score += 25;

  if (score < 50) {
    return { score, color: 'red', label: 'Too weak' };
  }
  if (score < 100) {
    return { score, color: 'yellow', label: 'Missing requirements' };
  }
  return { score, color: 'green', label: 'Strong' };
}

export default function AdminStep({
  values,
  onNext,
  serverErrors,
  disabled,
}: AdminStepProps) {
  const form = useForm<AdminValues>({
    initialValues: values,
    validate: {
      email: (value) => {
        if (value.trim().length === 0) return 'Email is required';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
          return 'Invalid email format';
        return null;
      },
      name: (value) =>
        value.trim().length === 0 ? 'Name is required' : null,
      password: (value) => {
        if (value.length < 8) return 'Password must be at least 8 characters';
        if (!/[a-z]/.test(value))
          return 'Password must contain a lowercase letter';
        if (!/[A-Z]/.test(value))
          return 'Password must contain an uppercase letter';
        if (!/[0-9]/.test(value)) return 'Password must contain a number';
        return null;
      },
      confirmPassword: (value, formValues) =>
        value !== formValues.password ? 'Passwords do not match' : null,
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
    // Only re-run when serverErrors reference changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverErrors]);

  const handleSubmit = (formValues: AdminValues) => {
    onNext(formValues);
  };

  const strength = getPasswordStrength(form.values.password);

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="md">
        <div>
          <Title order={4}>Create Admin Account</Title>
          <Text c="dimmed" size="sm" mt={4}>
            Set up the first administrator account for your platform.
          </Text>
        </div>

        <TextInput
          label="Email"
          placeholder="admin@example.com"
          required
          disabled={disabled}
          {...form.getInputProps('email')}
        />

        <TextInput
          label="Full Name"
          placeholder="John Doe"
          required
          disabled={disabled}
          {...form.getInputProps('name')}
        />

        <div>
          <PasswordInput
            label="Password"
            placeholder="At least 8 characters"
            required
            disabled={disabled}
            {...form.getInputProps('password')}
          />
          {form.values.password.length > 0 && (
            <Stack gap={4} mt={6}>
              <Progress
                value={strength.score}
                color={strength.color}
                size="sm"
              />
              <Text size="xs" c={strength.color}>
                {strength.label}
              </Text>
            </Stack>
          )}
        </div>

        <PasswordInput
          label="Confirm Password"
          placeholder="Re-enter your password"
          required
          disabled={disabled}
          {...form.getInputProps('confirmPassword')}
        />

        <Button type="submit" fullWidth mt="sm" disabled={disabled}>
          Next
        </Button>
      </Stack>
    </form>
  );
}
