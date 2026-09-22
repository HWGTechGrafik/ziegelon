/**
 * Lokale Speicherung in IndexedDB.
 *
 * Ein Projekt wird als ein Dokument abgelegt, Wandabschnitte samt Laengen und
 * Oeffnungen liegen darin verschachtelt. Das passt zur Arbeitsweise - man
 * bearbeitet immer ein Bauvorhaben am Stueck - und gibt beim spaeteren Sync
 * eine klare Einheit fuer die Konfliktbehandlung.
 *
 * Geloescht wird nie hart, sondern ueber deletedAt. Ohne diesen Grabstein
 * kaeme ein geloeschtes Projekt beim naechsten Abgleich vom anderen Geraet
 * zurueck.
 */
import Dexie, { type EntityTable } from 'dexie'
import { migrateProject } from '../domain/factory'
import type { BrickType, Project, Settings } from '../domain/types'

export class ZiegelonDb extends Dexie {
  projects!: EntityTable<Project, 'id'>
  brickTypes!: EntityTable<BrickType, 'id'>
  settings!: EntityTable<Settings, 'id'>

  constructor() {
    super('ziegelon')
    this.version(1).stores({
      projects: 'id, name, updatedAt, deletedAt',
      brickTypes: 'id, name, updatedAt, deletedAt',
    })
    // Version 2 ergaenzt die Einstellungen. Bestehende Tabellen bleiben
    // unveraendert, Dexie wandert bei Bedarf von selbst hoch.
    this.version(2).stores({
      settings: 'id',
    })
    // Version 3: der Schalter fuer Tuerlaibungen wird zum Schalter fuer die
    // ganze Laibung. Einmalig umschreiben, damit die Rechnung nur noch ein
    // Feld kennen muss.
    this.version(3)
      .stores({})
      .upgrade((tx) =>
        tx
          .table<Project, string>('projects')
          .toCollection()
          .modify((project, ref) => {
            ref.value = migrateProject(project)
          }),
      )
  }
}

export const db = new ZiegelonDb()
