import { useState } from 'react';
import { AppShell, Button, Group, Text, Menu } from '@mantine/core';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { IconChevronDown } from '@tabler/icons-react';
import CommitPanel from '../commit/CommitPanel';
import RouterSelector from './RouterSelector';
import CommitButton from './CommitButton';
import UserMenu from './UserMenu';
import { modules } from '../../features/configure/moduleConfig';

const simpleNavLinks = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Routers', to: '/routers' },
  { label: 'Audit Log', to: '/audit-log' },
  { label: 'Settings', to: '/settings' },
];

export default function AppShellLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [commitPanelOpen, setCommitPanelOpen] = useState(false);

  const isConfigureActive = location.pathname.startsWith('/configure');

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="lg">
            <Text
              fw={700}
              size="lg"
              component={Link}
              to="/dashboard"
              style={{ textDecoration: 'none', color: 'inherit' }}
            >
              Kormos
            </Text>

            <Group gap="xs">
              <Button
                component={Link}
                to="/dashboard"
                variant={
                  location.pathname.startsWith('/dashboard') ? 'light' : 'subtle'
                }
                size="compact-sm"
              >
                Dashboard
              </Button>

              <Menu trigger="hover" openDelay={100} closeDelay={200}>
                <Menu.Target>
                  <Button
                    variant={isConfigureActive ? 'light' : 'subtle'}
                    size="compact-sm"
                    rightSection={<IconChevronDown size={14} />}
                    onClick={() => navigate('/configure')}
                  >
                    Configure
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  {modules.map((mod) => {
                    const Icon = mod.icon;
                    return (
                      <Menu.Item
                        key={mod.title}
                        leftSection={<Icon size={16} />}
                        disabled={!mod.isEnabled}
                        onClick={() => {
                          if (mod.isEnabled) navigate(mod.route);
                        }}
                      >
                        {mod.title}
                        {!mod.isEnabled && (
                          <Text span c="dimmed" size="xs" ml="xs">
                            Coming soon
                          </Text>
                        )}
                      </Menu.Item>
                    );
                  })}
                </Menu.Dropdown>
              </Menu>

              {simpleNavLinks
                .filter((link) => link.label !== 'Dashboard')
                .map((link) => (
                  <Button
                    key={link.to}
                    component={Link}
                    to={link.to}
                    variant={
                      location.pathname.startsWith(link.to) ? 'light' : 'subtle'
                    }
                    size="compact-sm"
                  >
                    {link.label}
                  </Button>
                ))}
            </Group>
          </Group>

          <Group gap="sm">
            <RouterSelector />

            <CommitButton onClick={() => setCommitPanelOpen(true)} />

            <UserMenu />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>

      <CommitPanel
        isOpen={commitPanelOpen}
        onClose={() => setCommitPanelOpen(false)}
      />
    </AppShell>
  );
}
