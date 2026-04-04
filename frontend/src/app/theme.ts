import { createTheme } from '@mantine/core';

export const theme = createTheme({
  fontFamily: "'IBM Plex Sans', sans-serif",
  fontFamilyMonospace: "'IBM Plex Mono', monospace",

  primaryColor: 'blue',
  defaultRadius: 'xs',

  components: {
    Button: {
      defaultProps: {
        radius: 'sm',
      },
    },
  },
});
