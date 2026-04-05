import type { Tunnel, GRETunnel, IPsecTunnel } from '../api/types';

const seedData: Record<string, Tunnel[]> = {
  // edge-gw-01
  'mock-1': [
    {
      id: 'gre-1-1', name: 'gre-to-branch-bgd', tunnelType: 'gre',
      localAddress: '203.0.113.2', remoteAddress: '172.16.10.1',
      mtu: 1476, keepaliveInterval: 10, keepaliveRetries: 10, ipsecSecret: '',
      disabled: false, running: true, comment: 'GRE to Belgrade branch',
    } as GRETunnel,
    {
      id: 'gre-1-2', name: 'gre-to-branch-nis', tunnelType: 'gre',
      localAddress: '203.0.113.2', remoteAddress: '172.16.20.1',
      mtu: 1476, keepaliveInterval: 10, keepaliveRetries: 10, ipsecSecret: '',
      disabled: false, running: false, comment: 'GRE to Nis branch',
    } as GRETunnel,
    {
      id: 'ipsec-1-1', name: 'ipsec-to-branch-bgd', tunnelType: 'ipsec',
      mode: 'route-based', remoteAddress: '172.16.10.1', localAddress: '203.0.113.2',
      authMethod: 'pre-shared-key', ipsecSecret: 'branch-bgd-secret',
      phase1: { encryption: 'aes-256', hash: 'sha256', dhGroup: 'modp2048', lifetime: '1d' },
      phase2: { encryption: 'aes-256-cbc', authAlgorithm: 'sha256', pfsGroup: 'modp2048', lifetime: '30m' },
      localSubnets: [], remoteSubnets: [], tunnelRoutes: ['10.10.0.0/24', '10.10.1.0/24'],
      disabled: false, established: true, comment: 'IPsec to Belgrade',
    } as IPsecTunnel,
    {
      id: 'ipsec-1-2', name: 'ipsec-policy-datacenter', tunnelType: 'ipsec',
      mode: 'policy-based', remoteAddress: '198.51.100.1', localAddress: '203.0.113.2',
      authMethod: 'pre-shared-key', ipsecSecret: 'dc-secret-key',
      phase1: { encryption: 'aes-128', hash: 'sha256', dhGroup: 'ecp256', lifetime: '1d' },
      phase2: { encryption: 'aes-128-gcm', authAlgorithm: 'null', pfsGroup: 'ecp256', lifetime: '30m' },
      localSubnets: ['10.0.1.0/24', '10.0.2.0/24'], remoteSubnets: ['10.20.0.0/24', '10.20.1.0/24'], tunnelRoutes: [],
      disabled: false, established: true, comment: 'Policy-based to datacenter',
    } as IPsecTunnel,
    // GRE with IPsec encryption
    {
      id: 'gre-1-3', name: 'gre-ipsec-to-nis', tunnelType: 'gre',
      localAddress: '203.0.113.2', remoteAddress: '172.16.20.1',
      mtu: 1400, keepaliveInterval: 10, keepaliveRetries: 10, ipsecSecret: 'gre-nis-secret',
      disabled: false, running: true, comment: 'GRE+IPsec to Nis branch',
    } as GRETunnel,
    // Disabled GRE
    {
      id: 'gre-1-4', name: 'gre-old-backup', tunnelType: 'gre',
      localAddress: '203.0.113.2', remoteAddress: '192.0.2.50',
      mtu: 1476, keepaliveInterval: 0, keepaliveRetries: 0, ipsecSecret: '',
      disabled: true, running: false, comment: 'Decommissioned backup link',
    } as GRETunnel,
    // Route-based IPsec, down
    {
      id: 'ipsec-1-3', name: 'ipsec-route-dr', tunnelType: 'ipsec',
      mode: 'route-based', remoteAddress: '198.51.100.100', localAddress: '203.0.113.2',
      authMethod: 'pre-shared-key', ipsecSecret: 'dr-site-psk',
      phase1: { encryption: 'aes-256', hash: 'sha512', dhGroup: 'ecp384', lifetime: '1d' },
      phase2: { encryption: 'aes-256-gcm', authAlgorithm: 'null', pfsGroup: 'ecp384', lifetime: '30m' },
      localSubnets: [], remoteSubnets: [], tunnelRoutes: ['10.200.0.0/16'],
      disabled: false, established: false, comment: 'DR site - route based, currently down',
    } as IPsecTunnel,
    // Disabled IPsec
    {
      id: 'ipsec-1-4', name: 'ipsec-old-vendor', tunnelType: 'ipsec',
      mode: 'policy-based', remoteAddress: '192.0.2.99', localAddress: '203.0.113.2',
      authMethod: 'pre-shared-key', ipsecSecret: 'old-vendor-key',
      phase1: { encryption: 'aes-128', hash: 'sha256', dhGroup: 'modp2048', lifetime: '1d' },
      phase2: { encryption: 'aes-128-cbc', authAlgorithm: 'sha256', pfsGroup: 'modp2048', lifetime: '30m' },
      localSubnets: ['10.0.1.0/24'], remoteSubnets: ['172.30.0.0/16'], tunnelRoutes: [],
      disabled: true, established: false, comment: 'Old vendor tunnel - disabled',
    } as IPsecTunnel,
  ],

  // edge-gw-02
  'mock-2': [
    {
      id: 'gre-2-1', name: 'gre-backup-bgd', tunnelType: 'gre',
      localAddress: '203.0.113.3', remoteAddress: '172.16.10.1',
      mtu: 1476, keepaliveInterval: 10, keepaliveRetries: 10, ipsecSecret: '',
      disabled: false, running: true, comment: 'Backup GRE to Belgrade',
    } as GRETunnel,
    {
      id: 'ipsec-2-1', name: 'ipsec-backup-bgd', tunnelType: 'ipsec',
      mode: 'route-based', remoteAddress: '172.16.10.1', localAddress: '203.0.113.3',
      authMethod: 'pre-shared-key', ipsecSecret: 'backup-bgd-secret',
      phase1: { encryption: 'aes-256', hash: 'sha256', dhGroup: 'modp2048', lifetime: '1d' },
      phase2: { encryption: 'aes-256-cbc', authAlgorithm: 'sha256', pfsGroup: 'modp2048', lifetime: '30m' },
      localSubnets: [], remoteSubnets: [], tunnelRoutes: ['10.10.0.0/24'],
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
      localAddress: '172.16.10.1', remoteAddress: '203.0.113.2',
      mtu: 1476, keepaliveInterval: 10, keepaliveRetries: 10, ipsecSecret: '',
      disabled: false, running: true, comment: 'GRE to HQ',
    } as GRETunnel,
    {
      id: 'ipsec-5-1', name: 'ipsec-to-hq', tunnelType: 'ipsec',
      mode: 'policy-based', remoteAddress: '203.0.113.2', localAddress: '172.16.10.1',
      authMethod: 'pre-shared-key', ipsecSecret: 'hq-branch-secret',
      phase1: { encryption: 'aes-256', hash: 'sha256', dhGroup: 'modp2048', lifetime: '1d' },
      phase2: { encryption: 'aes-256-cbc', authAlgorithm: 'sha256', pfsGroup: 'modp2048', lifetime: '30m' },
      localSubnets: ['192.168.1.0/24'], remoteSubnets: ['10.0.1.0/24'], tunnelRoutes: [],
      disabled: false, established: true, comment: 'IPsec to HQ',
    } as IPsecTunnel,
  ],

  // branch-rtr-nis (offline)
  'mock-6': [
    {
      id: 'gre-6-1', name: 'gre-to-hq', tunnelType: 'gre',
      localAddress: '172.16.20.1', remoteAddress: '203.0.113.2',
      mtu: 1476, keepaliveInterval: 10, keepaliveRetries: 10, ipsecSecret: '',
      disabled: false, running: false, comment: 'GRE to HQ',
    } as GRETunnel,
    {
      id: 'ipsec-6-1', name: 'ipsec-to-hq', tunnelType: 'ipsec',
      mode: 'policy-based', remoteAddress: '203.0.113.2', localAddress: '172.16.20.1',
      authMethod: 'pre-shared-key', ipsecSecret: 'hq-nis-secret',
      phase1: { encryption: 'aes-256', hash: 'sha256', dhGroup: 'modp2048', lifetime: '1d' },
      phase2: { encryption: 'aes-256-cbc', authAlgorithm: 'sha256', pfsGroup: 'modp2048', lifetime: '30m' },
      localSubnets: ['192.168.2.0/24'], remoteSubnets: ['10.0.1.0/24'], tunnelRoutes: [],
      disabled: false, established: false, comment: 'IPsec to HQ',
    } as IPsecTunnel,
  ],

  // lab-rtr-01
  'mock-7': [],

  // vpn-gw-01
  'mock-8': [
    {
      id: 'ipsec-8-1', name: 'ipsec-partner-api', tunnelType: 'ipsec',
      mode: 'route-based', remoteAddress: '198.51.100.50', localAddress: '10.0.1.10',
      authMethod: 'digital-signature', ipsecSecret: '',
      phase1: { encryption: 'aes-256', hash: 'sha256', dhGroup: 'ecp384', lifetime: '1d' },
      phase2: { encryption: 'aes-256-gcm', authAlgorithm: 'null', pfsGroup: 'ecp384', lifetime: '30m' },
      localSubnets: [], remoteSubnets: [], tunnelRoutes: ['10.50.0.0/16'],
      disabled: false, established: true, comment: 'Partner API tunnel',
    } as IPsecTunnel,
    {
      id: 'ipsec-8-2', name: 'ipsec-cloud-dr', tunnelType: 'ipsec',
      mode: 'route-based', remoteAddress: '203.0.113.100', localAddress: '10.0.1.10',
      authMethod: 'pre-shared-key', ipsecSecret: 'cloud-dr-psk',
      phase1: { encryption: 'aes-128', hash: 'sha256', dhGroup: 'modp2048', lifetime: '1d' },
      phase2: { encryption: 'aes-128-cbc', authAlgorithm: 'sha256', pfsGroup: 'modp2048', lifetime: '30m' },
      localSubnets: [], remoteSubnets: [], tunnelRoutes: ['10.100.0.0/16', '10.101.0.0/16'],
      disabled: false, established: true, comment: 'Cloud DR site',
    } as IPsecTunnel,
    {
      id: 'ipsec-8-3', name: 'ipsec-vendor-net', tunnelType: 'ipsec',
      mode: 'policy-based', remoteAddress: '192.0.2.1', localAddress: '10.0.1.10',
      authMethod: 'pre-shared-key', ipsecSecret: 'vendor-psk',
      phase1: { encryption: 'aes-256', hash: 'sha256', dhGroup: 'ecp256', lifetime: '1d' },
      phase2: { encryption: 'aes-256-cbc', authAlgorithm: 'sha256', pfsGroup: 'ecp256', lifetime: '30m' },
      localSubnets: ['10.88.0.0/24'], remoteSubnets: ['172.20.0.0/16'], tunnelRoutes: [],
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
