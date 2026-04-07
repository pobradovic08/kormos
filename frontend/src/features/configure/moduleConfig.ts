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

export function configurePath(clusterId: string, slug?: string): string {
  return slug ? `/configure/${clusterId}/${slug}` : `/configure/${clusterId}`;
}

export const modules: ModuleConfig[] = [
  { title: 'Interfaces', subtitle: 'Configure interface addresses', icon: IconNetwork, route: 'interfaces', isEnabled: true },
  { title: 'Routes', subtitle: 'Configure static routes', icon: IconRouteAltRight, route: 'routes', isEnabled: true },
  { title: 'Firewall', subtitle: 'Configure firewall filter rules', icon: IconShieldCheck, route: 'firewall', isEnabled: true },
  { title: 'Address Lists', subtitle: 'Configure firewall address lists', icon: IconListDetails, route: 'address-lists', isEnabled: true },
  { title: 'NAT', subtitle: 'Configure NAT rules', icon: IconArrowsShuffle, route: 'nat', isEnabled: false },
  { title: 'Tunnels', subtitle: 'Configure IPsec / GRE tunnels', icon: IconBuilding, route: 'tunnels', isEnabled: true },
  { title: 'WireGuard', subtitle: 'Configure WireGuard VPN', icon: IconLock, route: 'wireguard', isEnabled: true },
  { title: 'Queues', subtitle: 'Configure bandwidth management', icon: IconGauge, route: 'queues', isEnabled: false },
];
