/**
 * Alle Schreibzugriffe laufen ueber dieses Modul - es ist die Naht, an der
 * spaeter ein Remote-Adapter fuer NAS oder Cloud andocken kann, ohne dass die
 * Oberflaeche etwas davon merkt.
 *
 * Es ist ausserdem die einzige Stelle, die updatedAt und deletedAt setzt.
 * Wuerden die Komponenten das selbst tun, waere beim ersten vergessenen
 * Zeitstempel der Sync kaputt.
 */
import { CATALOG_SEED } from '../domain/catalog'
import { newId, now } from '../domain/factory'
import type { BrickType, Project, Settings, Theme } from '../domain/types'
import { db } from './db'

const touch = <T extends { updatedAt: string }>(entity: T): T => ({
  ...entity,
  updatedAt: now(),
})

/**
 * Einstellungen zusammenfuehren statt ersetzen. Wuerde hier put mit einem
 * frischen Objekt stehen, loeschte das Speichern des Themas die Lizenz.
 */
async function patchSettings(changes: Partial<Settings>): Promise<void> {
  const current = await db.settings.get('app')
  const next: Settings = { ...current, ...changes, id: 'app', updatedAt: now() }
  await db.settings.put(next)
}

/** Merkt den Lizenzschluessel, damit die App nur einmal danach fragt. */
export async function saveLicense(license: string): Promise<void> {
  await patchSettings({ license })
}

export async function saveTheme(theme: Theme): Promise<void> {
  await patchSettings({ theme })
}

export async function saveProject(project: Project): Promise<void> {
  await db.projects.put(touch(project))
}

export async function deleteProject(id: string): Promise<void> {
  const project = await db.projects.get(id)
  if (!project) return
  await db.projects.put({ ...touch(project), deletedAt: now() })
}

export async function saveBrickType(brickType: BrickType): Promise<void> {
  await db.brickTypes.put(touch(brickType))
}

export async function deleteBrickType(id: string): Promise<void> {
  const brickType = await db.brickTypes.get(id)
  if (!brickType) return
  await db.brickTypes.put({ ...touch(brickType), deletedAt: now() })
}

/**
 * Legt den Ziegel-Katalog beim ersten Start mit den Werten aus der alten Excel
 * an. Laeuft nur, solange ueberhaupt noch kein Eintrag existiert - auch keiner,
 * der geloescht wurde. Sonst kaemen geloeschte Typen bei jedem Start zurueck.
 *
 * Pruefen und Schreiben muessen in einer Transaktion liegen. Sonst koennen
 * zwei gleichzeitige Aufrufe beide "noch leer" sehen und den Katalog doppelt
 * anlegen - genau das passiert im Entwicklungsmodus, weil React Effekte
 * absichtlich zweimal ausfuehrt.
 */
export async function seedCatalogIfEmpty(): Promise<void> {
  await db.transaction('rw', db.brickTypes, async () => {
    if ((await db.brickTypes.count()) > 0) return
    await db.brickTypes.bulkAdd(
      CATALOG_SEED.map((seed) => ({ ...seed, id: newId(), updatedAt: now() })),
    )
  })
}

/** Vollstaendige Sicherung als JSON - der Weg, ein Projekt aufs naechste Geraet zu bringen. */
export async function exportAll(): Promise<string> {
  const [projects, brickTypes] = await Promise.all([
    db.projects.toArray(),
    db.brickTypes.toArray(),
  ])
  return JSON.stringify({ version: 1, exportedAt: now(), projects, brickTypes }, null, 2)
}

export interface ImportSummary {
  projects: number
  brickTypes: number
}

/**
 * Spielt eine Sicherung ein. Bestehende Datensaetze werden nur ueberschrieben,
 * wenn die eingespielte Fassung juenger ist - dieselbe Regel, die spaeter auch
 * der Sync anwenden wird.
 */
export async function importAll(json: string): Promise<ImportSummary> {
  const parsed: unknown = JSON.parse(json)
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Die Datei enthält keine Ziegelon-Sicherung.')
  }
  const data = parsed as { projects?: Project[]; brickTypes?: BrickType[] }
  if (!Array.isArray(data.projects) || !Array.isArray(data.brickTypes)) {
    throw new Error('Die Datei enthält keine Ziegelon-Sicherung.')
  }

  return {
    brickTypes: await mergeNewer(
      data.brickTypes,
      (id) => db.brickTypes.get(id),
      (item) => db.brickTypes.put(item),
    ),
    projects: await mergeNewer(
      data.projects,
      (id) => db.projects.get(id),
      (item) => db.projects.put(item),
    ),
  }
}

/** Schreibt nur, was juenger ist als der vorhandene Stand. */
async function mergeNewer<T extends { id: string; updatedAt: string }>(
  items: T[],
  get: (id: string) => Promise<T | undefined>,
  put: (item: T) => Promise<unknown>,
): Promise<number> {
  let written = 0
  for (const item of items) {
    const existing = await get(item.id)
    if (!existing || existing.updatedAt < item.updatedAt) {
      await put(item)
      written += 1
    }
  }
  return written
}
