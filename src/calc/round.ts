/**
 * Rundungshelfer. Bewusst eigene Implementierung statt Math.ceil pur, weil
 * Excels CEILING.MATH auf ein Raster rundet und Gleitkommafehler sonst
 * 2,25 / 0,25 = 9,000000000000002 zu 10 aufrunden wuerden.
 */

/** Toleranz auf dem Quotienten - gross genug fuer IEEE-Rauschen, klein genug,
 *  um echte Ueberschreitungen nicht zu schlucken. */
const EPS = 1e-9

/** Entspricht Excel `CEILING.MATH(value; step)`. */
export function ceilTo(value: number, step: number): number {
  if (step <= 0) throw new Error(`ceilTo: step muss > 0 sein, war ${step}`)
  if (value === 0) return 0
  const steps = Math.ceil(value / step - EPS)
  return roundTo(steps * step, 6)
}

/**
 * Aufrunden auf ganze Stueck - fuer Paletten und Ziegelzahlen.
 *
 * Das `+ 0` ist kein Zierrat: `Math.ceil(0 - EPS)` liefert **negative Null**.
 * Rechnerisch ist die gleich 0, angezeigt wird daraus aber "-0 Paletten", und
 * in einer Sicherung stuende dasselbe. Die Addition macht daraus eine
 * gewoehnliche Null.
 */
export function ceilUnits(value: number): number {
  return Math.ceil(value - EPS) + 0
}

/** Kaufmaennisch auf `digits` Nachkommastellen runden (nur fuer die Anzeige). */
export function roundTo(value: number, digits: number): number {
  const f = 10 ** digits
  return Math.round((value + Number.EPSILON) * f) / f
}
