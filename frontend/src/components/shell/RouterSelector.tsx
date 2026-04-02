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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: isReachable ? '#40c057' : '#fa5252',
            flexShrink: 0,
          }}
        />
        <span>{option.label}</span>
      </div>
    );
  };

  return (
    <Select
      placeholder={isLoading ? 'Loading...' : 'No routers'}
      data={options}
      value={selectedRouterId}
      onChange={handleChange}
      renderOption={renderOption}
      searchable
      clearable
      size="xs"
      w={200}
      disabled={isLoading || options.length === 0}
    />
  );
}
