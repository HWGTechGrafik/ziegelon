/**
 * Ziegel-Katalog als Excel hinaus und wieder herein.
 *
 * Zweistufig wie die Uebernahme eines Bauvorhabens: erst zeigen, was sich
 * aendern wuerde, dann uebernehmen. Der Katalog bestimmt jede Berechnung -
 * ein Import, der still Kennwerte ueberschreibt, faellt erst bei der
 * Bestellung auf, und dann ist die Palette schon geliefert.
 *
 * Gebaut als Haken statt als eigene Karte, weil die Schalter in die Kopfzeile
 * des Katalogs gehoeren - neben "+ Ziegeltyp", wo man sie sucht. Der Haken
 * liefert beide Haelften getrennt: die Schalter fuer die Kopfzeile, die
 * Vorschau fuer den Inhalt.
 */
import { useRef, useState, type ReactNode } from 'react'
import { newId, now } from '../domain/factory'
import type { BrickType } from '../domain/types'
import { readCatalog, writeCatalog, type CatalogImportResult } from '../lib/catalog-excel'
import { saveBrickType } from '../storage/repo'
import { Button, Warnings } from './components'
import { fmt } from './format'

const STATUS_TEXT = {
  neu: 'neu',
  geaendert: 'geändert',
  unveraendert: 'unverändert',
} as const

export interface CatalogExcelParts {
  /** Schalter fuer die Kopfzeile der Katalog-Karte. */
  actions: ReactNode
  /** Hinweis, Fehler und Vorschau - gehoert in den Inhalt derselben Karte. */
  panel: ReactNode
}

export function useCatalogExcel(brickTypes: BrickType[]): CatalogExcelParts {
  const fileInput = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<CatalogImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const doExport = () => {
    const bytes = writeCatalog(brickTypes)
    // Kopie in einen eigenen Puffer: Blob will einen ArrayBuffer, und der von
    // fflate kann groesser sein als die Daten darin.
    const blob = new Blob([bytes.slice().buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Ziegelon_Ziegeltypen_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    setError(null)
    setMessage(
      `${brickTypes.length} ${brickTypes.length === 1 ? 'Ziegeltyp' : 'Ziegeltypen'} als Excel gespeichert.`,
    )
  }

  const read = async (file: File) => {
    setError(null)
    setMessage(null)
    setResult(null)
    try {
      setResult(readCatalog(await file.arrayBuffer(), brickTypes, newId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Die Datei ließ sich nicht lesen.')
    }
  }

  const zuSchreiben = result?.rows.filter((row) => row.status !== 'unveraendert') ?? []

  const commit = async () => {
    if (!result) return
    setBusy(true)
    try {
      // Unveraenderte Zeilen bleiben unangetastet. Sie neu zu schreiben wuerde
      // nur ihren Zeitstempel hochsetzen und spaeter beim Abgleich als
      // Aenderung durchgehen, die keine ist.
      for (const row of zuSchreiben) {
        // Den Zeitstempel setzt das Repo selbst; er steht hier nur, weil der
        // Datensatz sonst unvollstaendig waere.
        await saveBrickType({ ...row.brick, updatedAt: now() })
      }
      const neu = zuSchreiben.filter((row) => row.status === 'neu').length
      setResult(null)
      setMessage(`${neu} neu angelegt, ${zuSchreiben.length - neu} geändert.`)
    } finally {
      setBusy(false)
    }
  }

  const actions = (
    <>
      <Button onClick={doExport} disabled={brickTypes.length === 0} title="Katalog als Excel speichern">
        Als Excel
      </Button>
      <Button onClick={() => fileInput.current?.click()} title="Katalog aus Excel einlesen">
        Aus Excel
      </Button>
    </>
  )

  const panel = (
    <>
      <input
        ref={fileInput}
        type="file"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void read(file)
          e.target.value = ''
        }}
      />

      {error && (
        <p className="lock-error" role="alert">
          {error}
        </p>
      )}
      {message && !result && <p className="hint">{message}</p>}

      {result && (
        <div className="import-preview">
          <Warnings items={result.warnings} />

          {result.rows.length === 0 ? (
            <p className="hint">Keine übernehmbare Zeile gefunden.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Bezeichnung</th>
                  <th className="num">Stärke</th>
                  <th className="num">Stk/m²</th>
                  <th className="num">Stk/Pal</th>
                  <th>Was passiert</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.brick.id}>
                    <td>{row.brick.name}</td>
                    <td className="num">{fmt(row.brick.wallThicknessCm)} cm</td>
                    <td className="num">{fmt(row.brick.bricksPerSqm)}</td>
                    <td className="num">{fmt(row.brick.bricksPerPallet)}</td>
                    <td>
                      {STATUS_TEXT[row.status]}
                      {row.renamedFrom ? ` (bisher „${row.renamedFrom}“)` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="btn-row">
            <Button
              variant="primary"
              onClick={() => void commit()}
              disabled={busy || zuSchreiben.length === 0}
            >
              {busy ? 'Wird übernommen …' : `${zuSchreiben.length} übernehmen`}
            </Button>
            <Button onClick={() => setResult(null)}>Verwerfen</Button>
          </div>
        </div>
      )}
    </>
  )

  return { actions, panel }
}
