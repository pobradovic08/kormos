import { useState, useEffect } from 'react';
import {
  Drawer,
  TextInput,
  Checkbox,
  Button,
  Group,
  Stack,
  Text,
  SegmentedControl,
} from '@mantine/core';
import { IconUserPlus } from '@tabler/icons-react';
import { useAddPeer, useUpdatePeer } from './wireguardApi';
import { getNextAvailableIP } from '../../mocks/mockWireGuardData';
import type { WireGuardInterface, WireGuardPeer } from '../../api/types';

interface WireGuardPeerFormProps {
  isOpen: boolean;
  onClose: () => void;
  routerId: string;
  wgInterface: WireGuardInterface;
  editPeer?: WireGuardPeer | null;
  onCreated?: (peer: WireGuardPeer) => void;
}

function mockKey(prefix: string): string {
  return `${prefix}${'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef'.slice(0, 32)}=`;
}

interface FormState {
  mode: 'generate' | 'provide';
  name: string;
  publicKey: string;
  allowedAddress: string;
  presharedKey: boolean;
  comment: string;
}

function getInitialState(routerId: string, editPeer?: WireGuardPeer | null): FormState {
  if (editPeer) {
    return {
      mode: 'generate',
      name: editPeer.name,
      publicKey: editPeer.publicKey,
      allowedAddress: editPeer.allowedAddress,
      presharedKey: !!editPeer.presharedKey,
      comment: editPeer.comment,
    };
  }
  const nextIP = getNextAvailableIP(routerId);
  return {
    mode: 'generate',
    name: '',
    publicKey: '',
    allowedAddress: nextIP ?? '',
    presharedKey: false,
    comment: '',
  };
}

export default function WireGuardPeerForm({
  isOpen,
  onClose,
  routerId,
  wgInterface,
  editPeer,
  onCreated,
}: WireGuardPeerFormProps) {
  const isEdit = !!editPeer;
  const [state, setState] = useState<FormState>(getInitialState(routerId, editPeer));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const addMutation = useAddPeer(routerId);
  const updateMutation = useUpdatePeer(routerId);

  useEffect(() => {
    if (isOpen) {
      setState(getInitialState(routerId, editPeer));
      setErrors({});
      setSubmitted(false);
      setSaving(false);
    }
  }, [isOpen, editPeer, routerId]);

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
    if (!state.allowedAddress.trim()) newErrors.allowedAddress = 'Allowed address is required';
    if (state.mode === 'provide' && !isEdit && !state.publicKey.trim()) {
      newErrors.publicKey = 'Public key is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit() {
    setSubmitted(true);
    if (!validate()) return;

    setSaving(true);
    try {
      if (isEdit) {
        await updateMutation.mutateAsync({
          id: editPeer!.id,
          updates: {
            name: state.name.trim(),
            allowedAddress: state.allowedAddress.trim(),
            comment: state.comment.trim(),
          },
        });
        onClose();
      } else {
        // Generate keys for "generate" mode
        const isGenerate = state.mode === 'generate';
        const clientPrivateKey = isGenerate ? mockKey('client-priv-') : undefined;
        const publicKey = isGenerate ? mockKey('client-pub-') : state.publicKey.trim();
        const presharedKey = state.presharedKey ? mockKey('psk-') : '';

        const peerData: Omit<WireGuardPeer, 'id'> = {
          interface: wgInterface.name,
          name: state.name.trim(),
          publicKey,
          presharedKey,
          allowedAddress: state.allowedAddress.trim(),
          endpointAddress: '',
          endpointPort: 0,
          lastHandshake: '',
          rx: 0,
          tx: 0,
          persistentKeepalive: 25,
          disabled: false,
          comment: state.comment.trim(),
          clientPrivateKey,
        };

        const newPeer = await addMutation.mutateAsync(peerData) as WireGuardPeer;
        onClose();
        if (onCreated) {
          onCreated(newPeer);
        }
      }
    } finally {
      setSaving(false);
    }
  }

  const title = isEdit ? `Edit Peer` : 'Add Peer';

  return (
    <Drawer
      opened={isOpen}
      onClose={onClose}
      position="right"
      size="xl"
      padding="xl"
      title={
        <Group gap="xs">
          <IconUserPlus size={20} />
          <Text fw={600}>{title}</Text>
        </Group>
      }
    >
      <Stack gap="md">
        {!isEdit && (
          <>
            <div>
              <Text size="sm" fw={500} mb={4}>
                Key Mode
              </Text>
              <SegmentedControl
                fullWidth
                size="sm"
                radius="md"
                styles={{ indicator: { boxShadow: 'none' } }}
                value={state.mode}
                onChange={(val) => update('mode', val as 'generate' | 'provide')}
                data={[
                  { value: 'generate', label: 'Generate keys' },
                  { value: 'provide', label: 'Provide public key' },
                ]}
              />
            </div>
          </>
        )}

        <TextInput
          label="Name"
          placeholder="e.g. John - Laptop"
          required
          size="sm"
          radius="sm"
          value={state.name}
          onChange={(e) => update('name', e.currentTarget.value)}
          error={submitted ? errors.name : undefined}
        />

        {!isEdit && state.mode === 'provide' && (
          <TextInput
            label="Public Key"
            placeholder="Paste the client's public key"
            required
            size="sm"
            radius="sm"
            value={state.publicKey}
            onChange={(e) => update('publicKey', e.currentTarget.value)}
            error={submitted ? errors.publicKey : undefined}
          />
        )}

        <TextInput
          label="Allowed Address"
          placeholder="e.g. 10.10.0.2/32"
          required
          size="sm"
          radius="sm"
          value={state.allowedAddress}
          onChange={(e) => update('allowedAddress', e.currentTarget.value)}
          error={submitted ? errors.allowedAddress : undefined}
        />

        {!isEdit && (
          <Checkbox
            label="Enable preshared key"
            size="sm"
            checked={state.presharedKey}
            onChange={(e) => update('presharedKey', e.currentTarget.checked)}
          />
        )}

        <TextInput
          label="Comment"
          placeholder="Optional description"
          size="sm"
          radius="sm"
          value={state.comment}
          onChange={(e) => update('comment', e.currentTarget.value)}
        />

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
