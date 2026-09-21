// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import type { BrickType } from '../domain/types'
import { buildXlsx } from './xlsx-fixture'
import { readCatalog, writeCatalog, type CatalogImportRow } from './catalog-excel'

const brick = (over: Partial<BrickType> = {}): BrickType => ({
  id: 'a',
  updatedAt: '2026-09-01T00:00:00.000Z',
  name: 'Ziegel 36,5 cm',
  wallThicknessCm: 36.5,
  bricksPerSqm: 16,
  bricksPerPallet: 48,
  jambBricksPerPallet: 54,
  cornerBricksPerPallet: 21,
  lintelWidthCm: 12,
  ...over,
})

/** Zaehlt bei jedem Aufruf hoch, damit der Test die neuen Kennungen kennt. */
function zaehler(): () => string {
  let n = 0
  return () => `neu-${++n}`
}

const KOPF = {
  A1: 'Bezeichnung',
  B1: 'Wandstärke (cm)',
  C1: 'Ziegel je m²',
  D1: 'Ziegel je Palette',
  E1: 'Laibungsziegel je Palette',
  F1: 'Ecksteine je Palette',
  G1: 'Überlegerbreite (cm)',
  H1: 'Kennung (nicht ändern)',
}

const zeile = (r: number, werte: Record<string, number | string>) =>
  Object.fromEntries(Object.entries(werte).map(([sp, wert]) => [`${sp}${r}`, wert]))

const finde = (rows: CatalogImportRow[], name: string) =>
  rows.find((row) => row.brick.name === name)

describe('Katalog als Excel', () => {
  it('kommt unveraendert wieder herein, wie er hinausgegangen ist', () => {
    const katalog = [brick(), brick({ id: 'b', name: 'Ziegel 25 cm', wallThicknessCm: 25 })]
    const datei = writeCatalog(katalog)

    const ergebnis = readCatalog(datei, katalog, zaehler())

    expect(ergebnis.warnings).toEqual([])
    expect(ergebnis.rows).toHaveLength(2)
    expect(ergebnis.rows.every((row) => row.status === 'unveraendert')).toBe(true)
    expect(ergebnis.rows.map((row) => row.brick.id)).toEqual(['a', 'b'])
    // Alle Kennwerte kommen unversehrt zurueck, nicht nur die Bezeichnung.
    const { updatedAt: _weg, ...ohneZeitstempel } = katalog[0] as BrickType
    expect(ergebnis.rows[0]?.brick).toEqual(ohneZeitstempel)
  })

  it('erkennt eine geaenderte Zahl als Aenderung', () => {
    const katalog = [brick()]
    const datei = buildXlsx({
      Ziegeltypen: {
        ...KOPF,
        ...zeile(2, {
          A: 'Ziegel 36,5 cm', B: 36.5, C: 16, D: 50, E: 54, F: 21, G: 12, H: 'a',
        }),
      },
    })

    const { rows, warnings } = readCatalog(datei, katalog, zaehler())

    expect(warnings).toEqual([])
    expect(rows[0]?.status).toBe('geaendert')
    expect(rows[0]?.brick.bricksPerPallet).toBe(50)
    expect(rows[0]?.brick.id).toBe('a')
  })

  it('haelt eine Umbenennung ueber die Kennung zusammen', () => {
    const katalog = [brick()]
    const datei = buildXlsx({
      Ziegeltypen: {
        ...KOPF,
        ...zeile(2, {
          A: 'Poroton 36,5', B: 36.5, C: 16, D: 48, E: 54, F: 21, G: 12, H: 'a',
        }),
      },
    })

    const { rows } = readCatalog(datei, katalog, zaehler())

    expect(rows[0]?.brick.id).toBe('a')
    expect(rows[0]?.status).toBe('geaendert')
    expect(rows[0]?.renamedFrom).toBe('Ziegel 36,5 cm')
  })

  it('ordnet ohne Kennung ueber die Bezeichnung zu', () => {
    const katalog = [brick()]
    const datei = buildXlsx({
      Ziegeltypen: {
        A1: 'Bezeichnung', B1: 'Wandstärke (cm)', C1: 'Ziegel je m²',
        D1: 'Ziegel je Palette', E1: 'Laibungsziegel je Palette',
        F1: 'Ecksteine je Palette', G1: 'Überlegerbreite (cm)',
        ...zeile(2, { A: '  ziegel 36,5 CM  ', B: 36.5, C: 16, D: 48, E: 54, F: 21, G: 12 }),
      },
    })

    const { rows } = readCatalog(datei, katalog, zaehler())

    expect(rows[0]?.brick.id).toBe('a')
    expect(rows[0]?.status).toBe('geaendert')
    expect(rows[0]?.brick.name).toBe('ziegel 36,5 CM')
  })

  it('legt eine unbekannte Zeile als neuen Typ an', () => {
    const datei = buildXlsx({
      Ziegeltypen: {
        ...KOPF,
        ...zeile(2, { A: 'Ziegel 50 cm', B: 50, C: 8, D: 24, E: 40, F: 16, G: 12.5 }),
      },
    })

    const { rows, warnings } = readCatalog(datei, [], zaehler())

    expect(warnings).toEqual([])
    expect(rows[0]?.status).toBe('neu')
    expect(rows[0]?.brick.id).toBe('neu-1')
    expect(rows[0]?.brick.lintelWidthCm).toBe(12.5)
  })

  it('liest eine als Text formatierte Zahl mit Komma', () => {
    const datei = buildXlsx({
      Ziegeltypen: {
        ...KOPF,
        ...zeile(2, { A: 'Ziegel 30 cm', B: '30', C: '10,7', D: '30', E: '54', F: '21', G: '12' }),
      },
    })

    const { rows } = readCatalog(datei, [], zaehler())

    expect(rows[0]?.brick.bricksPerSqm).toBe(10.7)
    expect(rows[0]?.brick.wallThicknessCm).toBe(30)
  })

  it('legt keinen neuen Typ mit fehlendem Kennwert an', () => {
    const datei = buildXlsx({
      Ziegeltypen: {
        ...KOPF,
        ...zeile(2, { A: 'Halb ausgefuellt', B: 30, C: 10.7, D: 30, E: 54, F: 21 }),
      },
    })

    const { rows, warnings } = readCatalog(datei, [], zaehler())

    expect(rows).toEqual([])
    expect(warnings[0]).toContain('Überlegerbreite')
    expect(warnings[0]).toContain('übersprungen')
  })

  it('laesst einem bestehenden Typ seinen Wert, wenn die Zelle leer ist', () => {
    const katalog = [brick()]
    const datei = buildXlsx({
      Ziegeltypen: {
        ...KOPF,
        ...zeile(2, { A: 'Ziegel 36,5 cm', B: 36.5, C: 16, D: 48, E: 54, F: 21, H: 'a' }),
      },
    })

    const { rows, warnings } = readCatalog(datei, katalog, zaehler())

    expect(warnings).toEqual([])
    expect(rows[0]?.brick.lintelWidthCm).toBe(12)
    expect(rows[0]?.status).toBe('unveraendert')
  })

  it('weist eine Null oder eine negative Zahl zurueck', () => {
    const datei = buildXlsx({
      Ziegeltypen: {
        ...KOPF,
        ...zeile(2, { A: 'Unsinn', B: 0, C: 10.7, D: 30, E: 54, F: 21, G: 12 }),
        ...zeile(3, { A: 'Auch Unsinn', B: 30, C: 10.7, D: 30, E: 54, F: 21, G: -5 }),
      },
    })

    const { rows, warnings } = readCatalog(datei, [], zaehler())

    expect(rows).toEqual([])
    expect(warnings).toHaveLength(2)
    expect(warnings[0]).toContain('Wandstärke')
    expect(warnings[1]).toContain('Überlegerbreite')
  })

  it('loescht nichts, was in der Datei fehlt', () => {
    const katalog = [brick(), brick({ id: 'b', name: 'Ziegel 25 cm' })]
    const datei = buildXlsx({
      Ziegeltypen: {
        ...KOPF,
        ...zeile(2, { A: 'Ziegel 25 cm', B: 25, C: 12, D: 40, E: 54, F: 21, G: 12, H: 'b' }),
      },
    })

    const { rows } = readCatalog(datei, katalog, zaehler())

    expect(rows).toHaveLength(1)
    expect(finde(rows, 'Ziegel 36,5 cm')).toBeUndefined()
  })

  it('kommt mit vertauschten und zusaetzlichen Spalten zurecht', () => {
    const datei = buildXlsx({
      Ziegeltypen: {
        A1: 'Lieferant', B1: 'Ziegel je m²', C1: 'Bezeichnung', D1: 'Wandstärke in cm',
        E1: 'Ziegel je Palette', F1: 'Laibungsziegel je Palette',
        G1: 'Ecksteine je Palette', H1: 'Überlegerbreite',
        ...zeile(2, { A: 'Wienerberger', B: 16, C: 'Ziegel 36,5 cm', D: 36.5, E: 48, F: 54, G: 21, H: 12 }),
      },
    })

    const { rows, warnings } = readCatalog(datei, [], zaehler())

    expect(warnings).toEqual([])
    expect(rows[0]?.brick.bricksPerSqm).toBe(16)
    expect(rows[0]?.brick.wallThicknessCm).toBe(36.5)
  })

  it('ueberspringt Leerzeilen zwischen den Eintraegen', () => {
    const datei = buildXlsx({
      Ziegeltypen: {
        ...KOPF,
        ...zeile(2, { A: 'Ziegel 30 cm', B: 30, C: 10.7, D: 30, E: 54, F: 21, G: 12 }),
        ...zeile(6, { A: 'Ziegel 50 cm', B: 50, C: 8, D: 24, E: 40, F: 16, G: 12.5 }),
      },
    })

    const { rows } = readCatalog(datei, [], zaehler())

    expect(rows.map((row) => row.brick.name)).toEqual(['Ziegel 30 cm', 'Ziegel 50 cm'])
  })

  it('meldet eine Mappe ohne erkennbare Kopfzeile', () => {
    const datei = buildXlsx({ Irgendwas: { A1: 'Hallo', A2: 'Welt' } })

    expect(() => readCatalog(datei, [], zaehler())).toThrow(/Kopfzeile/)
  })

  it('liest auch, wenn das Blatt anders heisst', () => {
    const datei = buildXlsx({
      Tabelle1: {
        ...KOPF,
        ...zeile(2, { A: 'Ziegel 30 cm', B: 30, C: 10.7, D: 30, E: 54, F: 21, G: 12 }),
      },
    })

    expect(readCatalog(datei, [], zaehler()).rows).toHaveLength(1)
  })
})
