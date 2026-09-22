import { describe, expect, it } from 'vitest'
import { calcSection, jambBricksForOpening, lintelLengthM, lintelPiecesPerOpening } from './section'
import { brick365, section365 } from './fixtures'
import type { Opening } from '../domain/types'

describe('lintelLengthM - Excel Spalte G/M', () => {
  it('bildet die Excel-Formel AUFRUNDEN(b+0,30; 0,25) ab', () => {
    // 1,50 + 0,30 = 1,80 -> naechster 25-cm-Schritt = 2,00
    expect(lintelLengthM(1.5, 15)).toBe(2)
    // 1,00 + 0,30 = 1,30 -> 1,50
    expect(lintelLengthM(1.0, 15)).toBe(1.5)
    // exakt auf dem Raster bleibt stehen
    expect(lintelLengthM(1.2, 15)).toBe(1.5)
  })

  it('beruecksichtigt eine abweichende Auflage', () => {
    // 1,50 + 2x0,12 = 1,74 -> 1,75
    expect(lintelLengthM(1.5, 12)).toBe(1.75)
    // 1,50 + 2x0,25 = 2,00 -> 2,00
    expect(lintelLengthM(1.5, 25)).toBe(2)
  })
})

describe('lintelPiecesPerOpening - Excel Spalte H/N', () => {
  it('teilt die Wandstaerke durch die Ueberlegerbreite, ungerundet', () => {
    expect(lintelPiecesPerOpening(36.5, 12)).toBeCloseTo(3.0416667, 6)
    expect(lintelPiecesPerOpening(24, 12)).toBe(2)
    expect(lintelPiecesPerOpening(25, 12.5)).toBe(2)
  })

  it('weist eine Breite von 0 zurueck', () => {
    expect(() => lintelPiecesPerOpening(36.5, 0)).toThrow()
  })
})

describe('jambBricksForOpening - Excel Spalte F', () => {
  it('rechnet AUFRUNDEN(h; 0,25) x 2 / 0,25 x Stk', () => {
    const o = (heightM: number, count: number): Opening => ({
      id: 'x', updatedAt: '', kind: 'window', widthM: 1, heightM, count,
    })
    expect(jambBricksForOpening(o(1.5, 3))).toBe(36)
    expect(jambBricksForOpening(o(1.25, 2))).toBe(20)
    // 1,30 wird auf 1,50 aufgerundet -> wie bei 1,50
    expect(jambBricksForOpening(o(1.3, 1))).toBe(12)
  })
})

describe('calcSection - komplette Rechenkette eines Excel-Blatts', () => {
  const r = calcSection(section365, brick365)

  it('rechnet die Flaechen wie Excel A27 / E28 / L28 / A28', () => {
    expect(r.totalWallLengthM).toBe(36)
    expect(r.grossAreaSqm).toBe(108) // 36 m x 3 m
    expect(r.windowAreaSqm).toBe(9.25) // 1,5x1,5x3 + 1,0x1,25x2
    expect(r.doorAreaSqm).toBe(2)
    expect(r.netAreaSqm).toBe(96.75)
  })

  it('rechnet Ziegel und Paletten wie Excel P3 / P6, aber aufgerundet', () => {
    expect(r.bricks).toBe(1548) // 96,75 x 16
    expect(r.brickPallets).toBe(33) // 1548 / 48 = 32,25 -> 33
    expect(r.brickRemainder).toBe(36) // 33 x 48 - 1548
  })

  it('rechnet Laibung wie Excel P12 / P15, aber inklusive Tueren', () => {
    // Fenster 36 + 20, Tuer 2,00 m -> 2,00 x 2 / 0,25 = 16
    expect(r.jambBricks).toBe(72)
    expect(r.jambPallets).toBe(2) // 72 / 54 = 1,33 -> 2
    expect(r.jambRemainder).toBe(36)
  })

  it('rechnet gar keine Laibung, wenn der Schalter aus ist - auch nicht fuer Fenster', () => {
    const ohne = calcSection({ ...section365, countJambs: false }, brick365)
    expect(ohne.jambBricks).toBe(0)
    expect(ohne.jambPallets).toBe(0)
    expect(ohne.jambRemainder).toBe(0)
  })

  it('rechnet Ecksteine wie Excel P9 / P18', () => {
    expect(r.cornerBricks).toBe(48) // 3 m x 4 Ecken / 0,25
    expect(r.cornerPallets).toBe(3) // 48 / 21 = 2,29 -> 3
    expect(r.cornerRemainder).toBe(15)
  })

  it('gruppiert die Ueberleger nach Laenge und rundet dabei nicht', () => {
    expect(r.lintels).toEqual([
      // 1,00 m breit -> 1,50 m: Fenster (2 Stk) + Tuer (1 Stk) = 3 x 3,0416667
      { lengthM: 1.5, pieces: 9.125 },
      // 1,50 m breit -> 2,00 m: 3 Fenster x 3,0416667
      { lengthM: 2, pieces: 9.125 },
    ])
  })

  it('meldet Oeffnungen, die hoeher als das Geschoss sind', () => {
    const bad = {
      ...section365,
      openings: [{ ...section365.openings[0]!, heightM: 4, label: 'Panoramafenster' }],
    }
    expect(calcSection(bad, brick365).warnings.join(' ')).toContain('Panoramafenster')
  })

  it('warnt, wenn die Oeffnungen groesser als die Wand sind', () => {
    const bad = { ...section365, wallRuns: [{ ...section365.wallRuns[0]!, lengthM: 1 }] }
    const out = calcSection(bad, brick365)
    expect(out.warnings.join(' ')).toContain('größer als die Wandfläche')
    expect(out.bricks).toBe(0) // nie negative Ziegelzahlen
  })
})
