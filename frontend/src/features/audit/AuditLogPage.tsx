import { useState } from 'react';
import {
  Title,
  Group,
  Table,
  Badge,
  Text,
  Loader,
  Alert,
  Stack,
  Select,
  TextInput,
  Pagination,
  Paper,
} from '@mantine/core';
import { IconAlertCircle, IconSearch } from '@tabler/icons-react';
import { useRouters } from '../routers/routersApi';
import { useAuditLog } from './auditApi';
import type { AuditFilters } from './auditApi';
import type { AuditEntry } from '../../api/types';
import AuditEntryDetail from './AuditEntryDetail';

const PER_PAGE = 20;

function statusColor(status: string): string {
  switch (status) {
    case 'success':
      return 'green';
    case 'partial':
      return 'yellow';
    case 'failure':
      return 'red';
    default:
      return 'gray';
  }
}

function formatTimestamp(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

function truncate(text: string, maxLength: number): string {
  if (!text) return '-';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

export default function AuditLogPage() {
  const [routerFilter, setRouterFilter] = useState<string | null>(null);
  const [moduleFilter, setModuleFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<AuditEntry | null>(null);
  const [detailOpened, setDetailOpened] = useState(false);

  const { data: routers } = useRouters();

  const filters: AuditFilters = {
    routerId: routerFilter || undefined,
    module: moduleFilter || undefined,
    from: fromDate || undefined,
    to: toDate || undefined,
    page,
    perPage: PER_PAGE,
  };

  const { data, isLoading, error } = useAuditLog(filters);

  const entries = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const routerOptions = (routers ?? []).map((r) => ({
    value: r.id,
    label: r.name,
  }));

  const handleRowClick = (entry: AuditEntry) => {
    setSelectedEntry(entry);
    setDetailOpened(true);
  };

  const handleDetailClose = () => {
    setDetailOpened(false);
    setSelectedEntry(null);
  };

  const handleRouterChange = (value: string | null) => {
    setRouterFilter(value);
    setPage(1);
  };

  const handleModuleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setModuleFilter(e.currentTarget.value);
    setPage(1);
  };

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFromDate(e.currentTarget.value);
    setPage(1);
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setToDate(e.currentTarget.value);
    setPage(1);
  };

  return (
    <>
      <Title order={2} mb="md">
        Audit Log
      </Title>

      <Paper p="md" mb="md" withBorder>
        <Group gap="md" align="flex-end">
          <Select
            label="Router"
            placeholder="All routers"
            data={routerOptions}
            value={routerFilter}
            onChange={handleRouterChange}
            clearable
            searchable
            style={{ minWidth: 200 }}
          />
          <TextInput
            label="Module"
            placeholder="e.g. interface/vlan"
            value={moduleFilter}
            onChange={handleModuleChange}
            leftSection={<IconSearch size={14} />}
            style={{ minWidth: 180 }}
          />
          <TextInput
            label="From"
            type="date"
            value={fromDate}
            onChange={handleFromChange}
            style={{ minWidth: 160 }}
          />
          <TextInput
            label="To"
            type="date"
            value={toDate}
            onChange={handleToChange}
            style={{ minWidth: 160 }}
          />
        </Group>
      </Paper>

      {isLoading ? (
        <Stack align="center" mt="xl">
          <Loader size="lg" />
          <Text c="dimmed">Loading audit log...</Text>
        </Stack>
      ) : error ? (
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red" mt="md">
          Failed to load audit log. Please try again later.
        </Alert>
      ) : entries.length === 0 ? (
        <Text c="dimmed" ta="center" mt="xl">
          No audit log entries found. Adjust filters or perform some configuration changes.
        </Text>
      ) : (
        <>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>User</Table.Th>
                <Table.Th>Router</Table.Th>
                <Table.Th>Module</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Timestamp</Table.Th>
                <Table.Th>Commit Message</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {entries.map((entry) => (
                <Table.Tr
                  key={entry.id}
                  onClick={() => handleRowClick(entry)}
                  style={{ cursor: 'pointer' }}
                >
                  <Table.Td>
                    <Text size="sm">{entry.user.name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{entry.router.name}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" size="sm">
                      {entry.module}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      color={statusColor(entry.status)}
                      variant="filled"
                      size="sm"
                    >
                      {entry.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {formatTimestamp(entry.created_at)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {truncate(entry.commit_message, 50)}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          <Group justify="center" mt="md">
            <Pagination
              total={totalPages}
              value={page}
              onChange={setPage}
            />
          </Group>
        </>
      )}

      <AuditEntryDetail
        entry={selectedEntry}
        opened={detailOpened}
        onClose={handleDetailClose}
      />
    </>
  );
}
