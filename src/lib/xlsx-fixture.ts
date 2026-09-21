/**
 * Baut im Test eine echte .xlsx im Speicher.
 *
 * Bewusst so und nicht als abgelegte Beispieldatei: die Tests laufen damit
 * in jedem Klon, ohne dass eine Binaerdatei mitgeschleppt werden muss, und
 * es ist im Test ablesbar, welche Zelle welchen Wert traegt.
 */
import { zipSync, strToU8 } from 'fflate'

export type Cells = Record<string, number | string>

const escape = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** "B12" -> Zeilennummer 12 */
const rowOf = (ref: string): number => Number(ref.replace(/[^0-9]/g, ''))

function sheetXml(cells: Cells): string {
  const byRow = new Map<number, string[]>()
  for (const [ref, value] of Object.entries(cells)) {
    const row = rowOf(ref)
    const cell =
      typeof value === 'number'
        ? `<c r="${ref}"><v>${value}</v></c>`
        : `<c r="${ref}" t="inlineStr"><is><t>${escape(value)}</t></is></c>`
    const list = byRow.get(row)
    if (list) list.push(cell)
    else byRow.set(row, [cell])
  }

  const rows = [...byRow.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([row, list]) => `<row r="${row}">${list.join('')}</row>`)
    .join('')

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<sheetData>${rows}</sheetData></worksheet>`
  )
}

/** Erzeugt eine Arbeitsmappe aus {Blattname: Zellen}. */
export function buildXlsx(sheets: Record<string, Cells>): Uint8Array {
  const names = Object.keys(sheets)

  const workbook =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    names
      .map((name, i) => `<sheet name="${escape(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('') +
    '</sheets></workbook>'

  const rels =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    names
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join('') +
    '</Relationships>'

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="xml" ContentType="application/xml"/></Types>',
    ),
    'xl/workbook.xml': strToU8(workbook),
    'xl/_rels/workbook.xml.rels': strToU8(rels),
  }
  names.forEach((name, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(sheets[name] ?? {}))
  })

  return zipSync(files)
}

/** Die Kennwerte eines Rechenblatts der alten Vorlage. */
export function calcSheetCells(options: {
  storeyHeightM: number
  wallThicknessCm: number
  bricksPerSqm: number
  bricksPerPallet: number
  outerCorners: number
  wallLengths?: number[]
  windows?: Array<[number, number, number]>
  doors?: Array<[number, number, number]>
}): Cells {
  const cells: Cells = {
    O3: options.storeyHeightM,
    O6: options.wallThicknessCm,
    O9: options.bricksPerSqm,
    O12: options.bricksPerPallet,
    O15: options.outerCorners,
    O18: 54,
    O21: 21,
  }
  options.wallLengths?.forEach((length, i) => {
    cells[`A${3 + i}`] = length
  })
  options.windows?.forEach(([w, h, n], i) => {
    cells[`B${3 + i}`] = w
    cells[`C${3 + i}`] = h
    cells[`D${3 + i}`] = n
  })
  options.doors?.forEach(([w, h, n], i) => {
    cells[`I${3 + i}`] = w
    cells[`J${3 + i}`] = h
    cells[`K${3 + i}`] = n
  })
  return cells
}
