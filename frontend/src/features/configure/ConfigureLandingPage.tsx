import { useNavigate } from 'react-router-dom';
import {
  Title,
  Text,
  SimpleGrid,
  Card,
  Group,
  Stack,
  ThemeIcon,
  Tooltip,
  Box,
  Button,
} from '@mantine/core';
import { IconHeadset } from '@tabler/icons-react';
import { modules } from './moduleConfig';

export default function ConfigureLandingPage() {
  const navigate = useNavigate();

  return (
    <Stack gap="lg">
      <Title order={2}>Configure</Title>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }}>
        {modules.map((mod) => {
          const Icon = mod.icon;

          if (!mod.isEnabled) {
            return (
              <Tooltip key={mod.title} label="Coming soon" position="top">
                <Card
                  shadow="xs"
                  padding="lg"
                  radius="md"
                  withBorder
                  style={{ opacity: 0.5, cursor: 'default' }}
                >
                  <Group gap="md" wrap="nowrap">
                    <ThemeIcon size={48} radius="md" variant="light" color="blue">
                      <Icon size={32} />
                    </ThemeIcon>
                    <Stack gap={4}>
                      <Text fw={700} size="sm">
                        {mod.title}
                      </Text>
                      <Text c="dimmed" size="xs">
                        {mod.subtitle}
                      </Text>
                    </Stack>
                  </Group>
                </Card>
              </Tooltip>
            );
          }

          return (
            <Card
              key={mod.title}
              shadow="xs"
              padding="lg"
              radius="md"
              withBorder
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(mod.route)}
            >
              <Group gap="md" wrap="nowrap">
                <ThemeIcon size={48} radius="md" variant="light" color="blue">
                  <Icon size={32} />
                </ThemeIcon>
                <Stack gap={4}>
                  <Text fw={700} size="sm">
                    {mod.title}
                  </Text>
                  <Text c="dimmed" size="xs">
                    {mod.subtitle}
                  </Text>
                </Stack>
              </Group>
            </Card>
          );
        })}
      </SimpleGrid>

      <Box
        py="sm"
        px="md"
        style={(theme) => ({
          borderRadius: theme.radius.md,
          backgroundColor: 'var(--mantine-color-gray-0)',
          borderTop: '1px solid var(--mantine-color-gray-2)',
        })}
      >
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            Feature missing? You can make a feature request, or ask for full access to the router.
          </Text>
          <Button
            variant="subtle"
            color="orange"
            size="compact-sm"
            leftSection={<IconHeadset size={16} />}
          >
            Support
          </Button>
        </Group>
      </Box>
    </Stack>
  );
}
