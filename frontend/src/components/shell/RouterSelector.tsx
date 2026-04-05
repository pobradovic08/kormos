import { Combobox, InputBase, useCombobox, Group, Text, Box } from '@mantine/core';
import { IconSelector } from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useRouters } from '../../features/routers/routersApi';
import { useRouterStore } from '../../stores/useRouterStore';
import type { Router } from '../../api/types';

function RouterOption({ router }: { router: Router }) {
  return (
    <Group gap={8} wrap="nowrap" align="center">
      <Box
        w={7}
        h={7}
        style={{ borderRadius: '50%', flexShrink: 0 }}
        bg={router.is_reachable ? 'green.7' : 'red.7'}
      />
      <div>
        <Text size="xs" fw={600}>
          {router.name}
        </Text>
        <Text size="xs" ff="monospace" c="dimmed">
          {router.host}:{router.port}
        </Text>
      </div>
    </Group>
  );
}

export default function RouterSelector() {
  const { data: routers, isLoading } = useRouters();
  const selectedRouterId = useRouterStore((s) => s.selectedRouterId);
  const selectRouter = useRouterStore((s) => s.selectRouter);
  const navigate = useNavigate();
  const location = useLocation();

  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const selectedRouter = routers?.find((r) => r.id === selectedRouterId);

  // Show only other routers from the same cluster
  const clusterPeers = selectedRouter?.cluster_id
    ? (routers ?? []).filter(
        (r) => r.cluster_id === selectedRouter.cluster_id && r.id !== selectedRouterId,
      )
    : [];

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={(val) => {
        if (val === '__all_routers__') {
          navigate('/routers');
        } else {
          selectRouter(val);
          // If on a configure page, navigate to same sub-page with new cluster ID
          if (location.pathname.startsWith('/configure/')) {
            const parts = location.pathname.split('/');
            // parts: ['', 'configure', oldClusterId, ...subPath]
            const subPath = parts.slice(3).join('/');
            navigate(`/configure/${val}/${subPath}`);
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
            selectedRouter ? (
              <Box
                w={7}
                h={7}
                style={{ borderRadius: '50%', flexShrink: 0 }}
                bg={selectedRouter.is_reachable ? 'green.4' : 'red.4'}
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
          {selectedRouter ? (
            <div style={{ lineHeight: 1.3 }}>
              <Text size="xs" fw={600} c="white" truncate>
                {selectedRouter.name}
              </Text>
              <Text size="10px" ff="monospace" c="dimmed" truncate>
                {selectedRouter.host}:{selectedRouter.port}
              </Text>
            </div>
          ) : (
            <Text size="xs" c="dimmed">
              {isLoading ? 'Loading...' : 'Select router'}
            </Text>
          )}
        </InputBase>
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options>
          {clusterPeers.map((router) => (
            <Combobox.Option
              key={router.id}
              value={router.id}
              style={{ padding: '6px 10px' }}
            >
              <RouterOption router={router} />
            </Combobox.Option>
          ))}
          {clusterPeers.length > 0 && <Combobox.Option value="" disabled style={{ padding: 0, borderTop: '1px solid var(--mantine-color-gray-3)', minHeight: 0 }} />}
          <Combobox.Option value="__all_routers__" style={{ padding: '6px 10px' }}>
            <Group gap={8} wrap="nowrap" align="center">
              <Box w={7} style={{ flexShrink: 0 }} />
              <div>
                <Text size="xs" fw={600}>All routers</Text>
                <Text size="xs" c="dimmed">Browse & manage</Text>
              </div>
            </Group>
          </Combobox.Option>
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
