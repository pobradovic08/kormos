import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Text,
  SimpleGrid,
  Paper,
  Stack,
  Group,
  ThemeIcon,
  UnstyledButton,
} from '@mantine/core';
import {
  IconRouter,
  IconWifi,
  IconHistory,
  IconPlus,
  IconNetwork,
  IconFileText,
  IconArrowRight,
} from '@tabler/icons-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useRouterStore } from '../../stores/useRouterStore';
import { useOperationHistory } from '../../api/operationsApi';
import { configurePath } from '../configure/moduleConfig';
import { useRouters } from '../routers/routersApi';
import { useAuditLog } from '../audit/auditApi';

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const selectedRouterId = useRouterStore((s) => s.selectedRouterId);
  const { data: opHistory } = useOperationHistory(selectedRouterId, 1, 50);

  const { data: routers, isLoading: routersLoading } = useRouters();

  const twentyFourHoursAgo = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() - 24);
    return d.toISOString().split('T')[0];
  }, []);

  const { data: recentAudit, isLoading: auditLoading } = useAuditLog({
    from: twentyFourHoursAgo,
    perPage: 1,
  });

  const routerCount = routers?.length ?? null;
  const onlineCount = routers?.filter((r) => r.is_reachable).length ?? null;

  const undoableCount = useMemo(() => {
    return opHistory?.groups.filter((g) => g.can_undo).length ?? 0;
  }, [opHistory]);

  const recentChangeCount = recentAudit?.total ?? null;

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <Stack gap="xl">
      {/* Welcome section */}
      <div>
        <Text fw={600} size="lg">
          {getGreeting()}, {firstName}
        </Text>
        <Text c="dimmed" size="sm" mt={2}>
          Manage your MikroTik CHR fleet from here.
        </Text>
      </div>

      {/* Stats row */}
      <SimpleGrid cols={{ base: 2, sm: 4 }}>
        <Paper
          withBorder
          p="md"
          radius="md"
          style={{ borderLeftWidth: 3, borderLeftColor: 'var(--mantine-color-blue-6)' }}
        >
          <Group gap="md" wrap="nowrap">
            <ThemeIcon size={40} radius="md" variant="light" color="blue">
              <IconRouter size={22} />
            </ThemeIcon>
            <div>
              <Text fw={700} size="xl" lh={1}>
                {routersLoading ? '--' : routerCount}
              </Text>
              <Text c="dimmed" size="xs" mt={4}>
                Routers
              </Text>
            </div>
          </Group>
        </Paper>

        <Paper
          withBorder
          p="md"
          radius="md"
          style={{ borderLeftWidth: 3, borderLeftColor: 'var(--mantine-color-green-6)' }}
        >
          <Group gap="md" wrap="nowrap">
            <ThemeIcon size={40} radius="md" variant="light" color="green">
              <IconWifi size={22} />
            </ThemeIcon>
            <div>
              <Text fw={700} size="xl" lh={1}>
                {routersLoading ? '--' : onlineCount}
              </Text>
              <Text c="dimmed" size="xs" mt={4}>
                Online
              </Text>
            </div>
          </Group>
        </Paper>

        <Paper
          withBorder
          p="md"
          radius="md"
          style={{
            borderLeftWidth: 3,
            borderLeftColor:
              undoableCount > 0
                ? 'var(--mantine-color-orange-6)'
                : 'var(--mantine-color-gray-4)',
          }}
        >
          <Group gap="md" wrap="nowrap">
            <ThemeIcon
              size={40}
              radius="md"
              variant="light"
              color={undoableCount > 0 ? 'orange' : 'gray'}
            >
              <IconHistory size={22} />
            </ThemeIcon>
            <div>
              <Text fw={700} size="xl" lh={1}>
                {undoableCount}
              </Text>
              <Text c="dimmed" size="xs" mt={4}>
                Undoable
              </Text>
            </div>
          </Group>
        </Paper>

        <Paper
          withBorder
          p="md"
          radius="md"
          style={{ borderLeftWidth: 3, borderLeftColor: 'var(--mantine-color-violet-6)' }}
        >
          <Group gap="md" wrap="nowrap">
            <ThemeIcon size={40} radius="md" variant="light" color="violet">
              <IconHistory size={22} />
            </ThemeIcon>
            <div>
              <Text fw={700} size="xl" lh={1}>
                {auditLoading ? '--' : recentChangeCount}
              </Text>
              <Text c="dimmed" size="xs" mt={4}>
                Recent Changes
              </Text>
            </div>
          </Group>
        </Paper>
      </SimpleGrid>

      {/* Quick Actions */}
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <UnstyledButton onClick={() => navigate('/routers')}>
          <Paper
            withBorder
            p="lg"
            radius="md"
            className="hover-card"
          >
            <Group gap="md" wrap="nowrap">
              <ThemeIcon size={44} radius="md" variant="light" color="blue">
                <IconPlus size={22} />
              </ThemeIcon>
              <Stack gap={2} style={{ flex: 1 }}>
                <Group gap="xs" justify="space-between">
                  <Text fw={600} size="sm">
                    Add Router
                  </Text>
                  <IconArrowRight size={14} color="var(--mantine-color-dimmed)" />
                </Group>
                <Text c="dimmed" size="xs">
                  Register a new MikroTik CHR device
                </Text>
              </Stack>
            </Group>
          </Paper>
        </UnstyledButton>

        <UnstyledButton onClick={() => {
          if (selectedRouterId) {
            navigate(configurePath(selectedRouterId, 'interfaces'));
          } else {
            navigate('/routers');
          }
        }}>
          <Paper
            withBorder
            p="lg"
            radius="md"
            className="hover-card"
          >
            <Group gap="md" wrap="nowrap">
              <ThemeIcon size={44} radius="md" variant="light" color="teal">
                <IconNetwork size={22} />
              </ThemeIcon>
              <Stack gap={2} style={{ flex: 1 }}>
                <Group gap="xs" justify="space-between">
                  <Text fw={600} size="sm">
                    Configure Interfaces
                  </Text>
                  <IconArrowRight size={14} color="var(--mantine-color-dimmed)" />
                </Group>
                <Text c="dimmed" size="xs">
                  Manage addresses and interface settings
                </Text>
              </Stack>
            </Group>
          </Paper>
        </UnstyledButton>

        <UnstyledButton onClick={() => navigate('/audit-log')}>
          <Paper
            withBorder
            p="lg"
            radius="md"
            className="hover-card"
          >
            <Group gap="md" wrap="nowrap">
              <ThemeIcon size={44} radius="md" variant="light" color="grape">
                <IconFileText size={22} />
              </ThemeIcon>
              <Stack gap={2} style={{ flex: 1 }}>
                <Group gap="xs" justify="space-between">
                  <Text fw={600} size="sm">
                    View Audit Log
                  </Text>
                  <IconArrowRight size={14} color="var(--mantine-color-dimmed)" />
                </Group>
                <Text c="dimmed" size="xs">
                  Review configuration change history
                </Text>
              </Stack>
            </Group>
          </Paper>
        </UnstyledButton>
      </SimpleGrid>
    </Stack>
  );
}
