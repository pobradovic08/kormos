import { useNavigate } from 'react-router-dom';
import {
  Title,
  Text,
  SimpleGrid,
  Card,
  Stack,
  Group,
  ThemeIcon,
} from '@mantine/core';
import {
  IconSettings,
  IconRouter,
  IconFileText,
} from '@tabler/icons-react';
import { useAuthStore } from '../../stores/useAuthStore';

const quickLinks = [
  {
    title: 'Configure',
    description: 'Manage router interfaces, routes, and firewall rules',
    icon: IconSettings,
    route: '/configure',
  },
  {
    title: 'Routers',
    description: 'View and manage registered routers',
    icon: IconRouter,
    route: '/routers',
  },
  {
    title: 'Audit Log',
    description: 'Review configuration change history',
    icon: IconFileText,
    route: '/audit-log',
  },
];

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  return (
    <Stack gap="lg">
      <div>
        <Title order={2}>Welcome to Kormos</Title>
        {user && (
          <Text c="dimmed" mt={4}>
            Hello, {user.name}
          </Text>
        )}
      </div>

      <div>
        <Text fw={600} size="sm" mb="xs">
          Quick Links
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }}>
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Card
                key={link.title}
                shadow="xs"
                padding="lg"
                radius="md"
                withBorder
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(link.route)}
              >
                <Group gap="md" wrap="nowrap">
                  <ThemeIcon size={48} radius="md" variant="light" color="blue">
                    <Icon size={28} />
                  </ThemeIcon>
                  <Stack gap={4}>
                    <Text fw={700} size="sm">
                      {link.title}
                    </Text>
                    <Text c="dimmed" size="xs">
                      {link.description}
                    </Text>
                  </Stack>
                </Group>
              </Card>
            );
          })}
        </SimpleGrid>
      </div>

      <div>
        <Text fw={600} size="sm" mb="xs">
          Overview
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Card shadow="xs" padding="lg" radius="md" withBorder>
            <Text c="dimmed" size="xs" tt="uppercase" fw={600}>
              Registered Routers
            </Text>
            <Text fw={700} size="xl" mt="xs">
              --
            </Text>
          </Card>
          <Card shadow="xs" padding="lg" radius="md" withBorder>
            <Text c="dimmed" size="xs" tt="uppercase" fw={600}>
              Pending Changes
            </Text>
            <Text fw={700} size="xl" mt="xs">
              --
            </Text>
          </Card>
        </SimpleGrid>
      </div>
    </Stack>
  );
}
