import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// base relativa: la app funciona servida en la raíz o en una subcarpeta.
export default defineConfig({
  base: './',
  // MapLibre: versión "CSP", con el trabajador (worker) en un archivo aparte que se carga
  // desde nuestro propio dominio. La versión normal lo arma en tiempo de ejecución y falla al empaquetarse.
  resolve: {
    alias: [{ find: /^maplibre-gl$/, replacement: 'maplibre-gl/dist/maplibre-gl-csp.js' }],
  },
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
      // Service worker propio (src/sw.js): sin conexión + notificaciones.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
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
