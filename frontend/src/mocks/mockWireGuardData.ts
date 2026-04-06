import type { WireGuardInterface, WireGuardPeer } from '../api/types';

function mockKey(prefix: string): string {
  return `${prefix}${'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef'.slice(0, 32)}=`;
}

const seedInterfaces: Record<string, WireGuardInterface[]> = {
  'mock-1': [
    {
      id: 'wg-iface-1-1', name: 'wg0', listenPort: 13231, mtu: 1420,
      privateKey: mockKey('srv-priv-'), publicKey: mockKey('srv-pub-'),
      gatewayAddress: '10.10.0.1/24', dns: '10.0.1.1',
      clientAllowedIPs: '10.0.0.0/8, 192.168.0.0/16', disabled: false,
    },
    {
      id: 'wg-iface-1-2', name: 'wg-guest', listenPort: 13232, mtu: 1420,
      privateKey: mockKey('guest-priv-'), publicKey: mockKey('guest-pub-'),
      gatewayAddress: '10.11.0.1/24', dns: '8.8.8.8',
      clientAllowedIPs: '0.0.0.0/0', disabled: false,
    },
  ],
  'mock-2': [
    {
      id: 'wg-iface-2-1', name: 'wg0', listenPort: 51820, mtu: 1420,
      privateKey: mockKey('srv2-priv-'), publicKey: mockKey('srv2-pub-'),
      gatewayAddress: '10.20.0.1/24', dns: '',
      clientAllowedIPs: '0.0.0.0/0', disabled: false,
    },
  ],
  'mock-3': [],
  'mock-4': [],
  'mock-5': [],
  'mock-6': [],
  'mock-7': [],
  'mock-8': [
    {
      id: 'wg-iface-8-1', name: 'wg-vpn', listenPort: 13231, mtu: 1420,
      privateKey: mockKey('vpn-priv-'), publicKey: mockKey('vpn-pub-'),
      gatewayAddress: '10.50.0.1/24', dns: '10.0.1.1, 10.0.1.2',
      clientAllowedIPs: '10.0.0.0/8', disabled: false,
    },
  ],
  'mock-9': [],
};

const seedPeers: Record<string, WireGuardPeer[]> = {
  'mock-1': [
    {
      id: 'wg-peer-1-1', interface: 'wg0', name: 'Pavle - Laptop',
      publicKey: mockKey('peer1-pub-'), presharedKey: '',
      allowedAddress: '10.10.0.2/32',
      endpointAddress: '82.117.200.15', endpointPort: 49321,
      lastHandshake: '2026-04-05T11:45:00Z', rx: 15482880, tx: 3276800,
      persistentKeepalive: 25, disabled: false, comment: 'Primary laptop',
      clientPrivateKey: mockKey('peer1-priv-'),
    },
    {
      id: 'wg-peer-1-2', interface: 'wg0', name: 'Pavle - Phone',
      publicKey: mockKey('peer2-pub-'), presharedKey: mockKey('peer2-psk-'),
      allowedAddress: '10.10.0.3/32',
      endpointAddress: '82.117.200.15', endpointPort: 51200,
      lastHandshake: '2026-04-05T10:30:00Z', rx: 5242880, tx: 1048576,
      persistentKeepalive: 25, disabled: false, comment: 'Mobile phone',
      clientPrivateKey: mockKey('peer2-priv-'),
    },
    {
      id: 'wg-peer-1-3', interface: 'wg0', name: 'Marko - Laptop',
      publicKey: mockKey('peer3-pub-'), presharedKey: '',
      allowedAddress: '10.10.0.4/32',
      endpointAddress: '', endpointPort: 0,
      lastHandshake: '', rx: 0, tx: 0,
      persistentKeepalive: 25, disabled: false, comment: 'Never connected',
    },
    {
      id: 'wg-peer-1-4', interface: 'wg0', name: 'Old test device',
      publicKey: mockKey('peer4-pub-'), presharedKey: '',
      allowedAddress: '10.10.0.5/32',
      endpointAddress: '93.87.12.100', endpointPort: 43210,
      lastHandshake: '2026-03-01T08:00:00Z', rx: 102400, tx: 51200,
      persistentKeepalive: 0, disabled: true, comment: 'Decommissioned',
    },
    {
      id: 'wg-peer-1-5', interface: 'wg-guest', name: 'Guest user 1',
      publicKey: mockKey('guest1-pub-'), presharedKey: '',
      allowedAddress: '10.11.0.2/32',
      endpointAddress: '93.87.50.20', endpointPort: 44000,
      lastHandshake: '2026-04-05T12:00:00Z', rx: 1048576, tx: 524288,
      persistentKeepalive: 25, disabled: false, comment: 'Guest access',
      clientPrivateKey: mockKey('guest1-priv-'),
    },
  ],
  'mock-2': [
    {
      id: 'wg-peer-2-1', interface: 'wg0', name: 'Admin VPN',
      publicKey: mockKey('adm-pub-'), presharedKey: '',
      allowedAddress: '10.20.0.2/32',
      endpointAddress: '203.0.113.50', endpointPort: 45000,
      lastHandshake: '2026-04-05T12:00:00Z', rx: 52428800, tx: 10485760,
      persistentKeepalive: 25, disabled: false, comment: '',
      clientPrivateKey: mockKey('adm-priv-'),
    },
  ],
  'mock-3': [], 'mock-4': [], 'mock-5': [], 'mock-6': [], 'mock-7': [],
  'mock-8': [
    {
      id: 'wg-peer-8-1', interface: 'wg-vpn', name: 'Site engineer',
      publicKey: mockKey('eng-pub-'), presharedKey: mockKey('eng-psk-'),
      allowedAddress: '10.50.0.2/32',
      endpointAddress: '198.51.100.10', endpointPort: 61000,
      lastHandshake: '2026-04-05T11:55:00Z', rx: 8388608, tx: 2097152,
      persistentKeepalive: 25, disabled: false, comment: '',
      clientPrivateKey: mockKey('eng-priv-'),
    },
    {
      id: 'wg-peer-8-2', interface: 'wg-vpn', name: 'Monitoring probe',
      publicKey: mockKey('mon-pub-'), presharedKey: '',
      allowedAddress: '10.50.0.3/32',
      endpointAddress: '198.51.100.20', endpointPort: 51820,
      lastHandshake: '2026-04-05T11:59:00Z', rx: 204800, tx: 102400,
      persistentKeepalive: 15, disabled: false, comment: 'Automated probe',
    },
  ],
  'mock-9': [],
};

let interfaces = structuredClone(seedInterfaces);
let peers = structuredClone(seedPeers);
let nextIfaceId = 1000;
let nextPeerId = 1000;

// ─── Interface operations ────────────────────────────────────────────────────

export function listWireGuardInterfaces(routerId: string): WireGuardInterface[] {
  return interfaces[routerId] ?? [];
}

export function getWireGuardInterface(routerId: string, id: string): WireGuardInterface | undefined {
  return interfaces[routerId]?.find((i) => i.id === id);
}

export function createWireGuardInterface(routerId: string, wg: Omit<WireGuardInterface, 'id' | 'publicKey' | 'privateKey'>): WireGuardInterface {
  if (!interfaces[routerId]) interfaces[routerId] = [];
  const iface: WireGuardInterface = {
    ...wg,
    id: `wg-iface-${nextIfaceId++}`,
    privateKey: mockKey('gen-priv-'),
    publicKey: mockKey('gen-pub-'),
  };
  interfaces[routerId].push(iface);
  return iface;
}

export function updateWireGuardInterface(routerId: string, id: string, updates: Partial<WireGuardInterface>): WireGuardInterface {
  const list = interfaces[routerId];
  if (!list) throw new Error('Router not found');
  const index = list.findIndex((i) => i.id === id);
  if (index === -1) throw new Error('Interface not found');
  list[index] = { ...list[index], ...updates, id };
  return list[index];
}

export function deleteWireGuardInterface(routerId: string, id: string): void {
  if (!interfaces[routerId]) return;
  const iface = interfaces[routerId].find((i) => i.id === id);
  if (iface) {
    // Remove peers belonging to this interface
    if (peers[routerId]) {
      peers[routerId] = peers[routerId].filter((p) => p.interface !== iface.name);
    }
  }
  interfaces[routerId] = interfaces[routerId].filter((i) => i.id !== id);
}

// ─── Peer operations ─────────────────────────────────────────────────────────

export function listPeers(routerId: string): WireGuardPeer[] {
  return peers[routerId] ?? [];
}

export function listPeersForInterface(routerId: string, ifaceName: string): WireGuardPeer[] {
  return (peers[routerId] ?? []).filter((p) => p.interface === ifaceName);
}

export function getPeer(routerId: string, id: string): WireGuardPeer | undefined {
  return peers[routerId]?.find((p) => p.id === id);
}

export function addPeer(routerId: string, peer: Omit<WireGuardPeer, 'id'>): WireGuardPeer {
  if (!peers[routerId]) peers[routerId] = [];
  const newPeer = { ...peer, id: `wg-peer-${nextPeerId++}` };
  peers[routerId].push(newPeer);
  return newPeer;
}

export function updatePeer(routerId: string, id: string, updates: Partial<WireGuardPeer>): WireGuardPeer {
  const list = peers[routerId];
  if (!list) throw new Error('Router not found');
  const index = list.findIndex((p) => p.id === id);
  if (index === -1) throw new Error('Peer not found');
  list[index] = { ...list[index], ...updates, id };
  return list[index];
}

export function deletePeer(routerId: string, id: string): void {
  if (!peers[routerId]) return;
  peers[routerId] = peers[routerId].filter((p) => p.id !== id);
}

export function getNextAvailableIP(routerId: string, ifaceName: string): string | null {
  const iface = (interfaces[routerId] ?? []).find((i) => i.name === ifaceName);
  if (!iface) return null;

  const gateway = iface.gatewayAddress.split('/')[0];
  const parts = gateway.split('.').map(Number);
  const usedIPs = new Set(
    (peers[routerId] ?? [])
      .filter((p) => p.interface === ifaceName)
      .map((p) => p.allowedAddress.split('/')[0])
  );
  usedIPs.add(gateway);

  for (let i = 2; i <= 254; i++) {
    const candidate = `${parts[0]}.${parts[1]}.${parts[2]}.${i}`;
    if (!usedIPs.has(candidate)) return `${candidate}/32`;
  }
  return null;
}
