import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  worker: { format: 'es' },
  server: { proxy: { '/api': { target: 'http://127.0.0.1:8080', changeOrigin: false, ws: true } } },
  preview: {
    proxy: { '/api': { target: 'http://127.0.0.1:8080', changeOrigin: false, ws: true } },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Modela · Editor UML',
        short_name: 'Modela',
        lang: 'es',
        description: 'Borradores locales de diagramas de clases',
        theme_color: '#202333',
        background_color: '#fafbfe',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico}'],
        globIgnores: ['ai/**'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) =>
              url.pathname.startsWith('/ai/') && !request.headers.has('x-modela-prepare'),
            handler: 'CacheOnly',
            options: { cacheName: 'modela-ai-v1', cacheableResponse: { statuses: [200] } },
          },
        ],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
})
