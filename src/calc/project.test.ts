import { describe, expect, it } from 'vitest'
import { calcProject, targetKey } from './project'
import { brick365, project365, section365 } from './fixtures'
import type { OrderEntry, StockEntry } from '../domain/types'

const NOW = '2026-01-01T00:00:00.000Z'

const find = (rows: ReturnType<typeof calcProject>['demand'], key: string) =>
  rows.find((r) => targetKey(r.target) === key)

describe('calcProject - Blatt "Bestellung"', () => {
  it('fuehrt Paletten und Ueberleger zu einer Bedarfsliste zusammen', () => {
    const { demand } = calcProject(project365, [brick365])

    expect(find(demand, 'brick:bt-365')).toMatchObject({
      required: 33, unit: 'Paletten', open: 33,
    })
    expect(find(demand, 'jamb:bt-365')).toMatchObject({ required: 2, unit: 'Paletten' })
    expect(find(demand, 'corner:bt-365')).toMatchObject({ required: 3, unit: 'Paletten' })

    // 9,125 Stueck -> erst hier wird aufgerundet, nicht je Oeffnung
    expect(find(demand, 'lintel:1.5')).toMatchObject({ required: 10, unit: 'Stück' })
    expect(find(demand, 'lintel:2')).toMatchObject({ required: 10, unit: 'Stück' })
  })

  it('rundet die Ueberleger erst in der Summe auf, nicht je Abschnitt', () => {
    // Derselbe Abschnitt zweimal: 9,125 + 9,125 = 18,25 -> 19.
    // Haetten wir je Abschnitt gerundet, kaemen 20 heraus.
    const doubled = {
      ...project365,
      sections: [section365, { ...section365, id: 'sec-2' }],
    }
    expect(find(calcProject(doubled, [brick365]).demand, 'lintel:2')?.required).toBe(19)
  })

  it('zieht Bestelltes und Restbestand ab (Excel: offen = Bedarf - bestellt - rest)', () => {
    const order: OrderEntry = {
      id: 'ord-1', updatedAt: NOW, orderedOn: '2026-01-05',
      target: { type: 'brick', brickTypeId: 'bt-365' }, quantity: 20,
    }
    const stock: StockEntry = {
      id: 'st-1', updatedAt: NOW,
      target: { type: 'brick', brickTypeId: 'bt-365' }, quantity: 5,
    }
    const { demand } = calcProject(
      { ...project365, orders: [order], stock: [stock] }, [brick365],
    )
    expect(find(demand, 'brick:bt-365')).toMatchObject({
      required: 33, ordered: 20, inStock: 5, open: 8,
    })
  })

  it('zeigt "offen" nie negativ an, wenn zu viel bestellt wurde', () => {
    const order: OrderEntry = {
      id: 'ord-1', updatedAt: NOW, orderedOn: '2026-01-05',
      target: { type: 'brick', brickTypeId: 'bt-365' }, quantity: 99,
    }
    expect(find(calcProject({ ...project365, orders: [order] }, [brick365]).demand,
      'brick:bt-365')?.open).toBe(0)
  })

  it('ignoriert soft-geloeschte Bestellungen', () => {
    const order: OrderEntry = {
      id: 'ord-1', updatedAt: NOW, deletedAt: NOW, orderedOn: '2026-01-05',
      target: { type: 'brick', brickTypeId: 'bt-365' }, quantity: 20,
    }
    expect(find(calcProject({ ...project365, orders: [order] }, [brick365]).demand,
      'brick:bt-365')?.ordered).toBe(0)
  })

  it('warnt statt zu rechnen, wenn der Ziegeltyp im Katalog fehlt', () => {
    const out = calcProject(project365, [])
    expect(out.sections).toHaveLength(0)
    expect(out.warnings.join(' ')).toContain('Ziegeltyp')
  })

  it('ueberspringt soft-geloeschte Wandabschnitte', () => {
    const p = { ...project365, sections: [{ ...section365, deletedAt: NOW }] }
    expect(calcProject(p, [brick365]).demand).toHaveLength(0)
  })
})
