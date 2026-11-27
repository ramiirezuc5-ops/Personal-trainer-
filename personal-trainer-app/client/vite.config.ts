// // import react from '@vitejs/plugin-react';
// // import { defineConfig } from 'vitest/config';

// // // Un mismo proyecto, dos sitios: `--mode trainer` (panel del entrenador) o `--mode student` (app de los alumnos).
// // // Cualquier otro modo (incluido el de las pruebas) deja la app completa, como antes.
// // export default defineConfig(({ mode }) => {
// //   const appMode = mode === 'trainer' || mode === 'student' ? mode : 'all';
// //   const student = appMode === 'student';
// //   return {
// //     plugins: [react()],
// //     define: { __APP_MODE__: JSON.stringify(appMode) },
// //     // En desarrollo, /api se reenvía al backend: así las cookies son del mismo sitio (sin problemas de CORS ni SameSite).
// //     // strictPort: si el puerto está ocupado, avisa en lugar de abrir otro y confundirte de sitio.
// //     server: { port: student ? 5174 : 5173, strictPort: true, proxy: { '/api': { target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000', changeOrigin: false } } },
// //     preview: { port: student ? 4174 : 4173, strictPort: true },
// //     build: { outDir: appMode === 'all' ? 'dist' : `dist-${appMode}`, sourcemap: false, chunkSizeWarningLimit: 700 },
// //     test: { environment: 'jsdom', globals: true, setupFiles: ['tests/setup.ts'], css: false, include: ['tests/**/*.test.{ts,tsx}'] },
// //   };
// // });




// // import react from '@vitejs/plugin-react';
// // import { defineConfig } from 'vitest/config';
// // import { VitePWA } from 'vite-plugin-pwa';

// // // Un mismo proyecto para entrenadores y alumnos.
// // export default defineConfig(({ mode }) => {
// //   const appMode = mode === 'trainer' || mode === 'student' ? mode : 'all';
// //   const student = appMode === 'student';

// //   return {
// //     plugins: [
// //       react(),

// //       VitePWA({
// //         registerType: 'autoUpdate',

// //         includeAssets: ['favicon.svg'],

// //         manifest: {
// //           id: '/',
// //           name: 'Personal Trainer',
// //           short_name: 'Personal Trainer',
// //           description: 'Tu plataforma de entrenamiento y gestión personal.',
// //           theme_color: '#0a0a0c',
// //           background_color: '#0a0a0c',
// //           display: 'standalone',
// //           orientation: 'portrait',
// //           scope: '/',
// //           start_url: '/',
// //           icons: [],
// //         },

// //         workbox: {
// //           navigateFallbackDenylist: [/^\/api\//],
// //         },
// //       }),
// //     ],

// //     define: {
// //       __APP_MODE__: JSON.stringify(appMode),
// //     },

// //     server: {
// //       port: student ? 5174 : 5173,
// //       strictPort: true,
// //       proxy: {
// //         '/api': {
// //           target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000',
// //           changeOrigin: false,
// //         },
// //       },
// //     },

// //     preview: {
// //       port: student ? 4174 : 4173,
// //       strictPort: true,
// //     },

// //     build: {
// //       outDir: appMode === 'all' ? 'dist' : `dist-${appMode}`,
// //       sourcemap: false,
// //       chunkSizeWarningLimit: 700,
// //     },

// //     test: {
// //       environment: 'jsdom',
// //       globals: true,
// //       setupFiles: ['tests/setup.ts'],
// //       css: false,
// //       include: ['tests/**/*.test.{ts,tsx}'],
// //     },
// //   };
// // });

// import react from '@vitejs/plugin-react';
// import { defineConfig } from 'vitest/config';
// import { VitePWA } from 'vite-plugin-pwa';

// // Un mismo proyecto para entrenadores y alumnos.
// export default defineConfig(({ mode }) => {
//   const appMode = mode === 'trainer' || mode === 'student' ? mode : 'all';
//   const student = appMode === 'student';

//   return {
//     plugins: [
//       react(),

//       VitePWA({
//         registerType: 'autoUpdate',

//         includeAssets: ['favicon.svg'],

//         manifest: {
//           id: '/',
//           name: 'Personal Trainer',
//           short_name: 'Personal Trainer',
//           description: 'Plataforma de entrenamiento y gestion personal.',
//           lang: 'es',
//           theme_color: '#0a0a0c',
//           background_color: '#0a0a0c',
//           display: 'standalone',
//           orientation: 'portrait',
//           scope: '/',
//           start_url: '/',
//           icons: [
//             {
//               src: '/pwa-192x192.png',
//               sizes: '192x192',
//               type: 'image/png',
//               purpose: 'any',
//             },
//             {
//               src: '/pwa-512x512.png',
//               sizes: '512x512',
//               type: 'image/png',
//               purpose: 'any',
//             },
//           ],
//         },

//         workbox: {
//           navigateFallbackDenylist: [/^\/api\//],
//         },
//       }),
//     ],

//     define: {
//       __APP_MODE__: JSON.stringify(appMode),
//     },

//     server: {
//       port: student ? 5174 : 5173,
//       strictPort: true,
//       proxy: {
//         '/api': {
//           target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000',
//           changeOrigin: false,
//         },
//       },
//     },

//     preview: {
//       port: student ? 4174 : 4173,
//       strictPort: true,
//     },

//     build: {
//       outDir: appMode === 'all' ? 'dist' : `dist-${appMode}`,
//       sourcemap: false,
//       chunkSizeWarningLimit: 700,
//     },

//     test: {
//       environment: 'jsdom',
//       globals: true,
//       setupFiles: ['tests/setup.ts'],
//       css: false,
//       include: ['tests/**/*.test.{ts,tsx}'],
//     },
//   };
// });

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

// Un mismo proyecto para entrenadores y alumnos.
export default defineConfig(({ mode }) => {
  const appMode = mode === 'trainer' || mode === 'student' ? mode : 'all';
  const student = appMode === 'student';

  return {
    plugins: [
      react(),

      VitePWA({
        registerType: 'autoUpdate',

        includeAssets: ['favicon.svg'],

        manifest: {
          id: '/',
          name: 'Personal Trainer',
          short_name: 'Personal Trainer',
          description: 'Plataforma de entrenamiento y gestion personal.',
          lang: 'es',
          theme_color: '#0a0a0c',
          background_color: '#0a0a0c',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
          ],
        },

        workbox: {
          // Evita que las rutas de API reciban el fallback de la aplicación.
          navigateFallbackDenylist: [/^\/api\//],

          // Las solicitudes de API nunca se guardan en caché.
          runtimeCaching: [
            {
              urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
              handler: 'NetworkOnly',
            },
          ],
        },
      }),
    ],

    define: {
      __APP_MODE__: JSON.stringify(appMode),
    },

    server: {
      port: student ? 5174 : 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:4000',
          changeOrigin: false,
        },
      },
    },

    preview: {
      port: student ? 4174 : 4173,
      strictPort: true,
    },

    build: {
      outDir: appMode === 'all' ? 'dist' : `dist-${appMode}`,
      sourcemap: false,
      chunkSizeWarningLimit: 700,
    },

    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['tests/setup.ts'],
      css: false,
      include: ['tests/**/*.test.{ts,tsx}'],
    },
  };
});