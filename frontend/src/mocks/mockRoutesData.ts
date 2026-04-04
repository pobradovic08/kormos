import type { Route } from '../api/types';

// Routes per router ID
const routesByRouter: Record<string, Route[]> = {
  // edge-gw-01
  'mock-1': [
    {
      id: 'route-1-1', destination: '0.0.0.0/0', gateway: '203.0.113.1', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'Default route via ISP',
    },
    {
      id: 'route-1-2', destination: '203.0.113.0/24', gateway: '', interface: 'ether1',
      distance: 0, routeType: 'connected', routingMark: '', disabled: false, active: true, comment: '',
    },
    {
      id: 'route-1-3', destination: '10.0.1.0/24', gateway: '', interface: 'ether2',
      distance: 0, routeType: 'connected', routingMark: '', disabled: false, active: true, comment: '',
    },
    {
      id: 'route-1-4', destination: '10.100.0.0/24', gateway: '', interface: 'vlan100',
      distance: 0, routeType: 'connected', routingMark: '', disabled: false, active: true, comment: '',
    },
    {
      id: 'route-1-5', destination: '10.200.0.0/22', gateway: '', interface: 'vlan200',
      distance: 0, routeType: 'connected', routingMark: '', disabled: false, active: true, comment: '',
    },
    {
      id: 'route-1-6', destination: '10.255.255.1/32', gateway: '', interface: 'lo0',
      distance: 0, routeType: 'connected', routingMark: '', disabled: false, active: true, comment: '',
    },
    {
      id: 'route-1-7', destination: '10.0.1.254/32', gateway: '', interface: 'vrrp1',
      distance: 0, routeType: 'connected', routingMark: '', disabled: false, active: true, comment: '',
    },
    {
      id: 'route-1-8', destination: '10.10.0.0/24', gateway: '10.0.1.2', interface: 'ether2',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'Server network via core-rtr-01',
    },
    {
      id: 'route-1-9', destination: '172.31.0.0/24', gateway: '10.0.1.2', interface: 'ether2',
      distance: 1, routeType: 'static', routingMark: 'mgmt', disabled: false, active: true, comment: 'Management via core-rtr-01',
    },
    {
      id: 'route-1-10', destination: '172.16.10.0/24', gateway: '10.0.1.10', interface: 'ether2',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'Branch BGD via VPN gateway',
    },
    {
      id: 'route-1-11', destination: '192.168.1.0/24', gateway: '10.0.1.10', interface: 'ether2',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'Branch BGD LAN via VPN',
    },
    {
      id: 'route-1-12', destination: '10.0.0.0/8', gateway: '', interface: '',
      distance: 1, routeType: 'blackhole', routingMark: '', disabled: false, active: true, comment: 'Bogon filter - RFC1918',
    },
    {
      id: 'route-1-13', destination: '192.168.0.0/16', gateway: '', interface: '',
      distance: 1, routeType: 'blackhole', routingMark: '', disabled: false, active: true, comment: 'Bogon filter - RFC1918',
    },
    {
      id: 'route-1-14', destination: '10.50.0.0/24', gateway: '10.0.1.2', interface: 'ether2',
      distance: 1, routeType: 'static', routingMark: '', disabled: true, active: false, comment: 'Lab network (disabled)',
    },
    {
      id: 'route-1-15', destination: '172.16.20.0/24', gateway: '10.0.1.10', interface: 'ether2',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: false, comment: 'Branch NIS - gateway unreachable',
    },
  ],

  // edge-gw-02
  'mock-2': [
    {
      id: 'route-2-1', destination: '0.0.0.0/0', gateway: '203.0.113.1', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'Default route via ISP',
    },
    {
      id: 'route-2-2', destination: '203.0.113.0/24', gateway: '', interface: 'ether1',
      distance: 0, routeType: 'connected', routingMark: '', disabled: false, active: true, comment: '',
    },
    {
      id: 'route-2-3', destination: '10.0.1.0/24', gateway: '', interface: 'ether2',
      distance: 0, routeType: 'connected', routingMark: '', disabled: false, active: true, comment: '',
    },
    {
      id: 'route-2-4', destination: '10.255.255.2/32', gateway: '', interface: 'lo0',
      distance: 0, routeType: 'connected', routingMark: '', disabled: false, active: true, comment: '',
    },
    {
      id: 'route-2-5', destination: '10.10.0.0/24', gateway: '10.0.1.2', interface: 'ether2',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'Server network via core-rtr-01',
    },
    {
      id: 'route-2-6', destination: '172.31.0.0/24', gateway: '10.0.1.2', interface: 'ether2',
      distance: 1, routeType: 'static', routingMark: 'mgmt', disabled: false, active: true, comment: 'Management via core-rtr-01',
    },
    {
      id: 'route-2-7', destination: '10.0.0.0/8', gateway: '', interface: '',
      distance: 1, routeType: 'blackhole', routingMark: '', disabled: false, active: true, comment: 'Bogon filter - RFC1918',
    },
    {
      id: 'route-2-8', destination: '192.168.0.0/16', gateway: '', interface: '',
      distance: 1, routeType: 'blackhole', routingMark: '', disabled: false, active: true, comment: 'Bogon filter - RFC1918',
    },
    {
      id: 'route-2-9', destination: '172.16.10.0/24', gateway: '10.0.1.10', interface: 'ether2',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'Branch BGD via VPN gateway',
    },
    {
      id: 'route-2-10', destination: '10.100.0.0/24', gateway: '10.0.1.1', interface: 'ether2',
      distance: 2, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'Management VLAN via edge-gw-01',
    },
    {
      id: 'route-2-11', destination: '10.200.0.0/22', gateway: '10.0.1.1', interface: 'ether2',
      distance: 2, routeType: 'static', routingMark: '', disabled: true, active: false, comment: 'User VLAN (disabled - primary on edge-gw-01)',
    },
  ],

  // core-rtr-01
  'mock-3': [
    {
      id: 'route-3-1', destination: '0.0.0.0/0', gateway: '10.0.1.1', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'Default via edge-gw-01',
    },
    {
      id: 'route-3-2', destination: '10.0.1.0/24', gateway: '', interface: 'ether1',
      distance: 0, routeType: 'connected', routingMark: '', disabled: false, active: true, comment: '',
    },
    {
      id: 'route-3-3', destination: '10.10.0.0/24', gateway: '', interface: 'ether2',
      distance: 0, routeType: 'connected', routingMark: '', disabled: false, active: true, comment: '',
    },
    {
      id: 'route-3-4', destination: '172.31.0.0/24', gateway: '', interface: 'bridge1',
      distance: 0, routeType: 'connected', routingMark: '', disabled: false, active: true, comment: '',
    },
    {
      id: 'route-3-5', destination: '10.100.0.0/24', gateway: '10.0.1.1', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'Management VLAN via edge-gw-01',
    },
    {
      id: 'route-3-6', destination: '10.200.0.0/22', gateway: '10.0.1.1', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'User VLAN via edge-gw-01',
    },
    {
      id: 'route-3-7', destination: '10.50.0.0/24', gateway: '10.10.0.2', interface: 'ether2',
      distance: 1, routeType: 'static', routingMark: '', disabled: true, active: false, comment: 'Lab network (disabled)',
    },
    {
      id: 'route-3-8', destination: '0.0.0.0/0', gateway: '10.0.1.4', interface: 'ether1',
      distance: 2, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'Backup default via edge-gw-02',
    },
  ],

  // core-rtr-02
  'mock-4': [
    {
      id: 'route-4-1', destination: '0.0.0.0/0', gateway: '10.0.1.1', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'Default via edge-gw-01',
    },
    {
      id: 'route-4-2', destination: '10.0.1.0/24', gateway: '', interface: 'ether1',
      distance: 0, routeType: 'connected', routingMark: '', disabled: false, active: true, comment: '',
    },
    {
      id: 'route-4-3', destination: '10.10.0.0/24', gateway: '', interface: 'ether2',
      distance: 0, routeType: 'connected', routingMark: '', disabled: false, active: true, comment: '',
    },
    {
      id: 'route-4-4', destination: '10.100.0.0/24', gateway: '10.0.1.1', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'Management VLAN',
    },
    {
      id: 'route-4-5', destination: '10.200.0.0/22', gateway: '10.0.1.1', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'User VLAN',
    },
    {
      id: 'route-4-6', destination: '172.31.0.0/24', gateway: '10.0.1.2', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'Management bridge via core-rtr-01',
    },
    {
      id: 'route-4-7', destination: '0.0.0.0/0', gateway: '10.0.1.4', interface: 'ether1',
      distance: 2, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'Backup default via edge-gw-02',
    },
    {
      id: 'route-4-8', destination: '192.168.1.0/24', gateway: '10.0.1.10', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'Branch BGD LAN via VPN gateway',
    },
    {
      id: 'route-4-9', destination: '192.168.2.0/24', gateway: '10.0.1.10', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: false, comment: 'Branch NIS LAN - gateway unreachable',
    },
    {
      id: 'route-4-10', destination: '10.88.0.0/24', gateway: '10.0.1.10', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'L2TP VPN pool',
    },
    {
      id: 'route-4-11', destination: '10.89.0.0/24', gateway: '10.0.1.10', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'OpenVPN pool',
    },
    {
      id: 'route-4-12', destination: '10.90.0.0/24', gateway: '10.0.1.10', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: true, active: false, comment: 'WireGuard pool (disabled)',
    },
  ],

  // branch-rtr-bgd
  'mock-5': [
    {
      id: 'route-5-1', destination: '0.0.0.0/0', gateway: '172.16.10.254', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'Default via local ISP',
    },
    {
      id: 'route-5-2', destination: '172.16.10.0/24', gateway: '', interface: 'ether1',
      distance: 0, routeType: 'connected', routingMark: '', disabled: false, active: true, comment: '',
    },
    {
      id: 'route-5-3', destination: '192.168.1.0/24', gateway: '', interface: 'ether2',
      distance: 0, routeType: 'connected', routingMark: '', disabled: false, active: true, comment: '',
    },
    {
      id: 'route-5-4', destination: '10.99.0.0/30', gateway: '', interface: 'wg0',
      distance: 0, routeType: 'connected', routingMark: '', disabled: false, active: true, comment: '',
    },
    {
      id: 'route-5-5', destination: '10.0.1.0/24', gateway: '10.99.0.2', interface: 'wg0',
      distance: 1, routeType: 'static', routingMark: 'vpn', disabled: false, active: true, comment: 'HQ core network via VPN',
    },
    {
      id: 'route-5-6', destination: '10.10.0.0/24', gateway: '10.99.0.2', interface: 'wg0',
      distance: 1, routeType: 'static', routingMark: 'vpn', disabled: false, active: true, comment: 'HQ server network via VPN',
    },
    {
      id: 'route-5-7', destination: '10.100.0.0/24', gateway: '10.99.0.2', interface: 'wg0',
      distance: 1, routeType: 'static', routingMark: 'vpn', disabled: false, active: true, comment: 'HQ management VLAN via VPN',
    },
    {
      id: 'route-5-8', destination: '172.31.0.0/24', gateway: '10.99.0.2', interface: 'wg0',
      distance: 1, routeType: 'static', routingMark: 'vpn', disabled: false, active: true, comment: 'HQ management bridge via VPN',
    },
    {
      id: 'route-5-9', destination: '192.168.2.0/24', gateway: '10.99.0.2', interface: 'wg0',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: false, comment: 'Branch NIS LAN - remote side down',
    },
    {
      id: 'route-5-10', destination: '10.50.0.0/24', gateway: '10.99.0.2', interface: 'wg0',
      distance: 1, routeType: 'static', routingMark: '', disabled: true, active: false, comment: 'Lab network (disabled)',
    },
  ],

  // branch-rtr-nis (offline)
  'mock-6': [
    {
      id: 'route-6-1', destination: '0.0.0.0/0', gateway: '172.16.20.254', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: false, comment: 'Default via local ISP',
    },
    {
      id: 'route-6-2', destination: '172.16.20.0/24', gateway: '', interface: 'ether1',
      distance: 0, routeType: 'connected', routingMark: '', disabled: false, active: false, comment: '',
    },
    {
      id: 'route-6-3', destination: '192.168.2.0/24', gateway: '', interface: 'ether2',
      distance: 0, routeType: 'connected', routingMark: '', disabled: false, active: false, comment: '',
    },
    {
      id: 'route-6-4', destination: '10.0.1.0/24', gateway: '172.16.20.254', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: false, comment: 'HQ core network via ISP',
    },
    {
      id: 'route-6-5', destination: '10.10.0.0/24', gateway: '172.16.20.254', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: false, comment: 'HQ server network',
    },
    {
      id: 'route-6-6', destination: '192.168.1.0/24', gateway: '172.16.20.254', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: false, comment: 'Branch BGD LAN',
    },
    {
      id: 'route-6-7', destination: '10.200.0.0/22', gateway: '172.16.20.254', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: true, active: false, comment: 'User VLAN (disabled)',
    },
  ],

  // lab-rtr-01
  'mock-7': [
    {
      id: 'route-7-1', destination: '0.0.0.0/0', gateway: '192.168.100.254', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'Default via uplink',
    },
    {
      id: 'route-7-2', destination: '192.168.100.0/24', gateway: '', interface: 'ether1',
      distance: 0, routeType: 'connected', routingMark: '', disabled: false, active: true, comment: '',
    },
    {
      id: 'route-7-3', destination: '10.50.0.0/24', gateway: '', interface: 'ether2',
      distance: 0, routeType: 'connected', routingMark: '', disabled: false, active: true, comment: '',
    },
    {
      id: 'route-7-4', destination: '10.10.0.0/24', gateway: '192.168.100.254', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'Server network via uplink',
    },
    {
      id: 'route-7-5', destination: '172.31.0.0/24', gateway: '192.168.100.254', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: true, active: false, comment: 'Management bridge (disabled)',
    },
  ],

  // vpn-gw-01
  'mock-8': [
    {
      id: 'route-8-1', destination: '0.0.0.0/0', gateway: '10.0.1.1', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'Default via edge-gw-01',
    },
    {
      id: 'route-8-2', destination: '10.0.1.0/24', gateway: '', interface: 'ether1',
      distance: 0, routeType: 'connected', routingMark: '', disabled: false, active: true, comment: '',
    },
    {
      id: 'route-8-3', destination: '10.88.0.0/24', gateway: '', interface: 'l2tp-server',
      distance: 0, routeType: 'connected', routingMark: '', disabled: false, active: true, comment: '',
    },
    {
      id: 'route-8-4', destination: '10.89.0.0/24', gateway: '', interface: 'ovpn-server',
      distance: 0, routeType: 'connected', routingMark: '', disabled: false, active: true, comment: '',
    },
    {
      id: 'route-8-5', destination: '10.90.0.0/24', gateway: '', interface: 'wg0',
      distance: 0, routeType: 'connected', routingMark: '', disabled: false, active: true, comment: '',
    },
    {
      id: 'route-8-6', destination: '192.168.1.0/24', gateway: '10.99.0.1', interface: 'wg0',
      distance: 1, routeType: 'static', routingMark: 'vpn', disabled: false, active: true, comment: 'Branch BGD LAN via WireGuard',
    },
    {
      id: 'route-8-7', destination: '172.16.10.0/24', gateway: '10.99.0.1', interface: 'wg0',
      distance: 1, routeType: 'static', routingMark: 'vpn', disabled: false, active: true, comment: 'Branch BGD WAN via WireGuard',
    },
    {
      id: 'route-8-8', destination: '192.168.2.0/24', gateway: '10.99.0.1', interface: 'wg0',
      distance: 1, routeType: 'static', routingMark: 'vpn', disabled: false, active: false, comment: 'Branch NIS LAN - tunnel down',
    },
    {
      id: 'route-8-9', destination: '10.10.0.0/24', gateway: '10.0.1.2', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'Server network via core-rtr-01',
    },
    {
      id: 'route-8-10', destination: '10.100.0.0/24', gateway: '10.0.1.1', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'Management VLAN via edge-gw-01',
    },
    {
      id: 'route-8-11', destination: '10.200.0.0/22', gateway: '10.0.1.1', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'User VLAN via edge-gw-01',
    },
    {
      id: 'route-8-12', destination: '172.31.0.0/24', gateway: '10.0.1.2', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'Management bridge via core-rtr-01',
    },
    {
      id: 'route-8-13', destination: '10.50.0.0/24', gateway: '10.0.1.2', interface: 'ether1',
      distance: 1, routeType: 'static', routingMark: '', disabled: true, active: false, comment: 'Lab network (disabled)',
    },
    {
      id: 'route-8-14', destination: '0.0.0.0/0', gateway: '10.0.1.4', interface: 'ether1',
      distance: 2, routeType: 'static', routingMark: '', disabled: false, active: true, comment: 'Backup default via edge-gw-02',
    },
  ],
};

export function listRoutes(routerId: string): Route[] {
  return routesByRouter[routerId] ?? [];
}

export function getRoute(routerId: string, id: string): Route | undefined {
  return routesByRouter[routerId]?.find((r) => r.id === id);
}
