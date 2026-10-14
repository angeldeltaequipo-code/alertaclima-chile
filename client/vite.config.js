import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// base relativa: la app funciona servida en la raíz o en una subcarpeta.
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icono.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'AlertaClima Chile',
        short_name: 'AlertaClima',
        description: 'Lluvia, radar y alertas de tu comuna en tiempo real.',
        lang: 'es-CL',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0E1A24',
        theme_color: '#0E1A24',
        icons: [
          { src: 'icono-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icono-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // La interfaz completa queda en caché: la app abre sin conexión.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Límites comunales: cambian casi nunca.
            urlPattern: ({ url }) => url.pathname.includes('/limites/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'limites', expiration: { maxEntries: 20 } },
          },
          {
            // Mapa base: se guarda lo visto para poder consultarlo sin señal.
            urlPattern: ({ url }) => url.hostname.endsWith('basemaps.cartocdn.com'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'mapa-base',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Pronóstico y búsqueda de localidades: lo más nuevo si hay señal.
            urlPattern: ({ url }) => url.hostname.endsWith('open-meteo.com'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'clima',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            // Índice de cuadros de radar: siempre se intenta lo más nuevo.
            urlPattern: ({ url }) => url.hostname === 'api.rainviewer.com',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'radar-indice',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 6 },
            },
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith('rainviewer.com'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'radar-cuadros',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 3 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('leaflet')) return 'mapa'
        },
      },
    },
  },
})
