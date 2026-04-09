import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Title,
  Button,
  Group,
  Text,
  Stack,
  TextInput,
  Tabs,
} from '@mantine/core';
import { IconPlus, IconSearch, IconShield } from '@tabler/icons-react';
import { useClusterId } from '../../hooks/useClusterId';
import {
  useFirewallRules,
  useUpdateFirewallRule,
  useDeleteFirewallRule,
  useMoveFirewallRule,
} from './firewallApi';
import FirewallTable, { FirewallTableSkeleton } from './FirewallTable';
import FirewallDetail from './FirewallDetail';
import FirewallForm from './FirewallForm';
import { useInterfaces } from '../interfaces/interfacesApi';
import { useAddressLists } from '../address-lists/addressListsApi';
import EmptyState from '../../components/common/EmptyState';
import ErrorBanner from '../../components/common/ErrorBanner';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import type { FirewallRule, FirewallChain } from '../../api/types';

function matchesRule(rule: FirewallRule, query: string): boolean {
  const fields = [
    rule.comment,
    rule.action,
    rule.protocol,
    rule.srcAddress,
    rule.dstAddress,
    rule.srcAddressList,
    rule.dstAddressList,
    rule.srcPort,
    rule.dstPort,
    rule.inInterface,
    rule.outInterface,
  ];
  return fields.some((f) => f && f.toLowerCase().includes(query));
}

export default function FirewallPage() {
  const clusterId = useClusterId();
  const { data: rules, isLoading, error, refetch } = useFirewallRules(clusterId);
  const updateMutation = useUpdateFirewallRule(clusterId);
  const deleteMutation = useDeleteFirewallRule(clusterId);
  const moveMutation = useMoveFirewallRule(clusterId);
  const { data: interfaces } = useInterfaces(clusterId);

  const routerInterfaces = interfaces ?? [];

  const { data: addressLists } = useAddressLists(clusterId);
  const addressListNames = useMemo(() => {
    if (!addressLists) return [];
    return addressLists.map((l) => l.name);
  }, [addressLists]);

  const [activeTab, setActiveTab] = useState<FirewallChain>('forward');
  const [search, setSearch] = useState('');
  const [selectedRule, setSelectedRule] = useState<FirewallRule | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editRule, setEditRule] = useState<FirewallRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FirewallRule | null>(null);

  // Reset state when cluster changes
  const prevClusterId = useRef(clusterId);
  useEffect(() => {
    if (prevClusterId.current !== clusterId) {
      setActiveTab('forward');
      setSearch('');
      setSelectedRule(null);
      setDetailOpen(false);
      setFormOpen(false);
      setEditRule(null);
      setDeleteTarget(null);
      prevClusterId.current = clusterId;
    }
  }, [clusterId]);

  const filtered = useMemo(() => {
    if (!rules) return [];
    const byChain = rules.filter((r) => r.chain === activeTab);
    const trimmed = search.trim();
    if (!trimmed) return byChain;
    const query = trimmed.toLowerCase();
    return byChain.filter((r) => matchesRule(r, query));
  }, [rules, activeTab, search]);

  const chainHasRules = useMemo(() => {
    return rules ? rules.some((r) => r.chain === activeTab) : false;
  }, [rules, activeTab]);

  // CRUD handlers
  const handleAddRule = () => {
    setEditRule(null);
    setFormOpen(true);
  };

  const handleRowClick = (rule: FirewallRule) => {
    setSelectedRule(rule);
    setDetailOpen(true);
  };

  const handleDetailClose = () => {
    setDetailOpen(false);
  };

  const handleEdit = (rule: FirewallRule) => {
    setDetailOpen(false);
    setEditRule(rule);
    setFormOpen(true);
  };

  const handleDelete = (rule: FirewallRule) => {
    setDetailOpen(false);
    setDeleteTarget(rule);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(
      { id: deleteTarget.id },
      {
        onSuccess: () => {
          setDeleteTarget(null);
          setSelectedRule(null);
        },
      },
    );
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditRule(null);
  };

  const handleUpdate = (id: string, updates: Partial<FirewallRule>) => {
    updateMutation.mutate({ id, updates });
  };

  const handleReorder = (activeId: string, overId: string) => {
    moveMutation.mutate({ ruleId: activeId, destinationId: overId });
  };

  // Loading
  if (isLoading) {
    return (
      <>
        <Group justify="space-between" align="flex-start" mb="lg">
          <Stack gap={4}>
            <Title order={2}>Firewall</Title>
            <Text size="sm" c="dimmed">
              Firewall filter rules
            </Text>
          </Stack>
        </Group>
        <FirewallTableSkeleton />
      </>
    );
  }

  // Error
  if (error) {
    return (
      <ErrorBanner
        message="Failed to load firewall rules. Please try again later."
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <>
      <Group justify="space-between" align="flex-start" mb="lg">
        <Stack gap={4}>
          <Title order={2}>Firewall</Title>
          <Text size="sm" c="dimmed">
            Firewall filter rules
          </Text>
        </Stack>
        <Button leftSection={<IconPlus size={16} />} onClick={handleAddRule}>
          Add Rule
        </Button>
      </Group>

      <Tabs value={activeTab} onChange={(v) => setActiveTab(v as FirewallChain)} mb="md">
        <Tabs.List>
          <Tabs.Tab value="forward">Forwarding</Tabs.Tab>
          <Tabs.Tab value="input">Router inbound</Tabs.Tab>
          <Tabs.Tab value="output">Router outbound</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {chainHasRules ? (
        <>
          <TextInput
            placeholder="Search by comment, address, protocol, interface..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            radius="sm"
            mb="md"
          />
          <FirewallTable
            rules={filtered}
            routerInterfaces={routerInterfaces}
            addressListNames={addressListNames}
            onInfo={handleRowClick}
            onUpdate={handleUpdate}
            onReorder={handleReorder}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        </>
      ) : (
        <EmptyState
          icon={IconShield}
          title="No rules configured"
          description={`This router has no firewall rules in the ${activeTab === 'forward' ? 'forwarding' : activeTab === 'input' ? 'router inbound' : 'router outbound'} chain.`}
          action={
            <Button leftSection={<IconPlus size={16} />} onClick={handleAddRule}>
              Add Rule
            </Button>
          }
        />
      )}

      <FirewallDetail
        rule={selectedRule}
        isOpen={detailOpen}
        onClose={handleDetailClose}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <FirewallForm
        isOpen={formOpen}
        onClose={handleFormClose}
        routerId={clusterId}
        chain={activeTab}
        editRule={editRule}
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Rule"
        message={`Are you sure you want to delete this firewall rule? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmColor="red"
      />
    </>
  );
}
