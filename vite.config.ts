import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Every top-level path the backend serves. /api covers the /api/v1 modules
// (stations, commands, alerts, games); the newer modules sit at the root.
const BACKEND_PATHS = [
  '/auth',
  '/users',
  '/gamers',
  '/employees',
  '/health',
  '/api',
  '/machines',
  '/branches',
  '/wallets',
  '/pricing',
  '/membership-plans',
  '/memberships',
  '/subscription-plans',
  '/subscriptions',
  '/reservations',
  '/sessions',
  '/audit-logs',
  '/ranks',
  '/uploads',
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backend = env.VITE_BACKEND_URL || 'http://localhost:3000';

  const proxy: Record<string, object> = {
    '/dashboard-io': { target: backend, ws: true, changeOrigin: true },
  };
  for (const path of BACKEND_PATHS) {
    proxy[path] = { target: backend, changeOrigin: true };
  }

  return {
    plugins: [react()],
    // Relative asset URLs, so dist/admin/index.html loads ../assets/… whether
    // Caddy serves it under /admin/ or the Electron shell opens it.
    base: './',
    // Multi-page build: /admin/ (loaded by the Electron shell) and /portal/
    // (the gamer PWA). Each ships only its own code.
    build: {
      rollupOptions: {
        input: {
          admin: resolve(__dirname, 'admin/index.html'),
          portal: resolve(__dirname, 'portal/index.html'),
        },
        output: {
          manualChunks: (id) => (id.includes('node_modules') ? 'vendor' : undefined),
        },
      },
    },
    server: { port: 5173, proxy },
  };
});
