import { describe, expect, it } from 'vitest'
import { ceilTo, ceilUnits } from './round'

describe('ceilTo - Excel CEILING.MATH', () => {
  it('rundet auf das 25-cm-Raster auf', () => {
    expect(ceilTo(1.8, 0.25)).toBe(2)
    expect(ceilTo(1.3, 0.25)).toBe(1.5)
    expect(ceilTo(1.51, 0.25)).toBe(1.75)
  })

  it('laesst exakte Vielfache unveraendert', () => {
    expect(ceilTo(1.5, 0.25)).toBe(1.5)
    expect(ceilTo(2.25, 0.25)).toBe(2.25)
    expect(ceilTo(3, 0.25)).toBe(3)
  })

  it('faellt nicht auf Gleitkommarauschen herein', () => {
    // 1.95 + 0.3 ergibt in IEEE 2.2500000000000004 - ohne Toleranz kaeme 2,5 raus
    expect(ceilTo(1.95 + 0.3, 0.25)).toBe(2.25)
    expect(ceilTo(0.7 + 0.3 + 0.5, 0.25)).toBe(1.5)
  })

  it('behandelt 0 als 0', () => {
    expect(ceilTo(0, 0.25)).toBe(0)
  })

  it('weist ein Raster <= 0 zurueck', () => {
    expect(() => ceilTo(1, 0)).toThrow()
  })
})

describe('ceilUnits', () => {
  it('rundet auf ganze Stueck auf', () => {
    expect(ceilUnits(9.125)).toBe(10)
    expect(ceilUnits(32.25)).toBe(33)
  })

  it('laesst ganze Zahlen stehen, auch bei Rauschen', () => {
    expect(ceilUnits(9)).toBe(9)
    expect(ceilUnits(0.1 + 0.2 + 8.7)).toBe(9)
  })

  it('gibt bei 0 eine gewoehnliche Null zurueck, keine negative', () => {
    // Math.ceil(0 - EPS) liefert -0. Rechnerisch egal, angezeigt aber
    // "-0 Paletten" - und so stuende es auch in einer Sicherung.
    expect(Object.is(ceilUnits(0), -0)).toBe(false)
    expect(ceilUnits(0)).toBe(0)
  })
})
