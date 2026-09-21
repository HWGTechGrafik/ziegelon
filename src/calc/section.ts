/**
 * Die Rechenkette eines Tabellenblatts der Excel, als reine Funktion.
 *
 * Bewusst frei von React, Storage und Datumslogik: so laesst sie sich
 * Zeile fuer Zeile gegen die Excel-Formeln gegenpruefen.
 * Jede Formel traegt in Klammern die Zelle des Excel-Blatts, aus der sie
 * stammt - so laesst sich das Ergebnis gegen die Altdatei halten.
 */
import {
  COURSE_HEIGHT_M,
  LINTEL_STEP_M,
  type BrickType,
  type Opening,
  type WallSection,
} from '../domain/types'
import { ceilTo, ceilUnits, roundTo } from './round'

/** Ueberlegerbedarf einer Laenge - Stueck bewusst ungerundet. */
export interface LintelDemand {
  /** Laenge in m, immer ein Vielfaches von 0,25 */
  lengthM: number
  /** Ungerundete Stueckzahl, wie in der Excel. Erst die Summe wird aufgerundet. */
  pieces: number
}

export interface SectionResult {
  sectionId: string
  brickTypeId: string

  /** Summe aller Wandlaengen x Stueck (m) */
  totalWallLengthM: number
  /** Bruttowandflaeche = Laenge x Geschosshoehe (Excel A27) */
  grossAreaSqm: number
  windowAreaSqm: number
  doorAreaSqm: number
  /** Excel A28 */
  netAreaSqm: number

  /** Excel P3 */
  bricks: number
  /** Excel P6, hier aufgerundet */
  brickPallets: number
  /** Ziegel, die auf der letzten Palette uebrig bleiben */
  brickRemainder: number

  /** Excel P12 */
  jambBricks: number
  /** Excel P15, hier aufgerundet */
  jambPallets: number
  jambRemainder: number

  /** Excel P9 */
  cornerBricks: number
  /** Excel P18, hier aufgerundet */
  cornerPallets: number
  cornerRemainder: number

  /** Excel Spalten G/H bzw. M/N, gruppiert nach Laenge */
  lintels: LintelDemand[]

  warnings: string[]
}

/** Laenge des Ueberlegers: lichte Breite + beidseitige Auflage, auf 25 cm aufgerundet. */
export function lintelLengthM(widthM: number, bearingCmPerSide: number): number {
  return ceilTo(widthM + (2 * bearingCmPerSide) / 100, LINTEL_STEP_M)
}

/**
 * Wie viele Ueberleger liegen nebeneinander in der Wand.
 * Ungerundet - die Excel rundet hier ebenfalls nicht, gerundet wird erst
 * die Gesamtsumme je Laenge.
 */
export function lintelPiecesPerOpening(
  wallThicknessCm: number,
  lintelWidthCm: number,
): number {
  if (lintelWidthCm <= 0) {
    throw new Error(`lintelWidthCm muss > 0 sein, war ${lintelWidthCm}`)
  }
  return wallThicknessCm / lintelWidthCm
}

/** Laibungsziegel einer Oeffnung (Excel Spalte F). */
export function jambBricksForOpening(opening: Opening): number {
  return (ceilTo(opening.heightM, COURSE_HEIGHT_M) * 2) / COURSE_HEIGHT_M * opening.count
}

export function calcSection(section: WallSection, brick: BrickType): SectionResult {
  const warnings: string[] = []

  const totalWallLengthM = section.wallRuns.reduce(
    (sum, run) => sum + run.lengthM * run.count,
    0,
  )
  const grossAreaSqm = totalWallLengthM * section.storeyHeightM

  const areaOf = (kind: Opening['kind']) =>
    section.openings
      .filter((o) => o.kind === kind)
      .reduce((sum, o) => sum + o.widthM * o.heightM * o.count, 0)

  const windowAreaSqm = areaOf('window')
  const doorAreaSqm = areaOf('door')
  const netAreaSqm = grossAreaSqm - windowAreaSqm - doorAreaSqm

  if (netAreaSqm < 0) {
    warnings.push(
      'Die Öffnungen sind zusammen größer als die Wandfläche – bitte Eingaben prüfen.',
    )
  }
  for (const o of section.openings) {
    if (o.heightM > section.storeyHeightM) {
      warnings.push(
        `${o.label ?? (o.kind === 'door' ? 'Tür' : 'Fenster')}: Höhe ${o.heightM} m ` +
          `ist größer als die Geschoßhöhe ${section.storeyHeightM} m.`,
      )
    }
  }

  const bricks = Math.max(0, netAreaSqm) * brick.bricksPerSqm

  // Tuerlaibungen sind je Abschnitt abwaehlbar - die alte Excel kannte sie gar nicht.
  const jambSource = section.countDoorJambs
    ? section.openings
    : section.openings.filter((o) => o.kind === 'window')
  const jambBricks = jambSource.reduce((sum, o) => sum + jambBricksForOpening(o), 0)

  const cornerBricks = (section.storeyHeightM * section.outerCorners) / COURSE_HEIGHT_M

  const pallets = (units: number, perPallet: number) => {
    if (perPallet <= 0) return { pallets: 0, remainder: 0 }
    const whole = ceilUnits(units / perPallet)
    const remainder = whole === 0 ? 0 : roundTo(whole * perPallet - units, 2)
    return { pallets: whole, remainder }
  }

  const brickPal = pallets(bricks, brick.bricksPerPallet)
  const jambPal = pallets(jambBricks, brick.jambBricksPerPallet)
  const cornerPal = pallets(cornerBricks, brick.cornerBricksPerPallet)

  const perOpening = lintelPiecesPerOpening(brick.wallThicknessCm, brick.lintelWidthCm)
  const byLength = new Map<number, number>()
  for (const o of section.openings) {
    const len = lintelLengthM(o.widthM, section.bearingCmPerSide)
    byLength.set(len, (byLength.get(len) ?? 0) + perOpening * o.count)
  }

  return {
    sectionId: section.id,
    brickTypeId: brick.id,
    totalWallLengthM: roundTo(totalWallLengthM, 4),
    grossAreaSqm: roundTo(grossAreaSqm, 4),
    windowAreaSqm: roundTo(windowAreaSqm, 4),
    doorAreaSqm: roundTo(doorAreaSqm, 4),
    netAreaSqm: roundTo(netAreaSqm, 4),
    bricks: roundTo(bricks, 4),
    brickPallets: brickPal.pallets,
    brickRemainder: brickPal.remainder,
    jambBricks: roundTo(jambBricks, 4),
    jambPallets: jambPal.pallets,
    jambRemainder: jambPal.remainder,
    cornerBricks: roundTo(cornerBricks, 4),
    cornerPallets: cornerPal.pallets,
    cornerRemainder: cornerPal.remainder,
    lintels: [...byLength.entries()]
      .map(([lengthM, pieces]) => ({ lengthM, pieces: roundTo(pieces, 4) }))
      .sort((a, b) => a.lengthM - b.lengthM),
    warnings,
  }
}
