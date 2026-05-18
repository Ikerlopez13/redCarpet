import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'es2020',
    sourcemap: false,
    outDir: 'dist',
    emptyOutDir: true,
  },
  optimizeDeps: {
    noDiscovery: true,
  },
  server: {
    host: true,
    port: 5173,
  }
});