/**
 * Hell, dunkel oder dem System folgen.
 *
 * Gesetzt wird `data-theme` am <html>-Element; bei 'system' bleibt das
 * Attribut weg, damit die CSS-Medienabfrage greift.
 *
 * Zusaetzlich liegt die Wahl in localStorage. Das ist bewusst doppelt:
 * IndexedDB ist die Quelle der Wahrheit, aber asynchron - ohne den
 * synchron lesbaren Zwischenspeicher blitzte beim Start eine Sekunde lang
 * die helle Oberflaeche auf, bevor Dunkel greift.
 */
import { DEFAULT_THEME, type Theme } from '../domain/types'

const CACHE_KEY = 'ziegelon.theme'

const isTheme = (value: unknown): value is Theme =>
  value === 'light' || value === 'dark' || value === 'system'

/**
 * Liest die zuletzt gewaehlte Darstellung aus dem Browserspeicher.
 * Der Zugriff kann werfen - in privaten Fenstern oder bei gesperrten
 * Website-Daten -, deshalb faellt er still auf die Vorgabe zurueck.
 */
export function readCachedTheme(): Theme {
  try {
    const stored = localStorage.getItem(CACHE_KEY)
    return isTheme(stored) ? stored : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'system') delete root.dataset['theme']
  else root.dataset['theme'] = theme

  try {
    localStorage.setItem(CACHE_KEY, theme)
  } catch {
    // Ohne Browserspeicher blitzt beim naechsten Start kurz Hell auf.
    // Kein Grund, die App anzuhalten.
  }
}

/** Was gerade tatsaechlich zu sehen ist - fuer 'system' beim System nachfragen. */
export function effectiveTheme(theme: Theme): 'light' | 'dark' {
  if (theme !== 'system') return theme
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}
