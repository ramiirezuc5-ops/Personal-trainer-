import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// En desarrollo, /api se reenvía al backend: así las cookies son del mismo sitio (sin problemas de CORS ni SameSite).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': { target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000', changeOrigin: false } } },
  build: { sourcemap: false, chunkSizeWarningLimit: 700 },
  test: { environment: 'jsdom', globals: true, setupFiles: ['tests/setup.ts'], css: false, include: ['tests/**/*.test.{ts,tsx}'] },
});
