import type { FirewallRule } from '../api/types';

const seedData: Record<string, FirewallRule[]> = {
  'mock-1': [
    // chain=input (Router inbound)
    { id: '*1', chain: 'input', action: 'accept', connectionState: ['established', 'related', 'untracked'], disabled: false, comment: 'Accept established, related, untracked' },
    { id: '*2', chain: 'input', action: 'drop', connectionState: ['invalid'], disabled: false, comment: 'Drop invalid' },
    { id: '*3', chain: 'input', action: 'accept', protocol: 'icmp', disabled: false, comment: 'Accept ICMP' },
    { id: '*4', chain: 'input', action: 'accept', srcAddressList: 'LAN', disabled: false, comment: 'Accept from LAN' },
    { id: '*5', chain: 'input', action: 'drop', disabled: false, comment: 'Drop all other input' },
    // chain=forward (Forwarding)
    { id: '*6', chain: 'forward', action: 'fasttrack-connection', connectionState: ['established', 'related'], disabled: false, comment: 'Fasttrack established, related' },
    { id: '*7', chain: 'forward', action: 'accept', connectionState: ['established', 'related', 'untracked'], disabled: false, comment: 'Accept established, related, untracked' },
    { id: '*8', chain: 'forward', action: 'drop', connectionState: ['invalid'], disabled: false, comment: 'Drop invalid' },
    { id: '*9', chain: 'forward', action: 'accept', srcAddressList: 'LAN', outInterface: 'ether1', disabled: false, comment: 'Accept LAN to WAN' },
    { id: '*A', chain: 'forward', action: 'accept', protocol: 'tcp', dstPort: '443', connectionState: ['new'], disabled: false, comment: 'Accept HTTPS port forwarding' },
    { id: '*B', chain: 'forward', action: 'accept', protocol: 'tcp', dstPort: '80', connectionState: ['new'], disabled: true, comment: 'HTTP port forwarding (disabled)' },
    { id: '*C', chain: 'forward', action: 'drop', disabled: false, comment: 'Drop all other forward' },
    // chain=output (Router outbound)
    { id: '*D', chain: 'output', action: 'accept', disabled: false, comment: 'Accept all outbound' },
  ],
  'mock-2': [
    { id: '*1', chain: 'input', action: 'accept', connectionState: ['established', 'related'], disabled: false, comment: 'Accept established, related' },
    { id: '*2', chain: 'input', action: 'drop', connectionState: ['invalid'], disabled: false, comment: 'Drop invalid' },
    { id: '*3', chain: 'input', action: 'accept', protocol: 'icmp', disabled: false, comment: 'Accept ICMP' },
    { id: '*4', chain: 'input', action: 'drop', disabled: false, comment: 'Drop all other input' },
    { id: '*5', chain: 'forward', action: 'accept', connectionState: ['established', 'related'], disabled: false, comment: 'Accept established, related' },
    { id: '*6', chain: 'forward', action: 'drop', disabled: false, comment: 'Drop all other forward' },
    { id: '*7', chain: 'output', action: 'accept', disabled: false, comment: 'Accept all outbound' },
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
