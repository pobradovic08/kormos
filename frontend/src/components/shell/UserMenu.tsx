import { Avatar, Menu } from '@mantine/core';
import {
  IconUser,
  IconSettings,
  IconLogout,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import { usePermissions } from '../../hooks/usePermissions';
import apiClient from '../../api/client';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const { canManageTenant, canManageUsers } = usePermissions();

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore errors — we clear local state regardless.
    }
    clearAuth();
    navigate('/login');
  };

  if (!user) return null;

  const initials = getInitials(user.name);

  return (
    <Menu shadow="md" width={200} position="bottom-end">
      <Menu.Target>
        <Avatar
          radius="xl"
          size="sm"
          color="blue"
          style={{
            cursor: 'pointer',
            border: '2px solid var(--mantine-color-dark-3)',
            transition: 'border-color 150ms ease',
          }}
          onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
            e.currentTarget.style.borderColor = 'var(--mantine-color-blue-5)';
          }}
          onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
            e.currentTarget.style.borderColor = 'var(--mantine-color-dark-3)';
          }}
        >
          {initials}
        </Avatar>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>{user.name}</Menu.Label>

        <Menu.Item
          leftSection={<IconUser size={14} />}
          disabled
        >
          Profile
        </Menu.Item>

        {(canManageTenant || canManageUsers) && (
          <Menu.Item
            leftSection={<IconSettings size={14} />}
            onClick={() => navigate('/settings')}
          >
            Tenant Settings
          </Menu.Item>
        )}

        <Menu.Divider />

        <Menu.Item
          color="red"
          leftSection={<IconLogout size={14} />}
          onClick={() => void handleLogout()}
        >
          Logout
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
