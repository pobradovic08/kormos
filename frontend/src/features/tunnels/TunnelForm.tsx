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
  Group,
  Stack,
  Text,
} from '@mantine/core';
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
  localAddress: string;
  remoteAddress: string;
  ikeVersion: string;
  authMethod: string;
  tunnelInterface: string;
  localSubnet: string;
  remoteSubnet: string;
  comment: string;
  // Phase 1
  p1Encryption: string;
  p1Hash: string;
  p1DhGroup: string;
  p1Lifetime: string;
  // Phase 2
  p2Encryption: string;
  p2Hash: string;
  p2PfsGroup: string;
  p2Lifetime: string;
}

function getInitialIPsecState(tunnel?: Tunnel | null): IPsecFormState {
  if (tunnel && tunnel.tunnelType === 'ipsec') {
    const ipsec = tunnel as IPsecTunnel;
    return {
      name: ipsec.name,
      mode: ipsec.mode,
      localAddress: ipsec.localAddress,
      remoteAddress: ipsec.remoteAddress,
      ikeVersion: String(ipsec.ikeVersion),
      authMethod: ipsec.authMethod,
      tunnelInterface: ipsec.tunnelInterface,
      localSubnet: ipsec.localSubnet,
      remoteSubnet: ipsec.remoteSubnet,
      comment: ipsec.comment,
      p1Encryption: ipsec.phase1.encryption,
      p1Hash: ipsec.phase1.hash,
      p1DhGroup: String(ipsec.phase1.dhGroup),
      p1Lifetime: ipsec.phase1.lifetime,
      p2Encryption: ipsec.phase2.encryption,
      p2Hash: ipsec.phase2.hash,
      p2PfsGroup: String(ipsec.phase2.pfsGroup),
      p2Lifetime: ipsec.phase2.lifetime,
    };
  }
  return {
    name: '',
    mode: 'route-based',
    localAddress: '',
    remoteAddress: '',
    ikeVersion: '2',
    authMethod: 'pre-shared-key',
    tunnelInterface: '',
    localSubnet: '',
    remoteSubnet: '',
    comment: '',
    p1Encryption: 'aes-256-cbc',
    p1Hash: 'sha256',
    p1DhGroup: '14',
    p1Lifetime: '8h',
    p2Encryption: 'aes-256-cbc',
    p2Hash: 'sha256',
    p2PfsGroup: '14',
    p2Lifetime: '1h',
  };
}

// ─── Select options ─────────────────────────────────────────────────────────

const ENCRYPTION_OPTIONS = [
  { value: 'aes-128-cbc', label: 'AES-128-CBC' },
  { value: 'aes-256-cbc', label: 'AES-256-CBC' },
  { value: 'aes-128-gcm', label: 'AES-128-GCM' },
  { value: 'aes-256-gcm', label: 'AES-256-GCM' },
];

const HASH_OPTIONS = [
  { value: 'sha1', label: 'SHA1' },
  { value: 'sha256', label: 'SHA256' },
  { value: 'sha512', label: 'SHA512' },
  { value: 'none', label: 'None' },
];

const DH_GROUP_OPTIONS = [
  { value: '1', label: 'Group 1' },
  { value: '2', label: 'Group 2' },
  { value: '5', label: 'Group 5' },
  { value: '14', label: 'Group 14' },
  { value: '19', label: 'Group 19' },
  { value: '20', label: 'Group 20' },
];

const PFS_GROUP_OPTIONS = [
  { value: '0', label: 'None' },
  { value: '1', label: 'Group 1' },
  { value: '2', label: 'Group 2' },
  { value: '5', label: 'Group 5' },
  { value: '14', label: 'Group 14' },
  { value: '19', label: 'Group 19' },
  { value: '20', label: 'Group 20' },
];

const IKE_VERSION_OPTIONS = [
  { value: '1', label: 'IKEv1' },
  { value: '2', label: 'IKEv2' },
];

const AUTH_METHOD_OPTIONS = [
  { value: 'pre-shared-key', label: 'Pre-shared Key' },
  { value: 'certificate', label: 'Certificate' },
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
  const totalSteps = tunnelType === 'gre' ? 1 : 3;

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
      if (!ipsecState.localAddress.trim()) newErrors.localAddress = 'Local address is required';
      if (!ipsecState.remoteAddress.trim()) newErrors.remoteAddress = 'Remote address is required';
      if (ipsecState.mode === 'route-based' && !ipsecState.tunnelInterface.trim()) {
        newErrors.tunnelInterface = 'Tunnel interface is required for route-based mode';
      }
      if (ipsecState.mode === 'policy-based') {
        if (!ipsecState.localSubnet.trim()) newErrors.localSubnet = 'Local subnet is required';
        if (!ipsecState.remoteSubnet.trim()) newErrors.remoteSubnet = 'Remote subnet is required';
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
          localAddress: ipsecState.localAddress.trim(),
          remoteAddress: ipsecState.remoteAddress.trim(),
          ikeVersion: Number(ipsecState.ikeVersion) as 1 | 2,
          authMethod: ipsecState.authMethod as 'pre-shared-key' | 'certificate',
          tunnelInterface: ipsecState.tunnelInterface.trim(),
          localSubnet: ipsecState.localSubnet.trim(),
          remoteSubnet: ipsecState.remoteSubnet.trim(),
          comment: ipsecState.comment.trim(),
          phase1: {
            encryption: ipsecState.p1Encryption,
            hash: ipsecState.p1Hash,
            dhGroup: Number(ipsecState.p1DhGroup),
            lifetime: ipsecState.p1Lifetime,
          },
          phase2: {
            encryption: ipsecState.p2Encryption,
            hash: ipsecState.p2Hash,
            pfsGroup: Number(ipsecState.p2PfsGroup),
            lifetime: ipsecState.p2Lifetime,
          },
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
      title={<Text fw={600}>{title}</Text>}
    >
      {tunnelType === 'gre' ? (
        /* ─── GRE: flat form, no stepper ─────────────────────────── */
        <Stack gap="xs">
          <div>
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
            {!errors.name && <div style={{ height: 20 }} />}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--mantine-spacing-sm)' }}>
            <div>
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
              {!errors.remoteAddress && <div style={{ height: 20 }} />}
            </div>
            <div>
              <Select
                label="Local Tunnel Endpoint"
                size="sm"
                radius="sm"
                data={addressOptions}
                value={greState.localAddress}
                onChange={(val) => updateGRE('localAddress', val ?? '0.0.0.0')}
              />
              <div style={{ height: 20 }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--mantine-spacing-sm)' }}>
            <div>
              <NumberInput
                label="Keepalive Interval"
                placeholder="0 to disable"
                suffix="s"
                size="sm"
                radius="sm"
                value={greState.keepaliveInterval}
                onChange={(val) => updateGRE('keepaliveInterval', typeof val === 'number' ? val : 10)}
                min={0}
              />
              <div style={{ height: 20 }} />
            </div>
            <div>
              <NumberInput
                label="Keepalive Retries"
                size="sm"
                radius="sm"
                value={greState.keepaliveRetries}
                onChange={(val) => updateGRE('keepaliveRetries', typeof val === 'number' ? val : 10)}
                min={0}
              />
              <div style={{ height: 20 }} />
            </div>
            <div>
              <NumberInput
                label="MTU"
                size="sm"
                radius="sm"
                value={greState.mtu}
                onChange={(val) => updateGRE('mtu', typeof val === 'number' ? val : 1476)}
                min={68}
                max={65535}
              />
              <div style={{ height: 20 }} />
            </div>
          </div>
          <div>
            <PasswordInput
              label="IPsec Secret"
              placeholder="Leave empty for no encryption"
              size="sm"
              radius="sm"
              value={greState.ipsecSecret}
              onChange={(e) => updateGRE('ipsecSecret', e.currentTarget.value)}
            />
            <div style={{ height: 20 }} />
          </div>
          <div>
            <TextInput
              label="Comment"
              placeholder="Optional description"
              size="sm"
              radius="sm"
              value={greState.comment}
              onChange={(e) => updateGRE('comment', e.currentTarget.value)}
            />
            <div style={{ height: 20 }} />
          </div>
          <Group justify="space-between" mt="sm">
            <Button variant="default" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit} loading={saving}>
              {submitLabel}
            </Button>
          </Group>
        </Stack>
      ) : (
        /* ─── IPsec: stepper form ────────────────────────────────── */
        <Stack gap="lg">
          <Stepper active={activeStep} size="sm" allowNextStepsSelect={isEdit}>
            <Stepper.Step label="Connection" description="Basic settings" />
            <Stepper.Step label="Phase 1" description="IKE proposal" />
            <Stepper.Step label="Phase 2" description="IPsec proposal" />
          </Stepper>

          {activeStep === 0 && (
            <IPsecConnectionStep state={ipsecState} errors={errors} onUpdate={updateIPsec} />
          )}
          {activeStep === 1 && (
            <IPsecPhase1Step state={ipsecState} onUpdate={updateIPsec} />
          )}
          {activeStep === 2 && (
            <IPsecPhase2Step state={ipsecState} onUpdate={updateIPsec} />
          )}

          <Group justify="space-between">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Group gap="sm">
              {activeStep > 0 && (
                <Button variant="default" onClick={handleBack}>
                  Back
                </Button>
              )}
              {isLastStep ? (
                <Button onClick={handleSubmit} loading={saving}>
                  {submitLabel}
                </Button>
              ) : (
                <Button onClick={handleNext}>
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
}

function IPsecConnectionStep({ state, errors = {}, onUpdate }: IPsecStepProps) {
  return (
    <Stack gap="md" mt="md">
      <TextInput
        label="Name"
        required
        value={state.name}
        onChange={(e) => onUpdate('name', e.currentTarget.value)}
        error={errors.name}
      />
      <div>
        <Text size="sm" fw={500} mb={4}>
          Mode
        </Text>
        <SegmentedControl
          fullWidth
          value={state.mode}
          onChange={(val) => onUpdate('mode', val as 'route-based' | 'policy-based')}
          data={[
            { value: 'route-based', label: 'Route-based' },
            { value: 'policy-based', label: 'Policy-based' },
          ]}
        />
      </div>
      <Group grow>
        <TextInput
          label="Local Address"
          required
          value={state.localAddress}
          onChange={(e) => onUpdate('localAddress', e.currentTarget.value)}
          error={errors.localAddress}
        />
        <TextInput
          label="Remote Address"
          required
          value={state.remoteAddress}
          onChange={(e) => onUpdate('remoteAddress', e.currentTarget.value)}
          error={errors.remoteAddress}
        />
      </Group>
      <Group grow>
        <Select
          label="IKE Version"
          data={IKE_VERSION_OPTIONS}
          value={state.ikeVersion}
          onChange={(val) => onUpdate('ikeVersion', val ?? '2')}
        />
        <Select
          label="Auth Method"
          data={AUTH_METHOD_OPTIONS}
          value={state.authMethod}
          onChange={(val) => onUpdate('authMethod', val ?? 'pre-shared-key')}
        />
      </Group>
      {state.mode === 'route-based' && (
        <TextInput
          label="Tunnel Interface"
          required
          value={state.tunnelInterface}
          onChange={(e) => onUpdate('tunnelInterface', e.currentTarget.value)}
          error={errors.tunnelInterface}
        />
      )}
      {state.mode === 'policy-based' && (
        <Group grow>
          <TextInput
            label="Local Subnet"
            required
            value={state.localSubnet}
            onChange={(e) => onUpdate('localSubnet', e.currentTarget.value)}
            error={errors.localSubnet}
          />
          <TextInput
            label="Remote Subnet"
            required
            value={state.remoteSubnet}
            onChange={(e) => onUpdate('remoteSubnet', e.currentTarget.value)}
            error={errors.remoteSubnet}
          />
        </Group>
      )}
      <TextInput
        label="Comment"
        value={state.comment}
        onChange={(e) => onUpdate('comment', e.currentTarget.value)}
      />
    </Stack>
  );
}

function IPsecPhase1Step({ state, onUpdate }: IPsecStepProps) {
  return (
    <Stack gap="md" mt="md">
      <Group grow>
        <Select
          label="Encryption"
          data={ENCRYPTION_OPTIONS}
          value={state.p1Encryption}
          onChange={(val) => onUpdate('p1Encryption', val ?? 'aes-256-cbc')}
        />
        <Select
          label="Hash"
          data={HASH_OPTIONS}
          value={state.p1Hash}
          onChange={(val) => onUpdate('p1Hash', val ?? 'sha256')}
        />
      </Group>
      <Group grow>
        <Select
          label="DH Group"
          data={DH_GROUP_OPTIONS}
          value={state.p1DhGroup}
          onChange={(val) => onUpdate('p1DhGroup', val ?? '14')}
        />
        <TextInput
          label="Lifetime"
          value={state.p1Lifetime}
          onChange={(e) => onUpdate('p1Lifetime', e.currentTarget.value)}
        />
      </Group>
    </Stack>
  );
}

function IPsecPhase2Step({ state, onUpdate }: IPsecStepProps) {
  return (
    <Stack gap="md" mt="md">
      <Group grow>
        <Select
          label="Encryption"
          data={ENCRYPTION_OPTIONS}
          value={state.p2Encryption}
          onChange={(val) => onUpdate('p2Encryption', val ?? 'aes-256-cbc')}
        />
        <Select
          label="Hash"
          data={HASH_OPTIONS}
          value={state.p2Hash}
          onChange={(val) => onUpdate('p2Hash', val ?? 'sha256')}
        />
      </Group>
      <Group grow>
        <Select
          label="PFS Group"
          data={PFS_GROUP_OPTIONS}
          value={state.p2PfsGroup}
          onChange={(val) => onUpdate('p2PfsGroup', val ?? '14')}
        />
        <TextInput
          label="Lifetime"
          value={state.p2Lifetime}
          onChange={(e) => onUpdate('p2Lifetime', e.currentTarget.value)}
        />
      </Group>
    </Stack>
  );
}

