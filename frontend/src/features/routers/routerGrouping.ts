import type { Router } from '../../api/types';

export const LATEST_ROUTEROS_VERSION = '7.16';

export type VersionStatus = 'up-to-date' | 'needs-update' | 'version-mismatch';
export type LicenseStatus = 'valid' | 'free' | 'mismatch';
export type BackupStatus = 'recent' | 'stale' | 'old' | 'none';

export interface RouterGroup {
  clusterId: string;
  clusterName: string;
  tenantName: string;
  mode: 'ha' | 'standalone';
  status: 'online' | 'degraded' | 'offline';
  versionStatus: VersionStatus | null;
  licenseStatus: LicenseStatus;
  backupStatus: BackupStatus;
  routers: Router[];
}

function computeStatus(routers: Router[]): 'online' | 'degraded' | 'offline' {
  const onlineCount = routers.filter(r => r.is_reachable).length;
  if (onlineCount === routers.length) return 'online';
  if (onlineCount === 0) return 'offline';
  return 'degraded';
}

function computeVersionStatus(routers: Router[]): VersionStatus | null {
  const onlineRouters = routers.filter(r => r.is_reachable && r.routeros_version);
  if (onlineRouters.length === 0) return null;

  const versions = new Set(onlineRouters.map(r => r.routeros_version));
  if (versions.size > 1) return 'version-mismatch';

  const version = onlineRouters[0].routeros_version!;
  return version === LATEST_ROUTEROS_VERSION ? 'up-to-date' : 'needs-update';
}

function computeLicenseStatus(routers: Router[]): LicenseStatus {
  const licenses = routers.map(r => r.license_level).filter(Boolean);
  if (licenses.length === 0) return 'free';
  if (licenses.some(l => l === 'Free')) return 'free';
  const unique = new Set(licenses);
  if (unique.size > 1) return 'mismatch';
  return 'valid';
}

function computeBackupStatus(routers: Router[]): BackupStatus {
  const backups = routers.map(r => r.last_config_backup).filter(Boolean) as string[];
  if (backups.length === 0) return 'none';
  const now = Date.now();
  const oldest = Math.max(...backups.map(b => now - new Date(b).getTime()));
  const threeHours = 3 * 3600000;
  const twentyFourHours = 24 * 3600000;
  if (oldest <= threeHours) return 'recent';
  if (oldest <= twentyFourHours) return 'stale';
  return 'old';
}

export function groupRouters(routers: Router[] | null | undefined): RouterGroup[] {
  if (!routers) return [];
  const clusterMap = new Map<string, Router[]>();
  const standalone: Router[] = [];

  for (const router of routers) {
    if (router.cluster_id) {
      const existing = clusterMap.get(router.cluster_id) ?? [];
      existing.push(router);
      clusterMap.set(router.cluster_id, existing);
    } else {
      standalone.push(router);
    }
  }

  const groups: RouterGroup[] = [];

  for (const [clusterId, clusterRouters] of clusterMap) {
    clusterRouters.sort((a, b) => {
      if (a.role === 'master' && b.role !== 'master') return -1;
      if (a.role !== 'master' && b.role === 'master') return 1;
      return 0;
    });

    const first = clusterRouters[0];
    groups.push({
      clusterId,
      clusterName: first.cluster_name ?? clusterId,
      tenantName: first.tenant_name ?? '',
      mode: 'ha',
      status: computeStatus(clusterRouters),
      versionStatus: computeVersionStatus(clusterRouters),
      licenseStatus: computeLicenseStatus(clusterRouters),
      backupStatus: computeBackupStatus(clusterRouters),
      routers: clusterRouters,
    });
  }

  // Sort clusters alphabetically
  groups.sort((a, b) => a.clusterName.localeCompare(b.clusterName));

  // Wrap standalone routers as single-node groups
  const sortedStandalone = [...standalone].sort((a, b) =>
    a.hostname.localeCompare(b.hostname),
  );
  for (const router of sortedStandalone) {
    groups.push({
      clusterId: router.id,
      clusterName: router.name,
      tenantName: router.tenant_name ?? '',
      mode: 'standalone',
      status: router.is_reachable ? 'online' : 'offline',
      versionStatus: computeVersionStatus([router]),
      licenseStatus: computeLicenseStatus([router]),
      backupStatus: computeBackupStatus([router]),
      routers: [router],
    });
  }

  return groups;
}

export function filterGroups(groups: RouterGroup[], query: string): RouterGroup[] {
  const q = query.toLowerCase().trim();
  if (!q) return groups;

  return groups.filter(group =>
    group.clusterName.toLowerCase().includes(q) ||
    group.tenantName.toLowerCase().includes(q) ||
    group.routers.some(
      r =>
        r.name.toLowerCase().includes(q) ||
        r.hostname.toLowerCase().includes(q),
    ),
  );
}
