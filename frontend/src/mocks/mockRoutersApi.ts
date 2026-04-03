import type { Router, RouterStatus } from '../api/types';
import type { MockRouter } from './mockData';
import { mockRouters as seedRouters } from './mockData';

let routers: MockRouter[] = structuredClone(seedRouters);

function stripSystemInfo(router: MockRouter): Router {
  const { systemInfo: _systemInfo, ...rest } = router;
  return rest;
}

export function listRouters(): Router[] {
  return routers.map(stripSystemInfo);
}

export function getRouterById(id: string): Router | undefined {
  const found = routers.find((r) => r.id === id);
  return found ? stripSystemInfo(found) : undefined;
}

export function getRouterStatus(id: string): RouterStatus | undefined {
  const found = routers.find((r) => r.id === id);
  return found ? found.systemInfo : undefined;
}

export function createRouter(data: {
  name: string;
  hostname: string;
  host: string;
  port: number;
  username: string;
  password: string;
}): Router {
  const newRouter: MockRouter = {
    id: crypto.randomUUID(),
    name: data.name,
    hostname: data.hostname,
    host: data.host,
    port: data.port,
    is_reachable: false,
    last_seen: null,
    created_at: new Date().toISOString(),
    systemInfo: {
      is_reachable: false,
      error: 'Status not yet checked',
      checked_at: new Date().toISOString(),
    },
  };
  routers.push(newRouter);
  return stripSystemInfo(newRouter);
}

export function updateRouter(
  id: string,
  data: Partial<{
    name: string;
    hostname: string;
    host: string;
    port: number;
    username: string;
    password: string;
  }>,
): Router | undefined {
  const index = routers.findIndex((r) => r.id === id);
  if (index === -1) return undefined;
  const router = routers[index];
  if (data.name !== undefined) router.name = data.name;
  if (data.hostname !== undefined) router.hostname = data.hostname;
  if (data.host !== undefined) router.host = data.host;
  if (data.port !== undefined) router.port = data.port;
  return stripSystemInfo(router);
}

export function deleteRouter(id: string): boolean {
  const index = routers.findIndex((r) => r.id === id);
  if (index === -1) return false;
  routers.splice(index, 1);
  return true;
}

export async function checkStatus(id: string): Promise<RouterStatus> {
  await new Promise((resolve) => setTimeout(resolve, 500));
  const found = routers.find((r) => r.id === id);
  if (!found) {
    return {
      is_reachable: false,
      error: 'Router not found',
      checked_at: new Date().toISOString(),
    };
  }
  return found.systemInfo;
}
