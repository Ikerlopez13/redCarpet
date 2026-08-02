import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: [],
    pool: 'forks',
    env: {
      VITE_MAPBOX_TOKEN: 'pk.test.redcarpet_budget_tests',
    },
  },
  plugins: [react()],
  base: process.env.WEB_BUILD === 'true' ? '/dashboard/' : './',
  build: {
    target: 'es2020',
    sourcemap: false,
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Firebase — chunk propio
          if (id.includes('firebase') || id.includes('@capacitor-firebase')) return 'firebase';
          // RevenueCat
          if (id.includes('revenuecat') || id.includes('purchases')) return 'revenuecat';
          // Mapbox
          if (id.includes('mapbox')) return 'mapbox';
          // React + todo lo que depende de él van juntos en vendor para evitar
          // errores de orden de carga (createContext undefined)
          if (id.includes('node_modules')) return 'vendor';
        }
      }
    }
  },
  server: {
    host: true,
    port: 5173,
  }
});