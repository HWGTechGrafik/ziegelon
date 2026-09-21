// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { matchesBrick, readOldWorkbook } from './excel-import'
import { readWorkbook } from './xlsx-reader'
import { buildXlsx, calcSheetCells } from './xlsx-fixture'
import type { BrickType } from '../domain/types'

/** Eine Mappe im Zuschnitt der alten Vorlage. */
const vorlage = () =>
  buildXlsx({
    '36,5 cm': calcSheetCells({
      storeyHeightM: 3,
      wallThicknessCm: 36.5,
      bricksPerSqm: 16,
      bricksPerPallet: 48,
      outerCorners: 4,
      wallLengths: [10, 8, 10, 8],
      windows: [
        [1.5, 1.5, 3],
        [1, 1.25, 2],
      ],
      doors: [[1, 2, 1]],
    }),
    '25 cm': calcSheetCells({
      storeyHeightM: 2.5,
      wallThicknessCm: 25,
      bricksPerSqm: 10.7,
      bricksPerPallet: 30,
      outerCorners: 1,
      wallLengths: [6, 4],
    }),
    Bestellung: { A1: 'Paletten Bedarf', A3: 12 },
  })

describe('readWorkbook', () => {
  it('liest Blattnamen und Zellwerte', () => {
    const wb = readWorkbook(vorlage())
    expect(wb.sheetNames).toEqual(['36,5 cm', '25 cm', 'Bestellung'])

    const sheet = wb.sheet('36,5 cm')
    expect(sheet?.number('O6')).toBe(36.5)
    expect(sheet?.number('A3')).toBe(10)
    expect(wb.sheet('Bestellung')?.text('A1')).toBe('Paletten Bedarf')
  })

  it('liefert null für leere Zellen statt 0', () => {
    const sheet = readWorkbook(vorlage()).sheet('25 cm')
    // Nur zwei Wandlaengen erfasst - die dritte Zeile ist leer.
    expect(sheet?.number('A5')).toBeNull()
    expect(sheet?.cell('Z99')).toBeNull()
  })

  it('kennt ein unbekanntes Blatt nicht', () => {
    expect(readWorkbook(vorlage()).sheet('gibt es nicht')).toBeNull()
  })

  it('weist etwas zurück, das keine Arbeitsmappe ist', () => {
    expect(() => readWorkbook(new TextEncoder().encode('kein zip'))).toThrow(
      /keine Excel-Arbeitsmappe/,
    )
  })
})

describe('readOldWorkbook', () => {
  const result = readOldWorkbook(vorlage(), 'Ziegelrechner neu.xlsx')

  it('nimmt den Dateinamen als Bezeichnung', () => {
    expect(result.projectName).toBe('Ziegelrechner neu')
  })

  it('erkennt die Rechenblätter und lässt "Bestellung" liegen', () => {
    expect(result.sections.map((s) => s.sheetName)).toEqual(['36,5 cm', '25 cm'])
    expect(result.skippedSheets).toEqual(['Bestellung'])
  })

  it('übernimmt Kennwerte, Wandlängen und Öffnungen', () => {
    const section = result.sections[0]!
    expect(section.storeyHeightM).toBe(3)
    expect(section.outerCorners).toBe(4)
    expect(section.brick).toMatchObject({
      wallThicknessCm: 36.5,
      bricksPerSqm: 16,
      bricksPerPallet: 48,
      jambBricksPerPallet: 54,
      cornerBricksPerPallet: 21,
      lintelWidthCm: 12,
    })
    expect(section.wallRuns).toEqual([
      { lengthM: 10, count: 1 },
      { lengthM: 8, count: 1 },
      { lengthM: 10, count: 1 },
      { lengthM: 8, count: 1 },
    ])
    expect(section.openings).toEqual([
      { kind: 'window', widthM: 1.5, heightM: 1.5, count: 3 },
      { kind: 'door', widthM: 1, heightM: 2, count: 1 },
      { kind: 'window', widthM: 1, heightM: 1.25, count: 2 },
    ])
  })

  it('übernimmt 0 Außenecken als gültigen Wert', () => {
    const data = buildXlsx({
      Wand: calcSheetCells({
        storeyHeightM: 3, wallThicknessCm: 36.5, bricksPerSqm: 16,
        bricksPerPallet: 48, outerCorners: 0, wallLengths: [5],
      }),
    })
    expect(readOldWorkbook(data, 'x.xlsx').sections[0]!.outerCorners).toBe(0)
  })

  it('weist auf die Überlegerbreite hin, die in der Excel nur in Formeln stand', () => {
    expect(result.warnings.join(' ')).toContain('Überlegerbreite')
  })

  it('setzt eine fehlende Geschoßhöhe und meldet das', () => {
    const cells = calcSheetCells({
      storeyHeightM: 3, wallThicknessCm: 25, bricksPerSqm: 10.7,
      bricksPerPallet: 30, outerCorners: 1, wallLengths: [5],
    })
    delete cells['O3']
    const out = readOldWorkbook(buildXlsx({ Wand: cells }), 'x.xlsx')

    expect(out.sections[0]!.storeyHeightM).toBe(2.75)
    expect(out.warnings.join(' ')).toContain('keine Geschoßhöhe')
  })

  it('übernimmt Maße ohne Stückzahl als 1 Stück und meldet das', () => {
    const cells = calcSheetCells({
      storeyHeightM: 3, wallThicknessCm: 25, bricksPerSqm: 10.7,
      bricksPerPallet: 30, outerCorners: 1, wallLengths: [5],
      windows: [[1.2, 1.4, 2]],
    })
    delete cells['D3']
    const out = readOldWorkbook(buildXlsx({ Wand: cells }), 'x.xlsx')

    expect(out.sections[0]!.openings[0]).toEqual({
      kind: 'window', widthM: 1.2, heightM: 1.4, count: 1,
    })
    expect(out.warnings.join(' ')).toContain('ohne Stückzahl')
  })

  it('meldet, wenn nur Kennwerte und keine Eingaben dastehen', () => {
    const data = buildXlsx({
      Wand: calcSheetCells({
        storeyHeightM: 3, wallThicknessCm: 25, bricksPerSqm: 10.7,
        bricksPerPallet: 30, outerCorners: 1,
      }),
    })
    expect(readOldWorkbook(data, 'x.xlsx').warnings.join(' ')).toContain(
      'keine Wandlängen',
    )
  })

  it('verweigert eine Mappe ohne Rechenblatt', () => {
    const data = buildXlsx({ Irgendwas: { A1: 'Hallo', B2: 5 } })
    expect(() => readOldWorkbook(data, 'x.xlsx')).toThrow(/kein Rechenblatt/)
  })
})

describe('matchesBrick', () => {
  const brick: BrickType = {
    id: 'b1', updatedAt: '', name: 'Ziegel 36,5 cm',
    wallThicknessCm: 36.5, bricksPerSqm: 16, bricksPerPallet: 48,
    jambBricksPerPallet: 54, cornerBricksPerPallet: 21, lintelWidthCm: 12,
  }

  it('erkennt einen vorhandenen Ziegeltyp wieder', () => {
    const seed = readOldWorkbook(vorlage(), 'x.xlsx').sections[0]!.brick
    expect(matchesBrick(brick, seed)).toBe(true)
  })

  it('unterscheidet Typen mit gleicher Stärke, aber anderen Kennwerten', () => {
    const seed = readOldWorkbook(vorlage(), 'x.xlsx').sections[0]!.brick
    expect(matchesBrick({ ...brick, bricksPerSqm: 10.7 }, seed)).toBe(false)
  })
})
