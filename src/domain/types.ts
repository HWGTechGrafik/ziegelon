/**
 * Domaenenmodell von Ziegelon.
 *
 * Alle Entitaeten tragen `id` (UUID), `updatedAt` und optional `deletedAt`.
 * Das ist bewusst so gewaehlt, damit spaeter ein Sync gegen NAS oder Cloud
 * nachgeruestet werden kann, ohne das Modell umbauen zu muessen.
 */

/** Felder, die jede syncfaehige Entitaet mitbringt. */
export interface Syncable {
  id: string
  /** ISO-8601. Bei jeder Aenderung neu setzen. */
  updatedAt: string
  /** Soft delete - Datensaetze werden nie hart geloescht, sonst kippt der Sync. */
  deletedAt?: string
}

/**
 * Ein Eintrag im Ziegel-Katalog (Stammdaten).
 *
 * Loest die vier fest verdrahteten Tabellenblaetter der Excel ab: was dort je
 * Blatt in O3..O21 stand, ist hier ein pflegbarer Datensatz.
 */
export interface BrickType extends Syncable {
  name: string
  /** Wandstaerke in cm, z. B. 36.5 */
  wallThicknessCm: number
  /** Ziegel je m² Wandflaeche (Excel O9) */
  bricksPerSqm: number
  /** Ziegel je Palette (Excel O12) */
  bricksPerPallet: number
  /** Laibungsziegel je Palette (Excel O18) */
  jambBricksPerPallet: number
  /** Ecksteine je Palette (Excel O21) */
  cornerBricksPerPallet: number
  /**
   * Breite eines Ueberlegers in cm. Bestimmt, wie viele nebeneinander in die
   * Wandstaerke passen. In der Excel fix 12 bzw. 12,5 - hier pro Typ pflegbar,
   * weil das vom Lieferanten abhaengt.
   */
  lintelWidthCm: number
}

export type OpeningKind = 'window' | 'door'

/** Eine Oeffnung: Fenster oder Tuer. */
export interface Opening extends Syncable {
  kind: OpeningKind
  label?: string
  /** Lichte Breite in m */
  widthM: number
  /** Lichte Hoehe in m */
  heightM: number
  count: number
}

/** Eine Wandlaenge des Bauwerks (Excel: Spalte A). */
export interface WallRun extends Syncable {
  label?: string
  lengthM: number
  /** Die Excel kannte keine Stueckzahl - Default 1, erspart Doppelzeilen. */
  count: number
}

/**
 * Alle Waende einer Staerke in einem Geschoss.
 * Entspricht einem Tabellenblatt der Excel.
 */
export interface WallSection extends Syncable {
  label?: string
  brickTypeId: string
  /** Geschosshoehe in m (Excel O3) */
  storeyHeightM: number
  /** Anzahl Aussenecken (Excel O15) */
  outerCorners: number
  /**
   * Auflage des Ueberlegers je Seite in cm.
   * Die Excel rechnete fix mit +0,30 m gesamt, also 15 cm je Seite.
   * Zulaessig 12-25 cm.
   */
  bearingCmPerSide: number
  /**
   * Zaehlen Tuerlaibungen mit? Tueren haben gemauerte Laibungen wie Fenster,
   * deshalb ist das der Normalfall. Abwaehlbar, weil es Ausfuehrungen ohne
   * gemauerte Tuerlaibung gibt.
   *
   * Achtung: die alte Excel hatte fuer Tueren gar keine Laibungsspalte und
   * rechnete damit immer so, als waere das hier `false`.
   */
  countDoorJambs: boolean
  wallRuns: WallRun[]
  openings: Opening[]
}

/** Eine Bestellbuchung (Blatt "Bestellung", Spalten E-I). */
export interface OrderEntry extends Syncable {
  /** Worauf sich die Buchung bezieht. */
  target:
    | { type: 'brick'; brickTypeId: string }
    | { type: 'jamb'; brickTypeId: string }
    | { type: 'corner'; brickTypeId: string }
    | { type: 'lintel'; lengthM: number }
  /** Paletten bei brick/jamb/corner, Stueck bei lintel. */
  quantity: number
  /** ISO-Datum der Bestellung. */
  orderedOn: string
  note?: string
}

/** Restbestand, der vom Bedarf abgezogen wird (Blatt "Bestellung", Zeile 15). */
export interface StockEntry extends Syncable {
  target: OrderEntry['target']
  quantity: number
}

/**
 * Geraetebezogene Einstellungen. Es gibt genau einen Datensatz mit der
 * festen id 'app'.
 *
 * Die Lizenz gehoert bewusst hierher und nicht in den Export: sie gilt fuer
 * dieses Geraet, nicht fuer die Daten. Wer eine Sicherung weitergibt, gibt
 * damit nicht seine Lizenz weiter.
 */
export interface Settings extends Syncable {
  id: 'app'
  license?: string
  /** Fehlt der Wert, gilt 'system'. */
  theme?: Theme
}

/** 'system' folgt der Einstellung des Betriebssystems. */
export type Theme = 'light' | 'dark' | 'system'

export const DEFAULT_THEME: Theme = 'system'

export interface Project extends Syncable {
  name: string
  customer?: string
  note?: string
  createdAt: string
  sections: WallSection[]
  orders: OrderEntry[]
  stock: StockEntry[]
}

/** Schichthoehe in m - Raster fuer Laibung und Ecksteine (Excel: 0,25). */
export const COURSE_HEIGHT_M = 0.25

/** Laengenraster der Ueberleger in m (Excel: 0,25 -> 100/125/150 ... cm). */
export const LINTEL_STEP_M = 0.25

export const BEARING_MIN_CM = 12
export const BEARING_MAX_CM = 25
export const BEARING_DEFAULT_CM = 15

/** Vorgabe fuer neue Wandabschnitte: Tuerlaibungen zaehlen mit. */
export const DEFAULT_COUNT_DOOR_JAMBS = true
