/**
 * Uebernahme eines Bauvorhabens aus der alten Excel.
 *
 * Bewusst zweistufig: erst zeigen, was gefunden wurde, dann uebernehmen.
 * Ein Import, der stillschweigend Daten anlegt, ist schwer zu pruefen - und
 * die Vorlage steckte voller Zellen, die nur so aussahen wie Eingaben.
 */
import { useRef, useState } from 'react'
import {
  matchesBrick,
  readOldWorkbook,
  type ImportResult,
  type ImportedSection,
} from '../lib/excel-import'
import { createProject, createWallSection, newId, now } from '../domain/factory'
import type { BrickType, Opening, Project, WallRun } from '../domain/types'
import { saveBrickType, saveProject } from '../storage/repo'
import { fmt } from './format'
import { navigate } from './router'
import { Button, Card, TextField, Warnings } from './components'

export function ExcelImport({ brickTypes }: { brickTypes: BrickType[] }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const read = async (file: File) => {
    setError(null)
    setResult(null)
    try {
      const parsed = readOldWorkbook(await file.arrayBuffer(), file.name)
      setResult(parsed)
      setName(parsed.projectName)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Die Datei ließ sich nicht lesen.')
    }
  }

  const commit = async () => {
    if (!result) return
    setBusy(true)
    try {
      const project = await buildProject(result, name.trim() || result.projectName, brickTypes)
      await saveProject(project)
      setResult(null)
      navigate({ view: 'project', id: project.id })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card
      title="Aus Excel übernehmen"
      actions={
        <Button variant="primary" onClick={() => fileInput.current?.click()}>
          Excel wählen
        </Button>
      }
    >
      <input
        ref={fileInput}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void read(file)
          e.target.value = ''
        }}
      />

      <p className="hint">
        Übernimmt Wandlängen, Fenster, Türen und die Kennwerte aus der alten
        Ziegelrechner-Mappe. Das Blatt „Bestellung“ bleibt außen vor.
      </p>

      {error && (
        <p className="lock-error" role="alert">
          {error}
        </p>
      )}

      {result && (
        <>
          <Warnings items={result.warnings} />
          <table className="table">
            <thead>
              <tr>
                <th>Blatt</th>
                <th className="num">Wandstärke</th>
                <th className="num">Längen</th>
                <th className="num">Fenster</th>
                <th className="num">Türen</th>
              </tr>
            </thead>
            <tbody>
              {result.sections.map((section) => (
                <tr key={section.sheetName}>
                  <td>{section.sheetName}</td>
                  <td className="num">{fmt(section.brick.wallThicknessCm)} cm</td>
                  <td className="num">{section.wallRuns.length}</td>
                  <td className="num">{count(section, 'window')}</td>
                  <td className="num">{count(section, 'door')}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {result.skippedSheets.length > 0 && (
            <p className="hint">
              Nicht übernommen: {result.skippedSheets.join(', ')}
            </p>
          )}

          <TextField label="Bezeichnung des Bauvorhabens" value={name} onChange={setName} />

          <div className="btn-row">
            <Button variant="primary" onClick={() => void commit()} disabled={busy}>
              {busy ? 'Wird übernommen …' : 'Übernehmen'}
            </Button>
            <Button onClick={() => setResult(null)}>Verwerfen</Button>
          </div>
        </>
      )}
    </Card>
  )
}

const count = (section: ImportedSection, kind: Opening['kind']): number =>
  section.openings.filter((o) => o.kind === kind).reduce((sum, o) => sum + o.count, 0)

/**
 * Baut aus dem Gelesenen ein Bauvorhaben.
 *
 * Ziegeltypen werden wiederverwendet, wenn Staerke und Kennwerte
 * uebereinstimmen. Sonst legte jeder Import denselben Typ erneut an und der
 * Katalog waere nach drei Dateien unbrauchbar.
 */
export async function buildProject(
  result: ImportResult,
  name: string,
  catalog: BrickType[],
): Promise<Project> {
  const project = createProject(name)
  const known = [...catalog]

  for (const imported of result.sections) {
    let brick = known.find((b) => matchesBrick(b, imported.brick))
    if (!brick) {
      brick = { ...imported.brick, id: newId(), updatedAt: now() }
      await saveBrickType(brick)
      known.push(brick)
    }

    const section = createWallSection(brick.id)
    section.label = imported.sheetName
    section.storeyHeightM = imported.storeyHeightM
    section.outerCorners = imported.outerCorners
    section.wallRuns = imported.wallRuns.map(
      (run): WallRun => ({ id: newId(), updatedAt: now(), ...run }),
    )
    section.openings = imported.openings.map(
      (opening): Opening => ({ id: newId(), updatedAt: now(), ...opening }),
    )
    project.sections.push(section)
  }

  return project
}
