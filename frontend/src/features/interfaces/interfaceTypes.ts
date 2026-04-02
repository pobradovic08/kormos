// Re-export from api/types for convenience, add form-specific types
export type { RouterInterface, InterfaceAddress } from '../../api/types';

export interface InterfaceFormValues {
  name?: string;
  comment: string;
  addresses: string[]; // IP/CIDR strings
  mtu: number;
  disabled: boolean;
  arp: string;
  // Type-specific (optional)
  vlanId?: number;
  parentInterface?: string;
  bondingMode?: string;
  slaves?: string[];
  bridgePorts?: string[];
  stpEnabled?: boolean;
  wireguardPrivateKey?: string;
  wireguardListenPort?: number;
  greLocalAddress?: string;
  greRemoteAddress?: string;
  tunnelId?: number;
}
