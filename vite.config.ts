import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

/**
 * Version der App.
 *
 * Eine einzige Quelle: die Nummer in package.json. Die Windows-exe liest
 * dieselbe Datei beim Bauen, damit Fenster und App nicht verschiedene
 * Nummern behaupten.
 */
const paket = JSON.parse(readFileSync('./package.json', 'utf8')) as { version: string }

/**
 * Commit und Baudatum kommen automatisch dazu.
 *
 * Damit laesst sich auch zwischen zwei Nummern sagen, welcher Stand auf
 * einem Geraet liegt - bei einer Fehlermeldung von der Baustelle ist das die
 * erste Frage. Ohne Git-Arbeitsverzeichnis bleibt der Commit leer, der Bau
 * darf daran nicht scheitern.
 */
function commit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return ''
  }
}

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
  define: {
    __ZIEGELON_VERSION__: JSON.stringify(paket.version),
    __ZIEGELON_COMMIT__: JSON.stringify(commit()),
    __ZIEGELON_GEBAUT__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
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
