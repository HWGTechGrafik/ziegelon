/**
 * Ziegel-Katalog als Excel-Blatt - hinaus und wieder herein.
 *
 * Der Katalog ist das, was ein Betrieb am ehesten ausserhalb der App pflegt:
 * Lieferantenlisten kommen als Tabelle, und ein Dutzend Typen tippt niemand
 * gern zweimal ab. Deshalb dieselbe Mappe in beide Richtungen.
 *
 * **Die Kennung ist der Anker.** Sie steht in der letzten Spalte und wird
 * beim Einlesen bevorzugt: nur damit ueberlebt eine Umbenennung den Weg durch
 * Excel. Ist die Spalte leer - etwa in einer von Hand gebauten Liste -, wird
 * ueber die Bezeichnung zugeordnet und sonst neu angelegt.
 *
 * Es wird nie etwas geloescht. Eine Zeile, die in der Datei fehlt, bedeutet
 * "nicht enthalten", nicht "weg damit"; sonst raeumte ein Teilauszug den
 * halben Katalog ab.
 */
import type { BrickType } from '../domain/types'
import { readWorkbook } from './xlsx-reader'
import { columnName, writeWorkbook, type CellInput } from './xlsx-writer'

export const CATALOG_SHEET = 'Ziegeltypen'

type Zahlenfeld = Exclude<keyof BrickType, 'id' | 'updatedAt' | 'deletedAt' | 'name'>

interface Spalte {
  titel: string
  feld: Zahlenfeld | 'name' | 'id'
  /** Kleinster zulaessiger Wert. Alles darunter ist ein Tippfehler. */
  min: number
}

const SPALTEN: Spalte[] = [
  { titel: 'Bezeichnung', feld: 'name', min: 0 },
  { titel: 'Wandstärke (cm)', feld: 'wallThicknessCm', min: 0.1 },
  { titel: 'Ziegel je m²', feld: 'bricksPerSqm', min: 0.1 },
  { titel: 'Ziegel je Palette', feld: 'bricksPerPallet', min: 1 },
  { titel: 'Laibungsziegel je Palette', feld: 'jambBricksPerPallet', min: 1 },
  { titel: 'Ecksteine je Palette', feld: 'cornerBricksPerPallet', min: 1 },
  { titel: 'Überlegerbreite (cm)', feld: 'lintelWidthCm', min: 0.1 },
  { titel: 'Kennung (nicht ändern)', feld: 'id', min: 0 },
]

/** Kopfzeilen vergleichen sich ohne Klammerzusatz, Gross-/Kleinschreibung und Leerraum. */
const normTitel = (text: string): string =>
  text
    .replace(/\(.*?\)/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

export function catalogToRows(bricks: readonly BrickType[]): CellInput[][] {
  const kopf: CellInput[] = SPALTEN.map((s) => s.titel)
  const zeilen = bricks.map((brick) =>
    SPALTEN.map((s): CellInput => {
      if (s.feld === 'name') return brick.name
      if (s.feld === 'id') return brick.id
      return brick[s.feld]
    }),
  )
  return [kopf, ...zeilen]
}

export function writeCatalog(bricks: readonly BrickType[]): Uint8Array {
  return writeWorkbook(CATALOG_SHEET, catalogToRows(bricks))
}

export type RowStatus = 'neu' | 'geaendert' | 'unveraendert'

export interface CatalogImportRow {
  /** Fertiger Datensatz, bereit zum Speichern - updatedAt setzt das Repo. */
  brick: Omit<BrickType, 'updatedAt'>
  status: RowStatus
  /** Alter Name, falls die Zeile einen bestehenden Typ umbenennt. */
  renamedFrom?: string
}

export interface CatalogImportResult {
  rows: CatalogImportRow[]
  warnings: string[]
}

/**
 * Liest eine Zahl aus einer Zelle - auch aus Text.
 *
 * Wer eine Spalte in Excel als Text formatiert hat, bekommt "36,5" geliefert.
 * Das als leer zu behandeln waere die schlechtere Antwort, die Zahl steht ja
 * da.
 */
function zahl(value: string | number | null): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null
  const text = value.trim().replace(/\s/g, '').replace(',', '.')
  if (text === '') return null
  const num = Number(text)
  return Number.isFinite(num) ? num : null
}

const gleich = (a: Omit<BrickType, 'updatedAt'>, b: BrickType): boolean =>
  a.name === b.name &&
  SPALTEN.every((s) =>
    s.feld === 'id' || s.feld === 'name' ? true : a[s.feld] === b[s.feld],
  )

/**
 * Liest den Katalog aus einer Mappe und stellt ihn dem vorhandenen Bestand
 * gegenueber. Gespeichert wird hier nichts - das entscheidet die Oberflaeche,
 * nachdem sie gezeigt hat, was passieren wuerde.
 *
 * `newId` kommt von aussen, damit der Test die Zuordnung pruefen kann, ohne
 * gegen zufaellige Kennungen anzutreten.
 */
export function readCatalog(
  data: ArrayBuffer | Uint8Array,
  existing: readonly BrickType[],
  newId: () => string,
): CatalogImportResult {
  const workbook = readWorkbook(data)
  const name = workbook.sheetNames.includes(CATALOG_SHEET)
    ? CATALOG_SHEET
    : workbook.sheetNames[0]
  const sheet = name ? workbook.sheet(name) : null
  if (!sheet) throw new Error('Die Mappe enthält kein Tabellenblatt.')

  // Kopfzeile zuordnen. Reihenfolge und Zusatzspalten sind egal, solange die
  // Titel erkennbar bleiben - eine Liste vom Lieferanten sieht selten aus wie
  // der Auszug der App.
  const kopf: Array<{ spalte: number; norm: string }> = []
  for (let c = 0; c < 64; c++) {
    const titel = sheet.text(`${columnName(c)}1`)
    if (titel) kopf.push({ spalte: c, norm: normTitel(titel) })
  }

  const spalteFuer = new Map<Spalte['feld'], number>()
  const belegt = new Set<number>()
  const zuordnen = (passt: (norm: string, erwartet: string) => boolean) => {
    for (const s of SPALTEN) {
      if (spalteFuer.has(s.feld)) continue
      const erwartet = normTitel(s.titel)
      const treffer = kopf.find((k) => !belegt.has(k.spalte) && passt(k.norm, erwartet))
      if (treffer) {
        spalteFuer.set(s.feld, treffer.spalte)
        belegt.add(treffer.spalte)
      }
    }
  }
  // Erst die genauen Titel binden, dann die angehaengten Einheiten uebersehen:
  // "Wandstaerke in cm" meint dasselbe wie unser "Wandstaerke (cm)". Anders
  // herum koennte eine Zusatzspalte einen genauen Treffer wegschnappen.
  zuordnen((norm, erwartet) => norm === erwartet)
  zuordnen((norm, erwartet) => norm.startsWith(erwartet))

  const nameSpalte = spalteFuer.get('name')
  const fehlend = SPALTEN.filter(
    (s) => s.feld !== 'id' && s.feld !== 'name' && !spalteFuer.has(s.feld),
  )
  if (nameSpalte === undefined || fehlend.length === SPALTEN.length - 2) {
    throw new Error(
      'In der ersten Zeile steht keine erkennbare Kopfzeile. Erwartet werden die ' +
        'Spalten aus dem Auszug der App.',
    )
  }

  const warnings: string[] = []
  for (const s of fehlend) {
    warnings.push(`Spalte "${s.titel}" fehlt - dieser Wert bleibt unverändert.`)
  }

  const vorhandenNachId = new Map(existing.map((b) => [b.id, b]))
  const vorhandenNachName = new Map(existing.map((b) => [b.name.trim().toLowerCase(), b]))

  const rows: CatalogImportRow[] = []
  const gesehen = new Set<string>()
  let leer = 0

  for (let r = 2; r <= 1000 && leer < 20; r++) {
    const bezeichnung = sheet.text(`${columnName(nameSpalte)}${r}`)
    if (!bezeichnung) {
      leer += 1
      continue
    }
    leer = 0

    const idSpalte = spalteFuer.get('id')
    const kennung = idSpalte === undefined ? null : sheet.text(`${columnName(idSpalte)}${r}`)
    const treffer =
      (kennung ? vorhandenNachId.get(kennung) : undefined) ??
      vorhandenNachName.get(bezeichnung.trim().toLowerCase())

    const entwurf: Record<string, unknown> = {
      id: treffer?.id ?? kennung ?? newId(),
      name: bezeichnung.trim(),
    }
    let fehler: string | null = null

    for (const s of SPALTEN) {
      if (s.feld === 'name' || s.feld === 'id') continue
      const spalte = spalteFuer.get(s.feld)
      const wert = spalte === undefined ? null : zahl(sheet.cell(`${columnName(spalte)}${r}`))
      if (wert === null) {
        // Ein bestehender Typ behaelt seinen Wert. Ein neuer ohne Kennwert
        // wuerde still falsch rechnen - lieber gar nicht anlegen.
        if (treffer) {
          entwurf[s.feld] = treffer[s.feld]
        } else {
          fehler = `Zeile ${r} (${bezeichnung}): "${s.titel}" fehlt - neuer Ziegeltyp übersprungen.`
          break
        }
      } else if (wert < s.min) {
        fehler = `Zeile ${r} (${bezeichnung}): "${s.titel}" ist ${wert} - Zeile übersprungen.`
        break
      } else {
        entwurf[s.feld] = wert
      }
    }

    if (fehler) {
      warnings.push(fehler)
      continue
    }

    const brick = entwurf as unknown as Omit<BrickType, 'updatedAt'>
    if (gesehen.has(brick.id)) {
      warnings.push(`Zeile ${r} (${bezeichnung}): Kennung kommt mehrfach vor - übersprungen.`)
      continue
    }
    gesehen.add(brick.id)

    const status: RowStatus = !treffer
      ? 'neu'
      : gleich(brick, treffer)
        ? 'unveraendert'
        : 'geaendert'
    rows.push({
      brick,
      status,
      ...(treffer && treffer.name !== brick.name ? { renamedFrom: treffer.name } : {}),
    })
  }

  if (rows.length === 0 && warnings.length === 0) {
    warnings.push('Das Blatt enthält keine Zeilen mit einer Bezeichnung.')
  }
  return { rows, warnings }
}
