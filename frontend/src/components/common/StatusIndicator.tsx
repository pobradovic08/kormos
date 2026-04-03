import { Badge } from '@mantine/core';

interface StatusIndicatorProps {
  status: 'running' | 'stopped' | 'disabled' | 'degraded';
  label?: string;
}

const statusConfig: Record<StatusIndicatorProps['status'], { color: string; defaultLabel: string }> = {
  running: { color: 'green', defaultLabel: 'Online' },
  stopped: { color: 'red', defaultLabel: 'Offline' },
  disabled: { color: 'gray', defaultLabel: 'Disabled' },
  degraded: { color: 'orange', defaultLabel: 'Degraded' },
};

export default function StatusIndicator({ status, label }: StatusIndicatorProps) {
  const config = statusConfig[status];

  return (
    <Badge
      variant="light"
      color={config.color}
      size="sm"
      radius="sm"
    >
      {label ?? config.defaultLabel}
    </Badge>
  );
}
