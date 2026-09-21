/**
 * Minimaler Schreiber fuer .xlsx-Dateien.
 *
 * Gegenstueck zu xlsx-reader.ts und aus demselben Grund selbst gebaut: eine
 * Tabellenbibliothek waere fuer ein Blatt mit acht Spalten ein schlechter
 * Tausch gegen 400 kB, die jedes Geraet offline vorhalten muesste.
 *
 * Eine xlsx ist ein ZIP mit XML darin. Geschrieben wird genau so viel, dass
 * Excel, LibreOffice und der Leser nebenan die Datei ohne Nachfrage oeffnen:
 * Inhaltsverzeichnis, zwei Beziehungslisten, die Mappe, ein Blatt und eine
 * karge Formatvorlage.
 *
 * Text steht als `inlineStr` direkt in der Zelle statt in einer gemeinsamen
 * Zeichenkettentabelle. Das macht die Datei etwas groesser und den Schreiber
 * deutlich einfacher - bei einem Katalog mit ein paar Dutzend Zeilen faellt
 * das nicht ins Gewicht.
 *
 * **Formatvorlage nicht weglassen:** ohne `styles.xml` meldet Excel die
 * Mappe als beschaedigt und bietet an, sie zu reparieren. Der Inhalt waere
 * danach zwar da, aber der Schreck sitzt.
 */
import { strToU8, zipSync } from 'fflate'

export type CellInput = string | number | null | undefined

const XML_KOPF = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'

const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const NS_PAKET = 'http://schemas.openxmlformats.org/package/2006/relationships'
const NS_TYPEN = 'http://schemas.openxmlformats.org/package/2006/content-types'

/** Spaltenbuchstabe zu einer nullbasierten Nummer: 0 -> A, 26 -> AA. */
export function columnName(index: number): string {
  let rest = index
  let name = ''
  do {
    name = String.fromCharCode(65 + (rest % 26)) + name
    rest = Math.floor(rest / 26) - 1
  } while (rest >= 0)
  return name
}

const escapeXml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

/**
 * Steuerzeichen entfernen. Excel weist eine Datei ab, in der sie vorkommen -
 * und aus einer Zwischenablage kommt so etwas schneller mit, als man denkt.
 */
const saeubern = (text: string): string =>
  // eslint-disable-next-line no-control-regex
  text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')

function cellXml(ref: string, value: CellInput): string {
  if (value === null || value === undefined || value === '') return ''
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return ''
    return `<c r="${ref}"><v>${value}</v></c>`
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(
    saeubern(value),
  )}</t></is></c>`
}

function sheetXml(rows: readonly CellInput[][]): string {
  const zeilen = rows
    .map((row, r) => {
      const zellen = row.map((value, c) => cellXml(`${columnName(c)}${r + 1}`, value)).join('')
      return zellen === '' ? '' : `<row r="${r + 1}">${zellen}</row>`
    })
    .join('')
  return `${XML_KOPF}<worksheet xmlns="${NS_MAIN}"><sheetData>${zeilen}</sheetData></worksheet>`
}

/**
 * Baut eine Arbeitsmappe mit einem Blatt.
 *
 * `rows[0]` ist die Kopfzeile; der Schreiber behandelt sie nicht besonders,
 * das entscheidet der Aufrufer.
 */
export function writeWorkbook(sheetName: string, rows: readonly CellInput[][]): Uint8Array {
  // Excel erlaubt im Blattnamen weder diese Zeichen noch mehr als 31 davon.
  const name = escapeXml(sheetName.replace(/[\/?*[\]:]/g, ' ').slice(0, 31)) || 'Tabelle1'

  const dateien: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `${XML_KOPF}<Types xmlns="${NS_TYPEN}">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>',
    ),
    '_rels/.rels': strToU8(
      `${XML_KOPF}<Relationships xmlns="${NS_PAKET}">` +
        `<Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/>` +
        '</Relationships>',
    ),
    'xl/workbook.xml': strToU8(
      `${XML_KOPF}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">` +
        `<sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets>` +
        '</workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `${XML_KOPF}<Relationships xmlns="${NS_PAKET}">` +
        `<Relationship Id="rId1" Type="${NS_REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
        `<Relationship Id="rId2" Type="${NS_REL}/styles" Target="styles.xml"/>` +
        '</Relationships>',
    ),
    'xl/styles.xml': strToU8(
      `${XML_KOPF}<styleSheet xmlns="${NS_MAIN}">` +
        '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill>' +
        '<fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border/></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>' +
        // Ohne benannte Standardvorlage meldet ein strenger Leser die Mappe als
        // vorlagenlos und setzt seine eigene darueber.
        '<cellStyles count="1"><cellStyle name="Standard" xfId="0" builtinId="0"/></cellStyles>' +
        '</styleSheet>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(sheetXml(rows)),
  }

  return zipSync(dateien, { level: 6 })
}
