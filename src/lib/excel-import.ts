/**
 * Uebernahme eines Bauvorhabens aus der alten Ziegelrechner-Excel.
 *
 * Der Aufbau jener Mappe ist fest: je Wandstaerke ein Blatt, darin die
 * Eingaben in den Zeilen 3 bis 26 und die Kennwerte in Spalte O. Genau das
 * wird hier abgegriffen - alles andere, auch das Blatt "Bestellung", bleibt
 * unberuehrt. Bestellungen werden bewusst nicht uebernommen: sie standen
 * dort als blosse Zahlen ohne Datum und Zuordnung, und geraten uebernommen
 * waeren sie schlimmer als gar keine.
 *
 * Erkannt wird ein Rechenblatt daran, dass O6 (Wandstaerke) und O9 (Ziegel
 * je m2) Zahlen enthalten. Das ist unabhaengig vom Blattnamen - die Namen
 * der Vorlage stimmten mit ihrem Inhalt ohnehin nicht ueberein.
 */
import type { BrickType, OpeningKind } from '../domain/types'
import { readWorkbook, type Sheet } from './xlsx-reader'

/** Erste und letzte Eingabezeile der Vorlage. */
const FIRST_ROW = 3
const LAST_ROW = 26

/** Kennwerte in Spalte O. */
const CELL = {
  storeyHeight: 'O3',
  wallThickness: 'O6',
  bricksPerSqm: 'O9',
  bricksPerPallet: 'O12',
  outerCorners: 'O15',
  jambBricksPerPallet: 'O18',
  cornerBricksPerPallet: 'O21',
} as const

/**
 * Die Vorlage hatte die Ueberlegerbreite in den Formeln stehen, nicht als
 * Kennwert - mal 12, mal 12,5. Uebernommen wird deshalb 12; im Katalog laesst
 * sich das je Ziegeltyp nachziehen.
 */
const FALLBACK_LINTEL_WIDTH_CM = 12

export type BrickSeed = Omit<BrickType, 'id' | 'updatedAt'>

export interface ImportedOpening {
  kind: OpeningKind
  widthM: number
  heightM: number
  count: number
}

export interface ImportedSection {
  sheetName: string
  brick: BrickSeed
  storeyHeightM: number
  outerCorners: number
  wallRuns: Array<{ lengthM: number; count: number }>
  openings: ImportedOpening[]
}

export interface ImportResult {
  projectName: string
  sections: ImportedSection[]
  /** Blaetter, die nicht wie ein Rechenblatt aussahen. */
  skippedSheets: string[]
  warnings: string[]
}

/** Dateiname ohne Endung als Vorschlag fuer die Bezeichnung. */
function nameFromFile(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '').trim()
  return base === '' ? 'Aus Excel übernommen' : base
}

/** Zahl nur uebernehmen, wenn sie sinnvoll ist - 0 oder negativ heisst "leer". */
function positive(value: number | null): number | null {
  return value !== null && value > 0 ? value : null
}

function readSection(sheet: Sheet, warnings: string[]): ImportedSection | null {
  const wallThicknessCm = positive(sheet.number(CELL.wallThickness))
  const bricksPerSqm = positive(sheet.number(CELL.bricksPerSqm))
  if (wallThicknessCm === null || bricksPerSqm === null) return null

  const storeyHeightM = positive(sheet.number(CELL.storeyHeight))
  if (storeyHeightM === null) {
    warnings.push(
      `Blatt „${sheet.name}": keine Geschoßhöhe gefunden, 2,75 m eingesetzt.`,
    )
  }

  const wallRuns: Array<{ lengthM: number; count: number }> = []
  const openings: ImportedOpening[] = []

  for (let row = FIRST_ROW; row <= LAST_ROW; row++) {
    const lengthM = positive(sheet.number(`A${row}`))
    if (lengthM !== null) wallRuns.push({ lengthM, count: 1 })

    const add = (kind: OpeningKind, w: string, h: string, n: string) => {
      const widthM = positive(sheet.number(`${w}${row}`))
      const heightM = positive(sheet.number(`${h}${row}`))
      const count = positive(sheet.number(`${n}${row}`))
      if (widthM === null || heightM === null) return
      if (count === null) {
        warnings.push(
          `Blatt „${sheet.name}", Zeile ${row}: Maße ohne Stückzahl – als 1 Stück übernommen.`,
        )
      }
      openings.push({ kind, widthM, heightM, count: count ?? 1 })
    }

    add('window', 'B', 'C', 'D')
    add('door', 'I', 'J', 'K')
  }

  const brick: BrickSeed = {
    name: `Ziegel ${wallThicknessCm.toLocaleString('de-AT')} cm`,
    wallThicknessCm,
    bricksPerSqm,
    bricksPerPallet: positive(sheet.number(CELL.bricksPerPallet)) ?? 30,
    jambBricksPerPallet: positive(sheet.number(CELL.jambBricksPerPallet)) ?? 54,
    cornerBricksPerPallet: positive(sheet.number(CELL.cornerBricksPerPallet)) ?? 21,
    lintelWidthCm: FALLBACK_LINTEL_WIDTH_CM,
  }

  return {
    sheetName: sheet.name,
    brick,
    storeyHeightM: storeyHeightM ?? 2.75,
    // 0 Aussenecken ist ein gueltiger Wert, deshalb hier kein positive().
    outerCorners: sheet.number(CELL.outerCorners) ?? 0,
    wallRuns,
    openings,
  }
}

export function readOldWorkbook(
  data: ArrayBuffer | Uint8Array,
  fileName: string,
): ImportResult {
  const workbook = readWorkbook(data)
  const warnings: string[] = []
  const sections: ImportedSection[] = []
  const skippedSheets: string[] = []

  for (const name of workbook.sheetNames) {
    const sheet = workbook.sheet(name)
    if (!sheet) {
      skippedSheets.push(name)
      continue
    }
    const section = readSection(sheet, warnings)
    if (section) sections.push(section)
    else skippedSheets.push(name)
  }

  if (sections.length === 0) {
    throw new Error(
      'In dieser Datei wurde kein Rechenblatt gefunden. Erwartet wird die ' +
        'Ziegelrechner-Vorlage mit der Wandstärke in Zelle O6.',
    )
  }

  const hasInput = sections.some((s) => s.wallRuns.length > 0 || s.openings.length > 0)
  if (!hasInput) {
    warnings.push(
      'Die Blätter enthalten Kennwerte, aber keine Wandlängen und keine Öffnungen. ' +
        'Übernommen werden nur die Ziegeltypen.',
    )
  }

  warnings.push(
    'Die Überlegerbreite stand in der Excel in den Formeln, nicht als Kennwert. ' +
      `Übernommen wurden ${FALLBACK_LINTEL_WIDTH_CM} cm – bitte im Katalog prüfen.`,
  )

  return {
    projectName: nameFromFile(fileName),
    sections,
    skippedSheets,
    warnings,
  }
}

/** Passt ein Katalogeintrag zu dem, was im Blatt stand? */
export function matchesBrick(brick: BrickType, seed: BrickSeed): boolean {
  return (
    brick.wallThicknessCm === seed.wallThicknessCm &&
    brick.bricksPerSqm === seed.bricksPerSqm &&
    brick.bricksPerPallet === seed.bricksPerPallet
  )
}
