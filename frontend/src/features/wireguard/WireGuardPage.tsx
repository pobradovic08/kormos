import { useState, useEffect, useRef } from 'react';
import {
  Title,
  Group,
  Text,
  Skeleton,
  Stack,
  Tabs,
} from '@mantine/core';
import { IconRouter } from '@tabler/icons-react';
import { useRouterStore } from '../../stores/useRouterStore';
import { useWireGuardInterfaces } from './wireguardApi';
import ErrorBanner from '../../components/common/ErrorBanner';
import WireGuardInterfaceTab from './WireGuardInterface';
import WireGuardPeers from './WireGuardPeers';

export default function WireGuardPage() {
  const selectedRouterId = useRouterStore((s) => s.selectedRouterId);
  const { isLoading, error, refetch } = useWireGuardInterfaces(selectedRouterId);

  const [activeTab, setActiveTab] = useState<string | null>('interface');

  const prevRouterId = useRef(selectedRouterId);
  useEffect(() => {
    if (prevRouterId.current !== selectedRouterId) {
      setActiveTab('interface');
      prevRouterId.current = selectedRouterId;
    }
  }, [selectedRouterId]);

  if (!selectedRouterId) {
    return (
      <Stack align="center" mt="xl" gap="md">
        <IconRouter size={48} stroke={1.5} color="var(--mantine-color-dimmed)" />
        <Text c="dimmed" size="lg">Select a router to view WireGuard configuration</Text>
      </Stack>
    );
  }

  if (isLoading) {
    return (
      <>
        <Group justify="space-between" align="flex-start" mb="lg">
          <Stack gap={4}>
            <Title order={2}>WireGuard</Title>
            <Text size="sm" c="dimmed">Remote access VPN configuration</Text>
          </Stack>
        </Group>
        <Skeleton height={36} radius="sm" mb="md" />
        <Skeleton height={200} radius="sm" />
      </>
    );
  }

  if (error) {
    return (
      <ErrorBanner
        message="Failed to load WireGuard configuration. Please try again later."
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <>
      <Group justify="space-between" align="flex-start" mb="lg">
        <Stack gap={4}>
          <Title order={2}>WireGuard</Title>
          <Text size="sm" c="dimmed">Remote access VPN configuration</Text>
        </Stack>
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="interface">WireGuard</Tabs.Tab>
          <Tabs.Tab value="peers">Peers</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="interface">
          <WireGuardInterfaceTab routerId={selectedRouterId} />
        </Tabs.Panel>

        <Tabs.Panel value="peers">
          <WireGuardPeers routerId={selectedRouterId} />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
