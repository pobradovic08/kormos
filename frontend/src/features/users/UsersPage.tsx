import { useState } from 'react';
import {
  Title,
  Button,
  Group,
  Table,
  Badge,
  ActionIcon,
  Text,
  Skeleton,
  Stack,
  Tooltip,
  Modal,
  TextInput,
  PasswordInput,
  Select,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconUsers,
} from '@tabler/icons-react';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from './usersApi';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import EmptyState from '../../components/common/EmptyState';
import ErrorBanner from '../../components/common/ErrorBanner';
import type { User } from '../../api/types';

const roleOptions = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'operator', label: 'Operator' },
  { value: 'viewer', label: 'Viewer' },
];

const roleBadgeColor: Record<string, string> = {
  owner: 'red',
  admin: 'orange',
  operator: 'blue',
  viewer: 'gray',
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  return date.toLocaleString();
}

interface InviteFormValues {
  email: string;
  name: string;
  password: string;
  role: string;
}

interface EditFormValues {
  name: string;
  role: string;
}

export default function UsersPage() {
  const { data: users, isLoading, error, refetch } = useUsers();
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();

  const [inviteOpened, setInviteOpened] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const inviteForm = useForm<InviteFormValues>({
    mode: 'uncontrolled',
    initialValues: {
      email: '',
      name: '',
      password: '',
      role: 'viewer',
    },
    validate: {
      email: (value) => {
        if (value.trim().length === 0) return 'Email is required';
        if (!value.includes('@')) return 'Invalid email address';
        return null;
      },
      name: (value) => (value.trim().length === 0 ? 'Name is required' : null),
      password: (value) =>
        value.trim().length < 8 ? 'Password must be at least 8 characters' : null,
      role: (value) => (value ? null : 'Role is required'),
    },
  });

  const editForm = useForm<EditFormValues>({
    mode: 'uncontrolled',
    initialValues: {
      name: '',
      role: 'viewer',
    },
    validate: {
      name: (value) => (value.trim().length === 0 ? 'Name is required' : null),
      role: (value) => (value ? null : 'Role is required'),
    },
  });

  const handleInviteOpen = () => {
    inviteForm.reset();
    setInviteOpened(true);
  };

  const handleInviteSubmit = (values: InviteFormValues) => {
    createMutation.mutate(values, {
      onSuccess: () => {
        notifications.show({
          title: 'User invited',
          message: `User "${values.name}" has been created successfully.`,
          color: 'green',
        });
        inviteForm.reset();
        setInviteOpened(false);
      },
      onError: (err) => {
        notifications.show({
          title: 'Error',
          message: err instanceof Error ? err.message : 'Failed to create user',
          color: 'red',
        });
      },
    });
  };

  const handleEditOpen = (user: User) => {
    editForm.setValues({ name: user.name, role: user.role });
    setEditingUser(user);
  };

  const handleEditSubmit = (values: EditFormValues) => {
    if (!editingUser) return;

    updateMutation.mutate(
      { id: editingUser.id, name: values.name, role: values.role },
      {
        onSuccess: () => {
          notifications.show({
            title: 'User updated',
            message: `User "${values.name}" has been updated successfully.`,
            color: 'green',
          });
          setEditingUser(null);
        },
        onError: (err) => {
          notifications.show({
            title: 'Error',
            message: err instanceof Error ? err.message : 'Failed to update user',
            color: 'red',
          });
        },
      },
    );
  };

  const handleDeleteClick = (user: User) => {
    setDeletingUser(user);
  };

  const handleDeleteConfirm = () => {
    if (!deletingUser) return;

    deleteMutation.mutate(deletingUser.id, {
      onSuccess: () => {
        notifications.show({
          title: 'User deleted',
          message: `User "${deletingUser.name}" has been deleted.`,
          color: 'green',
        });
        setDeletingUser(null);
      },
      onError: (err) => {
        notifications.show({
          title: 'Error',
          message: err instanceof Error ? err.message : 'Failed to delete user',
          color: 'red',
        });
      },
    });
  };

  if (isLoading) {
    return (
      <>
        <Group justify="space-between" mb="md">
          <Title order={2} mb="lg">Users</Title>
        </Group>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Last Login</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <Table.Tr key={i}>
                {Array.from({ length: 6 }).map((_, j) => (
                  <Table.Td key={j}>
                    <Skeleton height="36px" radius="sm" />
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </>
    );
  }

  if (error) {
    return (
      <ErrorBanner
        message="Failed to load users. Please try again later."
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <>
      <Group justify="space-between" mb="md">
        <Title order={2} mb="lg">Users</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={handleInviteOpen}>
          Invite User
        </Button>
      </Group>

      {users && users.length > 0 ? (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Last Login</Table.Th>
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {users.map((user) => (
              <Table.Tr key={user.id}>
                <Table.Td>{user.name}</Table.Td>
                <Table.Td>
                  <Text size="sm">{user.email}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={roleBadgeColor[user.role] ?? 'gray'}
                    variant="filled"
                    size="sm"
                  >
                    {user.role}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge
                    color={user.is_active ? 'green' : 'red'}
                    variant="light"
                    size="sm"
                  >
                    {user.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {formatDate(user.last_login)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Tooltip label="Edit">
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        onClick={() => handleEditOpen(user)}
                        size="sm"
                      >
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Delete">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => handleDeleteClick(user)}
                        size="sm"
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <EmptyState
          icon={IconUsers}
          title="No users found"
          description='Click "Invite User" to add a team member.'
        />
      )}

      {/* Invite User Modal */}
      <Modal
        opened={inviteOpened}
        onClose={() => setInviteOpened(false)}
        title="Invite User"
        size="md"
      >
        <form onSubmit={inviteForm.onSubmit(handleInviteSubmit)}>
          <Stack gap="sm">
            <TextInput
              label="Email"
              placeholder="user@example.com"
              withAsterisk
              key={inviteForm.key('email')}
              {...inviteForm.getInputProps('email')}
            />
            <TextInput
              label="Name"
              placeholder="John Doe"
              withAsterisk
              key={inviteForm.key('name')}
              {...inviteForm.getInputProps('name')}
            />
            <PasswordInput
              label="Password"
              placeholder="Minimum 8 characters"
              withAsterisk
              key={inviteForm.key('password')}
              {...inviteForm.getInputProps('password')}
            />
            <Select
              label="Role"
              data={roleOptions}
              withAsterisk
              key={inviteForm.key('role')}
              {...inviteForm.getInputProps('role')}
            />
            <Group justify="flex-end" mt="md">
              <Button
                variant="default"
                onClick={() => setInviteOpened(false)}
                disabled={createMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                Invite
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        opened={!!editingUser}
        onClose={() => setEditingUser(null)}
        title="Edit User"
        size="md"
      >
        <form onSubmit={editForm.onSubmit(handleEditSubmit)}>
          <Stack gap="sm">
            <TextInput
              label="Name"
              withAsterisk
              key={editForm.key('name')}
              {...editForm.getInputProps('name')}
            />
            <Select
              label="Role"
              data={roleOptions}
              withAsterisk
              key={editForm.key('role')}
              {...editForm.getInputProps('role')}
            />
            <Group justify="flex-end" mt="md">
              <Button
                variant="default"
                onClick={() => setEditingUser(null)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" loading={updateMutation.isPending}>
                Save
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete User"
        message={
          deletingUser
            ? `Are you sure you want to delete user "${deletingUser.name}" (${deletingUser.email})? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        confirmColor="red"
      />
    </>
  );
}
