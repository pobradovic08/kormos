import type { Router, RouterStatus } from '../api/types';

export interface MockRouter extends Router {
  systemInfo: RouterStatus;
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600000).toISOString();
}
function daysAgo(d: number): string {
  return new Date(Date.now() - d * 86400000).toISOString();
}
function minutesAgo(m: number): string {
  return new Date(Date.now() - m * 60000).toISOString();
}

export const mockRouters: MockRouter[] = [
  // HA Pair 1: edge-gw — both online, both 7.16 → "Up to date"
  {
    id: 'mock-1', name: 'edge-gw-01', hostname: 'edge-gw-01.dc1.local',
    host: '10.0.1.1', port: 443, is_reachable: true, tenant_name: 'Mainstream',
    cluster_id: 'cluster-edge-gw', cluster_name: 'edge-gw', role: 'master',
    routeros_version: '7.16', uptime: '45d 12h',
    last_seen: minutesAgo(2), created_at: daysAgo(30),
    systemInfo: { is_reachable: true, routeros_version: '7.16', board_name: 'CHR', uptime: '45d 12h 30m', cpu_load: 12, free_memory: 805306368, total_memory: 1073741824, checked_at: minutesAgo(2) },
  },
  {
    id: 'mock-2', name: 'edge-gw-02', hostname: 'edge-gw-02.dc1.local',
    host: '10.0.1.4', port: 443, is_reachable: true, tenant_name: 'Mainstream',
    cluster_id: 'cluster-edge-gw', cluster_name: 'edge-gw', role: 'backup',
    routeros_version: '7.16', uptime: '45d 12h',
    last_seen: minutesAgo(2), created_at: daysAgo(30),
    systemInfo: { is_reachable: true, routeros_version: '7.16', board_name: 'CHR', uptime: '45d 12h 30m', cpu_load: 8, free_memory: 858993459, total_memory: 1073741824, checked_at: minutesAgo(2) },
  },

  // HA Pair 2: core-rtr — both online, 7.16 vs 7.14.3 → "Version mismatch"
  {
    id: 'mock-3', name: 'core-rtr-01', hostname: 'core-rtr-01.dc1.local',
    host: '10.0.1.2', port: 443, is_reachable: true, tenant_name: 'Mainstream',
    cluster_id: 'cluster-core-rtr', cluster_name: 'core-rtr', role: 'master',
    routeros_version: '7.16', uptime: '12d 5h',
    last_seen: minutesAgo(1), created_at: daysAgo(60),
    systemInfo: { is_reachable: true, routeros_version: '7.16', board_name: 'CHR', uptime: '12d 5h 15m', cpu_load: 45, free_memory: 322122547, total_memory: 1073741824, checked_at: minutesAgo(1) },
  },
  {
    id: 'mock-4', name: 'core-rtr-02', hostname: 'core-rtr-02.dc1.local',
    host: '10.0.1.3', port: 443, is_reachable: true, tenant_name: 'Mainstream',
    cluster_id: 'cluster-core-rtr', cluster_name: 'core-rtr', role: 'backup',
    routeros_version: '7.14.3', uptime: '12d 5h',
    last_seen: minutesAgo(1), created_at: daysAgo(60),
    systemInfo: { is_reachable: true, routeros_version: '7.14.3', board_name: 'CHR', uptime: '12d 5h 15m', cpu_load: 38, free_memory: 429496730, total_memory: 1073741824, checked_at: minutesAgo(1) },
  },

  // HA Pair 3: branch-rtr — one online (7.14.3), one offline → "Degraded" + "Needs update"
  {
    id: 'mock-5', name: 'branch-rtr-bgd', hostname: 'branch-rtr-bgd.rs.local',
    host: '172.16.10.1', port: 443, is_reachable: true, tenant_name: 'Acme Corp',
    cluster_id: 'cluster-branch-rtr', cluster_name: 'branch-rtr', role: 'master',
    routeros_version: '7.14.3', uptime: '28d 0h',
    last_seen: minutesAgo(3), created_at: daysAgo(45),
    systemInfo: { is_reachable: true, routeros_version: '7.14.3', board_name: 'CHR', uptime: '28d 0h 12m', cpu_load: 8, free_memory: 429496730, total_memory: 536870912, checked_at: minutesAgo(3) },
  },
  {
    id: 'mock-6', name: 'branch-rtr-nis', hostname: 'branch-rtr-nis.rs.local',
    host: '172.16.20.1', port: 443, is_reachable: false, tenant_name: 'Acme Corp',
    cluster_id: 'cluster-branch-rtr', cluster_name: 'branch-rtr', role: 'backup',
    last_seen: hoursAgo(2), created_at: daysAgo(45),
    systemInfo: { is_reachable: false, error: 'Connection timed out after 10s', checked_at: hoursAgo(2) },
  },

  // Standalone: lab-rtr-01 — online, 7.16 → "Up to date"
  {
    id: 'mock-7', name: 'lab-rtr-01', hostname: 'lab-rtr-01.lab.local',
    host: '192.168.100.1', port: 443, is_reachable: true, tenant_name: 'Lab Tenant',
    routeros_version: '7.16', uptime: '1d 2h',
    last_seen: minutesAgo(1), created_at: daysAgo(10),
    systemInfo: { is_reachable: true, routeros_version: '7.16', board_name: 'CHR', uptime: '1d 2h 30m', cpu_load: 3, free_memory: 483183821, total_memory: 536870912, checked_at: minutesAgo(1) },
  },

  // Standalone: vpn-gw-01 — online, 7.15.1 → "Needs update"
  {
    id: 'mock-8', name: 'vpn-gw-01', hostname: 'vpn-gw-01.dc1.local',
    host: '10.0.1.10', port: 443, is_reachable: true, tenant_name: 'Mainstream',
    routeros_version: '7.15.1', uptime: '60d 14h',
    last_seen: minutesAgo(1), created_at: daysAgo(120),
    systemInfo: { is_reachable: true, routeros_version: '7.15.1', board_name: 'CHR', uptime: '60d 14h 20m', cpu_load: 35, free_memory: 644245094, total_memory: 1073741824, checked_at: minutesAgo(1) },
  },

  // Standalone: backup-rtr-01 — offline
  {
    id: 'mock-9', name: 'backup-rtr-01', hostname: 'backup-rtr-01.dc2.local',
    host: '10.0.2.1', port: 443, is_reachable: false, tenant_name: 'Mainstream',
    last_seen: daysAgo(3), created_at: daysAgo(180),
    systemInfo: { is_reachable: false, error: 'No route to host', checked_at: daysAgo(3) },
  },
];
