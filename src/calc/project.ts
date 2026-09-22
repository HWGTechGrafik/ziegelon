/**
 * Zusammenfuehrung ueber alle Wandabschnitte eines Projekts und Abgleich
 * gegen bereits Bestelltes und Restbestand - das, was in der Excel das
 * Blatt "Bestellung" war.
 *
 * Der Unterschied zur Excel: der Ueberlegerbedarf entsteht hier automatisch
 * aus den Oeffnungen. In der Excel wurde er von Hand eingetippt.
 */
import type { BrickType, OrderEntry, Project, StockEntry } from '../domain/types'
import { calcSection, type SectionResult } from './section'
import { ceilUnits, roundTo } from './round'

export type DemandTarget = OrderEntry['target']

export interface DemandRow {
  target: DemandTarget
  label: string
  /** Paletten bei brick/jamb/corner, Stueck bei lintel - immer aufgerundet. */
  required: number
  unit: 'Paletten' | 'Stück'
  ordered: number
  inStock: number
  /** required - ordered - inStock, nie negativ dargestellt. */
  open: number
}

export interface ProjectResult {
  sections: SectionResult[]
  demand: DemandRow[]
  warnings: string[]
}

/** Stabiler Schluessel, damit Bedarf, Bestellungen und Restbestand zusammenfinden. */
export function targetKey(t: DemandTarget): string {
  return t.type === 'lintel' ? `lintel:${t.lengthM}` : `${t.type}:${t.brickTypeId}`
}

function sumBy(entries: Array<OrderEntry | StockEntry>, key: string): number {
  return entries
    .filter((e) => !e.deletedAt && targetKey(e.target) === key)
    .reduce((sum, e) => sum + e.quantity, 0)
}

export function calcProject(project: Project, brickTypes: BrickType[]): ProjectResult {
  const byId = new Map(brickTypes.map((b) => [b.id, b]))
  const warnings: string[] = []
  const sections: SectionResult[] = []

  for (const section of project.sections) {
    if (section.deletedAt) continue
    const brick = byId.get(section.brickTypeId)
    if (!brick) {
      warnings.push(
        `Wandabschnitt "${section.label ?? section.id}" verweist auf einen ` +
          'Ziegeltyp, den es im Katalog nicht mehr gibt.',
      )
      continue
    }
    const result = calcSection(section, brick)
    warnings.push(...result.warnings)
    sections.push(result)
  }

  // Paletten je Ziegeltyp aufsummieren. Bewusst die bereits aufgerundeten
  // Palettenzahlen je Abschnitt - zwei Abschnitte derselben Staerke werden
  // getrennt angeliefert.
  const palletTotals = new Map<string, number>()
  const add = (key: string, value: number) =>
    palletTotals.set(key, (palletTotals.get(key) ?? 0) + value)

  for (const s of sections) {
    add(`brick:${s.brickTypeId}`, s.brickPallets)
    add(`jamb:${s.brickTypeId}`, s.jambPallets)
    add(`corner:${s.brickTypeId}`, s.cornerPallets)
  }

  // Ueberleger: ungerundete Stueckzahlen ueber alle Abschnitte sammeln und
  // erst jetzt aufrunden - genau so, wie es in der Excel gemacht wurde.
  const lintelTotals = new Map<number, number>()
  for (const s of sections) {
    for (const l of s.lintels) {
      lintelTotals.set(l.lengthM, (lintelTotals.get(l.lengthM) ?? 0) + l.pieces)
    }
  }

  const rows: DemandRow[] = []
  const nameOf = (id: string) => byId.get(id)?.name ?? id

  const pushRow = (
    target: DemandTarget,
    label: string,
    required: number,
    unit: DemandRow['unit'],
  ) => {
    const key = targetKey(target)
    const ordered = sumBy(project.orders, key)
    const inStock = sumBy(project.stock, key)
    rows.push({
      target,
      label,
      required,
      unit,
      ordered,
      inStock,
      open: Math.max(0, roundTo(required - ordered - inStock, 2)),
    })
  }

  // Ohne Bedarf faellt eine Zeile weg - ausser es ist schon etwas gebucht.
  // Sonst verschwaende bestellte Laibung aus der Liste, sobald man sie abwaehlt.
  const hasBookings = (key: string) =>
    sumBy(project.orders, key) !== 0 || sumBy(project.stock, key) !== 0

  for (const [key, value] of palletTotals) {
    if (value === 0 && !hasBookings(key)) continue
    const [type, brickTypeId] = key.split(':') as ['brick' | 'jamb' | 'corner', string]
    const suffix =
      type === 'brick' ? '' : type === 'jamb' ? ' – Laibung' : ' – Ecksteine'
    pushRow({ type, brickTypeId }, `${nameOf(brickTypeId)}${suffix}`, value, 'Paletten')
  }

  for (const [lengthM, pieces] of [...lintelTotals.entries()].sort((a, b) => a[0] - b[0])) {
    const required = ceilUnits(pieces)
    if (required === 0) continue
    pushRow(
      { type: 'lintel', lengthM },
      `Überleger ${Math.round(lengthM * 100)} cm`,
      required,
      'Stück',
    )
  }

  return { sections, demand: rows, warnings }
}
