import type { FirewallRule } from '../api/types';

const seedData: Record<string, FirewallRule[]> = {
  'mock-1': [
    // chain=input (Router inbound)
    { id: '*1', chain: 'input', action: 'accept', connectionState: ['established', 'related', 'untracked'], disabled: false, comment: 'Accept established, related, untracked' },
    { id: '*2', chain: 'input', action: 'drop', connectionState: ['invalid'], disabled: false, comment: 'Drop invalid' },
    { id: '*3', chain: 'input', action: 'accept', protocol: 'icmp', disabled: false, comment: 'Accept ICMP' },
    { id: '*4', chain: 'input', action: 'accept', protocol: 'icmpv6', srcAddress: 'fe80::/10', disabled: false, comment: 'Accept ICMPv6 link-local' },
    { id: '*5', chain: 'input', action: 'accept', srcAddressList: 'LAN', inInterface: 'bridge1', disabled: false, comment: 'Accept from LAN' },
    { id: '*6', chain: 'input', action: 'accept', protocol: 'udp', dstPort: '53', srcAddress: '192.168.88.0/24', disabled: false, comment: 'Accept DNS from LAN' },
    { id: '*7', chain: 'input', action: 'accept', protocol: 'tcp', dstPort: '8291', srcAddress: '2001:0db8:85a3:0000:0000:8a2e:0370:7334/128', disabled: false, comment: 'Winbox from admin IPv6 host' },
    { id: '*8', chain: 'input', action: 'drop', disabled: false, comment: 'Drop all other input' },
    // chain=forward (Forwarding)
    { id: '*9', chain: 'forward', action: 'fasttrack-connection', connectionState: ['established', 'related'], disabled: false, comment: 'Fasttrack established, related' },
    { id: '*A', chain: 'forward', action: 'accept', connectionState: ['established', 'related', 'untracked'], disabled: false, comment: 'Accept established, related, untracked' },
    { id: '*B', chain: 'forward', action: 'drop', connectionState: ['invalid'], disabled: false, comment: 'Drop invalid' },
    { id: '*C', chain: 'forward', action: 'accept', srcAddressList: 'LAN', outInterface: 'ether1', disabled: false, comment: 'Accept LAN to WAN' },
    { id: '*D', chain: 'forward', action: 'accept', srcAddress: '2001:0db8:1234:5678::/64', dstAddress: '2001:0db8:abcd:ef01::/64', outInterface: 'sit1', disabled: false, comment: 'Allow IPv6 site-to-site' },
    { id: '*E', chain: 'forward', action: 'accept', protocol: 'tcp', dstPort: '443', dstAddress: '10.0.1.50', connectionState: ['new'], inInterface: 'ether1', disabled: false, comment: 'HTTPS to web server' },
    { id: '*F', chain: 'forward', action: 'accept', protocol: 'tcp', dstPort: '80', dstAddress: '10.0.1.50', connectionState: ['new'], inInterface: 'ether1', disabled: true, comment: 'HTTP to web server (disabled)' },
    { id: '*10', chain: 'forward', action: 'accept', protocol: 'tcp', dstPort: '25', dstAddress: '2001:0db8:85a3:0000:0000:8a2e:0370:7334', connectionState: ['new'], disabled: false, comment: 'SMTP to mail server (full IPv6)' },
    { id: '*11', chain: 'forward', action: 'drop', srcAddress: 'fc00::/7', dstAddressList: 'bogons', disabled: false, comment: 'Drop ULA to bogons' },
    { id: '*12', chain: 'forward', action: 'drop', disabled: false, comment: 'Drop all other forward' },
    // chain=output (Router outbound)
    { id: '*13', chain: 'output', action: 'accept', protocol: 'udp', dstPort: '53', dstAddress: '1.1.1.1', disabled: false, comment: 'Allow DNS to Cloudflare' },
    { id: '*14', chain: 'output', action: 'accept', protocol: 'udp', dstPort: '123', dstAddress: '2620:fe::fe', disabled: false, comment: 'NTP to Quad9 IPv6' },
    { id: '*15', chain: 'output', action: 'accept', disabled: false, comment: 'Accept all other outbound' },
  ],
  'mock-2': [
    { id: '*1', chain: 'input', action: 'accept', connectionState: ['established', 'related'], disabled: false, comment: 'Accept established, related' },
    { id: '*2', chain: 'input', action: 'drop', connectionState: ['invalid'], disabled: false, comment: 'Drop invalid' },
    { id: '*3', chain: 'input', action: 'accept', protocol: 'icmp', disabled: false, comment: 'Accept ICMP' },
    { id: '*4', chain: 'input', action: 'accept', protocol: 'icmpv6', disabled: false, comment: 'Accept ICMPv6' },
    { id: '*5', chain: 'input', action: 'accept', srcAddress: '192.168.1.0/24', inInterface: 'bridge1', disabled: false, comment: 'Accept from management subnet' },
    { id: '*6', chain: 'input', action: 'drop', disabled: false, comment: 'Drop all other input' },
    { id: '*7', chain: 'forward', action: 'accept', connectionState: ['established', 'related'], disabled: false, comment: 'Accept established, related' },
    { id: '*8', chain: 'forward', action: 'accept', srcAddress: 'fd12:3456:789a::/48', dstAddress: '2001:0db8::/32', outInterface: 'ether1', disabled: false, comment: 'Allow ULA to global IPv6' },
    { id: '*9', chain: 'forward', action: 'drop', disabled: false, comment: 'Drop all other forward' },
    { id: '*A', chain: 'output', action: 'accept', disabled: false, comment: 'Accept all outbound' },
  ],
};

let data = structuredClone(seedData);
let nextId = 0x100;

export function listFirewallRules(routerId: string): FirewallRule[] {
  return [...(data[routerId] ?? [])];
}

export function addFirewallRule(routerId: string, rule: Omit<FirewallRule, 'id'>): FirewallRule {
  if (!data[routerId]) data[routerId] = [];
  const newRule: FirewallRule = { ...rule, id: `*${(nextId++).toString(16).toUpperCase()}` };
  data[routerId].push(newRule);
  return newRule;
}

export function updateFirewallRule(routerId: string, id: string, updates: Partial<FirewallRule>): FirewallRule {
  const rules = data[routerId];
  if (!rules) throw new Error('Router not found');
  const index = rules.findIndex((r) => r.id === id);
  if (index === -1) throw new Error('Rule not found');
  rules[index] = { ...rules[index], ...updates, id };
  return rules[index];
}

export function deleteFirewallRule(routerId: string, id: string): void {
  if (!data[routerId]) return;
  data[routerId] = data[routerId].filter((r) => r.id !== id);
}

export function moveFirewallRule(routerId: string, ruleId: string, destinationId: string): void {
  const rules = data[routerId];
  if (!rules) return;
  const fromIndex = rules.findIndex((r) => r.id === ruleId);
  if (fromIndex === -1) return;
  const [rule] = rules.splice(fromIndex, 1);
  const toIndex = rules.findIndex((r) => r.id === destinationId);
  if (toIndex === -1) {
    rules.push(rule);
  } else {
    rules.splice(toIndex, 0, rule);
  }
}
