import type { ReactNode } from 'react';
import { Stack, Text, Center, ThemeIcon } from '@mantine/core';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ComponentType<any>;
  action?: ReactNode;
}

export default function EmptyState({ title, description, icon: Icon, action }: EmptyStateProps) {
  return (
    <Center py="xl">
      <Stack align="center" gap="md">
        {Icon && (
          <ThemeIcon size={64} radius="xl" variant="light" color="gray">
            <Icon size={32} />
          </ThemeIcon>
        )}
        <Text fw={600} size="lg">
          {title}
        </Text>
        <Text c="dimmed" size="sm" ta="center" maw={400}>
          {description}
        </Text>
        {action && action}
      </Stack>
    </Center>
  );
}
