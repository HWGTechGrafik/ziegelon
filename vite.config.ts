import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Unterverzeichnis, unter dem die App ausgeliefert wird.
 *
 * Auf GitHub Pages liegt sie unter /ziegelon/, in der Windows-Fassung und
 * beim Entwickeln direkt unter /. Ohne die Unterscheidung suchte die App auf
 * Pages ihre Dateien im Wurzelverzeichnis und bliebe weiss.
 */
const base = process.env['BASE_PATH'] ?? '/'

export default defineConfig({
  base,
  server: {
    // Nimmt den Port, den die Umgebung vorgibt. Ohne das sucht sich Vite bei
    // belegtem 5173 selbst einen und die Vorschau zeigt ins Leere.
    port: Number(process.env['PORT']) || 5173,
    watch: {
      // Ordner mit fertigen Binaerdateien: die Dateiueberwachung laeuft dort
      // in eine gesperrte Datei und reisst den Entwicklungsserver mit
      // (EBUSY) - passiert beim Schnueren der Windows-Fassung zuverlaessig,
      // weil die exe ueber 100 MB gross ist und gerade geschrieben wird.
      // Mit der Weboberflaeche haben die Ordner ohnehin nichts zu tun.
      //
      // privat/       Lizenzgenerator samt Build-Artefakten
      // release/      die gebaute Windows-exe
      // auslieferung/ dieselbe exe, geschnuert zum Weitergeben
      ignored: ['**/privat/**', '**/release/**', '**/auslieferung/**'],
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
        // Muss zum Unterverzeichnis passen, sonst startet die installierte
        // App auf einer leeren Seite.
        start_url: base,
        scope: base,
        id: base,
        display: 'standalone',
        orientation: 'portrait-primary',
        // Hell, weil der Schriftzug "Ziegel" markendunkel ist und auf dunklem
        // Grund verschwindet.
        background_color: '#F7F6F4',
        theme_color: '#19222B',
        icons: [
          { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
          {
            src: `${base}icons/icon-maskable-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
