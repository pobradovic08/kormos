import { useNavigate } from 'react-router-dom';
import { useClusterId } from '../../hooks/useClusterId';
import {
  Text,
  SimpleGrid,
  Card,
  Stack,
  ThemeIcon,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  UnstyledButton,
} from '@mantine/core';
import { IconHeadset } from '@tabler/icons-react';
import { modules, configurePath } from './moduleConfig';

export default function ConfigureLandingPage() {
  const navigate = useNavigate();
  const clusterId = useClusterId();

  return (
    <Stack gap="xl">
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        {modules.map((mod) => {
          const Icon = mod.icon;

          if (!mod.isEnabled) {
            return (
              <Card
                key={mod.title}
                padding="lg"
                radius="md"
                withBorder
                mih={120}
                style={{
                  opacity: 0.5,
                  cursor: 'not-allowed',
                  position: 'relative',
                }}
              >
                <Badge
                  size="xs"
                  variant="filled"
                  color="gray"
                  style={{ position: 'absolute', top: 12, right: 12 }}
                >
                  Coming soon
                </Badge>
                <Stack align="center" justify="center" gap="sm" h="100%">
                  <ThemeIcon size={40} radius="md" variant="light" color="blue">
                    <Icon size={24} />
                  </ThemeIcon>
                  <Stack gap={2} align="center">
                    <Text fw={700} size="sm">
                      {mod.title}
                    </Text>
                    <Text c="dimmed" size="xs" ta="center">
                      {mod.subtitle}
                    </Text>
                  </Stack>
                </Stack>
              </Card>
            );
          }

          return (
            <UnstyledButton
              key={mod.title}
              onClick={() => navigate(configurePath(clusterId, mod.route))}
              style={{ display: 'block' }}
            >
              <Card
                padding="lg"
                radius="md"
                withBorder
                mih={120}
                className="hover-card"
              >
                <Stack align="center" justify="center" gap="sm" h="100%">
                  <ThemeIcon size={40} radius="md" variant="light" color="blue">
                    <Icon size={24} />
                  </ThemeIcon>
                  <Stack gap={2} align="center">
                    <Text fw={700} size="sm">
                      {mod.title}
                    </Text>
                    <Text c="dimmed" size="xs" ta="center">
                      {mod.subtitle}
                    </Text>
                  </Stack>
                </Stack>
              </Card>
            </UnstyledButton>
          );
        })}
      </SimpleGrid>

      <Box>
        <Divider mb="sm" />
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            Feature missing? You can make a feature request, or ask for full access to the router.
          </Text>
          <Button
            variant="subtle"
            color="orange"
            size="compact-xs"
            leftSection={<IconHeadset size={14} />}
          >
            Support
          </Button>
        </Group>
      </Box>

    </Stack>
  );
}
