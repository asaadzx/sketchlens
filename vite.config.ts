import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'SketchLens — trace art on your wall',
        short_name: 'SketchLens',
        description:
          'Project an image onto your wall through the camera, align it by eye, then trace it. No install, no account.',
        theme_color: '#c1572b',
        background_color: '#faf7f2',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        categories: ['graphics', 'photo', 'utilities'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.openverse\.org\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'openverse-api',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 },
              networkTimeoutSeconds: 6,
            },
          },
          {
            urlPattern: /^https:\/\/images\.openverse\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'openverse-thumbs',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
})
