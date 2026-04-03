import type { Router } from '../../api/types';

export const LATEST_ROUTEROS_VERSION = '7.16';

export type VersionStatus = 'up-to-date' | 'needs-update' | 'version-mismatch';

export interface ClusterGroup {
  type: 'cluster';
  clusterId: string;
  clusterName: string;
  tenantName: string;
  status: 'online' | 'degraded' | 'offline';
  versionStatus: VersionStatus | null;
  routers: Router[];
}

export interface StandaloneGroup {
  type: 'standalone';
  router: Router;
  versionStatus: VersionStatus | null;
}

export type RouterGroup = ClusterGroup | StandaloneGroup;

function computeClusterStatus(routers: Router[]): 'online' | 'degraded' | 'offline' {
  const onlineCount = routers.filter(r => r.is_reachable).length;
  if (onlineCount === routers.length) return 'online';
  if (onlineCount === 0) return 'offline';
  return 'degraded';
}

function computeClusterVersionStatus(routers: Router[]): VersionStatus | null {
  const onlineRouters = routers.filter(r => r.is_reachable && r.routeros_version);
  if (onlineRouters.length === 0) return null;

  const versions = new Set(onlineRouters.map(r => r.routeros_version));
  if (versions.size > 1) return 'version-mismatch';

  const version = onlineRouters[0].routeros_version!;
  return version === LATEST_ROUTEROS_VERSION ? 'up-to-date' : 'needs-update';
}

function computeStandaloneVersionStatus(router: Router): VersionStatus | null {
  if (!router.is_reachable || !router.routeros_version) return null;
  return router.routeros_version === LATEST_ROUTEROS_VERSION ? 'up-to-date' : 'needs-update';
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
    // Sort within cluster: master first, then backup
    clusterRouters.sort((a, b) => {
      if (a.role === 'master' && b.role !== 'master') return -1;
      if (a.role !== 'master' && b.role === 'master') return 1;
      return 0;
    });

    const first = clusterRouters[0];
    groups.push({
      type: 'cluster',
      clusterId,
      clusterName: first.cluster_name ?? clusterId,
      tenantName: first.tenant_name ?? '',
      status: computeClusterStatus(clusterRouters),
      versionStatus: computeClusterVersionStatus(clusterRouters),
      routers: clusterRouters,
    });
  }

  // Sort clusters alphabetically by name
  groups.sort((a, b) => {
    if (a.type === 'cluster' && b.type === 'cluster') {
      return a.clusterName.localeCompare(b.clusterName);
    }
    return 0;
  });

  // Append standalone routers after clusters, sorted alphabetically by hostname
  const sortedStandalone = [...standalone].sort((a, b) =>
    a.hostname.localeCompare(b.hostname),
  );
  for (const router of sortedStandalone) {
    groups.push({
      type: 'standalone',
      router,
      versionStatus: computeStandaloneVersionStatus(router),
    });
  }

  return groups;
}

export function filterGroups(groups: RouterGroup[], query: string): RouterGroup[] {
  const q = query.toLowerCase().trim();
  if (!q) return groups;

  return groups.filter(group => {
    if (group.type === 'cluster') {
      return (
        group.clusterName.toLowerCase().includes(q) ||
        group.tenantName.toLowerCase().includes(q) ||
        group.routers.some(
          r =>
            r.name.toLowerCase().includes(q) ||
            r.hostname.toLowerCase().includes(q),
        )
      );
    }
    return (
      group.router.name.toLowerCase().includes(q) ||
      group.router.hostname.toLowerCase().includes(q) ||
      (group.router.tenant_name ?? '').toLowerCase().includes(q)
    );
  });
}
