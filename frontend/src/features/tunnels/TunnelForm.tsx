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
  Badge,
  Box,
} from '@mantine/core';
import { IconBuildingTunnel, IconPlus, IconTrash } from '@tabler/icons-react';
import type {
  Tunnel,
  GRETunnel,
  IPsecTunnel,
  MergedGRETunnel,
  MergedIPsecTunnel,
  CreateGRETunnelPayload,
  CreateIPsecTunnelPayload,
} from '../../api/types';
import {
  useCreateGRETunnel,
  useUpdateGRETunnel,
  useCreateIPsecTunnel,
  useUpdateIPsecTunnel,
} from './tunnelsApi';
import { useCluster } from '../routers/clustersApi';
import { useMergedInterfaces } from '../interfaces/interfacesApi';

type TunnelType = 'gre' | 'ipsec';

type EditTunnel = Tunnel | MergedGRETunnel | MergedIPsecTunnel | null;

interface TunnelFormProps {
  isOpen: boolean;
  onClose: () => void;
  clusterId: string;
  tunnelType: TunnelType;
  editTunnel?: EditTunnel;
}

// ─── Shared endpoint state ───────────────────────────────────────────────────

interface EndpointState {
  routerId: string;
  routerName: string;
  role: string;
  localAddress: string;
  remoteAddress: string;
}

// ─── IPv4 validation ─────────────────────────────────────────────────────────

function isValidIPv4(ip: string): boolean {
  const parts = ip.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!/^\d{1,3}$/.test(p)) return false;
    const n = Number(p);
    return n >= 0 && n <= 255;
  });
}

// ─── GRE Form State ─────────────────────────────────────────────────────────

interface GREFormState {
  name: string;
  endpoints: EndpointState[];
  keepaliveInterval: number;
  keepaliveRetries: number;
  mtu: number;
  ipsecSecret: string;
  comment: string;
}

function isMergedTunnel(t: EditTunnel): t is MergedGRETunnel | MergedIPsecTunnel {
  return !!t && 'endpoints' in t && !('id' in t);
}

function isLegacyTunnel(t: EditTunnel): t is Tunnel {
  return !!t && 'id' in t;
}

function getInitialGREState(
  tunnel: EditTunnel,
  clusterRouters: { id: string; name: string; role: string }[],
): GREFormState {
  if (isMergedTunnel(tunnel) && 'mtu' in tunnel) {
    const merged = tunnel as MergedGRETunnel;
    return {
      name: merged.name,
      endpoints: merged.endpoints.map((ep) => ({
        routerId: ep.routerId,
        routerName: ep.routerName,
        role: ep.role,
        localAddress: ep.localAddress || '0.0.0.0',
        remoteAddress: ep.remoteAddress || '',
      })),
      keepaliveInterval: merged.keepaliveInterval,
      keepaliveRetries: merged.keepaliveRetries,
      mtu: merged.mtu,
      ipsecSecret: merged.ipsecSecret,
      comment: merged.comment,
    };
  }
  if (isLegacyTunnel(tunnel) && tunnel.tunnelType === 'gre') {
    const gre = tunnel as GRETunnel;
    return {
      name: gre.name,
      endpoints: clusterRouters.map((r) => ({
        routerId: r.id,
        routerName: r.name,
        role: r.role,
        localAddress: gre.localAddress || '0.0.0.0',
        remoteAddress: gre.remoteAddress || '',
      })),
      keepaliveInterval: gre.keepaliveInterval,
      keepaliveRetries: gre.keepaliveRetries,
      mtu: gre.mtu,
      ipsecSecret: gre.ipsecSecret,
      comment: gre.comment,
    };
  }
  return {
    name: '',
    endpoints: clusterRouters.map((r) => ({
      routerId: r.id,
      routerName: r.name,
      role: r.role,
      localAddress: '0.0.0.0',
      remoteAddress: '',
    })),
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
  endpoints: EndpointState[];
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

function getInitialIPsecState(
  tunnel: EditTunnel,
  clusterRouters: { id: string; name: string; role: string }[],
): IPsecFormState {
  if (isMergedTunnel(tunnel) && 'phase1' in tunnel) {
    const merged = tunnel as MergedIPsecTunnel;
    return {
      name: merged.name,
      mode: merged.mode as 'route-based' | 'policy-based',
      endpoints: merged.endpoints.map((ep) => ({
        routerId: ep.routerId,
        routerName: ep.routerName,
        role: ep.role,
        localAddress: ep.localAddress || '0.0.0.0',
        remoteAddress: ep.remoteAddress || '',
      })),
      authMethod: merged.authMethod,
      ipsecSecret: merged.ipsecSecret,
      comment: merged.comment,
      p1Encryption: merged.phase1.encryption,
      p1Hash: merged.phase1.hash,
      p1DhGroup: merged.phase1.dhGroup,
      p1Lifetime: merged.phase1.lifetime,
      p2Encryption: merged.phase2.encryption,
      p2AuthAlgorithm: merged.phase2.authAlgorithm,
      p2PfsGroup: merged.phase2.pfsGroup,
      p2Lifetime: merged.phase2.lifetime,
      localSubnets: [...merged.localSubnets],
      remoteSubnets: [...merged.remoteSubnets],
      tunnelRoutes: [...merged.tunnelRoutes],
    };
  }
  if (isLegacyTunnel(tunnel) && tunnel.tunnelType === 'ipsec') {
    const ipsec = tunnel as IPsecTunnel;
    return {
      name: ipsec.name,
      mode: ipsec.mode,
      endpoints: clusterRouters.map((r) => ({
        routerId: r.id,
        routerName: r.name,
        role: r.role,
        localAddress: ipsec.localAddress || '0.0.0.0',
        remoteAddress: ipsec.remoteAddress || '',
      })),
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
    endpoints: clusterRouters.map((r) => ({
      routerId: r.id,
      routerName: r.name,
      role: r.role,
      localAddress: '0.0.0.0',
      remoteAddress: '',
    })),
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

// ─── Router Endpoint Card ────────────────────────────────────────────────────

interface RouterEndpointCardProps {
  endpoint: EndpointState;
  addressOptions: { value: string; label: string }[];
  errors: Record<string, string>;
  submitted: boolean;
  onLocalAddressChange: (value: string) => void;
  onRemoteAddressChange: (value: string) => void;
}

function RouterEndpointCard({
  endpoint,
  addressOptions,
  errors,
  submitted,
  onLocalAddressChange,
  onRemoteAddressChange,
}: RouterEndpointCardProps) {
  const errorKey = `endpoint-${endpoint.routerId}-remoteAddress`;
  return (
    <Box
      style={{
        border: '1px solid var(--mantine-color-gray-3)',
        borderRadius: 8,
        padding: 12,
      }}
    >
      <Group gap="xs" mb="sm">
        <Text fw={500} size="sm">{endpoint.routerName}</Text>
        <Badge
          variant="light"
          size="sm"
          radius="sm"
          color={endpoint.role === 'master' ? 'blue' : 'orange'}
        >
          {endpoint.role}
        </Badge>
      </Group>
      <SimpleGrid cols={2} spacing="sm">
        <Select
          label="Local Address"
          size="sm"
          radius="sm"
          data={addressOptions}
          value={endpoint.localAddress}
          onChange={(val) => onLocalAddressChange(val ?? '0.0.0.0')}
        />
        <TextInput
          label="Remote Address"
          placeholder="e.g. 172.16.10.1"
          required
          size="sm"
          radius="sm"
          value={endpoint.remoteAddress}
          onChange={(e) => onRemoteAddressChange(e.currentTarget.value)}
          error={submitted ? errors[errorKey] : undefined}
        />
      </SimpleGrid>
    </Box>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function TunnelForm({
  isOpen,
  onClose,
  clusterId,
  tunnelType,
  editTunnel,
}: TunnelFormProps) {
  const isEdit = !!editTunnel;
  const editName = editTunnel ? ('name' in editTunnel ? editTunnel.name : '') : '';
  const totalSteps = tunnelType === 'gre' ? 1 : 4;

  const [activeStep, setActiveStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Cluster data for router list and per-router interfaces
  const { data: cluster } = useCluster(clusterId);
  const { data: mergedInterfaces } = useMergedInterfaces(clusterId);

  const clusterRouters = useMemo(() => {
    if (!cluster?.routers) return [];
    return cluster.routers.map((r) => ({
      id: r.id,
      name: r.name,
      role: r.role,
    }));
  }, [cluster?.routers]);

  // Build address options per router from merged interfaces
  const addressOptionsByRouter = useMemo(() => {
    const map: Record<string, { value: string; label: string }[]> = {};
    for (const router of clusterRouters) {
      const auto = { value: '0.0.0.0', label: 'Auto (0.0.0.0)' };
      if (!mergedInterfaces) {
        map[router.id] = [auto];
        continue;
      }
      const addrs = mergedInterfaces.flatMap((iface) => {
        const ep = iface.endpoints.find((e) => e.routerId === router.id);
        if (!ep) return [];
        return ep.addresses.map((a) => ({
          value: a.address.split('/')[0],
          label: `${a.address.split('/')[0]} (${iface.name})`,
        }));
      });
      map[router.id] = [auto, ...addrs];
    }
    return map;
  }, [clusterRouters, mergedInterfaces]);

  const [greState, setGreState] = useState<GREFormState>(
    getInitialGREState(editTunnel ?? null, clusterRouters),
  );
  const [ipsecState, setIpsecState] = useState<IPsecFormState>(
    getInitialIPsecState(editTunnel ?? null, clusterRouters),
  );

  // Cluster-scoped mutation hooks
  const createGRE = useCreateGRETunnel(clusterId);
  const updateGRE = useUpdateGRETunnel(clusterId);
  const createIPsec = useCreateIPsecTunnel(clusterId);
  const updateIPsec = useUpdateIPsecTunnel(clusterId);

  // Reset form when drawer opens/closes or cluster routers change
  useEffect(() => {
    if (isOpen) {
      setActiveStep(0);
      setErrors({});
      setSubmitted(false);
      setSaving(false);
      setSubmitError(null);
      setGreState(getInitialGREState(editTunnel ?? null, clusterRouters));
      setIpsecState(getInitialIPsecState(editTunnel ?? null, clusterRouters));
    }
  }, [isOpen, editTunnel, clusterRouters]);

  // ─── Endpoint updaters ──────────────────────────────────────────────────────

  function updateGREEndpoint(routerId: string, field: 'localAddress' | 'remoteAddress', value: string) {
    setGreState((prev) => ({
      ...prev,
      endpoints: prev.endpoints.map((ep) =>
        ep.routerId === routerId ? { ...ep, [field]: value } : ep,
      ),
    }));
    const errorKey = `endpoint-${routerId}-${field}`;
    if (errors[errorKey]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[errorKey];
        return next;
      });
    }
  }

  function updateIPsecEndpoint(routerId: string, field: 'localAddress' | 'remoteAddress', value: string) {
    setIpsecState((prev) => ({
      ...prev,
      endpoints: prev.endpoints.map((ep) =>
        ep.routerId === routerId ? { ...ep, [field]: value } : ep,
      ),
    }));
    const errorKey = `endpoint-${routerId}-${field}`;
    if (errors[errorKey]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[errorKey];
        return next;
      });
    }
  }

  // ─── GRE validation ────────────────────────────────────────────────────────

  function validateGRE(): boolean {
    const newErrors: Record<string, string> = {};
    if (!(greState.name || '').trim()) newErrors.name = 'Name is required';
    for (const ep of greState.endpoints) {
      if (!(ep.remoteAddress || '').trim()) {
        newErrors[`endpoint-${ep.routerId}-remoteAddress`] = 'Remote address is required';
      } else if (!isValidIPv4((ep.remoteAddress || '').trim())) {
        newErrors[`endpoint-${ep.routerId}-remoteAddress`] = 'Must be a valid IPv4 address';
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ─── IPsec validation ─────────────────────────────────────────────────────

  function validateIPsecStep(step: number): boolean {
    const newErrors: Record<string, string> = {};

    if (step === 0) {
      if (!(ipsecState.name || '').trim()) newErrors.name = 'Name is required';
      for (const ep of ipsecState.endpoints) {
        if (!(ep.remoteAddress || '').trim()) {
          newErrors[`endpoint-${ep.routerId}-remoteAddress`] = 'Remote address is required';
        } else if (!isValidIPv4((ep.remoteAddress || '').trim())) {
          newErrors[`endpoint-${ep.routerId}-remoteAddress`] = 'Must be a valid IPv4 address';
        }
      }
      if (ipsecState.authMethod === 'pre-shared-key' && !(ipsecState.ipsecSecret || '').trim()) {
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
    setSubmitError(null);
    try {
      if (tunnelType === 'gre') {
        const payload: CreateGRETunnelPayload = {
          name: (greState.name || '').trim(),
          mtu: greState.mtu,
          keepaliveInterval: greState.keepaliveInterval,
          keepaliveRetries: greState.keepaliveRetries,
          ipsecSecret: greState.ipsecSecret,
          disabled: false,
          comment: (greState.comment || '').trim(),
          endpoints: greState.endpoints.map((ep) => ({
            routerId: ep.routerId,
            localAddress: ep.localAddress,
            remoteAddress: (ep.remoteAddress || '').trim(),
          })),
        };

        if (isEdit) {
          const { name: _, ...body } = payload;
          await updateGRE.mutateAsync({ name: editName, ...body });
        } else {
          await createGRE.mutateAsync(payload);
        }
      } else {
        const payload: CreateIPsecTunnelPayload = {
          name: (ipsecState.name || '').trim(),
          mode: ipsecState.mode,
          authMethod: ipsecState.authMethod,
          ipsecSecret: ipsecState.ipsecSecret,
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
          comment: (ipsecState.comment || '').trim(),
          endpoints: ipsecState.endpoints.map((ep) => ({
            routerId: ep.routerId,
            localAddress: ep.localAddress,
            remoteAddress: (ep.remoteAddress || '').trim(),
          })),
        };

        if (isEdit) {
          const { name: _, ...body } = payload;
          await updateIPsec.mutateAsync({ name: editName, ...body });
        } else {
          await createIPsec.mutateAsync(payload);
        }
      }

      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to save tunnel';
      setSubmitError(msg);
    } finally {
      setSaving(false);
    }
  }

  // ─── GRE field updater ────────────────────────────────────────────────────

  function updateGREField<K extends keyof GREFormState>(field: K, value: GREFormState[K]) {
    setGreState((prev) => ({ ...prev, [field]: value }));
    if (errors[field as string]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field as string];
        return next;
      });
    }
  }

  // ─── IPsec field updater ──────────────────────────────────────────────────

  function updateIPsecField<K extends keyof IPsecFormState>(field: K, value: IPsecFormState[K]) {
    setIpsecState((prev) => ({ ...prev, [field]: value }));
    if (errors[field as string]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field as string];
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
            disabled={isEdit}
            size="sm"
            radius="sm"
            value={greState.name}
            onChange={(e) => updateGREField('name', e.currentTarget.value)}
            error={submitted ? errors.name : undefined}
          />
          {/* Router endpoint cards */}
          <Stack gap="sm">
            <Text size="sm" fw={500}>Router Endpoints</Text>
            {greState.endpoints.map((ep) => (
              <RouterEndpointCard
                key={ep.routerId}
                endpoint={ep}
                addressOptions={addressOptionsByRouter[ep.routerId] ?? [{ value: '0.0.0.0', label: 'Auto (0.0.0.0)' }]}
                errors={errors}
                submitted={submitted}
                onLocalAddressChange={(val) => updateGREEndpoint(ep.routerId, 'localAddress', val)}
                onRemoteAddressChange={(val) => updateGREEndpoint(ep.routerId, 'remoteAddress', val)}
              />
            ))}
          </Stack>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--mantine-spacing-sm)' }}>
            <NumberInput
              label="MTU"
              size="sm"
              radius="sm"
              value={greState.mtu}
              onChange={(val) => updateGREField('mtu', typeof val === 'number' ? val : 1476)}
              min={68}
              max={65535}
            />
            <NumberInput
              label="Keepalive"
              placeholder="0 to disable"
              suffix="s"
              size="sm"
              radius="sm"
              value={greState.keepaliveInterval}
              onChange={(val) => updateGREField('keepaliveInterval', typeof val === 'number' ? val : 10)}
              min={0}
            />
            <NumberInput
              label="Retries"
              size="sm"
              radius="sm"
              value={greState.keepaliveRetries}
              onChange={(val) => updateGREField('keepaliveRetries', typeof val === 'number' ? val : 10)}
              min={0}
            />
          </div>
          <PasswordInput
            label="IPsec Secret"
            placeholder="Leave empty for no encryption"
            size="sm"
            radius="sm"
            value={greState.ipsecSecret}
            onChange={(e) => updateGREField('ipsecSecret', e.currentTarget.value)}
          />
          <TextInput
            label="Comment"
            placeholder="Optional description"
            size="sm"
            radius="sm"
            value={greState.comment}
            onChange={(e) => updateGREField('comment', e.currentTarget.value)}
          />
          {submitError && (
            <Alert variant="light" color="red" radius="sm" title="Error">
              {submitError}
            </Alert>
          )}
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
            <IPsecConnectionStep
              state={ipsecState}
              errors={errors}
              submitted={submitted}
              isEdit={isEdit}
              onUpdate={updateIPsecField}
              endpoints={ipsecState.endpoints}
              addressOptionsByRouter={addressOptionsByRouter}
              onEndpointChange={updateIPsecEndpoint}
            />
          )}
          {activeStep === 1 && (
            <IPsecPhase1Step state={ipsecState} onUpdate={updateIPsecField} />
          )}
          {activeStep === 2 && (
            <IPsecPhase2Step state={ipsecState} onUpdate={updateIPsecField} />
          )}
          {activeStep === 3 && (
            <IPsecNetworksStep state={ipsecState} errors={errors} onUpdate={updateIPsecField} />
          )}

          {submitError && (
            <Alert variant="light" color="red" radius="sm" title="Error">
              {submitError}
            </Alert>
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
  submitted?: boolean;
  isEdit?: boolean;
  onUpdate: <K extends keyof IPsecFormState>(field: K, value: IPsecFormState[K]) => void;
  endpoints?: EndpointState[];
  addressOptionsByRouter?: Record<string, { value: string; label: string }[]>;
  onEndpointChange?: (routerId: string, field: 'localAddress' | 'remoteAddress', value: string) => void;
}

function IPsecConnectionStep({
  state,
  errors = {},
  submitted = false,
  isEdit = false,
  onUpdate,
  endpoints = [],
  addressOptionsByRouter = {},
  onEndpointChange,
}: IPsecStepProps) {
  return (
    <Stack gap="md">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--mantine-spacing-sm)' }}>
        <TextInput
          label="Name" required disabled={isEdit} size="sm" radius="sm"
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
      {/* Router endpoint cards */}
      <Stack gap="sm">
        <Text size="sm" fw={500}>Router Endpoints</Text>
        {endpoints.map((ep) => (
          <RouterEndpointCard
            key={ep.routerId}
            endpoint={ep}
            addressOptions={addressOptionsByRouter[ep.routerId] ?? [{ value: '0.0.0.0', label: 'Auto (0.0.0.0)' }]}
            errors={errors}
            submitted={submitted}
            onLocalAddressChange={(val) => onEndpointChange?.(ep.routerId, 'localAddress', val)}
            onRemoteAddressChange={(val) => onEndpointChange?.(ep.routerId, 'remoteAddress', val)}
          />
        ))}
      </Stack>
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
