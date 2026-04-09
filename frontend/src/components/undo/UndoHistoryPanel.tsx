import { useState } from 'react';
import {
  Drawer,
  Stack,
  Group,
  Text,
  Badge,
  Button,
  Collapse,
  UnstyledButton,
  Divider,
  Alert,
} from '@mantine/core';
import {
  IconChevronDown,
  IconChevronRight,
  IconArrowBackUp,
  IconAlertCircle,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useOperationHistory, useUndoOperation } from '../../api/operationsApi';
import { useClusterStore } from '../../stores/useClusterStore';
import { relativeTime } from '../../utils/relativeTime';
import type { OperationGroup } from '../../api/types';

interface UndoHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const statusColor: Record<string, string> = {
  applied: 'green',
  undone: 'gray',
  failed: 'red',
  requires_attention: 'orange',
};

const opTypeColor: Record<string, string> = {
  add: 'green',
  modify: 'blue',
  delete: 'red',
};

function GroupEntry({ group }: { group: OperationGroup }) {
  const [expanded, setExpanded] = useState(false);
  const undoMutation = useUndoOperation();
  const [confirmUndo, setConfirmUndo] = useState(false);

  const isExpired = new Date(group.expires_at) < new Date();
  const routerCount = new Set(group.operations.map((o) => o.router_id)).size;

  const handleUndo = async () => {
    try {
      const result = await undoMutation.mutateAsync(group.id);
      if (result.status === 'undone') {
        notifications.show({
          title: 'Undone',
          message: group.description,
          color: 'green',
        });
      } else if (result.status === 'undo_blocked') {
        notifications.show({
          title: 'Undo blocked',
          message: result.reason ?? 'Resource has been modified since this operation',
          color: 'orange',
        });
      }
    } catch {
      notifications.show({
        title: 'Undo failed',
        message: 'An error occurred while undoing this operation',
        color: 'red',
      });
    }
    setConfirmUndo(false);
  };

  return (
    <Stack gap={0}>
      <UnstyledButton
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: '10px 12px',
          borderRadius: 'var(--mantine-radius-sm)',
          opacity: isExpired && group.status === 'applied' ? 0.5 : 1,
        }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Group gap="xs" wrap="nowrap">
            {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
            <div>
              <Text size="sm" fw={500} lineClamp={1}>
                {group.description}
              </Text>
              <Text size="xs" c="dimmed">
                {group.user.name} &middot; {relativeTime(group.created_at)}
                {routerCount > 1 && ` · ${routerCount} routers`}
              </Text>
            </div>
          </Group>
          <Group gap="xs" wrap="nowrap">
            <Badge size="sm" color={statusColor[group.status] ?? 'gray'}>
              {group.status}
            </Badge>
            {isExpired && group.status === 'applied' && (
              <Badge size="sm" color="gray" variant="outline">
                Expired
              </Badge>
            )}
          </Group>
        </Group>
      </UnstyledButton>

      <Collapse expanded={expanded}>
        <Stack gap="xs" pl={28} pr={12} pb={8}>
          {group.operations.map((op) => (
            <Group key={op.id} gap="xs">
              <Badge size="xs" color={opTypeColor[op.operation_type] ?? 'gray'}>
                {op.operation_type}
              </Badge>
              <Text size="xs" c="dimmed">
                {op.module} &middot; {op.resource_path}
                {op.resource_id && ` / ${op.resource_id}`}
              </Text>
              {op.error && (
                <Text size="xs" c="red">
                  {op.error}
                </Text>
              )}
            </Group>
          ))}

          {group.can_undo && !confirmUndo && (
            <Button
              size="xs"
              variant="light"
              color="orange"
              leftSection={<IconArrowBackUp size={14} />}
              onClick={() => setConfirmUndo(true)}
            >
              Undo
            </Button>
          )}

          {confirmUndo && (
            <Alert
              color="orange"
              icon={<IconAlertCircle size={16} />}
              title={`Undo "${group.description}"?`}
            >
              <Text size="xs" mb="xs">
                This will reverse {group.operations.length} operation
                {group.operations.length > 1 ? 's' : ''}
                {routerCount > 1 && ` across ${routerCount} routers`}.
              </Text>
              <Group gap="xs">
                <Button
                  size="xs"
                  color="orange"
                  loading={undoMutation.isPending}
                  onClick={handleUndo}
                >
                  Confirm undo
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  onClick={() => setConfirmUndo(false)}
                >
                  Cancel
                </Button>
              </Group>
            </Alert>
          )}
        </Stack>
      </Collapse>
    </Stack>
  );
}

export default function UndoHistoryPanel({ isOpen, onClose }: UndoHistoryPanelProps) {
  const selectedClusterId = useClusterStore((s) => s.selectedClusterId);
  const { data, isLoading } = useOperationHistory(selectedClusterId, 1, 50);

  return (
    <Drawer
      opened={isOpen}
      onClose={onClose}
      title="Operation History"
      position="right"
      size="md"
    >
      <Stack gap="xs">
        {isLoading && (
          <Text size="sm" c="dimmed">
            Loading history...
          </Text>
        )}

        {!isLoading && (!data?.groups || data.groups.length === 0) && (
          <Text size="sm" c="dimmed" ta="center" py="xl">
            No operations recorded yet.
          </Text>
        )}

        {data?.groups?.map((group, i) => (
          <div key={group.id}>
            {i > 0 && <Divider />}
            <GroupEntry group={group} />
          </div>
        ))}
      </Stack>
    </Drawer>
  );
}
