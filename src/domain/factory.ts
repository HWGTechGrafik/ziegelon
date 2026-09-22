/**
 * Erzeugt neue Entitaeten mit den Feldern, die fuer einen spaeteren Sync
 * noetig sind: eine UUID, die auch offline eindeutig bleibt, und updatedAt.
 */
import {
  BEARING_DEFAULT_CM,
  DEFAULT_COUNT_JAMBS,
  type Opening,
  type OpeningKind,
  type Project,
  type WallRun,
  type WallSection,
} from './types'

export const now = (): string => new Date().toISOString()

export const newId = (): string =>
  // randomUUID gibt es in allen Zielbrowsern; der Rueckfall deckt unsichere
  // Kontexte ab (http ohne TLS), in denen crypto.randomUUID fehlt.
  globalThis.crypto?.randomUUID?.() ??
  `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

export function createProject(name: string): Project {
  const ts = now()
  return {
    id: newId(),
    updatedAt: ts,
    createdAt: ts,
    name,
    sections: [],
    orders: [],
    stock: [],
  }
}

export function createWallSection(
  brickTypeId: string,
  countJambs = DEFAULT_COUNT_JAMBS,
): WallSection {
  return {
    id: newId(),
    updatedAt: now(),
    brickTypeId,
    storeyHeightM: 2.75,
    outerCorners: 4,
    bearingCmPerSide: BEARING_DEFAULT_CM,
    countJambs,
    wallRuns: [],
    openings: [],
  }
}

export const createWallRun = (): WallRun => ({
  id: newId(),
  updatedAt: now(),
  lengthM: 0,
  count: 1,
})

export const createOpening = (kind: OpeningKind): Opening => ({
  id: newId(),
  updatedAt: now(),
  kind,
  widthM: kind === 'door' ? 1 : 1.2,
  heightM: kind === 'door' ? 2 : 1.25,
  count: 1,
})

/**
 * Bringt ein Bauvorhaben aus einem aelteren Stand auf das heutige Format.
 *
 * Frueher gab es nur den Schalter `countDoorJambs`; Fensterlaibungen zaehlten
 * immer. Heute schaltet `countJambs` die ganze Laibung. Wer die Tuerlaibung
 * abgewaehlt hatte, wollte keine Laibung - deshalb wird aus false ein false.
 * Fehlt beides, stammt der Abschnitt aus der Zeit vor dem Schalter: an.
 */
export function migrateProject(project: Project): Project {
  if (project.sections.every((s) => typeof s.countJambs === 'boolean')) return project
  return {
    ...project,
    sections: project.sections.map((section) => {
      if (typeof section.countJambs === 'boolean') return section
      const { countDoorJambs, ...rest } = section as WallSection & {
        countDoorJambs?: boolean
      }
      return { ...rest, countJambs: countDoorJambs ?? true }
    }),
  }
}
