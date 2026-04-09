import { Combobox, InputBase, useCombobox, Group, Text, Box, Badge } from '@mantine/core';
import { IconSelector } from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useClusters } from '../../features/routers/clustersApi';
import { configurePath } from '../../features/configure/moduleConfig';
import { useClusterStore } from '../../stores/useClusterStore';
import type { ClusterResponse } from '../../api/types';

function ClusterOption({ cluster }: { cluster: ClusterResponse }) {
  const allReachable = cluster.routers.every((r) => r.is_reachable);
  const someReachable = cluster.routers.some((r) => r.is_reachable);

  return (
    <Group gap={8} wrap="nowrap" align="center">
      <Box
        w={7}
        h={7}
        style={{ borderRadius: '50%', flexShrink: 0 }}
        bg={allReachable ? 'green.7' : someReachable ? 'orange.7' : 'red.7'}
      />
      <div>
        <Group gap={6} wrap="nowrap">
          <Text size="xs" fw={600}>
            {cluster.name}
          </Text>
          <Badge variant="light" size="xs" radius="sm" color={cluster.mode === 'ha' ? 'blue' : 'gray'}>
            {cluster.mode === 'ha' ? 'HA' : 'Standalone'}
          </Badge>
        </Group>
        <Text size="xs" c="dimmed">
          {cluster.routers.length} {cluster.routers.length === 1 ? 'node' : 'nodes'}
        </Text>
      </div>
    </Group>
  );
}

export default function ClusterSelector() {
  const { data: clusters, isLoading } = useClusters();
  const selectedClusterId = useClusterStore((s) => s.selectedClusterId);
  const selectCluster = useClusterStore((s) => s.selectCluster);
  const navigate = useNavigate();
  const location = useLocation();

  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const selectedCluster = clusters?.find((c) => c.id === selectedClusterId);

  // Other clusters (not the currently selected one)
  const otherClusters = (clusters ?? []).filter((c) => c.id !== selectedClusterId);

  const allReachable = selectedCluster?.routers.every((r) => r.is_reachable) ?? false;
  const someReachable = selectedCluster?.routers.some((r) => r.is_reachable) ?? false;

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={(val) => {
        if (val === '__all_routers__') {
          navigate('/routers');
        } else {
          selectCluster(val);
          if (location.pathname.startsWith('/configure/')) {
            const subPath = location.pathname.split('/').slice(3).join('/');
            navigate(configurePath(val, subPath || undefined));
          }
        }
        combobox.closeDropdown();
      }}
    >
      <Combobox.Target>
        <InputBase
          component="button"
          type="button"
          pointer
          radius="sm"
          w={220}
          onClick={() => combobox.toggleDropdown()}
          rightSectionPointerEvents="none"
          rightSection={<IconSelector size={14} color="var(--mantine-color-dark-2)" />}
          leftSection={
            selectedCluster ? (
              <Box
                w={7}
                h={7}
                style={{ borderRadius: '50%', flexShrink: 0 }}
                bg={allReachable ? 'green.4' : someReachable ? 'orange.4' : 'red.4'}
              />
            ) : undefined
          }
          styles={{
            input: {
              backgroundColor: 'var(--mantine-color-dark-6)',
              borderColor: 'var(--mantine-color-dark-4)',
              color: '#ffffff',
              height: 'auto',
              minHeight: 32,
              paddingTop: 4,
              paddingBottom: 4,
            },
          }}
        >
          {selectedCluster ? (
            <div style={{ lineHeight: 1.3 }}>
              <Text size="xs" fw={600} c="white" truncate>
                {selectedCluster.name}
              </Text>
              <Text size="10px" c="dimmed" truncate>
                {selectedCluster.routers.length} {selectedCluster.routers.length === 1 ? 'node' : 'nodes'}
                {selectedCluster.mode === 'ha' ? ' (HA)' : ''}
              </Text>
            </div>
          ) : (
            <Text size="xs" c="dimmed">
              {isLoading ? 'Loading...' : 'Select cluster'}
            </Text>
          )}
        </InputBase>
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options>
          {otherClusters.map((cluster) => (
            <Combobox.Option
              key={cluster.id}
              value={cluster.id}
              style={{ padding: '6px 10px' }}
            >
              <ClusterOption cluster={cluster} />
            </Combobox.Option>
          ))}
          {otherClusters.length > 0 && <Combobox.Option value="" disabled style={{ padding: 0, borderTop: '1px solid var(--mantine-color-gray-3)', minHeight: 0 }} />}
          <Combobox.Option value="__all_routers__" style={{ padding: '6px 10px' }}>
            <Group gap={8} wrap="nowrap" align="center">
              <Box w={7} style={{ flexShrink: 0 }} />
              <div>
                <Text size="xs" fw={600}>All clusters</Text>
                <Text size="xs" c="dimmed">Browse & manage</Text>
              </div>
            </Group>
          </Combobox.Option>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
