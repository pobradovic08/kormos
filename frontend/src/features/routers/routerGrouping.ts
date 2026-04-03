import type { Router } from '../../api/types';

export const LATEST_ROUTEROS_VERSION = '7.16';

export type VersionStatus = 'up-to-date' | 'needs-update' | 'version-mismatch';

export interface RouterGroup {
  clusterId: string;
  clusterName: string;
  tenantName: string;
  mode: 'ha' | 'standalone';
  status: 'online' | 'degraded' | 'offline';
  versionStatus: VersionStatus | null;
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

export function groupRouters(routers: Router[]): RouterGroup[] {
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
