import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 15400,
    watch: {
      useFsEvents: false,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:15480',
        changeOrigin: true,
      },
    },
  },
});
