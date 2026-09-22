import { describe, expect, it } from 'vitest'
import { section365 } from '../calc/fixtures'
import type { Project, WallSection } from './types'
import { createWallSection, migrateProject } from './factory'

describe('createWallSection', () => {
  it('laesst die Laibung ohne Vorgabe aus', () => {
    expect(createWallSection('z').countJambs).toBe(false)
  })

  it('uebernimmt die Vorgabe aus den Einstellungen', () => {
    expect(createWallSection('z', true).countJambs).toBe(true)
  })
})

describe('migrateProject', () => {
  const alt = (countDoorJambs?: boolean): Project => {
    const { countJambs: _weg, ...rest } = section365
    const section = { ...rest, ...(countDoorJambs === undefined ? {} : { countDoorJambs }) }
    return {
      id: 'p', updatedAt: '', createdAt: '', name: 'Alt',
      sections: [section as unknown as WallSection], orders: [], stock: [],
    }
  }
  const neu = (p: Project) => p.sections[0] as WallSection & { countDoorJambs?: boolean }

  it('macht aus abgewaehlter Tuerlaibung eine abgewaehlte Laibung', () => {
    expect(neu(migrateProject(alt(false))).countJambs).toBe(false)
  })

  it('laesst die Laibung an, wo die Tuerlaibung an war oder der Schalter fehlte', () => {
    expect(neu(migrateProject(alt(true))).countJambs).toBe(true)
    expect(neu(migrateProject(alt())).countJambs).toBe(true)
  })

  it('raeumt das alte Feld weg und laesst heutige Daten unberuehrt', () => {
    expect(neu(migrateProject(alt(true))).countDoorJambs).toBeUndefined()
    const heute = migrateProject(alt(false))
    expect(migrateProject(heute)).toBe(heute)
  })
})
