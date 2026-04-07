import { useState, useEffect } from 'react';
import {
  Drawer,
  TextInput,
  NumberInput,
  Button,
  Group,
  Stack,
  Text,
  SimpleGrid,
} from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { useCreateWireGuardInterface, useUpdateWireGuardInterface } from './wireguardApi';
import type { WireGuardInterface } from '../../api/types';

interface WireGuardInterfaceFormProps {
  isOpen: boolean;
  onClose: () => void;
  routerId: string;
  editInterface?: WireGuardInterface | null;
}

interface FormState {
  name: string;
  listenPort: number;
  mtu: number;
  gatewayAddress: string;
  dns: string;
  clientAllowedIPs: string;
}

function getInitialState(iface?: WireGuardInterface | null): FormState {
  if (iface) {
    return {
      name: iface.name,
      listenPort: iface.listenPort,
      mtu: iface.mtu,
      gatewayAddress: iface.gatewayAddress,
      dns: iface.dns,
      clientAllowedIPs: iface.clientAllowedIPs,
    };
  }
  return {
    name: 'wg0',
    listenPort: 13231,
    mtu: 1420,
    gatewayAddress: '',
    dns: '',
    clientAllowedIPs: '0.0.0.0/0',
  };
}

export default function WireGuardInterfaceForm({
  isOpen,
  onClose,
  routerId,
  editInterface,
}: WireGuardInterfaceFormProps) {
  const isEdit = !!editInterface;
  const [state, setState] = useState<FormState>(getInitialState(editInterface));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const createMutation = useCreateWireGuardInterface(routerId);
  const updateMutation = useUpdateWireGuardInterface(routerId);

  useEffect(() => {
    if (isOpen) {
      setState(getInitialState(editInterface));
      setErrors({});
      setSubmitted(false);
      setSaving(false);
    }
  }, [isOpen, editInterface]);

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!state.name.trim()) newErrors.name = 'Name is required';
    if (!state.gatewayAddress.trim()) newErrors.gatewayAddress = 'Gateway address is required';
    if (!state.listenPort || state.listenPort < 1 || state.listenPort > 65535) {
      newErrors.listenPort = 'Valid port required (1-65535)';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit() {
    setSubmitted(true);
    if (!validate()) return;

    setSaving(true);
    try {
      const data = {
        name: state.name.trim(),
        listenPort: state.listenPort,
        mtu: state.mtu,
        gatewayAddress: state.gatewayAddress.trim(),
        dns: state.dns.trim(),
        clientAllowedIPs: state.clientAllowedIPs.trim(),
        disabled: editInterface?.disabled ?? false,
      };

      if (isEdit) {
        await updateMutation.mutateAsync({ id: editInterface!.id, updates: data });
      } else {
        await createMutation.mutateAsync(data);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const title = isEdit ? 'Edit WireGuard Interface' : 'Configure WireGuard';

  return (
    <Drawer
      opened={isOpen}
      onClose={onClose}
      position="right"
      size="xl"
      padding="xl"
      title={
        <Group gap="xs">
          <IconLock size={20} />
          <Text fw={600}>{title}</Text>
        </Group>
      }
    >
      <Stack gap="md">
        <SimpleGrid cols={2} spacing="sm">
          <TextInput
            label="Name"
            placeholder="e.g. wg0"
            required
            size="sm"
            radius="sm"
            value={state.name}
            onChange={(e) => update('name', e.currentTarget.value)}
            error={submitted ? errors.name : undefined}
          />
          <NumberInput
            label="Listen Port"
            required
            size="sm"
            radius="sm"
            value={state.listenPort}
            onChange={(val) => update('listenPort', typeof val === 'number' ? val : 13231)}
            min={1}
            max={65535}
            error={submitted ? errors.listenPort : undefined}
          />
        </SimpleGrid>

        <SimpleGrid cols={2} spacing="sm">
          <NumberInput
            label="MTU"
            size="sm"
            radius="sm"
            value={state.mtu}
            onChange={(val) => update('mtu', typeof val === 'number' ? val : 1420)}
            min={68}
            max={65535}
          />
          <TextInput
            label="Gateway Address"
            placeholder="e.g. 10.10.0.1/24"
            required
            size="sm"
            radius="sm"
            value={state.gatewayAddress}
            onChange={(e) => update('gatewayAddress', e.currentTarget.value)}
            error={submitted ? errors.gatewayAddress : undefined}
          />
        </SimpleGrid>

        <SimpleGrid cols={2} spacing="sm">
          <TextInput
            label="DNS"
            placeholder="e.g. 10.0.1.1"
            size="sm"
            radius="sm"
            value={state.dns}
            onChange={(e) => update('dns', e.currentTarget.value)}
          />
          <TextInput
            label="Client Allowed IPs"
            placeholder="e.g. 0.0.0.0/0 or 10.0.0.0/8"
            size="sm"
            radius="sm"
            value={state.clientAllowedIPs}
            onChange={(e) => update('clientAllowedIPs', e.currentTarget.value)}
          />
        </SimpleGrid>

        <Group justify="space-between" mt="xs">
          <Button variant="default" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} loading={saving}>
            {isEdit ? 'Save' : 'Create'}
          </Button>
        </Group>
      </Stack>
    </Drawer>
  );
}
