/**
 * Zahlen in oesterreichischer Schreibweise.
 *
 * Auf der Baustelle wird "2,75" getippt, nicht "2.75". Die Eingabe muss beides
 * annehmen, sonst entstehen still falsche Mengen: parseFloat("2,75") ergibt 2.
 */
const nf = (min: number, max: number) =>
  new Intl.NumberFormat('de-AT', { minimumFractionDigits: min, maximumFractionDigits: max })

const decimal = nf(0, 2)
const exact = nf(0, 0)

/**
 * Negative Null zu gewoehnlicher Null.
 *
 * Intl formatiert -0 als "-0". Aus einer Differenz, die genau aufgeht, wird
 * so ein "-0 m2" - das sieht nach einem Rechenfehler aus, wo keiner ist.
 */
const ohneMinusNull = (value: number): number => value + 0

/** Fuer Mengen mit Nachkommastellen, z. B. Flaechen. */
export const fmt = (value: number): string => decimal.format(ohneMinusNull(value))

/** Fuer Stueckzahlen und Paletten. */
export const fmtInt = (value: number): string =>
  exact.format(ohneMinusNull(Math.round(value)))

/** Laengen in m mit zwei Nachkommastellen, z. B. "2,75 m". */
export const fmtM = (value: number): string =>
  `${nf(2, 2).format(ohneMinusNull(value))} m`

/**
 * Liest eine Zahl aus einer Eingabe. Akzeptiert Komma und Punkt.
 * Gibt null zurueck, wenn nichts Sinnvolles dasteht - dann bleibt der alte
 * Wert stehen, statt dass stillschweigend 0 gerechnet wird.
 */
export function parseNumber(input: string): number | null {
  const cleaned = input.trim().replace(/\s/g, '').replace(',', '.')
  if (cleaned === '') return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

/** Wandelt eine Zahl in den Text, der im Eingabefeld stehen soll. */
export const toInput = (value: number): string =>
  Number.isInteger(value) ? String(value) : String(value).replace('.', ',')
