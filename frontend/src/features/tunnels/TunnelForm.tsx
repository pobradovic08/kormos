import { useState, useEffect, useMemo } from 'react';
import {
  Drawer,
  Stepper,
  TextInput,
  NumberInput,
  PasswordInput,
  Select,
  SegmentedControl,
  Button,
  ActionIcon,
  Group,
  Stack,
  Table,
  Text,
  SimpleGrid,
  Alert,
} from '@mantine/core';
import { IconBuildingTunnel, IconPlus, IconTrash } from '@tabler/icons-react';
import type { Tunnel, GRETunnel, IPsecTunnel } from '../../api/types';
import { useAddTunnel, useUpdateTunnel } from './tunnelsApi';
import { useInterfaces } from '../interfaces/interfacesApi';

type TunnelType = 'gre' | 'ipsec';

interface TunnelFormProps {
  isOpen: boolean;
  onClose: () => void;
  routerId: string;
  tunnelType: TunnelType;
  editTunnel?: Tunnel | null;
}

// ─── GRE Form State ─────────────────────────────────────────────────────────

interface GREFormState {
  name: string;
  remoteAddress: string;
  localAddress: string;
  keepaliveInterval: number;
  keepaliveRetries: number;
  mtu: number;
  ipsecSecret: string;
  comment: string;
}

function getInitialGREState(tunnel?: Tunnel | null): GREFormState {
  if (tunnel && tunnel.tunnelType === 'gre') {
    const gre = tunnel as GRETunnel;
    return {
      name: gre.name,
      remoteAddress: gre.remoteAddress,
      localAddress: gre.localAddress || '0.0.0.0',
      keepaliveInterval: gre.keepaliveInterval,
      keepaliveRetries: gre.keepaliveRetries,
      mtu: gre.mtu,
      ipsecSecret: gre.ipsecSecret,
      comment: gre.comment,
    };
  }
  return {
    name: '',
    remoteAddress: '',
    localAddress: '0.0.0.0',
    keepaliveInterval: 10,
    keepaliveRetries: 10,
    mtu: 1476,
    ipsecSecret: '',
    comment: '',
  };
}

// ─── IPsec Form State ───────────────────────────────────────────────────────

interface IPsecFormState {
  name: string;
  mode: 'route-based' | 'policy-based';
  remoteAddress: string;
  localAddress: string;
  authMethod: string;
  ipsecSecret: string;
  comment: string;
  p1Encryption: string;
  p1Hash: string;
  p1DhGroup: string;
  p1Lifetime: string;
  p2Encryption: string;
  p2AuthAlgorithm: string;
  p2PfsGroup: string;
  p2Lifetime: string;
  localSubnets: string[];
  remoteSubnets: string[];
  tunnelRoutes: string[];
}

function getInitialIPsecState(tunnel?: Tunnel | null): IPsecFormState {
  if (tunnel && tunnel.tunnelType === 'ipsec') {
    const ipsec = tunnel as IPsecTunnel;
    return {
      name: ipsec.name,
      mode: ipsec.mode,
      remoteAddress: ipsec.remoteAddress,
      localAddress: ipsec.localAddress || '0.0.0.0',
      authMethod: ipsec.authMethod,
      ipsecSecret: ipsec.ipsecSecret,
      comment: ipsec.comment,
      p1Encryption: ipsec.phase1.encryption,
      p1Hash: ipsec.phase1.hash,
      p1DhGroup: ipsec.phase1.dhGroup,
      p1Lifetime: ipsec.phase1.lifetime,
      p2Encryption: ipsec.phase2.encryption,
      p2AuthAlgorithm: ipsec.phase2.authAlgorithm,
      p2PfsGroup: ipsec.phase2.pfsGroup,
      p2Lifetime: ipsec.phase2.lifetime,
      localSubnets: [...ipsec.localSubnets],
      remoteSubnets: [...ipsec.remoteSubnets],
      tunnelRoutes: [...ipsec.tunnelRoutes],
    };
  }
  return {
    name: '',
    mode: 'route-based',
    remoteAddress: '',
    localAddress: '0.0.0.0',
    authMethod: 'pre-shared-key',
    ipsecSecret: '',
    comment: '',
    p1Encryption: 'aes-256',
    p1Hash: 'sha512',
    p1DhGroup: 'ecp384',
    p1Lifetime: '1d',
    p2Encryption: 'aes-256-cbc',
    p2AuthAlgorithm: 'sha512',
    p2PfsGroup: 'ecp384',
    p2Lifetime: '30m',
    localSubnets: [],
    remoteSubnets: [],
    tunnelRoutes: [],
  };
}

// ─── Select options ─────────────────────────────────────────────────────────

// Phase 1 (IKE Profile) options
const P1_ENCRYPTION_OPTIONS = [
  { value: 'aes-128', label: 'AES-128' },
  { value: 'aes-192', label: 'AES-192' },
  { value: 'aes-256', label: 'AES-256' },
];

const P1_HASH_OPTIONS = [
  { value: 'sha256', label: 'SHA256' },
  { value: 'sha384', label: 'SHA384' },
  { value: 'sha512', label: 'SHA512' },
];

const DH_GROUP_OPTIONS = [
  { value: 'modp2048', label: 'modp2048 (Group 14)' },
  { value: 'modp3072', label: 'modp3072 (Group 15)' },
  { value: 'modp4096', label: 'modp4096 (Group 16)' },
  { value: 'ecp256', label: 'ecp256 (Group 19)' },
  { value: 'ecp384', label: 'ecp384 (Group 20)' },
  { value: 'ecp521', label: 'ecp521 (Group 21)' },
];

// Phase 2 (ESP Proposal) options
const P2_ENCRYPTION_OPTIONS = [
  { value: 'aes-128-cbc', label: 'AES-128-CBC' },
  { value: 'aes-256-cbc', label: 'AES-256-CBC' },
  { value: 'aes-128-gcm', label: 'AES-128-GCM' },
  { value: 'aes-256-gcm', label: 'AES-256-GCM' },
];

const P2_AUTH_OPTIONS = [
  { value: 'sha256', label: 'SHA256' },
  { value: 'sha512', label: 'SHA512' },
  { value: 'null', label: 'None (GCM)' },
];

const PFS_GROUP_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'modp2048', label: 'modp2048 (Group 14)' },
  { value: 'modp3072', label: 'modp3072 (Group 15)' },
  { value: 'ecp256', label: 'ecp256 (Group 19)' },
  { value: 'ecp384', label: 'ecp384 (Group 20)' },
];

const AUTH_METHOD_OPTIONS = [
  { value: 'pre-shared-key', label: 'Pre-shared Key' },
  { value: 'digital-signature', label: 'Certificate' },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function TunnelForm({
  isOpen,
  onClose,
  routerId,
  tunnelType,
  editTunnel,
}: TunnelFormProps) {
  const isEdit = !!editTunnel;
  const totalSteps = tunnelType === 'gre' ? 1 : 4;

  const [activeStep, setActiveStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const [greState, setGreState] = useState<GREFormState>(getInitialGREState(editTunnel));
  const [ipsecState, setIpsecState] = useState<IPsecFormState>(getInitialIPsecState(editTunnel));

  const addMutation = useAddTunnel(routerId);
  const updateMutation = useUpdateTunnel(routerId);

  // Fetch router addresses for Local Address dropdown
  const { data: interfaces } = useInterfaces(routerId);
  const addressOptions = useMemo(() => {
    const auto = { value: '0.0.0.0', label: 'Auto (0.0.0.0)' };
    if (!interfaces) return [auto];
    const addrs = interfaces.flatMap((iface) =>
      iface.addresses.map((a) => ({
        value: a.address.split('/')[0],
        label: `${a.address.split('/')[0]} (${iface.name})`,
      }))
    );
    return [auto, ...addrs];
  }, [interfaces]);

  // Reset form when drawer opens/closes
  useEffect(() => {
    if (isOpen) {
      setActiveStep(0);
      setErrors({});
      setSubmitted(false);
      setSaving(false);
      setGreState(getInitialGREState(editTunnel));
      setIpsecState(getInitialIPsecState(editTunnel));
    }
  }, [isOpen, editTunnel]);

  // ─── GRE validation ────────────────────────────────────────────────────────

  function validateGRE(): boolean {
    const newErrors: Record<string, string> = {};
    if (!greState.name.trim()) newErrors.name = 'Name is required';
    if (!greState.remoteAddress.trim()) newErrors.remoteAddress = 'Remote address is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ─── IPsec validation ─────────────────────────────────────────────────────

  function validateIPsecStep(step: number): boolean {
    const newErrors: Record<string, string> = {};

    if (step === 0) {
      if (!ipsecState.name.trim()) newErrors.name = 'Name is required';
      if (!ipsecState.remoteAddress.trim()) newErrors.remoteAddress = 'Remote address is required';
      if (ipsecState.authMethod === 'pre-shared-key' && !ipsecState.ipsecSecret.trim()) {
        newErrors.ipsecSecret = 'Pre-shared key is required';
      }
    }
    if (step === 3) {
      if (ipsecState.mode === 'policy-based') {
        if (ipsecState.localSubnets.length === 0) newErrors.localSubnets = 'At least one local subnet required';
        if (ipsecState.remoteSubnets.length === 0) newErrors.remoteSubnets = 'At least one remote subnet required';
      } else {
        if (ipsecState.tunnelRoutes.length === 0) newErrors.tunnelRoutes = 'At least one route required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  function handleNext() {
    if (!validateIPsecStep(activeStep)) return;
    if (activeStep < totalSteps - 1) {
      setActiveStep((s) => s + 1);
    }
  }

  function handleBack() {
    setErrors({});
    setActiveStep((s) => Math.max(0, s - 1));
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setSubmitted(true);
    const isValid = tunnelType === 'gre'
      ? validateGRE()
      : validateIPsecStep(activeStep);

    if (!isValid) return;

    setSaving(true);
    try {
      if (tunnelType === 'gre') {
        const tunnelData: Omit<GRETunnel, 'id'> = {
          tunnelType: 'gre',
          name: greState.name.trim(),
          remoteAddress: greState.remoteAddress.trim(),
          localAddress: greState.localAddress,
          mtu: greState.mtu,
          keepaliveInterval: greState.keepaliveInterval,
          keepaliveRetries: greState.keepaliveRetries,
          ipsecSecret: greState.ipsecSecret,
          comment: greState.comment.trim(),
          disabled: false,
          running: true,
        };

        if (isEdit) {
          await updateMutation.mutateAsync({ id: editTunnel!.id, updates: tunnelData });
        } else {
          await addMutation.mutateAsync(tunnelData);
        }
      } else {
        const tunnelData: Omit<IPsecTunnel, 'id'> = {
          tunnelType: 'ipsec',
          name: ipsecState.name.trim(),
          mode: ipsecState.mode,
          remoteAddress: ipsecState.remoteAddress.trim(),
          localAddress: ipsecState.localAddress,
          authMethod: ipsecState.authMethod as 'pre-shared-key' | 'digital-signature',
          ipsecSecret: ipsecState.ipsecSecret,
          comment: ipsecState.comment.trim(),
          phase1: {
            encryption: ipsecState.p1Encryption,
            hash: ipsecState.p1Hash,
            dhGroup: ipsecState.p1DhGroup,
            lifetime: ipsecState.p1Lifetime,
          },
          phase2: {
            encryption: ipsecState.p2Encryption,
            authAlgorithm: ipsecState.p2AuthAlgorithm,
            pfsGroup: ipsecState.p2PfsGroup,
            lifetime: ipsecState.p2Lifetime,
          },
          localSubnets: ipsecState.localSubnets,
          remoteSubnets: ipsecState.remoteSubnets,
          tunnelRoutes: ipsecState.tunnelRoutes,
          disabled: false,
          established: false,
        };

        if (isEdit) {
          await updateMutation.mutateAsync({ id: editTunnel!.id, updates: tunnelData });
        } else {
          await addMutation.mutateAsync(tunnelData);
        }
      }

      onClose();
    } finally {
      setSaving(false);
    }
  }

  // ─── GRE field updater ────────────────────────────────────────────────────

  function updateGRE<K extends keyof GREFormState>(field: K, value: GREFormState[K]) {
    setGreState((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  // ─── IPsec field updater ──────────────────────────────────────────────────

  function updateIPsec<K extends keyof IPsecFormState>(field: K, value: IPsecFormState[K]) {
    setIpsecState((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  // ─── Title ────────────────────────────────────────────────────────────────

  const typeLabel = tunnelType === 'gre' ? 'GRE' : 'IPsec';
  const title = isEdit ? `Edit ${typeLabel} Tunnel` : `Add ${typeLabel}`;

  // ─── Is on final step? ────────────────────────────────────────────────────

  const isLastStep = activeStep === totalSteps - 1;
  const submitLabel = isEdit ? 'Save' : 'Create';

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <Drawer
      opened={isOpen}
      onClose={onClose}
      position="right"
      size="xl"
      padding="xl"
      title={<Group gap="xs"><IconBuildingTunnel size={20} /><Text fw={600}>{title}</Text></Group>}
    >
      {tunnelType === 'gre' ? (
        /* ─── GRE: flat form, no stepper ─────────────────────────── */
        <Stack gap="md">
          <TextInput
            label="Name"
            placeholder="e.g. gre-to-branch"
            required
            size="sm"
            radius="sm"
            value={greState.name}
            onChange={(e) => updateGRE('name', e.currentTarget.value)}
            error={submitted ? errors.name : undefined}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--mantine-spacing-sm)' }}>
            <Select
              label="Local Tunnel Endpoint"
              size="sm"
              radius="sm"
              data={addressOptions}
              value={greState.localAddress}
              onChange={(val) => updateGRE('localAddress', val ?? '0.0.0.0')}
            />
            <NumberInput
              label="MTU"
              size="sm"
              radius="sm"
              value={greState.mtu}
              onChange={(val) => updateGRE('mtu', typeof val === 'number' ? val : 1476)}
              min={68}
              max={65535}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 'var(--mantine-spacing-sm)' }}>
            <TextInput
              label="Remote Tunnel Endpoint"
              placeholder="e.g. 172.16.10.1"
              required
              size="sm"
              radius="sm"
              value={greState.remoteAddress}
              onChange={(e) => updateGRE('remoteAddress', e.currentTarget.value)}
              error={submitted ? errors.remoteAddress : undefined}
            />
            <NumberInput
              label="Keepalive"
              placeholder="0 to disable"
              suffix="s"
              size="sm"
              radius="sm"
              value={greState.keepaliveInterval}
              onChange={(val) => updateGRE('keepaliveInterval', typeof val === 'number' ? val : 10)}
              min={0}
            />
            <NumberInput
              label="Retries"
              size="sm"
              radius="sm"
              value={greState.keepaliveRetries}
              onChange={(val) => updateGRE('keepaliveRetries', typeof val === 'number' ? val : 10)}
              min={0}
            />
          </div>
          <PasswordInput
            label="IPsec Secret"
            placeholder="Leave empty for no encryption"
            size="sm"
            radius="sm"
            value={greState.ipsecSecret}
            onChange={(e) => updateGRE('ipsecSecret', e.currentTarget.value)}
          />
          <TextInput
            label="Comment"
            placeholder="Optional description"
            size="sm"
            radius="sm"
            value={greState.comment}
            onChange={(e) => updateGRE('comment', e.currentTarget.value)}
          />
          <Group justify="space-between" mt="xs">
            <Button variant="default" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit} loading={saving}>
              {submitLabel}
            </Button>
          </Group>
        </Stack>
      ) : (
        /* ─── IPsec: 4-step stepper form ─────────────────────────── */
        <Stack gap="md">
          <Stepper active={activeStep} size="sm" allowNextStepsSelect={isEdit}>
            <Stepper.Step label="Connection" description="Auth & endpoints" />
            <Stepper.Step label="Phase 1" description="IKE profile" />
            <Stepper.Step label="Phase 2" description="ESP proposal" />
            <Stepper.Step label="Networks" description="Traffic selectors" />
          </Stepper>

          {activeStep === 0 && (
            <IPsecConnectionStep state={ipsecState} errors={errors} onUpdate={updateIPsec} addressOptions={addressOptions} />
          )}
          {activeStep === 1 && (
            <IPsecPhase1Step state={ipsecState} onUpdate={updateIPsec} />
          )}
          {activeStep === 2 && (
            <IPsecPhase2Step state={ipsecState} onUpdate={updateIPsec} />
          )}
          {activeStep === 3 && (
            <IPsecNetworksStep state={ipsecState} errors={errors} onUpdate={updateIPsec} />
          )}

          <Group justify="space-between">
            <Button variant="default" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Group gap="sm">
              {activeStep > 0 && (
                <Button variant="default" size="sm" onClick={handleBack}>
                  Back
                </Button>
              )}
              {isLastStep ? (
                <Button size="sm" onClick={handleSubmit} loading={saving}>
                  {submitLabel}
                </Button>
              ) : (
                <Button size="sm" onClick={handleNext}>
                  Next
                </Button>
              )}
            </Group>
          </Group>
        </Stack>
      )}
    </Drawer>
  );
}

// ─── IPsec Step Components ────────────────────────────────────────────────────

interface IPsecStepProps {
  state: IPsecFormState;
  errors?: Record<string, string>;
  onUpdate: <K extends keyof IPsecFormState>(field: K, value: IPsecFormState[K]) => void;
  addressOptions?: { value: string; label: string }[];
}

function IPsecConnectionStep({ state, errors = {}, onUpdate, addressOptions = [] }: IPsecStepProps) {
  return (
    <Stack gap="md">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--mantine-spacing-sm)' }}>
        <TextInput
          label="Name" required size="sm" radius="sm"
          value={state.name}
          onChange={(e) => onUpdate('name', e.currentTarget.value)}
          error={errors.name}
        />
        <div>
          <Text size="sm" fw={500} mb={4}>Mode</Text>
          <SegmentedControl
            fullWidth size="sm" radius="md"
            styles={{ indicator: { boxShadow: 'none' } }}
            value={state.mode}
            onChange={(val) => onUpdate('mode', val as 'route-based' | 'policy-based')}
            data={[
              { value: 'route-based', label: 'Route-based' },
              { value: 'policy-based', label: 'Policy-based' },
            ]}
          />
        </div>
      </div>
      <SimpleGrid cols={2} spacing="sm">
        <TextInput
          label="Remote Address" required size="sm" radius="sm"
          placeholder="e.g. 172.16.10.1"
          value={state.remoteAddress}
          onChange={(e) => onUpdate('remoteAddress', e.currentTarget.value)}
          error={errors.remoteAddress}
        />
        <Select
          label="Local Address" size="sm" radius="sm"
          data={addressOptions}
          value={state.localAddress}
          onChange={(val) => onUpdate('localAddress', val ?? '0.0.0.0')}
        />
      </SimpleGrid>
      <SimpleGrid cols={2} spacing="sm">
        <Select
          label="Auth Method" size="sm" radius="sm"
          data={AUTH_METHOD_OPTIONS}
          value={state.authMethod}
          onChange={(val) => onUpdate('authMethod', val ?? 'pre-shared-key')}
        />
        {state.authMethod === 'pre-shared-key' && (
          <PasswordInput
            label="Pre-shared Key" required size="sm" radius="sm"
            value={state.ipsecSecret}
            onChange={(e) => onUpdate('ipsecSecret', e.currentTarget.value)}
            error={errors.ipsecSecret}
          />
        )}
      </SimpleGrid>
      <TextInput
        label="Comment" size="sm" radius="sm"
        placeholder="Optional description"
        value={state.comment}
        onChange={(e) => onUpdate('comment', e.currentTarget.value)}
      />
    </Stack>
  );
}

function IPsecPhase1Step({ state, onUpdate }: IPsecStepProps) {
  return (
    <Stack gap="md">
      <Alert variant="light" color="blue" radius="sm" title="Deprecation notice" icon={false}
        styles={{
          title: { fontSize: 'var(--mantine-font-size-sm)' },
          message: { fontSize: 'var(--mantine-font-size-xs)' },
        }}>
        IKEv1, 3DES, SHA1, and DH Groups 1, 2, 5 are not available due to
        known security vulnerabilities and NIST deprecation.
      </Alert>
      <SimpleGrid cols={2} spacing="sm">
        <Select
          label="Encryption" size="sm" radius="sm"
          data={P1_ENCRYPTION_OPTIONS}
          value={state.p1Encryption}
          onChange={(val) => onUpdate('p1Encryption', val ?? 'aes-256')}
        />
        <Select
          label="Hash" size="sm" radius="sm"
          data={P1_HASH_OPTIONS}
          value={state.p1Hash}
          onChange={(val) => onUpdate('p1Hash', val ?? 'sha512')}
        />
      </SimpleGrid>
      <SimpleGrid cols={2} spacing="sm">
        <Select
          label="DH Group" size="sm" radius="sm"
          data={DH_GROUP_OPTIONS}
          value={state.p1DhGroup}
          onChange={(val) => onUpdate('p1DhGroup', val ?? 'ecp384')}
        />
        <TextInput
          label="Lifetime" size="sm" radius="sm"
          value={state.p1Lifetime}
          onChange={(e) => onUpdate('p1Lifetime', e.currentTarget.value)}
        />
      </SimpleGrid>
    </Stack>
  );
}

function IPsecPhase2Step({ state, onUpdate }: IPsecStepProps) {
  return (
    <Stack gap="md">
      <Alert variant="light" color="blue" radius="sm" title="Deprecation notice" icon={false}
        styles={{
          title: { fontSize: 'var(--mantine-font-size-sm)' },
          message: { fontSize: 'var(--mantine-font-size-xs)' },
        }}>
        SHA1 and PFS Groups 1, 2, 5 are not available due to known security
        vulnerabilities and NIST deprecation.
      </Alert>
      <SimpleGrid cols={2} spacing="sm">
        <Select
          label="Encryption" size="sm" radius="sm"
          data={P2_ENCRYPTION_OPTIONS}
          value={state.p2Encryption}
          onChange={(val) => onUpdate('p2Encryption', val ?? 'aes-256-cbc')}
        />
        <Select
          label="Auth Algorithm" size="sm" radius="sm"
          data={P2_AUTH_OPTIONS}
          value={state.p2AuthAlgorithm}
          onChange={(val) => onUpdate('p2AuthAlgorithm', val ?? 'sha256')}
        />
      </SimpleGrid>
      <SimpleGrid cols={2} spacing="sm">
        <Select
          label="PFS Group" size="sm" radius="sm"
          data={PFS_GROUP_OPTIONS}
          value={state.p2PfsGroup}
          onChange={(val) => onUpdate('p2PfsGroup', val ?? 'modp2048')}
        />
        <TextInput
          label="Lifetime" size="sm" radius="sm"
          value={state.p2Lifetime}
          onChange={(e) => onUpdate('p2Lifetime', e.currentTarget.value)}
        />
      </SimpleGrid>
    </Stack>
  );
}

function SubnetList({ items, onRemove, onAdd, placeholder, error }: {
  items: string[];
  onRemove: (index: number) => void;
  onAdd: (value: string) => void;
  placeholder: string;
  error?: string;
}) {
  const [input, setInput] = useState('');

  const handleAdd = () => {
    if (input.trim()) {
      onAdd(input.trim());
      setInput('');
    }
  };

  return (
    <Stack gap="sm">
      <Group gap="sm">
        <TextInput
          placeholder={placeholder}
          size="sm" radius="sm"
          style={{ flex: 1 }}
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          error={error}
        />
        <Button size="sm" variant="light" leftSection={<IconPlus size={14} />}
          disabled={!input.trim()} onClick={handleAdd}>
          Add
        </Button>
      </Group>
      {items.length > 0 && (
        <Table withRowBorders={false} style={{
          borderCollapse: 'collapse' as const,
          border: '1px solid var(--mantine-color-gray-3)',
          borderRadius: 4,
          overflow: 'hidden',
        }}>
          <Table.Tbody>
            {items.map((item, i) => (
              <Table.Tr key={`${item}-${i}`} style={{
                borderBottom: i < items.length - 1 ? '1px solid var(--mantine-color-gray-1)' : undefined,
              }}>
                <Table.Td>
                  <Text size="sm" ff="monospace">{item}</Text>
                </Table.Td>
                <Table.Td style={{ width: 40 }}>
                  <ActionIcon size="sm" variant="subtle" color="red" onClick={() => onRemove(i)}>
                    <IconTrash size={14} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}

function IPsecNetworksStep({ state, errors = {}, onUpdate }: IPsecStepProps) {
  if (state.mode === 'route-based') {
    return (
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Add destination networks to route through this tunnel.
        </Text>
        <SubnetList
          items={state.tunnelRoutes}
          placeholder="e.g. 10.20.0.0/24"
          error={errors.tunnelRoutes}
          onAdd={(v) => onUpdate('tunnelRoutes', [...state.tunnelRoutes, v])}
          onRemove={(i) => onUpdate('tunnelRoutes', state.tunnelRoutes.filter((_, j) => j !== i))}
        />
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Add local and remote subnets. Policies will be created for every combination.
      </Text>
      <SimpleGrid cols={2} spacing="sm">
        <Stack gap="xs">
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: 0.5 }}>Local Subnets</Text>
          <SubnetList
            items={state.localSubnets}
            placeholder="e.g. 10.0.1.0/24"
            error={errors.localSubnets}
            onAdd={(v) => onUpdate('localSubnets', [...state.localSubnets, v])}
            onRemove={(i) => onUpdate('localSubnets', state.localSubnets.filter((_, j) => j !== i))}
          />
        </Stack>
        <Stack gap="xs">
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" style={{ letterSpacing: 0.5 }}>Remote Subnets</Text>
          <SubnetList
            items={state.remoteSubnets}
            placeholder="e.g. 10.20.0.0/24"
            error={errors.remoteSubnets}
            onAdd={(v) => onUpdate('remoteSubnets', [...state.remoteSubnets, v])}
            onRemove={(i) => onUpdate('remoteSubnets', state.remoteSubnets.filter((_, j) => j !== i))}
          />
        </Stack>
      </SimpleGrid>
    </Stack>
  );
}

