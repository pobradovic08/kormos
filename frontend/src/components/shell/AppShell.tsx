import { useState } from 'react';
import {
  AppShell,
  Group,
  Text,
  Menu,
  UnstyledButton,
  Divider,
} from '@mantine/core';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { IconChevronDown } from '@tabler/icons-react';
import CommitPanel from '../commit/CommitPanel';
import RouterSelector from './RouterSelector';
import CommitButton from './CommitButton';
import UserMenu from './UserMenu';
import { modules, configurePath } from '../../features/configure/moduleConfig';
import { usePortalStore } from '../../stores/usePortalStore';
import { useRouterStore } from '../../stores/useRouterStore';

const simpleNavLinks = [
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Routers', to: '/routers' },
  { label: 'Audit Log', to: '/audit-log' },
  { label: 'Settings', to: '/settings' },
];

function NavLink({
  to,
  isActive,
  children,
  onClick,
  rightSection,
}: {
  to?: string;
  isActive: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  rightSection?: React.ReactNode;
}) {
  const Component = to ? Link : 'button';
  const linkProps = to ? { to } : {};

  return (
    <UnstyledButton
      component={Component as any}
      {...linkProps}
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: 'var(--mantine-radius-sm)',
        color: isActive ? '#ffffff' : 'var(--mantine-color-dark-1)',
        backgroundColor: isActive ? 'var(--mantine-color-dark-5)' : 'transparent',
        fontSize: 'var(--mantine-font-size-sm)',
        fontWeight: isActive ? 600 : 500,
        textDecoration: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        transition: 'background-color 150ms ease, color 150ms ease',
        border: 'none',
        cursor: 'pointer',
      }}
      onMouseEnter={(e: React.MouseEvent<HTMLElement>) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'var(--mantine-color-dark-5)';
          e.currentTarget.style.color = '#ffffff';
        }
      }}
      onMouseLeave={(e: React.MouseEvent<HTMLElement>) => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = 'var(--mantine-color-dark-1)';
        }
      }}
    >
      {children}
      {rightSection}
    </UnstyledButton>
  );
}

export default function AppShellLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [commitPanelOpen, setCommitPanelOpen] = useState(false);
  const portalName = usePortalStore((s) => s.portalName) || 'Kormos';

  const isConfigureActive = location.pathname.startsWith('/configure');

  const selectedRouterId = useRouterStore((s) => s.selectedRouterId);

  // Extract clusterId from URL if on a configure page, else fall back to store
  const configureClusterId = isConfigureActive
    ? location.pathname.split('/')[2] ?? selectedRouterId
    : selectedRouterId;

  return (
    <AppShell
      header={{ height: 56 }}
      padding="md"
    >
      <AppShell.Header
        style={{
          backgroundColor: 'var(--mantine-color-dark-7)',
          borderBottom: '1px solid var(--mantine-color-dark-5)',
        }}
      >
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          {/* Left side: Logo + Nav links */}
          <Group gap="lg" wrap="nowrap">
            <Text
              fw={700}
              size="lg"
              component={Link}
              to="/dashboard"
              style={{
                textDecoration: 'none',
                color: '#ffffff',
                letterSpacing: '-0.02em',
                whiteSpace: 'nowrap',
                textTransform: 'uppercase',
              }}
            >
              {portalName}
            </Text>

            <Divider
              orientation="vertical"
              color="dark.5"
              style={{ height: 24, alignSelf: 'center' }}
            />

            <Group gap={4} wrap="nowrap">
              <NavLink
                to="/dashboard"
                isActive={location.pathname.startsWith('/dashboard')}
              >
                Dashboard
              </NavLink>

              <Menu trigger="hover" openDelay={100} closeDelay={200}>
                <Menu.Target>
                  <div>
                    <NavLink
                      isActive={isConfigureActive}
                      onClick={() => {
                        if (configureClusterId) {
                          navigate(configurePath(configureClusterId));
                        } else {
                          navigate('/routers');
                        }
                      }}
                      rightSection={
                        <IconChevronDown
                          size={14}
                          style={{ opacity: 0.7 }}
                        />
                      }
                    >
                      Configure
                    </NavLink>
                  </div>
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
                          if (mod.isEnabled) {
                            if (configureClusterId) {
                              navigate(configurePath(configureClusterId, mod.route));
                            } else {
                              navigate('/routers');
                            }
                          }
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
                  <NavLink
                    key={link.to}
                    to={link.to}
                    isActive={location.pathname.startsWith(link.to)}
                  >
                    {link.label}
                  </NavLink>
                ))}
            </Group>
          </Group>

          {/* Right side: RouterSelector, CommitButton, UserMenu */}
          <Group gap="sm" wrap="nowrap">
            <RouterSelector />

            <Divider
              orientation="vertical"
              color="dark.5"
              style={{ height: 24, alignSelf: 'center' }}
            />

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
