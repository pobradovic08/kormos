import { useState, useEffect, useRef } from 'react';
import {
  Title,
  Group,
  Text,
  Skeleton,
  Stack,
  Tabs,
} from '@mantine/core';
import { useClusterId } from '../../hooks/useClusterId';
import { useWireGuardInterfaces } from './wireguardApi';
import ErrorBanner from '../../components/common/ErrorBanner';
import WireGuardInterfaceTab from './WireGuardInterface';
import WireGuardPeers from './WireGuardPeers';

export default function WireGuardPage() {
  const clusterId = useClusterId();
  const { isLoading, error, refetch } = useWireGuardInterfaces(clusterId);

  const [activeTab, setActiveTab] = useState<string | null>('interface');

  const prevClusterId = useRef(clusterId);
  useEffect(() => {
    if (prevClusterId.current !== clusterId) {
      setActiveTab('interface');
      prevClusterId.current = clusterId;
    }
  }, [clusterId]);

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
          <WireGuardInterfaceTab routerId={clusterId} />
        </Tabs.Panel>

        <Tabs.Panel value="peers">
          <WireGuardPeers routerId={clusterId} />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
