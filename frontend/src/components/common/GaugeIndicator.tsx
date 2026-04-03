import { Group, Progress, Text } from '@mantine/core';
import type { ReactNode } from 'react';

interface GaugeIndicatorProps {
  value: number;
  label: string;
  icon?: ReactNode;
  size?: string;
  showValue?: boolean;
}

function getColor(value: number): string {
  if (value < 60) return 'green.6';
  if (value < 80) return 'yellow.6';
  return 'red.6';
}

export default function GaugeIndicator({
  value,
  label,
  icon,
  size = 'md',
  showValue = true,
}: GaugeIndicatorProps) {
  return (
    <>
      <Group justify="space-between" mb={4}>
        <Group gap={6}>
          {icon}
          <Text size="sm">{label}</Text>
        </Group>
        {showValue && (
          <Text size="sm" fw={500}>
            {Math.round(value)}%
          </Text>
        )}
      </Group>
      <Progress value={value} color={getColor(value)} size={size} />
    </>
  );
}
