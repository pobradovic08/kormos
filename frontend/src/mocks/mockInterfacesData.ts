import type { RouterInterface } from '../api/types';

function mac(suffix: string): string {
  return `AA:BB:CC:DD:${suffix}`;
}

// Interfaces per router ID
const interfacesByRouter: Record<string, RouterInterface[]> = {
  // edge-gw-01
  'mock-1': [
    {
      id: 'iface-1-1', name: 'ether1', type: 'ether', running: true, disabled: false,
      comment: 'WAN Uplink', mtu: 1500, mac_address: mac('01:01'),
      addresses: [{ id: 'addr-1-1', address: '203.0.113.2/24', network: '203.0.113.0', interface: 'ether1' }],
      properties: { speed: '1Gbps', duplex: 'full' },
    },
    {
      id: 'iface-1-2', name: 'ether2', type: 'ether', running: true, disabled: false,
      comment: 'LAN Trunk', mtu: 1500, mac_address: mac('01:02'),
      addresses: [{ id: 'addr-1-2', address: '10.0.1.1/24', network: '10.0.1.0', interface: 'ether2' }],
      properties: { speed: '10Gbps', duplex: 'full' },
    },
    {
      id: 'iface-1-3', name: 'vlan100', type: 'vlan', running: true, disabled: false,
      comment: 'Management VLAN', mtu: 1500, mac_address: mac('01:03'),
      addresses: [{ id: 'addr-1-3', address: '10.100.0.1/24', network: '10.100.0.0', interface: 'vlan100' }],
      properties: { vlanId: 100, interface: 'ether2' },
    },
    {
      id: 'iface-1-4', name: 'vlan200', type: 'vlan', running: true, disabled: false,
      comment: 'User VLAN', mtu: 1500, mac_address: mac('01:04'),
      addresses: [{ id: 'addr-1-4', address: '10.200.0.1/22', network: '10.200.0.0', interface: 'vlan200' }],
      properties: { vlanId: 200, interface: 'ether2' },
    },
    {
      id: 'iface-1-5', name: 'lo0', type: 'loopback', running: true, disabled: false,
      comment: 'Loopback', mtu: 65535, mac_address: '',
      addresses: [{ id: 'addr-1-5', address: '10.255.255.1/32', network: '10.255.255.1', interface: 'lo0' }],
      properties: {},
    },
    {
      id: 'iface-1-6', name: 'vrrp1', type: 'vrrp', running: true, disabled: false,
      comment: 'VRRP Gateway', mtu: 1500, mac_address: '00:00:5E:00:01:01',
      addresses: [{ id: 'addr-1-6', address: '10.0.1.254/32', network: '10.0.1.0', interface: 'vrrp1' }],
      properties: { vrid: 1, priority: 200, interface: 'ether2' },
    },
    {
      id: 'iface-1-7', name: 'ether3', type: 'ether', running: false, disabled: true,
      comment: '', mtu: 1500, mac_address: mac('01:07'),
      addresses: [], properties: { speed: '1Gbps' },
    },
  ],

  // edge-gw-02
  'mock-2': [
    {
      id: 'iface-2-1', name: 'ether1', type: 'ether', running: true, disabled: false,
      comment: 'WAN Uplink', mtu: 1500, mac_address: mac('02:01'),
      addresses: [{ id: 'addr-2-1', address: '203.0.113.3/24', network: '203.0.113.0', interface: 'ether1' }],
      properties: { speed: '1Gbps', duplex: 'full' },
    },
    {
      id: 'iface-2-2', name: 'ether2', type: 'ether', running: true, disabled: false,
      comment: 'LAN Trunk', mtu: 1500, mac_address: mac('02:02'),
      addresses: [{ id: 'addr-2-2', address: '10.0.1.4/24', network: '10.0.1.0', interface: 'ether2' }],
      properties: { speed: '10Gbps', duplex: 'full' },
    },
    {
      id: 'iface-2-3', name: 'vrrp1', type: 'vrrp', running: true, disabled: false,
      comment: 'VRRP Gateway (backup)', mtu: 1500, mac_address: '00:00:5E:00:01:01',
      addresses: [],
      properties: { vrid: 1, priority: 100, interface: 'ether2' },
    },
    {
      id: 'iface-2-4', name: 'lo0', type: 'loopback', running: true, disabled: false,
      comment: 'Loopback', mtu: 65535, mac_address: '',
      addresses: [{ id: 'addr-2-4', address: '10.255.255.2/32', network: '10.255.255.2', interface: 'lo0' }],
      properties: {},
    },
  ],

  // core-rtr-01
  'mock-3': [
    {
      id: 'iface-3-1', name: 'ether1', type: 'ether', running: true, disabled: false,
      comment: 'Uplink to edge-gw', mtu: 9000, mac_address: mac('03:01'),
      addresses: [{ id: 'addr-3-1', address: '10.0.1.2/24', network: '10.0.1.0', interface: 'ether1' }],
      properties: { speed: '10Gbps', duplex: 'full' },
    },
    {
      id: 'iface-3-2', name: 'ether2', type: 'ether', running: true, disabled: false,
      comment: 'Server network', mtu: 9000, mac_address: mac('03:02'),
      addresses: [{ id: 'addr-3-2', address: '10.10.0.1/24', network: '10.10.0.0', interface: 'ether2' }],
      properties: { speed: '10Gbps', duplex: 'full' },
    },
    {
      id: 'iface-3-3', name: 'bridge1', type: 'bridge', running: true, disabled: false,
      comment: 'Management bridge', mtu: 1500, mac_address: mac('03:03'),
      addresses: [{ id: 'addr-3-3', address: '172.31.0.1/24', network: '172.31.0.0', interface: 'bridge1' }],
      properties: { protocol: 'rstp' },
    },
  ],

  // core-rtr-02
  'mock-4': [
    {
      id: 'iface-4-1', name: 'ether1', type: 'ether', running: true, disabled: false,
      comment: 'Uplink to edge-gw', mtu: 9000, mac_address: mac('04:01'),
      addresses: [{ id: 'addr-4-1', address: '10.0.1.3/24', network: '10.0.1.0', interface: 'ether1' }],
      properties: { speed: '10Gbps', duplex: 'full' },
    },
    {
      id: 'iface-4-2', name: 'ether2', type: 'ether', running: true, disabled: false,
      comment: 'Server network', mtu: 9000, mac_address: mac('04:02'),
      addresses: [{ id: 'addr-4-2', address: '10.10.0.2/24', network: '10.10.0.0', interface: 'ether2' }],
      properties: { speed: '10Gbps', duplex: 'full' },
    },
  ],

  // branch-rtr-bgd
  'mock-5': [
    {
      id: 'iface-5-1', name: 'ether1', type: 'ether', running: true, disabled: false,
      comment: 'WAN', mtu: 1500, mac_address: mac('05:01'),
      addresses: [{ id: 'addr-5-1', address: '172.16.10.1/24', network: '172.16.10.0', interface: 'ether1' }],
      properties: { speed: '1Gbps', duplex: 'full' },
    },
    {
      id: 'iface-5-2', name: 'ether2', type: 'ether', running: true, disabled: false,
      comment: 'LAN', mtu: 1500, mac_address: mac('05:02'),
      addresses: [{ id: 'addr-5-2', address: '192.168.1.1/24', network: '192.168.1.0', interface: 'ether2' }],
      properties: { speed: '1Gbps', duplex: 'full' },
    },
    {
      id: 'iface-5-3', name: 'wg0', type: 'wireguard', running: true, disabled: false,
      comment: 'Site-to-site VPN', mtu: 1420, mac_address: '',
      addresses: [{ id: 'addr-5-3', address: '10.99.0.1/30', network: '10.99.0.0', interface: 'wg0' }],
      properties: { listenPort: 51820, publicKey: 'aB3dE...truncated' },
    },
  ],

  // branch-rtr-nis (offline — return interfaces but they won't be "running")
  'mock-6': [
    {
      id: 'iface-6-1', name: 'ether1', type: 'ether', running: false, disabled: false,
      comment: 'WAN', mtu: 1500, mac_address: mac('06:01'),
      addresses: [{ id: 'addr-6-1', address: '172.16.20.1/24', network: '172.16.20.0', interface: 'ether1' }],
      properties: { speed: '1Gbps' },
    },
    {
      id: 'iface-6-2', name: 'ether2', type: 'ether', running: false, disabled: false,
      comment: 'LAN', mtu: 1500, mac_address: mac('06:02'),
      addresses: [{ id: 'addr-6-2', address: '192.168.2.1/24', network: '192.168.2.0', interface: 'ether2' }],
      properties: { speed: '1Gbps' },
    },
  ],

  // lab-rtr-01
  'mock-7': [
    {
      id: 'iface-7-1', name: 'ether1', type: 'ether', running: true, disabled: false,
      comment: 'Uplink', mtu: 1500, mac_address: mac('07:01'),
      addresses: [{ id: 'addr-7-1', address: '192.168.100.1/24', network: '192.168.100.0', interface: 'ether1' }],
      properties: { speed: '1Gbps', duplex: 'full' },
    },
    {
      id: 'iface-7-2', name: 'ether2', type: 'ether', running: true, disabled: false,
      comment: 'Lab network', mtu: 1500, mac_address: mac('07:02'),
      addresses: [{ id: 'addr-7-2', address: '10.50.0.1/24', network: '10.50.0.0', interface: 'ether2' }],
      properties: { speed: '1Gbps', duplex: 'full' },
    },
    {
      id: 'iface-7-3', name: 'ether3', type: 'ether', running: false, disabled: true,
      comment: 'Unused', mtu: 1500, mac_address: mac('07:03'),
      addresses: [], properties: {},
    },
  ],

  // vpn-gw-01
  'mock-8': [
    {
      id: 'iface-8-1', name: 'ether1', type: 'ether', running: true, disabled: false,
      comment: 'WAN', mtu: 1500, mac_address: mac('08:01'),
      addresses: [{ id: 'addr-8-1', address: '10.0.1.10/24', network: '10.0.1.0', interface: 'ether1' }],
      properties: { speed: '1Gbps', duplex: 'full' },
    },
    {
      id: 'iface-8-2', name: 'l2tp-server', type: 'l2tp-server', running: true, disabled: false,
      comment: 'Remote access VPN', mtu: 1450, mac_address: '',
      addresses: [{ id: 'addr-8-2', address: '10.88.0.1/24', network: '10.88.0.0', interface: 'l2tp-server' }],
      properties: { maxSessions: 100, authentication: 'mschap2' },
    },
    {
      id: 'iface-8-3', name: 'ovpn-server', type: 'ovpn-server', running: true, disabled: false,
      comment: 'OpenVPN server', mtu: 1400, mac_address: '',
      addresses: [{ id: 'addr-8-3', address: '10.89.0.1/24', network: '10.89.0.0', interface: 'ovpn-server' }],
      properties: { port: 1194, protocol: 'udp' },
    },
    {
      id: 'iface-8-4', name: 'wg0', type: 'wireguard', running: true, disabled: false,
      comment: 'WireGuard tunnel', mtu: 1420, mac_address: '',
      addresses: [{ id: 'addr-8-4', address: '10.90.0.1/24', network: '10.90.0.0', interface: 'wg0' }],
      properties: { listenPort: 13231, publicKey: 'xK9pQ...truncated' },
    },
  ],

  // backup-rtr-01 (offline)
  'mock-9': [
    {
      id: 'iface-9-1', name: 'ether1', type: 'ether', running: false, disabled: false,
      comment: 'WAN', mtu: 1500, mac_address: mac('09:01'),
      addresses: [{ id: 'addr-9-1', address: '10.0.2.1/24', network: '10.0.2.0', interface: 'ether1' }],
      properties: { speed: '1Gbps' },
    },
  ],
};

export function listInterfaces(routerId: string): RouterInterface[] {
  return interfacesByRouter[routerId] ?? [];
}

export function getInterface(routerId: string, name: string): RouterInterface | undefined {
  return interfacesByRouter[routerId]?.find((i) => i.name === name);
}
