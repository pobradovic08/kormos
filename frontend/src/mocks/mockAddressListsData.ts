import type { AddressEntry, AddressList } from '../api/types';

const bogonEntries: AddressEntry[] = [
  { id: '', prefix: '0.0.0.0/8', comment: 'RFC1122 - This host on this network', disabled: false },
  { id: '', prefix: '10.0.0.0/8', comment: 'RFC1918 - Private', disabled: false },
  { id: '', prefix: '100.64.0.0/10', comment: 'RFC6598 - Shared address space (CGNAT)', disabled: false },
  { id: '', prefix: '127.0.0.0/8', comment: 'RFC1122 - Loopback', disabled: false },
  { id: '', prefix: '169.254.0.0/16', comment: 'RFC3927 - Link-local', disabled: false },
  { id: '', prefix: '172.16.0.0/12', comment: 'RFC1918 - Private', disabled: false },
  { id: '', prefix: '192.0.2.0/24', comment: 'RFC5737 - Documentation (TEST-NET-1)', disabled: false },
  { id: '', prefix: '192.168.0.0/16', comment: 'RFC1918 - Private', disabled: false },
  { id: '', prefix: '198.18.0.0/15', comment: 'RFC2544 - Benchmarking', disabled: false },
  { id: '', prefix: '198.51.100.0/24', comment: 'RFC5737 - Documentation (TEST-NET-2)', disabled: false },
  { id: '', prefix: '203.0.113.0/24', comment: 'RFC5737 - Documentation (TEST-NET-3)', disabled: false },
  { id: '', prefix: '224.0.0.0/4', comment: 'Multicast', disabled: false },
];

const allowedDnsEntries: AddressEntry[] = [
  { id: '', prefix: '8.8.8.8/32', comment: 'Google DNS', disabled: false },
  { id: '', prefix: '8.8.4.4/32', comment: 'Google DNS secondary', disabled: false },
  { id: '', prefix: '1.1.1.1/32', comment: 'Cloudflare', disabled: false },
  { id: '', prefix: '1.0.0.1/32', comment: 'Cloudflare secondary', disabled: false },
  { id: '', prefix: '9.9.9.9/32', comment: 'Quad9', disabled: false },
];

function stampIds(routerNum: number, listName: string, entries: AddressEntry[]): AddressEntry[] {
  return entries.map((e, i) => ({ ...e, id: `entry-${routerNum}-${listName}-${i + 1}` }));
}

const seedData: Record<string, AddressList[]> = {
  // edge-gw-01
  'mock-1': [
    {
      name: 'bogons',
      entries: stampIds(1, 'bogons', bogonEntries),
    },
    {
      name: 'allowed-dns',
      entries: stampIds(1, 'allowed-dns', allowedDnsEntries),
    },
    {
      name: 'blocked-scanners',
      entries: stampIds(1, 'blocked-scanners', [
        { id: '', prefix: '45.33.32.156/32', comment: 'Known scanner - Nmap reference host', disabled: false },
        { id: '', prefix: '71.6.167.142/32', comment: 'Shodan probe', disabled: false },
        { id: '', prefix: '185.142.236.34/32', comment: 'Known scanner', disabled: false },
        { id: '', prefix: '198.20.69.74/32', comment: 'Shodan probe', disabled: false },
        { id: '', prefix: '162.142.125.0/24', comment: 'Censys scanner range', disabled: false },
        { id: '', prefix: '167.248.133.0/24', comment: 'Censys scanner range', disabled: true },
      ]),
    },
  ],

  // edge-gw-02
  'mock-2': [
    {
      name: 'bogons',
      entries: stampIds(2, 'bogons', bogonEntries),
    },
    {
      name: 'allowed-dns',
      entries: stampIds(2, 'allowed-dns', allowedDnsEntries),
    },
  ],

  // core-rtr-01
  'mock-3': [
    {
      name: 'server-whitelist',
      entries: stampIds(3, 'server-whitelist', [
        { id: '', prefix: '10.10.0.10/32', comment: 'Web server', disabled: false },
        { id: '', prefix: '10.10.0.20/32', comment: 'DB primary', disabled: false },
        { id: '', prefix: '10.10.0.21/32', comment: 'DB replica', disabled: false },
        { id: '', prefix: '10.10.0.30/32', comment: 'Redis', disabled: false },
        { id: '', prefix: '10.10.0.40/32', comment: 'Elasticsearch', disabled: false },
      ]),
    },
    {
      name: 'monitoring-sources',
      entries: stampIds(3, 'monitoring-sources', [
        { id: '', prefix: '10.100.0.50/32', comment: 'Prometheus', disabled: false },
        { id: '', prefix: '10.100.0.51/32', comment: 'Grafana', disabled: false },
        { id: '', prefix: '10.100.0.52/32', comment: 'Alertmanager', disabled: false },
      ]),
    },
  ],

  // core-rtr-02
  'mock-4': [
    {
      name: 'server-whitelist',
      entries: stampIds(4, 'server-whitelist', [
        { id: '', prefix: '10.10.0.10/32', comment: 'Web server', disabled: false },
        { id: '', prefix: '10.10.0.20/32', comment: 'DB primary', disabled: false },
        { id: '', prefix: '10.10.0.21/32', comment: 'DB replica', disabled: false },
        { id: '', prefix: '10.10.0.30/32', comment: 'Redis', disabled: false },
        { id: '', prefix: '10.10.0.40/32', comment: 'Elasticsearch', disabled: false },
      ]),
    },
    {
      name: 'monitoring-sources',
      entries: stampIds(4, 'monitoring-sources', [
        { id: '', prefix: '10.100.0.50/32', comment: 'Prometheus', disabled: false },
        { id: '', prefix: '10.100.0.51/32', comment: 'Grafana', disabled: false },
        { id: '', prefix: '10.100.0.52/32', comment: 'Alertmanager', disabled: false },
      ]),
    },
    {
      name: 'db-access',
      entries: stampIds(4, 'db-access', [
        { id: '', prefix: '10.10.0.10/32', comment: 'Web app', disabled: false },
        { id: '', prefix: '10.10.0.30/32', comment: 'Redis', disabled: false },
        { id: '', prefix: '172.31.0.0/24', comment: 'Management network', disabled: false },
      ]),
    },
  ],

  // branch-rtr-bgd
  'mock-5': [
    {
      name: 'local-networks',
      entries: stampIds(5, 'local-networks', [
        { id: '', prefix: '192.168.1.0/24', comment: 'LAN', disabled: false },
        { id: '', prefix: '10.99.0.0/30', comment: 'VPN tunnel', disabled: false },
      ]),
    },
    {
      name: 'vpn-allowed',
      entries: stampIds(5, 'vpn-allowed', [
        { id: '', prefix: '10.0.1.0/24', comment: 'HQ core', disabled: false },
        { id: '', prefix: '10.10.0.0/24', comment: 'HQ servers', disabled: false },
        { id: '', prefix: '10.100.0.0/24', comment: 'HQ management', disabled: false },
      ]),
    },
  ],

  // branch-rtr-nis
  'mock-6': [
    {
      name: 'local-networks',
      entries: stampIds(6, 'local-networks', [
        { id: '', prefix: '192.168.2.0/24', comment: 'LAN', disabled: false },
      ]),
    },
    {
      name: 'vpn-allowed',
      entries: stampIds(6, 'vpn-allowed', [
        { id: '', prefix: '10.0.1.0/24', comment: 'HQ core', disabled: false },
        { id: '', prefix: '10.10.0.0/24', comment: 'HQ servers', disabled: false },
      ]),
    },
  ],

  // lab-rtr-01
  'mock-7': [
    {
      name: 'lab-nets',
      entries: stampIds(7, 'lab-nets', [
        { id: '', prefix: '10.50.0.0/24', comment: 'Lab network', disabled: false },
        { id: '', prefix: '192.168.100.0/24', comment: 'Uplink', disabled: false },
      ]),
    },
    {
      name: 'test-blocks',
      entries: stampIds(7, 'test-blocks', [
        { id: '', prefix: '198.51.100.0/24', comment: 'Test range 1', disabled: false },
        { id: '', prefix: '203.0.113.0/24', comment: 'Test range 2', disabled: false },
        { id: '', prefix: '100.64.0.0/10', comment: 'CGNAT test', disabled: true },
      ]),
    },
  ],

  // vpn-gw-01
  'mock-8': [
    {
      name: 'vpn-clients',
      entries: stampIds(8, 'vpn-clients', [
        { id: '', prefix: '10.88.0.0/24', comment: 'L2TP pool', disabled: false },
        { id: '', prefix: '10.89.0.0/24', comment: 'OpenVPN pool', disabled: false },
        { id: '', prefix: '10.90.0.0/24', comment: 'WireGuard pool', disabled: false },
      ]),
    },
    {
      name: 'blocked-ips',
      entries: stampIds(8, 'blocked-ips', [
        { id: '', prefix: '91.240.118.0/24', comment: 'Brute force source', disabled: false },
        { id: '', prefix: '185.56.83.0/24', comment: 'Spam relay', disabled: false },
        { id: '', prefix: '45.227.255.99/32', comment: 'Brute force source', disabled: false },
        { id: '', prefix: '103.43.18.0/24', comment: 'Port scan origin', disabled: false },
        { id: '', prefix: '193.32.162.0/24', comment: 'Credential stuffing', disabled: true },
      ]),
    },
    {
      name: 'rate-limited',
      entries: stampIds(8, 'rate-limited', [
        { id: '', prefix: '203.0.113.0/24', comment: 'Test traffic', disabled: false },
        { id: '', prefix: '198.51.100.0/24', comment: 'Partner API', disabled: false },
      ]),
    },
  ],
};

// Mutable state - clone so mutations never corrupt seed data
let data = structuredClone(seedData);

// Counter for generating new entry IDs
let nextId = 1000;

// ─── Query functions ──────────────────────────────────────────────────────────

export function listAddressLists(routerId: string): AddressList[] {
  return data[routerId] ?? [];
}

export function getAddressList(routerId: string, name: string): AddressList | undefined {
  return data[routerId]?.find((l) => l.name === name);
}

// ─── Mutation functions ───────────────────────────────────────────────────────

export function createAddressList(routerId: string, name: string): AddressList {
  if (!data[routerId]) {
    data[routerId] = [];
  }
  if (data[routerId].some((l) => l.name === name)) {
    throw new Error(`Address list "${name}" already exists on router ${routerId}`);
  }
  const list: AddressList = { name, entries: [] };
  data[routerId].push(list);
  return list;
}

export function deleteAddressList(routerId: string, name: string): void {
  if (!data[routerId]) return;
  data[routerId] = data[routerId].filter((l) => l.name !== name);
}

export function addEntry(
  routerId: string,
  listName: string,
  prefix: string,
  comment: string,
): AddressEntry {
  const list = data[routerId]?.find((l) => l.name === listName);
  if (!list) {
    throw new Error(`Address list "${listName}" not found on router ${routerId}`);
  }
  if (list.entries.some((e) => e.prefix === prefix)) {
    throw new Error(`Prefix "${prefix}" already exists in list "${listName}"`);
  }
  const entry: AddressEntry = {
    id: `entry-new-${nextId++}`,
    prefix,
    comment,
    disabled: false,
  };
  list.entries.push(entry);
  return entry;
}

export function deleteEntries(routerId: string, listName: string, entryIds: string[]): void {
  const list = data[routerId]?.find((l) => l.name === listName);
  if (!list) return;
  const idSet = new Set(entryIds);
  list.entries = list.entries.filter((e) => !idSet.has(e.id));
}

export function updateEntry(
  routerId: string,
  listName: string,
  entryId: string,
  comment: string,
): void {
  const list = data[routerId]?.find((l) => l.name === listName);
  if (!list) return;
  const entry = list.entries.find((e) => e.id === entryId);
  if (!entry) return;
  entry.comment = comment;
}
