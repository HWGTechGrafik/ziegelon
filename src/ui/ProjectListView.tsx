/**
 * Startseite: alle Bauvorhaben.
 *
 * Die alte Excel kannte nur ein Bauvorhaben je Datei. Hier liegen sie
 * nebeneinander, das zuletzt bearbeitete oben.
 */
import { useRef, useState } from 'react'
import { createProject } from '../domain/factory'
import type { Project } from '../domain/types'
import { deleteProject, exportAll, importAll, saveProject } from '../storage/repo'
import { navigate } from './router'
import { Button, Card, Empty, TextField } from './components'

export function ProjectListView({ projects }: { projects: Project[] }) {
  const [name, setName] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)

  const add = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    const project = createProject(trimmed)
    await saveProject(project)
    setName('')
    navigate({ view: 'project', id: project.id })
  }

  const remove = async (project: Project) => {
    if (window.confirm(`Bauvorhaben "${project.name}" wirklich löschen?`)) {
      await deleteProject(project.id)
    }
  }

  const doExport = async () => {
    const json = await exportAll()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Ziegelon_Sicherung_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const doImport = async (file: File) => {
    try {
      const summary = await importAll(await file.text())
      setMessage(
        `${summary.projects} Bauvorhaben und ${summary.brickTypes} Ziegeltypen übernommen.`,
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Die Datei ließ sich nicht lesen.')
    }
  }

  return (
    <>
      <Card title="Neues Bauvorhaben">
        <div className="grid grid-2">
          <TextField
            label="Bezeichnung"
            value={name}
            onChange={setName}
            placeholder="z. B. Einfamilienhaus Huber"
          />
          <div className="field field-action">
            <Button variant="primary" onClick={() => void add()} disabled={!name.trim()}>
              Anlegen
            </Button>
          </div>
        </div>
      </Card>

      <Card
        title="Bauvorhaben"
        actions={
          <>
            <Button onClick={() => void doExport()}>Sichern</Button>
            <Button onClick={() => fileInput.current?.click()}>Einspielen</Button>
          </>
        }
      >
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void doImport(file)
            e.target.value = ''
          }}
        />
        {message && <p className="hint">{message}</p>}

        {projects.length === 0 ? (
          <Empty>Noch kein Bauvorhaben angelegt.</Empty>
        ) : (
          <ul className="project-list">
            {projects.map((project) => (
              <li key={project.id}>
                <button
                  className="project-open"
                  type="button"
                  aria-label={`Bauvorhaben ${project.name} öffnen`}
                  onClick={() => navigate({ view: 'project', id: project.id })}
                >
                  <span className="project-name">{project.name}</span>
                  <span className="project-meta">
                    {project.sections.filter((s) => !s.deletedAt).length} Wandabschnitte ·
                    zuletzt {new Date(project.updatedAt).toLocaleDateString('de-AT')}
                  </span>
                </button>
                <Button variant="danger" onClick={() => void remove(project)}>
                  Löschen
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
