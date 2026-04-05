import {
  IconNetwork,
  IconRouteAltRight,
  IconShieldCheck,
  IconListDetails,
  IconArrowsShuffle,
  IconBuilding,
  IconLock,
  IconGauge,
} from '@tabler/icons-react';

export interface ModuleConfig {
  title: string;
  subtitle: string;
  icon: React.ComponentType<any>;
  route: string;
  isEnabled: boolean;
}

export const modules: ModuleConfig[] = [
  { title: 'Interfaces', subtitle: 'Configure interface addresses', icon: IconNetwork, route: '/configure/interfaces', isEnabled: true },
  { title: 'Routes', subtitle: 'Configure static routes', icon: IconRouteAltRight, route: '/configure/routes', isEnabled: true },
  { title: 'Firewall', subtitle: 'Configure firewall filter rules', icon: IconShieldCheck, route: '/configure/firewall', isEnabled: false },
  { title: 'Address Lists', subtitle: 'Configure firewall address lists', icon: IconListDetails, route: '/configure/address-lists', isEnabled: true },
  { title: 'NAT', subtitle: 'Configure NAT rules', icon: IconArrowsShuffle, route: '/configure/nat', isEnabled: false },
  { title: 'Tunnels', subtitle: 'Configure IPsec / GRE tunnels', icon: IconBuilding, route: '/configure/tunnels', isEnabled: true },
  { title: 'WireGuard', subtitle: 'Configure WireGuard VPN', icon: IconLock, route: '/configure/wireguard', isEnabled: false },
  { title: 'Queues', subtitle: 'Configure bandwidth management', icon: IconGauge, route: '/configure/queues', isEnabled: false },
];
