/**
 * Minimaler Leser fuer .xlsx-Dateien.
 *
 * Eine xlsx ist ein ZIP mit XML darin. Gebraucht werden hier nur Zellwerte
 * aus bekannten Feldern - kein Schreiben, keine Formeln, keine Formate.
 * Dafuer reichen das Entpacken und der DOMParser des Browsers.
 *
 * **Warum nicht SheetJS:** die uebliche Bibliothek bringt rund 400 kB mit,
 * die jedes Geraet herunterladen und offline vorhalten muesste, und die auf
 * npm verfuegbare Fassung hat eine bekannte Luecke beim Parsen fremder
 * Dateien. Fuer das schmale Stueck Format, das hier gebraucht wird, waere das
 * ein schlechter Tausch. Was dieser Leser nicht kann, faellt beim Import als
 * "Zelle leer" auf und nicht als falsche Zahl - das ist die wichtigere
 * Eigenschaft.
 *
 * Bei Formelzellen wird der zuletzt von Excel gespeicherte Wert gelesen.
 * Eine Datei, die nie gerechnet hat, liefert deshalb Nullen; darauf weist
 * der Import gesondert hin.
 */
import { unzipSync } from 'fflate'

export type CellValue = string | number | null

export interface Sheet {
  readonly name: string
  /** Rohwert einer Zelle, z. B. "B3". */
  cell(ref: string): CellValue
  /** Zahl oder null - Text, der keine Zahl ist, gilt als leer. */
  number(ref: string): number | null
  /** Text oder null. */
  text(ref: string): string | null
}

export interface Workbook {
  readonly sheetNames: string[]
  sheet(name: string): Sheet | null
}

const decoder = new TextDecoder()

function parseXml(bytes: Uint8Array): Document {
  const doc = new DOMParser().parseFromString(decoder.decode(bytes), 'application/xml')
  if (doc.querySelector('parsererror')) {
    throw new Error('Die Datei enthält beschädigtes XML.')
  }
  return doc
}

/**
 * Text eines <si>-Eintrags. Excel zerlegt formatierten Text in mehrere
 * <r>-Abschnitte; die muessen wieder zusammengesetzt werden, sonst fehlt
 * alles ausser dem ersten Stueck.
 */
function sharedStringText(si: Element): string {
  const runs = si.getElementsByTagName('t')
  let out = ''
  for (let i = 0; i < runs.length; i++) out += runs[i]?.textContent ?? ''
  return out
}

/** Pfad aus einer Beziehung aufloesen - mal relativ zu xl/, mal absolut. */
function resolveTarget(target: string): string {
  if (target.startsWith('/')) return target.slice(1)
  if (target.startsWith('xl/')) return target
  return `xl/${target}`
}

export function readWorkbook(data: ArrayBuffer | Uint8Array): Workbook {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)

  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes)
  } catch {
    throw new Error('Die Datei ist keine Excel-Arbeitsmappe (.xlsx).')
  }

  const workbookXml = files['xl/workbook.xml']
  const relsXml = files['xl/_rels/workbook.xml.rels']
  if (!workbookXml || !relsXml) {
    throw new Error('Die Datei ist keine Excel-Arbeitsmappe (.xlsx).')
  }

  // Gemeinsame Zeichenketten: Zellen mit t="s" verweisen per Index hierher.
  const shared: string[] = []
  const sharedXml = files['xl/sharedStrings.xml']
  if (sharedXml) {
    const items = parseXml(sharedXml).getElementsByTagName('si')
    for (let i = 0; i < items.length; i++) {
      const si = items[i]
      if (si) shared.push(sharedStringText(si))
    }
  }

  const targetById = new Map<string, string>()
  const rels = parseXml(relsXml).getElementsByTagName('Relationship')
  for (let i = 0; i < rels.length; i++) {
    const rel = rels[i]
    const id = rel?.getAttribute('Id')
    const target = rel?.getAttribute('Target')
    if (id && target) targetById.set(id, resolveTarget(target))
  }

  const sheetPaths = new Map<string, string>()
  const sheetNames: string[] = []
  const entries = parseXml(workbookXml).getElementsByTagName('sheet')
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const name = entry?.getAttribute('name')
    // Der Namensraum steht je nach Erzeuger anders da, deshalb beide Wege.
    const rid =
      entry?.getAttribute('r:id') ??
      entry?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
    if (!name || !rid) continue
    const path = targetById.get(rid)
    if (!path) continue
    sheetNames.push(name)
    sheetPaths.set(name, path)
  }

  const cache = new Map<string, Sheet>()

  function load(name: string): Sheet | null {
    const cached = cache.get(name)
    if (cached) return cached

    const path = sheetPaths.get(name)
    const xml = path ? files[path] : undefined
    if (!xml) return null

    const values = new Map<string, CellValue>()
    const cells = parseXml(xml).getElementsByTagName('c')
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i]
      const ref = c?.getAttribute('r')
      if (!c || !ref) continue
      const type = c.getAttribute('t')

      if (type === 'inlineStr') {
        const is = c.getElementsByTagName('is')[0]
        if (is) values.set(ref, sharedStringText(is))
        continue
      }

      // <v> ist bei Formelzellen der zuletzt gespeicherte Wert.
      const v = c.getElementsByTagName('v')[0]?.textContent
      if (v === undefined || v === null || v === '') continue

      if (type === 's') {
        const index = Number(v)
        const text = shared[index]
        if (text !== undefined) values.set(ref, text)
      } else if (type === 'str' || type === 'e') {
        values.set(ref, v)
      } else if (type === 'b') {
        values.set(ref, v === '1' ? 1 : 0)
      } else {
        const num = Number(v)
        values.set(ref, Number.isFinite(num) ? num : v)
      }
    }

    const sheet: Sheet = {
      name,
      cell: (ref) => values.get(ref.toUpperCase()) ?? null,
      number(ref) {
        const value = this.cell(ref)
        return typeof value === 'number' && Number.isFinite(value) ? value : null
      },
      text(ref) {
        const value = this.cell(ref)
        if (value === null) return null
        const text = String(value).trim()
        return text === '' ? null : text
      },
    }
    cache.set(name, sheet)
    return sheet
  }

  return {
    sheetNames,
    sheet: (name) => load(name),
  }
}
