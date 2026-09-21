/**
 * Lesezugriffe als Live-Abfragen: die Oberflaeche aktualisiert sich selbst,
 * sobald sich in IndexedDB etwas aendert - auch aus einem zweiten Tab.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import type { BrickType, Project, Settings } from '../domain/types'
import { db } from './db'

const alive = <T extends { deletedAt?: string }>(items: T[]): T[] =>
  items.filter((item) => !item.deletedAt)

export function useProjects(): Project[] | undefined {
  return useLiveQuery(async () => {
    const all = alive(await db.projects.toArray())
    return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [])
}

/**
 * Ergebnis einer Projektabfrage.
 *
 * Die angefragte id kommt mit zurueck, weil useLiveQuery beim Wechsel der
 * Abhaengigkeit kurz noch das vorige Ergebnis liefert. Ohne diesen Abgleich
 * haelt der Aufrufer den alten Stand faelschlich fuer die Antwort auf die
 * neue Frage - und wirft den Nutzer aus einem Bauvorhaben wieder heraus,
 * kaum dass er es geoeffnet hat.
 */
export interface ProjectLookup {
  id: string | null
  project: Project | null
}

export function useProject(id: string | null): ProjectLookup | undefined {
  return useLiveQuery(async () => {
    if (!id) return { id: null, project: null }
    const found = await db.projects.get(id)
    return { id, project: found && !found.deletedAt ? found : null }
  }, [id])
}

/** undefined = wird noch geladen, null = noch nie etwas gespeichert. */
export function useSettings(): Settings | null | undefined {
  return useLiveQuery(async () => (await db.settings.get('app')) ?? null, [])
}

export function useBrickTypes(): BrickType[] | undefined {
  return useLiveQuery(async () => {
    const all = alive(await db.brickTypes.toArray())
    return all.sort((a, b) => b.wallThicknessCm - a.wallThicknessCm)
  }, [])
}
