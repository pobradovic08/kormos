import { Select } from '@mantine/core';
import { useRouters } from '../../features/routers/routersApi';
import { useRouterStore } from '../../stores/useRouterStore';
import type { ComboboxItem } from '@mantine/core';

export default function RouterSelector() {
  const { data: routers, isLoading } = useRouters();
  const selectedRouterId = useRouterStore((s) => s.selectedRouterId);
  const selectRouter = useRouterStore((s) => s.selectRouter);
  const clearRouter = useRouterStore((s) => s.clearRouter);

  const options: ComboboxItem[] = (routers ?? []).map((router) => ({
    value: router.id,
    label: router.name || router.hostname,
  }));

  const handleChange = (value: string | null) => {
    if (value) {
      selectRouter(value);
    } else {
      clearRouter();
    }
  };

  const renderOption = ({ option }: { option: ComboboxItem }) => {
    const router = routers?.find((r) => r.id === option.value);
    const isReachable = router?.is_reachable ?? false;

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--mantine-spacing-xs)' }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: isReachable
              ? 'var(--mantine-color-green-7)'
              : 'var(--mantine-color-red-7)',
            flexShrink: 0,
          }}
        />
        <span>{option.label}</span>
      </div>
    );
  };

  return (
    <Select
      placeholder={isLoading ? 'Loading...' : 'Select router'}
      data={options}
      value={selectedRouterId}
      onChange={handleChange}
      renderOption={renderOption}
      searchable
      clearable
      size="xs"
      w={200}
      disabled={isLoading || options.length === 0}
      styles={{
        input: {
          backgroundColor: 'var(--mantine-color-dark-6)',
          borderColor: 'var(--mantine-color-dark-4)',
          color: '#ffffff',
          '&::placeholder': {
            color: 'var(--mantine-color-dark-2)',
          },
          '&:focus': {
            borderColor: 'var(--mantine-color-blue-6)',
          },
        },
        section: {
          color: 'var(--mantine-color-dark-2)',
        },
      }}
    />
  );
}
