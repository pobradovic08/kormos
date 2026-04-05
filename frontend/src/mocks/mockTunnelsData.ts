import type { Tunnel, GRETunnel, IPsecTunnel } from '../api/types';

const seedData: Record<string, Tunnel[]> = {
  // edge-gw-01
  'mock-1': [
    {
      id: 'gre-1-1', name: 'gre-to-branch-bgd', tunnelType: 'gre',
      localAddress: '203.0.113.2', remoteAddress: '172.16.10.1', localInterface: 'ether1',
      mtu: 1476, keepaliveInterval: 10, keepaliveRetries: 3,
      disabled: false, running: true, comment: 'GRE to Belgrade branch',
    } as GRETunnel,
    {
      id: 'gre-1-2', name: 'gre-to-branch-nis', tunnelType: 'gre',
      localAddress: '203.0.113.2', remoteAddress: '172.16.20.1', localInterface: 'ether1',
      mtu: 1476, keepaliveInterval: 10, keepaliveRetries: 3,
      disabled: false, running: false, comment: 'GRE to Nis branch',
    } as GRETunnel,
    {
      id: 'ipsec-1-1', name: 'ipsec-to-branch-bgd', tunnelType: 'ipsec',
      mode: 'route-based', localAddress: '203.0.113.2', remoteAddress: '172.16.10.1',
      ikeVersion: 2, authMethod: 'pre-shared-key',
      phase1: { encryption: 'aes-256-cbc', hash: 'sha256', dhGroup: 14, lifetime: '8h' },
      phase2: { encryption: 'aes-256-cbc', hash: 'sha256', pfsGroup: 14, lifetime: '1h' },
      tunnelInterface: 'ipsec-bgd', localSubnet: '', remoteSubnet: '',
      disabled: false, established: true, comment: 'IPsec to Belgrade',
    } as IPsecTunnel,
    {
      id: 'ipsec-1-2', name: 'ipsec-policy-datacenter', tunnelType: 'ipsec',
      mode: 'policy-based', localAddress: '203.0.113.2', remoteAddress: '198.51.100.1',
      ikeVersion: 2, authMethod: 'pre-shared-key',
      phase1: { encryption: 'aes-128-cbc', hash: 'sha256', dhGroup: 19, lifetime: '24h' },
      phase2: { encryption: 'aes-128-gcm', hash: 'none', pfsGroup: 19, lifetime: '1h' },
      tunnelInterface: '', localSubnet: '10.0.1.0/24', remoteSubnet: '10.20.0.0/24',
      disabled: false, established: true, comment: 'Policy-based to datacenter',
    } as IPsecTunnel,
  ],

  // edge-gw-02
  'mock-2': [
    {
      id: 'gre-2-1', name: 'gre-backup-bgd', tunnelType: 'gre',
      localAddress: '203.0.113.3', remoteAddress: '172.16.10.1', localInterface: 'ether1',
      mtu: 1476, keepaliveInterval: 10, keepaliveRetries: 3,
      disabled: false, running: true, comment: 'Backup GRE to Belgrade',
    } as GRETunnel,
    {
      id: 'ipsec-2-1', name: 'ipsec-backup-bgd', tunnelType: 'ipsec',
      mode: 'route-based', localAddress: '203.0.113.3', remoteAddress: '172.16.10.1',
      ikeVersion: 2, authMethod: 'pre-shared-key',
      phase1: { encryption: 'aes-256-cbc', hash: 'sha256', dhGroup: 14, lifetime: '8h' },
      phase2: { encryption: 'aes-256-cbc', hash: 'sha256', pfsGroup: 14, lifetime: '1h' },
      tunnelInterface: 'ipsec-bgd-bkp', localSubnet: '', remoteSubnet: '',
      disabled: false, established: true, comment: 'Backup IPsec to Belgrade',
    } as IPsecTunnel,
  ],

  // core-rtr-01
  'mock-3': [],

  // core-rtr-02
  'mock-4': [],

  // branch-rtr-bgd
  'mock-5': [
    {
      id: 'gre-5-1', name: 'gre-to-hq', tunnelType: 'gre',
      localAddress: '172.16.10.1', remoteAddress: '203.0.113.2', localInterface: 'ether1',
      mtu: 1476, keepaliveInterval: 10, keepaliveRetries: 3,
      disabled: false, running: true, comment: 'GRE to HQ',
    } as GRETunnel,
    {
      id: 'ipsec-5-1', name: 'ipsec-to-hq', tunnelType: 'ipsec',
      mode: 'policy-based', localAddress: '172.16.10.1', remoteAddress: '203.0.113.2',
      ikeVersion: 2, authMethod: 'pre-shared-key',
      phase1: { encryption: 'aes-256-cbc', hash: 'sha256', dhGroup: 14, lifetime: '8h' },
      phase2: { encryption: 'aes-256-cbc', hash: 'sha256', pfsGroup: 14, lifetime: '1h' },
      tunnelInterface: '', localSubnet: '192.168.1.0/24', remoteSubnet: '10.0.1.0/24',
      disabled: false, established: true, comment: 'IPsec to HQ',
    } as IPsecTunnel,
  ],

  // branch-rtr-nis (offline)
  'mock-6': [
    {
      id: 'gre-6-1', name: 'gre-to-hq', tunnelType: 'gre',
      localAddress: '172.16.20.1', remoteAddress: '203.0.113.2', localInterface: 'ether1',
      mtu: 1476, keepaliveInterval: 10, keepaliveRetries: 3,
      disabled: false, running: false, comment: 'GRE to HQ',
    } as GRETunnel,
    {
      id: 'ipsec-6-1', name: 'ipsec-to-hq', tunnelType: 'ipsec',
      mode: 'policy-based', localAddress: '172.16.20.1', remoteAddress: '203.0.113.2',
      ikeVersion: 2, authMethod: 'pre-shared-key',
      phase1: { encryption: 'aes-256-cbc', hash: 'sha256', dhGroup: 14, lifetime: '8h' },
      phase2: { encryption: 'aes-256-cbc', hash: 'sha256', pfsGroup: 14, lifetime: '1h' },
      tunnelInterface: '', localSubnet: '192.168.2.0/24', remoteSubnet: '10.0.1.0/24',
      disabled: false, established: false, comment: 'IPsec to HQ',
    } as IPsecTunnel,
  ],

  // lab-rtr-01
  'mock-7': [],

  // vpn-gw-01
  'mock-8': [
    {
      id: 'ipsec-8-1', name: 'ipsec-partner-api', tunnelType: 'ipsec',
      mode: 'route-based', localAddress: '10.0.1.10', remoteAddress: '198.51.100.50',
      ikeVersion: 2, authMethod: 'certificate',
      phase1: { encryption: 'aes-256-cbc', hash: 'sha256', dhGroup: 20, lifetime: '24h' },
      phase2: { encryption: 'aes-256-gcm', hash: 'none', pfsGroup: 20, lifetime: '2h' },
      tunnelInterface: 'ipsec-partner', localSubnet: '', remoteSubnet: '',
      disabled: false, established: true, comment: 'Partner API tunnel',
    } as IPsecTunnel,
    {
      id: 'ipsec-8-2', name: 'ipsec-cloud-dr', tunnelType: 'ipsec',
      mode: 'route-based', localAddress: '10.0.1.10', remoteAddress: '203.0.113.100',
      ikeVersion: 1, authMethod: 'pre-shared-key',
      phase1: { encryption: 'aes-128-cbc', hash: 'sha1', dhGroup: 14, lifetime: '8h' },
      phase2: { encryption: 'aes-128-cbc', hash: 'sha1', pfsGroup: 14, lifetime: '1h' },
      tunnelInterface: 'ipsec-cloud', localSubnet: '', remoteSubnet: '',
      disabled: false, established: true, comment: 'Cloud DR site',
    } as IPsecTunnel,
    {
      id: 'ipsec-8-3', name: 'ipsec-vendor-net', tunnelType: 'ipsec',
      mode: 'policy-based', localAddress: '10.0.1.10', remoteAddress: '192.0.2.1',
      ikeVersion: 2, authMethod: 'pre-shared-key',
      phase1: { encryption: 'aes-256-cbc', hash: 'sha256', dhGroup: 19, lifetime: '8h' },
      phase2: { encryption: 'aes-256-cbc', hash: 'sha256', pfsGroup: 19, lifetime: '1h' },
      tunnelInterface: '', localSubnet: '10.88.0.0/24', remoteSubnet: '172.20.0.0/16',
      disabled: true, established: false, comment: 'Vendor network (disabled)',
    } as IPsecTunnel,
  ],

  // backup-rtr-01
  'mock-9': [],
};

// Mutable state - clone so mutations never corrupt seed data
let data = structuredClone(seedData);

// Counter for generating new tunnel IDs
let nextId = 1000;

// ─── Query functions ──────────────────────────────────────────────────────────

export function listTunnels(routerId: string): Tunnel[] {
  return data[routerId] ?? [];
}

export function getTunnel(routerId: string, id: string): Tunnel | undefined {
  return data[routerId]?.find((t) => t.id === id);
}

// ─── Mutation functions ───────────────────────────────────────────────────────

export function addTunnel(routerId: string, tunnel: Omit<Tunnel, 'id'>): Tunnel {
  if (!data[routerId]) {
    data[routerId] = [];
  }
  const newTunnel = { ...tunnel, id: `tunnel-${nextId++}` } as Tunnel;
  data[routerId].push(newTunnel);
  return newTunnel;
}

export function updateTunnel(
  routerId: string,
  id: string,
  updates: Partial<Tunnel>,
): Tunnel {
  const list = data[routerId];
  if (!list) throw new Error(`Router "${routerId}" not found`);
  const index = list.findIndex((t) => t.id === id);
  if (index === -1) throw new Error(`Tunnel "${id}" not found on router "${routerId}"`);
  const updated = { ...list[index], ...updates, id } as Tunnel;
  list[index] = updated;
  return updated;
}

export function deleteTunnel(routerId: string, id: string): void {
  if (!data[routerId]) return;
  data[routerId] = data[routerId].filter((t) => t.id !== id);
}
