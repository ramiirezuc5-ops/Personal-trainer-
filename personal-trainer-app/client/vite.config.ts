import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Un mismo proyecto, dos sitios: `--mode trainer` (panel del entrenador) o `--mode student` (app de los alumnos).
// Cualquier otro modo (incluido el de las pruebas) deja la app completa, como antes.
export default defineConfig(({ mode }) => {
  const appMode = mode === 'trainer' || mode === 'student' ? mode : 'all';
  const student = appMode === 'student';
  return {
    plugins: [react()],
    define: { __APP_MODE__: JSON.stringify(appMode) },
    // En desarrollo, /api se reenvía al backend: así las cookies son del mismo sitio (sin problemas de CORS ni SameSite).
    // strictPort: si el puerto está ocupado, avisa en lugar de abrir otro y confundirte de sitio.
    server: { port: student ? 5174 : 5173, strictPort: true, proxy: { '/api': { target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000', changeOrigin: false } } },
    preview: { port: student ? 4174 : 4173, strictPort: true },
    build: { outDir: appMode === 'all' ? 'dist' : `dist-${appMode}`, sourcemap: false, chunkSizeWarningLimit: 700 },
    test: { environment: 'jsdom', globals: true, setupFiles: ['tests/setup.ts'], css: false, include: ['tests/**/*.test.{ts,tsx}'] },
  };
});
