import { Group, Box, Text } from '@mantine/core';

interface StatusIndicatorProps {
  status: 'running' | 'stopped' | 'disabled';
  label?: string;
}

const statusColors: Record<StatusIndicatorProps['status'], string> = {
  running: '#2F9E44',
  stopped: '#E03131',
  disabled: '#ADB5BD',
};

export default function StatusIndicator({ status, label }: StatusIndicatorProps) {
  const color = statusColors[status];

  return (
    <Group gap={8} wrap="nowrap">
      <Box
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: color,
          flexShrink: 0,
        }}
      />
      {label && (
        <Text size="sm">{label}</Text>
      )}
    </Group>
  );
}
