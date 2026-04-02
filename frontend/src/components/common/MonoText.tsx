import { Text } from '@mantine/core';
import type { ReactNode } from 'react';

interface MonoTextProps {
  children: ReactNode;
  size?: string;
}

export default function MonoText({ children, size = 'sm' }: MonoTextProps) {
  return (
    <Text size={size} ff="monospace">
      {children}
    </Text>
  );
}
