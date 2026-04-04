import { Stack, Group, TextInput, ActionIcon, Button } from '@mantine/core';
import { IconPlus, IconX } from '@tabler/icons-react';

interface IpAddressInputProps {
  value: string[];
  onChange: (value: string[]) => void;
}

const IP_CIDR_PATTERN = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;

function validateIpCidr(value: string): string | null {
  if (!value.trim()) return null; // empty is allowed, will be filtered on save
  if (!IP_CIDR_PATTERN.test(value.trim())) {
    return 'Must be in IP/CIDR format (e.g. 192.168.1.1/24)';
  }
  return null;
}

export default function IpAddressInput({ value, onChange }: IpAddressInputProps) {
  const handleChange = (index: number, newVal: string) => {
    const updated = [...value];
    updated[index] = newVal;
    onChange(updated);
  };

  const handleAdd = () => {
    onChange([...value, '']);
  };

  const handleRemove = (index: number) => {
    const updated = value.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <Stack gap="xs">
      {value.map((addr, index) => (
        <Group key={index} gap="xs" wrap="nowrap">
          <TextInput
            placeholder="192.168.1.1/24"
            value={addr}
            onChange={(e) => handleChange(index, e.currentTarget.value)}
            error={addr ? validateIpCidr(addr) : undefined}
            style={{ flex: 1 }}
            size="sm"
          />
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={() => handleRemove(index)}
            size="sm"
          >
            <IconX size={14} />
          </ActionIcon>
        </Group>
      ))}
      <Button
        variant="light"
        size="compact-xs"
        leftSection={<IconPlus size={14} />}
        onClick={handleAdd}
        style={{ alignSelf: 'flex-start' }}
      >
        Add address
      </Button>
    </Stack>
  );
}
