import { Text } from '@mantine/core';
import type { CSSProperties, ReactNode } from 'react';

export interface MonoTextProps {
  children: ReactNode;
  size?: string;
  fw?: number;
  c?: string;
  lineClamp?: number;
  style?: CSSProperties;
}

export default function MonoText({ children, size = 'sm', fw, c, lineClamp, style }: MonoTextProps) {
  return (
    <Text size={size} ff="monospace" fw={fw} c={c} lineClamp={lineClamp} style={style}>
      {children}
    </Text>
  );
}
