/**
 * Version der App.
 *
 * Die Werte setzt Vite beim Bauen ein (siehe vite.config.ts). Die Nummer
 * steht in package.json und nirgends sonst - die Windows-exe liest dieselbe
 * Datei, damit Fenster und App nicht verschiedene Nummern behaupten.
 *
 * Commit und Baudatum kommen automatisch dazu. Zwischen zwei Nummern laesst
 * sich damit sagen, welcher Stand auf einem Geraet liegt; bei einer Meldung
 * von der Baustelle ist das die erste Frage.
 */
declare const __ZIEGELON_VERSION__: string
declare const __ZIEGELON_COMMIT__: string
declare const __ZIEGELON_GEBAUT__: string

export const VERSION = __ZIEGELON_VERSION__
export const COMMIT = __ZIEGELON_COMMIT__
export const GEBAUT = __ZIEGELON_GEBAUT__

/** Kurzform fuer die Fusszeile, z. B. "Version 1.1.0". */
export const VERSION_KURZ = `Version ${VERSION}`

/** Lange Form fuer die Einstellungen, z. B. "1.1.0 · 21.9.2026 · a99f6f8". */
export function versionLang(): string {
  const datum = GEBAUT ? new Date(GEBAUT).toLocaleDateString('de-AT') : ''
  return [VERSION, datum, COMMIT].filter(Boolean).join(' · ')
}
