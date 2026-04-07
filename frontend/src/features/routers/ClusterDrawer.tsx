import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Drawer,
  Stepper,
  TextInput,
  NumberInput,
  PasswordInput,
  Button,
  Group,
  Stack,
  Switch,
  Alert,
  Badge,
  Paper,
  Text,
  Divider,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconCheck,
  IconX,
  IconServer,
  IconShieldCheck,
  IconTrash,
} from '@tabler/icons-react';
import {
  useCreateCluster,
  useUpdateCluster,
  useDeleteCluster,
  useTestConnection,
} from './clustersApi';
import type {
  ClusterResponse,
  TestConnectionResponse,
} from '../../api/types';

interface ClusterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cluster?: ClusterResponse | null;
}

interface RouterFields {
  name: string;
  hostname: string;
  host: string;
  port: number;
  username: string;
  password: string;
}

interface FormValues {
  clusterName: string;
  primary: RouterFields;
  secondary: RouterFields;
  enableHA: boolean;
}

function buildInitialValues(cluster?: ClusterResponse | null): FormValues {
  if (cluster) {
    const master = cluster.routers.find((r) => r.role === 'master');
    const backup = cluster.routers.find((r) => r.role === 'backup');
    return {
      clusterName: cluster.name,
      primary: {
        name: master?.name ?? '',
        hostname: master?.hostname ?? '',
        host: master?.host ?? '',
        port: master?.port ?? 443,
        username: '',
        password: '',
      },
      secondary: {
        name: backup?.name ?? '',
        hostname: backup?.hostname ?? '',
        host: backup?.host ?? '',
        port: backup?.port ?? 443,
        username: '',
        password: '',
      },
      enableHA: !!backup,
    };
  }
  return {
    clusterName: '',
    primary: { name: '', hostname: '', host: '', port: 443, username: '', password: '' },
    secondary: { name: '', hostname: '', host: '', port: 443, username: '', password: '' },
    enableHA: false,
  };
}

export default function ClusterDrawer({
  isOpen,
  onClose,
  cluster,
}: ClusterDrawerProps) {
  const isEditing = !!cluster;
  const [activeStep, setActiveStep] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Track whether user has manually edited router names
  const primaryNameEdited = useRef(false);
  const secondaryNameEdited = useRef(false);

  // Test connection state
  const [primaryTestResult, setPrimaryTestResult] = useState<TestConnectionResponse | null>(null);
  const [secondaryTestResult, setSecondaryTestResult] = useState<TestConnectionResponse | null>(null);

  const createMutation = useCreateCluster();
  const updateMutation = useUpdateCluster();
  const deleteMutation = useDeleteCluster();
  const testPrimaryConnection = useTestConnection();
  const testSecondaryConnection = useTestConnection();

  const form = useForm<FormValues>({
    mode: 'controlled',
    initialValues: buildInitialValues(cluster),
    validate: {
      clusterName: (value) =>
        value.trim().length === 0 ? 'Cluster name is required' : null,
      primary: {
        name: (value) =>
          value.trim().length === 0 ? 'Name is required' : null,
        hostname: (value) =>
          value.trim().length === 0 ? 'Hostname is required' : null,
        host: (value) =>
          value.trim().length === 0 ? 'Address is required' : null,
        port: (value) => {
          if (value < 1 || value > 65535) return 'Port must be between 1 and 65535';
          return null;
        },
        username: (value) =>
          value.trim().length === 0 ? 'Username is required' : null,
        password: (value, allValues) => {
          if (!isEditing && value.trim().length === 0) return 'Password is required';
          // In edit mode, password can be empty (keep current)
          if (isEditing && value.trim().length === 0) return null;
          return allValues ? null : null;
        },
      },
      secondary: {
        name: (value, allValues) => {
          if (!allValues.enableHA) return null;
          return value.trim().length === 0 ? 'Name is required' : null;
        },
        hostname: (value, allValues) => {
          if (!allValues.enableHA) return null;
          return value.trim().length === 0 ? 'Hostname is required' : null;
        },
        host: (value, allValues) => {
          if (!allValues.enableHA) return null;
          return value.trim().length === 0 ? 'Address is required' : null;
        },
        port: (value, allValues) => {
          if (!allValues.enableHA) return null;
          if (value < 1 || value > 65535) return 'Port must be between 1 and 65535';
          return null;
        },
        username: (value, allValues) => {
          if (!allValues.enableHA) return null;
          return value.trim().length === 0 ? 'Username is required' : null;
        },
        password: (value, allValues) => {
          if (!allValues.enableHA) return null;
          if (!isEditing && value.trim().length === 0) return 'Password is required';
          return null;
        },
      },
    },
  });

  // Reset form & state when drawer opens/closes or cluster changes
  useEffect(() => {
    if (isOpen) {
      const values = buildInitialValues(cluster);
      form.setValues(values);
      form.clearErrors();
      setActiveStep(0);
      setDeleteConfirm(false);
      setPrimaryTestResult(null);
      setSecondaryTestResult(null);
      primaryNameEdited.current = isEditing;
      secondaryNameEdited.current = isEditing;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, cluster]);

  // Auto-derive router names from cluster name
  const handleClusterNameChange = useCallback(
    (value: string) => {
      form.setFieldValue('clusterName', value);
      if (!primaryNameEdited.current) {
        form.setFieldValue('primary.name', value ? `${value}-1` : '');
      }
      if (!secondaryNameEdited.current) {
        form.setFieldValue('secondary.name', value ? `${value}-2` : '');
      }
    },
    [form],
  );

  // Clear test results when relevant fields change
  const handlePrimaryFieldChange = useCallback(() => {
    setPrimaryTestResult(null);
  }, []);

  const handleSecondaryFieldChange = useCallback(() => {
    setSecondaryTestResult(null);
  }, []);

  // Step validation
  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0: {
        const errors = form.validate();
        // Only check clusterName
        return !errors.hasErrors || !errors.errors.clusterName;
      }
      case 1: {
        const errors = form.validate();
        const primaryFields = ['primary.name', 'primary.hostname', 'primary.host', 'primary.port', 'primary.username', 'primary.password'];
        return !primaryFields.some((f) => errors.errors[f]);
      }
      case 2: {
        const currentValues = form.getValues();
        if (!currentValues.enableHA) return true;
        const errors = form.validate();
        const secondaryFields = ['secondary.name', 'secondary.hostname', 'secondary.host', 'secondary.port', 'secondary.username', 'secondary.password'];
        return !secondaryFields.some((f) => errors.errors[f]);
      }
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep((s) => Math.min(s + 1, 3));
    }
  };

  const handleBack = () => {
    setActiveStep((s) => Math.max(s - 1, 0));
  };

  const handleTestPrimary = () => {
    const values = form.getValues();
    testPrimaryConnection.mutate(
      {
        host: values.primary.host,
        port: values.primary.port,
        username: values.primary.username,
        password: values.primary.password,
      },
      {
        onSuccess: (result) => setPrimaryTestResult(result),
        onError: (error) =>
          setPrimaryTestResult({
            success: false,
            error: error instanceof Error ? error.message : 'Connection failed',
          }),
      },
    );
  };

  const handleTestSecondary = () => {
    const values = form.getValues();
    testSecondaryConnection.mutate(
      {
        host: values.secondary.host,
        port: values.secondary.port,
        username: values.secondary.username,
        password: values.secondary.password,
      },
      {
        onSuccess: (result) => setSecondaryTestResult(result),
        onError: (error) =>
          setSecondaryTestResult({
            success: false,
            error: error instanceof Error ? error.message : 'Connection failed',
          }),
      },
    );
  };

  const handleSubmit = () => {
    const values = form.getValues();
    const routers: {
      id?: string;
      name: string;
      hostname: string;
      host: string;
      port: number;
      username: string;
      password: string;
      role: 'master' | 'backup';
    }[] = [
      {
        ...(isEditing && cluster?.routers.find((r) => r.role === 'master')
          ? { id: cluster.routers.find((r) => r.role === 'master')!.id }
          : {}),
        name: values.primary.name,
        hostname: values.primary.hostname,
        host: values.primary.host,
        port: values.primary.port,
        username: values.primary.username,
        password: values.primary.password,
        role: 'master',
      },
    ];

    if (values.enableHA) {
      routers.push({
        ...(isEditing && cluster?.routers.find((r) => r.role === 'backup')
          ? { id: cluster.routers.find((r) => r.role === 'backup')!.id }
          : {}),
        name: values.secondary.name,
        hostname: values.secondary.hostname,
        host: values.secondary.host,
        port: values.secondary.port,
        username: values.secondary.username,
        password: values.secondary.password,
        role: 'backup',
      });
    }

    const payload = { name: values.clusterName, routers };

    if (isEditing && cluster) {
      updateMutation.mutate(
        { id: cluster.id, ...payload },
        {
          onSuccess: () => {
            notifications.show({
              title: 'Cluster updated',
              message: `Cluster "${values.clusterName}" has been updated successfully.`,
              color: 'green',
            });
            handleClose();
          },
          onError: (error) => {
            notifications.show({
              title: 'Error',
              message: error instanceof Error ? error.message : 'Failed to update cluster',
              color: 'red',
            });
          },
        },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          notifications.show({
            title: 'Cluster created',
            message: `Cluster "${values.clusterName}" has been created successfully.`,
            color: 'green',
          });
          handleClose();
        },
        onError: (error) => {
          notifications.show({
            title: 'Error',
            message: error instanceof Error ? error.message : 'Failed to create cluster',
            color: 'red',
          });
        },
      });
    }
  };

  const handleDelete = () => {
    if (!cluster) return;
    deleteMutation.mutate(cluster.id, {
      onSuccess: () => {
        notifications.show({
          title: 'Cluster deleted',
          message: `Cluster "${cluster.name}" has been deleted.`,
          color: 'green',
        });
        handleClose();
      },
      onError: (error) => {
        notifications.show({
          title: 'Error',
          message: error instanceof Error ? error.message : 'Failed to delete cluster',
          color: 'red',
        });
      },
    });
  };

  const handleClose = () => {
    form.reset();
    setActiveStep(0);
    setDeleteConfirm(false);
    setPrimaryTestResult(null);
    setSecondaryTestResult(null);
    primaryNameEdited.current = false;
    secondaryNameEdited.current = false;
    onClose();
  };

  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  const currentValues = form.getValues();

  return (
    <Drawer
      opened={isOpen}
      onClose={handleClose}
      position="right"
      size="xl"
      padding="xl"
      title={isEditing ? 'Edit Cluster' : 'Create Cluster'}
    >
      <Stepper active={activeStep} size="sm" mb="xl">
        <Stepper.Step label="Cluster" />
        <Stepper.Step label="Primary Router" />
        <Stepper.Step label="Secondary Router" />
        <Stepper.Step label="Review & Save" />
      </Stepper>

      {/* Step 0: Cluster Name */}
      {activeStep === 0 && (
        <Stack gap="md">
          <TextInput
            label="Cluster Name"
            placeholder="e.g., dc1-edge"
            withAsterisk

            {...form.getInputProps('clusterName')}
            onChange={(e) => handleClusterNameChange(e.currentTarget.value)}
          />
          <Text size="sm" c="dimmed">
            Router names will be auto-derived as "{currentValues.clusterName || 'name'}-1" and "{currentValues.clusterName || 'name'}-2".
          </Text>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleNext}>Next</Button>
          </Group>
        </Stack>
      )}

      {/* Step 1: Primary Router */}
      {activeStep === 1 && (
        <Stack gap="md">
          <TextInput
            label="Router Name"
            placeholder="e.g., dc1-edge-1"
            withAsterisk

            {...form.getInputProps('primary.name')}
            onChange={(e) => {
              form.setFieldValue('primary.name', e.currentTarget.value);
              primaryNameEdited.current = true;
            }}
          />
          <TextInput
            label="Hostname"
            placeholder="e.g., dc1-edge-1.local"
            withAsterisk
            {...form.getInputProps('primary.hostname')}
            onChange={(e) => {
              form.setFieldValue('primary.hostname', e.currentTarget.value);
              handlePrimaryFieldChange();
            }}
          />
          <TextInput
            label="Address"
            placeholder="IP address or FQDN, e.g., 10.0.1.1"
            withAsterisk
            {...form.getInputProps('primary.host')}
            onChange={(e) => {
              form.setFieldValue('primary.host', e.currentTarget.value);
              handlePrimaryFieldChange();
            }}
          />
          <NumberInput
            label="Port"
            placeholder="443"
            min={1}
            max={65535}
            withAsterisk
            {...form.getInputProps('primary.port')}
            onChange={(value) => {
              form.setFieldValue('primary.port', typeof value === 'number' ? value : 443);
              handlePrimaryFieldChange();
            }}
          />
          <TextInput
            label="API Username"
            placeholder="admin"
            withAsterisk
            {...form.getInputProps('primary.username')}
            onChange={(e) => {
              form.setFieldValue('primary.username', e.currentTarget.value);
              handlePrimaryFieldChange();
            }}
          />
          <PasswordInput
            label="API Password"
            placeholder={isEditing ? 'Leave empty to keep current' : 'Enter password'}
            withAsterisk={!isEditing}
            {...form.getInputProps('primary.password')}
            onChange={(e) => {
              form.setFieldValue('primary.password', e.currentTarget.value);
              handlePrimaryFieldChange();
            }}
            styles={{ innerInput: { fontSize: 'var(--mantine-font-size-sm)' } }}
          />

          <Button
            variant="light"
            onClick={handleTestPrimary}
            loading={testPrimaryConnection.isPending}
            fullWidth
          >
            Test Connection
          </Button>

          {primaryTestResult && primaryTestResult.success && (
            <Alert icon={<IconCheck size={16} />} color="green" variant="light">
              Connection successful
              {primaryTestResult.routeros_version && ` - RouterOS ${primaryTestResult.routeros_version}`}
              {primaryTestResult.board_name && ` (${primaryTestResult.board_name})`}
            </Alert>
          )}
          {primaryTestResult && !primaryTestResult.success && (
            <Alert icon={<IconX size={16} />} color="red" variant="light">
              {primaryTestResult.error || 'Connection failed'}
            </Alert>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={handleBack}>
              Back
            </Button>
            <Button onClick={handleNext}>Next</Button>
          </Group>
        </Stack>
      )}

      {/* Step 2: Secondary Router (optional) */}
      {activeStep === 2 && (
        <Stack gap="md">
          <Switch
            label="Add backup router for HA"
            {...form.getInputProps('enableHA', { type: 'checkbox' })}
          />

          {currentValues.enableHA ? (
            <>
              <TextInput
                label="Router Name"
                placeholder="e.g., dc1-edge-2"
                withAsterisk
                {...form.getInputProps('secondary.name')}
                onChange={(e) => {
                  form.setFieldValue('secondary.name', e.currentTarget.value);
                  secondaryNameEdited.current = true;
                }}
              />
              <TextInput
                label="Hostname"
                placeholder="e.g., dc1-edge-2.local"
                withAsterisk
                {...form.getInputProps('secondary.hostname')}
                onChange={(e) => {
                  form.setFieldValue('secondary.hostname', e.currentTarget.value);
                  handleSecondaryFieldChange();
                }}
              />
              <TextInput
                label="Address"
                placeholder="IP address or FQDN, e.g., 10.0.1.2"
                withAsterisk
                {...form.getInputProps('secondary.host')}
                onChange={(e) => {
                  form.setFieldValue('secondary.host', e.currentTarget.value);
                  handleSecondaryFieldChange();
                }}
              />
              <NumberInput
                label="Port"
                placeholder="443"
                min={1}
                max={65535}
                withAsterisk
                {...form.getInputProps('secondary.port')}
                onChange={(value) => {
                  form.setFieldValue('secondary.port', typeof value === 'number' ? value : 443);
                  handleSecondaryFieldChange();
                }}
              />
              <TextInput
                label="API Username"
                placeholder="admin"
                withAsterisk
                {...form.getInputProps('secondary.username')}
                onChange={(e) => {
                  form.setFieldValue('secondary.username', e.currentTarget.value);
                  handleSecondaryFieldChange();
                }}
              />
              <PasswordInput
                label="API Password"
                placeholder={isEditing ? 'Leave empty to keep current' : 'Enter password'}
                withAsterisk={!isEditing}
                {...form.getInputProps('secondary.password')}
                onChange={(e) => {
                  form.setFieldValue('secondary.password', e.currentTarget.value);
                  handleSecondaryFieldChange();
                }}
                styles={{ innerInput: { fontSize: 'var(--mantine-font-size-sm)' } }}
              />

              <Button
                variant="light"
                onClick={handleTestSecondary}
                loading={testSecondaryConnection.isPending}
                fullWidth
              >
                Test Connection
              </Button>

              {secondaryTestResult && secondaryTestResult.success && (
                <Alert icon={<IconCheck size={16} />} color="green" variant="light">
                  Connection successful
                  {secondaryTestResult.routeros_version && ` - RouterOS ${secondaryTestResult.routeros_version}`}
                  {secondaryTestResult.board_name && ` (${secondaryTestResult.board_name})`}
                </Alert>
              )}
              {secondaryTestResult && !secondaryTestResult.success && (
                <Alert icon={<IconX size={16} />} color="red" variant="light">
                  {secondaryTestResult.error || 'Connection failed'}
                </Alert>
              )}
            </>
          ) : (
            <Alert variant="light" color="gray">
              This will be a standalone cluster with a single router. You can add a backup router later.
            </Alert>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={handleBack}>
              Back
            </Button>
            {!currentValues.enableHA ? (
              <Button variant="light" onClick={handleNext}>
                Skip
              </Button>
            ) : (
              <Button onClick={handleNext}>Next</Button>
            )}
          </Group>
        </Stack>
      )}

      {/* Step 3: Review & Save */}
      {activeStep === 3 && (
        <Stack gap="md">
          <Group gap="sm">
            <Text fw={600} size="lg">
              {currentValues.clusterName}
            </Text>
            <Badge variant="light" color={currentValues.enableHA ? 'blue' : 'gray'}>
              {currentValues.enableHA ? 'HA' : 'Standalone'}
            </Badge>
          </Group>

          <Divider />

          {/* Primary Router Card */}
          <Paper withBorder p="md" radius="md">
            <Group gap="xs" mb="sm">
              <IconServer size={18} />
              <Text fw={600} size="sm">
                Primary Router
              </Text>
              <Badge size="sm" variant="light" color="blue">
                master
              </Badge>
              {primaryTestResult?.success && (
                <Badge size="sm" variant="light" color="green" leftSection={<IconShieldCheck size={12} />}>
                  Tested
                </Badge>
              )}
            </Group>
            <Stack gap={4}>
              <Group gap="xs">
                <Text size="sm" c="dimmed" w={80}>Name:</Text>
                <Text size="sm">{currentValues.primary.name}</Text>
              </Group>
              <Group gap="xs">
                <Text size="sm" c="dimmed" w={80}>Host:</Text>
                <Text size="sm">{currentValues.primary.host}:{currentValues.primary.port}</Text>
              </Group>
              <Group gap="xs">
                <Text size="sm" c="dimmed" w={80}>Hostname:</Text>
                <Text size="sm">{currentValues.primary.hostname}</Text>
              </Group>
              <Group gap="xs">
                <Text size="sm" c="dimmed" w={80}>Username:</Text>
                <Text size="sm">{currentValues.primary.username}</Text>
              </Group>
            </Stack>
          </Paper>

          {/* Secondary Router Card */}
          {currentValues.enableHA && (
            <Paper withBorder p="md" radius="md">
              <Group gap="xs" mb="sm">
                <IconServer size={18} />
                <Text fw={600} size="sm">
                  Secondary Router
                </Text>
                <Badge size="sm" variant="light" color="orange">
                  backup
                </Badge>
                {secondaryTestResult?.success && (
                  <Badge size="sm" variant="light" color="green" leftSection={<IconShieldCheck size={12} />}>
                    Tested
                  </Badge>
                )}
              </Group>
              <Stack gap={4}>
                <Group gap="xs">
                  <Text size="sm" c="dimmed" w={80}>Name:</Text>
                  <Text size="sm">{currentValues.secondary.name}</Text>
                </Group>
                <Group gap="xs">
                  <Text size="sm" c="dimmed" w={80}>Host:</Text>
                  <Text size="sm">{currentValues.secondary.host}:{currentValues.secondary.port}</Text>
                </Group>
                <Group gap="xs">
                  <Text size="sm" c="dimmed" w={80}>Hostname:</Text>
                  <Text size="sm">{currentValues.secondary.hostname}</Text>
                </Group>
                <Group gap="xs">
                  <Text size="sm" c="dimmed" w={80}>Username:</Text>
                  <Text size="sm">{currentValues.secondary.username}</Text>
                </Group>
              </Stack>
            </Paper>
          )}

          <Divider />

          <Group justify="space-between" mt="md">
            <Group>
              {isEditing && (
                <>
                  {deleteConfirm ? (
                    <Group gap="xs">
                      <Text size="sm" c="red">
                        Delete this cluster?
                      </Text>
                      <Button
                        size="compact-sm"
                        color="red"
                        variant="filled"
                        onClick={handleDelete}
                        loading={deleteMutation.isPending}
                      >
                        Confirm
                      </Button>
                      <Button
                        size="compact-sm"
                        variant="default"
                        onClick={() => setDeleteConfirm(false)}
                      >
                        Cancel
                      </Button>
                    </Group>
                  ) : (
                    <Button
                      variant="subtle"
                      color="red"
                      leftSection={<IconTrash size={16} />}
                      onClick={() => setDeleteConfirm(true)}
                    >
                      Delete Cluster
                    </Button>
                  )}
                </>
              )}
            </Group>
            <Group>
              <Button variant="default" onClick={handleBack}>
                Back
              </Button>
              <Button onClick={handleSubmit} loading={isPending}>
                {isEditing ? 'Save Changes' : 'Create Cluster'}
              </Button>
            </Group>
          </Group>
        </Stack>
      )}
    </Drawer>
  );
}
