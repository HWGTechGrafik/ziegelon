/**
 * Startseite: alle Bauvorhaben.
 *
 * Die alte Excel kannte nur ein Bauvorhaben je Datei. Hier liegen sie
 * nebeneinander, das zuletzt bearbeitete oben.
 */
import { useState } from 'react'
import { createProject } from '../domain/factory'
import type { Project } from '../domain/types'
import type { BrickType } from '../domain/types'
import { deleteProject, saveProject } from '../storage/repo'
import { ExcelImport } from './ExcelImport'
import { navigate } from './router'
import { Button, Card, Empty, TextField } from './components'

export function ProjectListView({
  projects,
  brickTypes,
}: {
  projects: Project[]
  brickTypes: BrickType[]
}) {
  const [name, setName] = useState('')

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

  return (
    <>
      {/* Zwei Wege zum selben Ziel - leer anfangen oder die alte Mappe uebernehmen. */}
      <div className="start-row">
        <ExcelImport brickTypes={brickTypes} />

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
      </div>

      <Card title="Bauvorhaben">
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
