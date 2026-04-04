export interface Tenant {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'operator' | 'viewer';
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenant: Tenant;
}

export interface LoginResponse {
  access_token: string;
  user: AuthUser;
}

export interface Router {
  id: string;
  name: string;
  hostname: string;
  host: string;
  port: number;
  is_reachable: boolean;
  last_seen: string | null;
  created_at: string;
  tenant_name?: string;
  cluster_id?: string;
  cluster_name?: string;
  role?: 'master' | 'backup';
  routeros_version?: string;
  uptime?: string;
  serial_number?: string;
  license_level?: string;
  last_config_backup?: string;
}

export interface RouterStatus {
  is_reachable: boolean;
  routeros_version?: string;
  board_name?: string;
  uptime?: string;
  cpu_load?: number;
  free_memory?: number;
  total_memory?: number;
  checked_at: string;
  error?: string;
}

export interface InterfaceAddress {
  id: string;
  address: string;
  network: string;
  interface: string;
}

export interface RouterInterface {
  id: string;
  name: string;
  type: string;
  running: boolean;
  disabled: boolean;
  comment: string;
  mtu: number;
  mac_address: string;
  addresses: InterfaceAddress[];
  properties: Record<string, unknown>;
}

export interface Route {
  id: string;
  destination: string;
  gateway: string;
  interface: string;
  distance: number;
  routeType: 'static' | 'connected' | 'blackhole';
  routingMark: string;
  disabled: boolean;
  active: boolean;
  comment: string;
}

export interface AddressEntry {
  id: string;
  prefix: string;
  comment: string;
  disabled: boolean;
}

export interface AddressList {
  name: string;
  entries: AddressEntry[];
}

export interface PendingChange {
  id: string;
  routerId: string;
  module: string;
  operation: 'add' | 'modify' | 'delete';
  resourcePath: string;
  resourceId: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
}

export interface OperationResult {
  index: number;
  status: 'success' | 'failure';
  resource_id: string | null;
  error?: string;
}

export interface CommitResponse {
  status: 'success' | 'partial' | 'failure';
  results: OperationResult[];
  audit_id: string;
}

export interface AuditOperation {
  index: number;
  module: string;
  operation: string;
  resource_path: string;
  method: string;
  body: Record<string, unknown>;
}

export interface AuditEntry {
  id: string;
  tenant_id: string;
  router_id: string;
  user_id: string;
  router: { id: string; name: string };
  user: { id: string; name: string; email: string };
  module: string;
  action: string;
  operations: string | AuditOperation[];
  commit_message: string;
  status: string;
  error_details?: string;
  created_at: string;
}