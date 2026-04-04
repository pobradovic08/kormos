import { useState } from 'react';
import { Button, Drawer, Group, Stack, Textarea, Text, Title, Divider } from '@mantine/core';
import ConfirmDialog from '../common/ConfirmDialog';
import { notifications } from '@mantine/notifications';
import apiClient from '../../api/client';
import type { CommitResponse, PendingChange } from '../../api/types';
import { useCommitStore } from '../../stores/useCommitStore';
import { useRouterStore } from '../../stores/useRouterStore';
import ChangeDiff from './ChangeDiff';
import ChangeList from './ChangeList';

interface CommitPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function mapChangeToOperation(change: PendingChange, index: number) {
  const methodMap: Record<string, string> = {
    add: 'PUT',
    modify: 'PATCH',
    delete: 'DELETE',
  };

  // For PATCH/DELETE, append the resource ID to the path
  const resourcePath =
    change.operation !== 'add' && change.resourceId
      ? `${change.resourcePath}/${change.resourceId}`
      : change.resourcePath;

  return {
    index,
    module: change.module,
    operation: change.operation,
    resource_path: resourcePath,
    method: methodMap[change.operation] ?? 'PATCH',
    body: change.after ?? {},
  };
}

export default function CommitPanel({ isOpen, onClose }: CommitPanelProps) {
  const [commitMessage, setCommitMessage] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  const selectedRouterId = useRouterStore((s) => s.selectedRouterId);
  const getChangesForRouter = useCommitStore((s) => s.getChangesForRouter);
  const discardChange = useCommitStore((s) => s.discardChange);
  const discardAll = useCommitStore((s) => s.discardAll);
  const clearCommitted = useCommitStore((s) => s.clearCommitted);

  const changes = selectedRouterId ? getChangesForRouter(selectedRouterId) : [];

  const handleDiscard = (changeId: string) => {
    if (selectedRouterId) {
      discardChange(selectedRouterId, changeId);
      if (expandedId === changeId) {
        setExpandedId(null);
      }
    }
  };

  const handleDiscardAll = () => {
    if (selectedRouterId) {
      discardAll(selectedRouterId);
      setExpandedId(null);
    }
  };

  const handleToggleExpand = (changeId: string) => {
    setExpandedId((prev) => (prev === changeId ? null : changeId));
  };

  const handleCommit = async () => {
    if (!selectedRouterId || changes.length === 0) return;

    setIsCommitting(true);
    try {
      const response = await apiClient.post<CommitResponse>(
        `/routers/${selectedRouterId}/configure`,
        {
          operations: changes.map((c, i) => mapChangeToOperation(c, i)),
          commit_message: commitMessage || undefined,
        },
      );

      const data = response.data;

      if (data.status === 'success') {
        clearCommitted(
          selectedRouterId,
          changes.map((c) => c.id),
        );
        notifications.show({
          title: 'Commit successful',
          message: `All ${changes.length} operations applied successfully.`,
          color: 'green',
        });
        setCommitMessage('');
        setExpandedId(null);
        onClose();
      } else if (data.status === 'partial') {
        const succeededIndexes = data.results
          .filter((r) => r.status === 'success')
          .map((r) => r.index);
        const succeededIds = succeededIndexes.map((i) => changes[i].id);
        clearCommitted(selectedRouterId, succeededIds);

        const failedCount = data.results.filter(
          (r) => r.status === 'failure',
        ).length;
        const failedErrors = data.results
          .filter((r) => r.status === 'failure')
          .map((r) => r.error ?? 'Unknown error')
          .join('; ');

        notifications.show({
          title: 'Partial commit',
          message: `${succeededIndexes.length} succeeded, ${failedCount} failed: ${failedErrors}`,
          color: 'yellow',
          autoClose: false,
        });
      } else {
        notifications.show({
          title: 'Commit failed',
          message: 'All operations failed. Check the changes and try again.',
          color: 'red',
        });
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred.';
      notifications.show({
        title: 'Commit error',
        message,
        color: 'red',
      });
    } finally {
      setIsCommitting(false);
    }
  };

  const expandedChange = changes.find((c) => c.id === expandedId);

  return (
    <Drawer
      opened={isOpen}
      onClose={onClose}
      title={
        <Title order={4}>
          Review Changes
        </Title>
      }
      position="right"
      size="lg"
      padding="md"
    >
      <Stack h="calc(100vh - 120px)" justify="space-between">
        <Stack gap="md" style={{ overflow: 'auto', flex: 1 }}>
          <ChangeList
            changes={changes}
            onDiscard={handleDiscard}
            expandedId={expandedId}
            onToggleExpand={handleToggleExpand}
          />

          {expandedChange && (
            <>
              <Divider />
              <Text size="xs" fw={600} c="dimmed">
                Diff
              </Text>
              <ChangeDiff
                before={expandedChange.before}
                after={expandedChange.after}
                operation={expandedChange.operation}
              />
            </>
          )}
        </Stack>

        <Stack gap="sm">
          <Divider />
          <Textarea
            placeholder="Optional commit message..."
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.currentTarget.value)}
            minRows={2}
            maxRows={4}
            autosize
          />
          <Group justify="space-between">
            <Button
              color="red"
              variant="outline"
              onClick={() => setConfirmDiscardOpen(true)}
              disabled={changes.length === 0 || isCommitting}
            >
              Discard All
            </Button>
            <Button
              color="green"
              onClick={handleCommit}
              loading={isCommitting}
              disabled={changes.length === 0}
            >
              Commit
            </Button>
          </Group>
        </Stack>
      </Stack>

      <ConfirmDialog
        isOpen={confirmDiscardOpen}
        onClose={() => setConfirmDiscardOpen(false)}
        onConfirm={handleDiscardAll}
        title="Discard All Changes"
        message="Are you sure you want to discard all pending changes? This action cannot be undone."
        confirmLabel="Discard All"
        confirmColor="red"
      />
    </Drawer>
  );
}
