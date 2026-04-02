import { SimpleGrid, Card, Text, Stack, ThemeIcon } from '@mantine/core';
import {
  IconNetwork,
  IconTags,
  IconLink,
  IconBuildingBridge2,
  IconShieldLock,
  IconArrowsShuffle,
  IconArrowsShuffle2,
  IconRepeat,
} from '@tabler/icons-react';

export interface InterfaceTypeOption {
  type: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  resourcePath: string;
}

const interfaceTypeOptions: InterfaceTypeOption[] = [
  {
    type: 'ether',
    label: 'Ethernet',
    description: 'Physical ethernet interface. Cannot be created, only edited.',
    icon: <IconNetwork size={28} />,
    resourcePath: '/rest/interface/ethernet',
  },
  {
    type: 'vlan',
    label: 'VLAN',
    description: 'Virtual LAN interface bound to a parent interface with a VLAN ID.',
    icon: <IconTags size={28} />,
    resourcePath: '/rest/interface/vlan',
  },
  {
    type: 'bonding',
    label: 'Bonding',
    description: 'Link aggregation combining multiple interfaces for redundancy or throughput.',
    icon: <IconLink size={28} />,
    resourcePath: '/rest/interface/bonding',
  },
  {
    type: 'bridge',
    label: 'Bridge',
    description: 'Layer 2 bridge connecting multiple interfaces into one broadcast domain.',
    icon: <IconBuildingBridge2 size={28} />,
    resourcePath: '/rest/interface/bridge',
  },
  {
    type: 'wireguard',
    label: 'WireGuard',
    description: 'Modern, high-performance VPN tunnel interface.',
    icon: <IconShieldLock size={28} />,
    resourcePath: '/rest/interface/wireguard',
  },
  {
    type: 'gre',
    label: 'GRE Tunnel',
    description: 'Generic Routing Encapsulation tunnel between two endpoints.',
    icon: <IconArrowsShuffle size={28} />,
    resourcePath: '/rest/interface/gre',
  },
  {
    type: 'eoip',
    label: 'EoIP Tunnel',
    description: 'Ethernet over IP tunnel, a MikroTik proprietary Layer 2 tunnel.',
    icon: <IconArrowsShuffle2 size={28} />,
    resourcePath: '/rest/interface/eoip',
  },
  {
    type: 'loopback',
    label: 'Loopback',
    description: 'Virtual loopback interface, typically used for router IDs and management.',
    icon: <IconRepeat size={28} />,
    resourcePath: '/rest/interface/bridge',
  },
];

interface InterfaceTypeSelectorProps {
  onSelect: (option: InterfaceTypeOption) => void;
}

export default function InterfaceTypeSelector({ onSelect }: InterfaceTypeSelectorProps) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
      {interfaceTypeOptions.map((option) => (
        <Card
          key={option.type}
          shadow="sm"
          padding="lg"
          radius="md"
          withBorder
          onClick={() => onSelect(option)}
          style={{ cursor: 'pointer' }}
          className="interface-type-card"
        >
          <Stack gap="xs" align="center" ta="center">
            <ThemeIcon size={48} radius="md" variant="light" color="blue">
              {option.icon}
            </ThemeIcon>
            <Text fw={600} size="sm">
              {option.label}
            </Text>
            <Text size="xs" c="dimmed" lineClamp={2}>
              {option.description}
            </Text>
          </Stack>
        </Card>
      ))}
    </SimpleGrid>
  );
}
