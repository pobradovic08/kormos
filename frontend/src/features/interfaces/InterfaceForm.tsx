import {
  Stack,
  TextInput,
  NumberInput,
  Switch,
  Select,
  Button,
  Group,
  PasswordInput,
  MultiSelect,
  Text,
  Title,
  Alert,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconInfoCircle } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import IpAddressInput from '../../components/common/IpAddressInput';
import { useClusterId } from '../../hooks/useClusterId';
import apiClient from '../../api/client';
import { useInterfaces } from './interfacesApi';
import type { RouterInterface } from '../../api/types';
import type { InterfaceFormValues } from './interfaceTypes';

interface InterfaceFormProps {
  iface?: RouterInterface;
  interfaceType?: string;
  resourcePath?: string;
  isNew?: boolean;
  onClose: () => void;
}

function interfaceToFormValues(iface: RouterInterface): InterfaceFormValues {
  return {
    comment: iface.comment ?? '',
    addresses: iface.addresses.map((a) => a.address),
    mtu: iface.mtu,
    disabled: iface.disabled,
    arp: (iface.properties?.arp as string) ?? 'enabled',
  };
}

function getDefaultFormValues(interfaceType: string): InterfaceFormValues {
  const base: InterfaceFormValues = {
    name: '',
    comment: '',
    addresses: [],
    mtu: 1500,
    disabled: false,
    arp: 'enabled',
  };

  switch (interfaceType) {
    case 'vlan':
      return { ...base, vlanId: 1, parentInterface: '' };
    case 'bonding':
      return { ...base, bondingMode: '802.3ad', slaves: [] };
    case 'bridge':
      return { ...base, bridgePorts: [], stpEnabled: false };
    case 'wireguard':
      return { ...base, wireguardPrivateKey: '', wireguardListenPort: 13231 };
    case 'gre':
      return { ...base, greLocalAddress: '', greRemoteAddress: '' };
    case 'eoip':
      return { ...base, greLocalAddress: '', greRemoteAddress: '', tunnelId: 0 };
    case 'loopback':
      return { ...base, mtu: 65535 };
    default:
      return base;
  }
}

export default function InterfaceForm({
  iface,
  interfaceType: propType,
  resourcePath: _resourcePath,
  isNew = false,
  onClose,
}: InterfaceFormProps) {
  const clusterId = useClusterId();
  const queryClient = useQueryClient();
  const { data: existingInterfaces } = useInterfaces(clusterId);

  const interfaceType = propType ?? iface?.type ?? '';
  const isEthernet = interfaceType === 'ether';

  const originalValues = iface
    ? interfaceToFormValues(iface)
    : getDefaultFormValues(interfaceType);

  const form = useForm<InterfaceFormValues>({
    mode: 'uncontrolled',
    initialValues: isNew
      ? getDefaultFormValues(interfaceType)
      : { ...originalValues },
    validate: {
      name: isNew
        ? (value) => {
            if (!value || !value.trim()) return 'Interface name is required';
            return null;
          }
        : undefined,
      mtu: (value) => {
        if (value < 68 || value > 65535) return 'MTU must be between 68 and 65535';
        return null;
      },
      vlanId:
        interfaceType === 'vlan'
          ? (value) => {
              if (value == null || value < 1 || value > 4094)
                return 'VLAN ID must be between 1 and 4094';
              return null;
            }
          : undefined,
      parentInterface:
        interfaceType === 'vlan'
          ? (value) => {
              if (!value || !value.trim()) return 'Parent interface is required';
              return null;
            }
          : undefined,
      greLocalAddress:
        interfaceType === 'gre' || interfaceType === 'eoip'
          ? (value) => {
              if (!value || !value.trim()) return 'Local address is required';
              return null;
            }
          : undefined,
      greRemoteAddress:
        interfaceType === 'gre' || interfaceType === 'eoip'
          ? (value) => {
              if (!value || !value.trim()) return 'Remote address is required';
              return null;
            }
          : undefined,
    },
  });

  const existingInterfaceOptions = (existingInterfaces ?? []).map((i) => ({
    value: i.name,
    label: `${i.name} (${i.type})`,
  }));

  const handleSubmit = async (values: InterfaceFormValues) => {
    const cleanedValues = {
      ...values,
      addresses: values.addresses.filter((a) => a.trim() !== ''),
    };

    try {
      if (isNew) {
        await apiClient.post(
          `/clusters/${clusterId}/interfaces`,
          cleanedValues,
        );

        notifications.show({
          title: 'Interface created',
          message: `New ${interfaceType} interface has been created.`,
          color: 'green',
        });
      } else {
        if (!iface) return;

        await apiClient.patch(
          `/clusters/${clusterId}/interfaces/${iface.name}`,
          cleanedValues,
        );

        notifications.show({
          title: 'Interface updated',
          message: `Changes to "${iface.name}" have been applied.`,
          color: 'green',
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['interfaces', clusterId] });
      await queryClient.invalidateQueries({ queryKey: ['interfaces-merged', clusterId] });
      onClose();
    } catch {
      notifications.show({
        title: 'Operation failed',
        message: 'Failed to apply interface changes. Please try again.',
        color: 'red',
      });
    }
  };

  const showTypeFields = isNew || !!propType;

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="md">
        {isNew && isEthernet && (
          <Alert
            icon={<IconInfoCircle size={16} />}
            title="Read-only type"
            color="yellow"
          >
            Ethernet interfaces cannot be created. They are physical interfaces
            that can only be edited.
          </Alert>
        )}

        {isNew && (
          <TextInput
            label="Name"
            placeholder="Interface name"
            required
            key={form.key('name')}
            {...form.getInputProps('name')}
            description="Will be used as the interface name on the router"
          />
        )}

        <TextInput
          label="Comment"
          placeholder="Interface description"
          key={form.key('comment')}
          {...form.getInputProps('comment')}
        />

        <NumberInput
          label="MTU"
          min={68}
          max={65535}
          key={form.key('mtu')}
          {...form.getInputProps('mtu')}
        />

        <Switch
          label="Disabled"
          key={form.key('disabled')}
          {...form.getInputProps('disabled', { type: 'checkbox' })}
        />

        <Select
          label="ARP Mode"
          data={[
            { value: 'enabled', label: 'Enabled' },
            { value: 'disabled', label: 'Disabled' },
            { value: 'proxy-arp', label: 'Proxy ARP' },
            { value: 'reply-only', label: 'Reply Only' },
          ]}
          key={form.key('arp')}
          {...form.getInputProps('arp')}
        />

        <IpAddressInput
          value={form.getValues().addresses}
          onChange={(newAddrs) => form.setFieldValue('addresses', newAddrs)}
        />

        {/* VLAN-specific fields */}
        {showTypeFields && interfaceType === 'vlan' && (
          <>
            <Title order={5} mt="lg" mb="xs">
              VLAN Settings
            </Title>
            <Select
              label="Parent Interface"
              placeholder="Select parent interface"
              data={existingInterfaceOptions}
              searchable
              required
              key={form.key('parentInterface')}
              {...form.getInputProps('parentInterface')}
            />
            <NumberInput
              label="VLAN ID"
              min={1}
              max={4094}
              required
              key={form.key('vlanId')}
              {...form.getInputProps('vlanId')}
            />
          </>
        )}

        {/* Bonding-specific fields */}
        {showTypeFields && interfaceType === 'bonding' && (
          <>
            <Title order={5} mt="lg" mb="xs">
              Bonding Settings
            </Title>
            <Select
              label="Bonding Mode"
              data={[
                { value: '802.3ad', label: '802.3ad (LACP)' },
                { value: 'balance-rr', label: 'Balance Round-Robin' },
                { value: 'balance-xor', label: 'Balance XOR' },
                { value: 'broadcast', label: 'Broadcast' },
                { value: 'active-backup', label: 'Active Backup' },
                { value: 'balance-tlb', label: 'Balance TLB' },
                { value: 'balance-alb', label: 'Balance ALB' },
              ]}
              key={form.key('bondingMode')}
              {...form.getInputProps('bondingMode')}
            />
            <MultiSelect
              label="Slave Interfaces"
              placeholder="Select interfaces to bond"
              data={existingInterfaceOptions}
              searchable
              key={form.key('slaves')}
              {...form.getInputProps('slaves')}
            />
          </>
        )}

        {/* Bridge-specific fields */}
        {showTypeFields && interfaceType === 'bridge' && (
          <>
            <Title order={5} mt="lg" mb="xs">
              Bridge Settings
            </Title>
            <MultiSelect
              label="Bridge Ports"
              placeholder="Select interfaces to bridge"
              data={existingInterfaceOptions}
              searchable
              key={form.key('bridgePorts')}
              {...form.getInputProps('bridgePorts')}
            />
            <Switch
              label="STP Enabled"
              key={form.key('stpEnabled')}
              {...form.getInputProps('stpEnabled', { type: 'checkbox' })}
            />
          </>
        )}

        {/* WireGuard-specific fields */}
        {showTypeFields && interfaceType === 'wireguard' && (
          <>
            <Title order={5} mt="lg" mb="xs">
              WireGuard Settings
            </Title>
            <PasswordInput
              label="Private Key"
              placeholder="Auto-generated if left empty"
              key={form.key('wireguardPrivateKey')}
              {...form.getInputProps('wireguardPrivateKey')}
            />
            <NumberInput
              label="Listen Port"
              min={1}
              max={65535}
              key={form.key('wireguardListenPort')}
              {...form.getInputProps('wireguardListenPort')}
            />
          </>
        )}

        {/* GRE Tunnel-specific fields */}
        {showTypeFields && interfaceType === 'gre' && (
          <>
            <Title order={5} mt="lg" mb="xs">
              GRE Tunnel Settings
            </Title>
            <TextInput
              label="Local Address"
              placeholder="e.g. 10.0.0.1"
              required
              key={form.key('greLocalAddress')}
              {...form.getInputProps('greLocalAddress')}
            />
            <TextInput
              label="Remote Address"
              placeholder="e.g. 10.0.0.2"
              required
              key={form.key('greRemoteAddress')}
              {...form.getInputProps('greRemoteAddress')}
            />
          </>
        )}

        {/* EoIP Tunnel-specific fields */}
        {showTypeFields && interfaceType === 'eoip' && (
          <>
            <Title order={5} mt="lg" mb="xs">
              EoIP Tunnel Settings
            </Title>
            <TextInput
              label="Local Address"
              placeholder="e.g. 10.0.0.1"
              required
              key={form.key('greLocalAddress')}
              {...form.getInputProps('greLocalAddress')}
            />
            <TextInput
              label="Remote Address"
              placeholder="e.g. 10.0.0.2"
              required
              key={form.key('greRemoteAddress')}
              {...form.getInputProps('greRemoteAddress')}
            />
            <NumberInput
              label="Tunnel ID"
              min={0}
              max={65535}
              required
              key={form.key('tunnelId')}
              {...form.getInputProps('tunnelId')}
            />
          </>
        )}

        {/* Loopback has no type-specific fields beyond common ones */}
        {showTypeFields && interfaceType === 'loopback' && (
          <Text size="xs" c="dimmed" mt="md">
            Loopback interfaces only require address configuration (above).
          </Text>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={isNew && isEthernet}>
            {isNew ? 'Create Interface' : 'Save Changes'}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
