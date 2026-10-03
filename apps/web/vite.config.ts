import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Chunking (Vite 8 / Rolldown `output.codeSplitting`, formerly `advancedChunks`): long-lived
 * vendor code is split from the app bundle so a deploy only invalidates what changed. three.js
 * is reached only through the dynamic `import('@maze/renderer/three')` and must stay out of the
 * initial graph; no group below matches it, so Rolldown keeps it in its own lazily loaded chunk.
 * `scripts/check-bundle-size.mjs` fails the build if that ever changes.
 */
const vendorGroups = [
  { name: 'vendor-react', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
  { name: 'vendor-router', test: /[\\/]node_modules[\\/]@tanstack[\\/]/ },
  {
    name: 'vendor-ui',
    test: /[\\/]node_modules[\\/](@radix-ui|lucide-react|@floating-ui|aria-hidden|react-remove-scroll|react-remove-scroll-bar|react-style-singleton|use-callback-ref|use-sidecar|get-nonce|tslib)[\\/]/,
  },
  { name: 'vendor-state', test: /[\\/]node_modules[\\/]zustand[\\/]/ },
];

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      // Registration happens in src/pwa/register.ts so the app can show an update toast.
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'robots.txt'],
      manifest: {
        id: '/',
        name: 'Maze Lab',
        short_name: 'Maze Lab',
        description:
          'Generate, solve, race and learn maze algorithms in 2D and 3D. Works offline.',
        lang: 'en',
        dir: 'ltr',
        start_url: '/play',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#0f1420',
        background_color: '#0f1420',
        categories: ['education', 'games'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell + all hashed assets are precached; the three.js chunk (~550 kB) included.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        runtimeCaching: [
          {
            // HTML navigations: prefer the network, fall back to cache when offline.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'maze-lab-pages',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            // Hashed build assets never change under the same URL.
            urlPattern: ({ url }) => url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'maze-lab-assets',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: false,
    // dist/.vite/manifest.json is read by scripts/check-bundle-size.mjs.
    manifest: true,
    chunkSizeWarningLimit: 600,
    rolldownOptions: {
      output: {
        codeSplitting: { groups: vendorGroups },
      },
    },
  },
  server: {
    fs: {
      // Workspace packages are linked from ../../packages/*.
      allow: ['../..'],
    },
  },
});
