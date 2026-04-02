import { Group, Box, Text } from '@mantine/core';

interface StatusIndicatorProps {
  status: 'running' | 'stopped' | 'disabled';
  label?: string;
}

const statusColors: Record<StatusIndicatorProps['status'], string> = {
  running: 'green.7',
  stopped: 'red.7',
  disabled: 'gray.5',
};

export default function StatusIndicator({ status, label }: StatusIndicatorProps) {
  return (
    <Group gap="xs" wrap="nowrap">
      <Box
        bg={statusColors[status]}
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          flexShrink: 0,
        }}
      />
      {label && (
        <Text size="sm">{label}</Text>
      )}
    </Group>
  );
}
