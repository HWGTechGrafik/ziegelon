import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    // Nimmt den Port, den die Umgebung vorgibt. Ohne das sucht sich Vite bei
    // belegtem 5173 selbst einen und die Vorschau zeigt ins Leere.
    port: Number(process.env['PORT']) || 5173,
    watch: {
      // privat/ enthaelt den Lizenzgenerator samt seiner Build-Artefakte.
      // Die Dateiueberwachung lief dort in eine gesperrte Datei und riss den
      // Entwicklungsserver mit (EBUSY). Mit der App hat der Ordner ohnehin
      // nichts zu tun.
      ignored: ['**/privat/**'],
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Ziegelon',
        short_name: 'Ziegelon',
        description:
          'Ziegel-, Laibungs-, Eckstein- und Überlegerbedarf berechnen und bestellen.',
        lang: 'de',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait-primary',
        // Hell, weil der Schriftzug "Ziegel" markendunkel ist und auf dunklem
        // Grund verschwindet.
        background_color: '#F7F6F4',
        theme_color: '#19222B',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
