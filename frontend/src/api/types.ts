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
  default_name?: string;
  type: string;
  running: boolean;
  disabled: boolean;
  comment: string;
  mtu: number;
  mac_address: string;
  addresses: InterfaceAddress[];
  properties: Record<string, unknown>;
}

export interface MergedInterfaceEndpoint {
  routerId: string;
  routerName: string;
  role: string;
  rosId: string;
  macAddress: string;
  running: boolean;
  addresses: InterfaceAddress[];
}

export interface MergedInterface {
  name: string;
  defaultName?: string;
  type: string;
  mtu: number;
  disabled: boolean;
  comment: string;
  endpoints: MergedInterfaceEndpoint[];
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

export interface GRETunnel {
  id: string;
  name: string;
  tunnelType: 'gre';
  localAddress: string;
  remoteAddress: string;
  mtu: number;
  keepaliveInterval: number;
  keepaliveRetries: number;
  ipsecSecret: string;
  disabled: boolean;
  running: boolean;
  comment: string;
}

export interface IPsecTunnel {
  id: string;
  name: string;
  tunnelType: 'ipsec';
  mode: 'route-based' | 'policy-based';
  remoteAddress: string;
  localAddress: string;
  authMethod: 'pre-shared-key' | 'digital-signature';
  ipsecSecret: string;
  phase1: {
    encryption: string;
    hash: string;
    dhGroup: string;
    lifetime: string;
  };
  phase2: {
    encryption: string;
    authAlgorithm: string;
    pfsGroup: string;
    lifetime: string;
  };
  localSubnets: string[];
  remoteSubnets: string[];
  tunnelRoutes: string[];
  disabled: boolean;
  established: boolean;
  comment: string;
}

export type Tunnel = GRETunnel | IPsecTunnel;

// ─── Tunnel Create/Update Payloads (cluster-scoped, endpoints-based) ─────────

export interface TunnelEndpointPayload {
  routerId: string;
  localAddress: string;
  remoteAddress: string;
}

export interface CreateGRETunnelPayload {
  name: string;
  mtu: number;
  keepaliveInterval: number;
  keepaliveRetries: number;
  ipsecSecret: string;
  disabled: boolean;
  comment: string;
  endpoints: TunnelEndpointPayload[];
}

export interface CreateIPsecTunnelPayload {
  name: string;
  mode: string;
  authMethod: string;
  ipsecSecret: string;
  phase1: { encryption: string; hash: string; dhGroup: string; lifetime: string };
  phase2: { encryption: string; authAlgorithm: string; pfsGroup: string; lifetime: string };
  localSubnets: string[];
  remoteSubnets: string[];
  tunnelRoutes: string[];
  disabled: boolean;
  comment: string;
  endpoints: TunnelEndpointPayload[];
}

// Display endpoint for table/detail views (shared across GRE/IPsec)
export interface DisplayEndpoint {
  routerName: string;
  role: string;
  localAddress: string;
  remoteAddress: string;
}

export interface GRETunnelEndpoint {
  routerId: string;
  routerName: string;
  role: string;
  rosId: string;
  localAddress: string;
  remoteAddress: string;
  running: boolean;
}

export interface MergedGRETunnel {
  name: string;
  tunnelType: string;
  mtu: number;
  keepaliveInterval: number;
  keepaliveRetries: number;
  ipsecSecret: string;
  disabled: boolean;
  comment: string;
  endpoints: GRETunnelEndpoint[];
}

export interface IPsecRosIds {
  peer: string;
  profile: string;
  proposal: string;
  identity: string;
  policies?: string[];
}

export interface IPsecTunnelEndpoint {
  routerId: string;
  routerName: string;
  role: string;
  rosIds: IPsecRosIds;
  localAddress: string;
  remoteAddress: string;
  established: boolean;
}

export interface MergedIPsecTunnel {
  name: string;
  tunnelType: string;
  mode: string;
  authMethod: string;
  ipsecSecret: string;
  phase1: {
    encryption: string;
    hash: string;
    dhGroup: string;
    lifetime: string;
  };
  phase2: {
    encryption: string;
    authAlgorithm: string;
    pfsGroup: string;
    lifetime: string;
  };
  localSubnets: string[];
  remoteSubnets: string[];
  tunnelRoutes: string[];
  disabled: boolean;
  comment: string;
  endpoints: IPsecTunnelEndpoint[];
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

// ─── WireGuard ────────────────────────────────────────────────────────────────

export interface WireGuardInterface {
  id: string;
  name: string;
  listenPort: number;
  mtu: number;
  privateKey: string;
  publicKey: string;
  gatewayAddress: string;
  dns: string;
  clientAllowedIPs: string;
  disabled: boolean;
}

export interface WireGuardPeer {
  id: string;
  interface: string;
  name: string;
  publicKey: string;
  presharedKey: string;
  allowedAddress: string;
  endpointAddress: string;
  endpointPort: number;
  lastHandshake: string;
  rx: number;
  tx: number;
  persistentKeepalive: number;
  disabled: boolean;
  comment: string;
  clientPrivateKey?: string;
}

export interface RouterWireGuardInterface {
  router_id: string;
  router_name: string;
  interfaces: WireGuardInterface[];
}

export interface RouterWireGuardPeer {
  router_id: string;
  router_name: string;
  peers: WireGuardPeer[];
}

// Backend cluster-scoped WireGuard response shape (one entry per router interface).
export interface WGInterfaceRaw {
  rosId: string;
  name: string;
  listenPort: number;
  mtu: number;
  privateKey: string;
  publicKey: string;
  disabled: boolean;
  running: boolean;
}

export interface WGPeerRaw {
  rosId: string;
  interface: string;
  name: string;
  publicKey: string;
  presharedKey: string;
  allowedAddress: string;
  endpointAddress: string;
  endpointPort: number;
  lastHandshake: string;
  rx: number;
  tx: number;
  persistentKeepalive: number;
  disabled: boolean;
  comment: string;
}

export interface RouterWireGuard {
  routerId: string;
  routerName: string;
  role: string;
  interface: WGInterfaceRaw;
  peers: WGPeerRaw[];
}

// ─── Firewall ─────────────────────────────────────────────────────────────────

export type FirewallChain = 'forward' | 'input' | 'output';
export type FirewallAction = 'accept' | 'drop' | 'reject' | 'fasttrack-connection' | 'passthrough';
export type ConnectionState = 'established' | 'related' | 'new' | 'invalid' | 'untracked';

export interface FirewallRule {
  id: string;
  chain: FirewallChain;
  action: FirewallAction;
  protocol?: string;
  srcAddress?: string;
  dstAddress?: string;
  srcAddressList?: string;
  dstAddressList?: string;
  srcPort?: string;
  dstPort?: string;
  inInterface?: string;
  outInterface?: string;
  connectionState?: ConnectionState[];
  disabled: boolean;
  comment: string;
}

// --- Operation Log & Undo ---

export interface OperationGroup {
  id: string;
  tenant_id: string;
  user_id: string;
  description: string;
  status: 'applied' | 'undone' | 'failed' | 'requires_attention';
  created_at: string;
  expires_at: string;
  user: { id: string; name: string; email: string };
  operations: OperationEntry[];
  can_undo: boolean;
}

export interface OperationEntry {
  id: string;
  group_id: string;
  router_id: string;
  module: string;
  operation_type: 'add' | 'modify' | 'delete';
  resource_path: string;
  resource_id?: string;
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
  sequence: number;
  status: 'applied' | 'undone' | 'failed';
  error?: string;
  applied_at: string;
}

export interface ExecuteOperationRequest {
  description: string;
  operations: {
    router_id: string;
    module: string;
    operation_type: 'add' | 'modify' | 'delete';
    resource_path: string;
    resource_id?: string;
    body: Record<string, unknown>;
  }[];
}

export interface ExecuteOperationResponse {
  group_id: string;
  status: string;
  operations: {
    id: string;
    status: string;
    resource_id?: string;
    after_state?: Record<string, unknown>;
    error?: string;
  }[];
}

export interface UndoResponse {
  group_id: string;
  status: string;
  reason?: string;
  drifted_operation?: {
    id: string;
    resource_path: string;
    resource_id: string;
    expected_state: Record<string, unknown>;
    current_state: Record<string, unknown>;
  };
}

export interface OperationHistoryResponse {
  groups: OperationGroup[];
  total: number;
}

// --- Cluster Management ---

export interface ClusterResponse {
  id: string;
  name: string;
  mode: 'ha' | 'standalone';
  created_at: string;
  routers: ClusterRouter[];
}

export interface ClusterRouter {
  id: string;
  name: string;
  hostname: string;
  host: string;
  port: number;
  role: 'master' | 'backup';
  is_reachable: boolean;
  last_seen: string | null;
}

export interface CreateClusterRequest {
  name: string;
  routers: {
    name: string;
    hostname: string;
    host: string;
    port: number;
    username: string;
    password: string;
    role: 'master' | 'backup';
  }[];
}

export interface UpdateClusterRequest {
  name: string;
  routers: {
    id?: string;
    name: string;
    hostname: string;
    host: string;
    port: number;
    username: string;
    password: string;
    role: 'master' | 'backup';
  }[];
}

export interface TestConnectionRequest {
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface TestConnectionResponse {
  success: boolean;
  routeros_version?: string;
  board_name?: string;
  error?: string;
}