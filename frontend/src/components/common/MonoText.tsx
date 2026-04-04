import { Text } from '@mantine/core';
import type { ReactNode } from 'react';

interface MonoTextProps {
  children: ReactNode;
  size?: string;
  fw?: number;
  c?: string;
}

export default function MonoText({ children, size = 'sm', fw, c }: MonoTextProps) {
  return (
    <Text size={size} ff="monospace" fw={fw} c={c}>
      {children}
    </Text>
  );
}
