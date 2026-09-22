/**
 * Ein Bauvorhaben: Wandabschnitte erfassen, Bedarf ablesen, Bestellung fuehren.
 *
 * Gerechnet wird bei jeder Aenderung neu. Gespeichert wird ebenfalls sofort -
 * es gibt keinen Speichern-Knopf, weil auf der Baustelle niemand daran denkt.
 */
import { useMemo, useState } from 'react'
import { calcProject } from '../calc/project'
import { createWallSection, now } from '../domain/factory'
import type { BrickType, Project, WallSection } from '../domain/types'
import { saveProject } from '../storage/repo'
import { DemandView } from './DemandView'
import { SectionCard, duplicateSection } from './SectionCard'
import { navigate } from './router'
import { fmt, fmtInt } from './format'
import { Button, Card, Empty, TextField, Warnings } from './components'

type Tab = 'walls' | 'demand'

export function ProjectView({
  project,
  brickTypes,
  countJambs,
}: {
  project: Project
  brickTypes: BrickType[]
  /** Vorgabe aus den Einstellungen fuer neu angelegte Abschnitte. */
  countJambs: boolean
}) {
  const [tab, setTab] = useState<Tab>('walls')
  // Ein gerade angelegter oder kopierter Abschnitt geht offen auf. Sonst
  // sieht es so aus, als haette der Knopf nichts getan.
  const [zuletztAngelegt, setZuletztAngelegt] = useState<string | null>(null)

  const result = useMemo(
    () => calcProject(project, brickTypes),
    [project, brickTypes],
  )

  const update = (next: Project) => void saveProject(next)

  const sections = project.sections.filter((s) => !s.deletedAt)

  const addSection = () => {
    const first = brickTypes[0]
    if (!first) return
    const abschnitt = createWallSection(first.id, countJambs)
    setZuletztAngelegt(abschnitt.id)
    update({ ...project, sections: [...project.sections, abschnitt] })
  }

  const patchSection = (section: WallSection) =>
    update({
      ...project,
      sections: project.sections.map((s) => (s.id === section.id ? section : s)),
    })

  const removeSection = (id: string) =>
    update({
      ...project,
      sections: project.sections.map((s) =>
        s.id === id ? { ...s, deletedAt: now(), updatedAt: now() } : s,
      ),
    })

  const copySection = (section: WallSection) => {
    const kopie = duplicateSection(section)
    setZuletztAngelegt(kopie.id)
    update({ ...project, sections: [...project.sections, kopie] })
  }

  const totals = result.demand.reduce(
    (acc, row) => {
      if (row.unit === 'Paletten') acc.pallets += row.required
      else acc.lintels += row.required
      return acc
    },
    { pallets: 0, lintels: 0 },
  )

  return (
    <>
      <Card
        title={project.name}
        actions={
          <Button onClick={() => navigate({ view: 'projects' })}>Zurück</Button>
        }
      >
        <div className="grid grid-2">
          <TextField
            label="Bezeichnung"
            value={project.name}
            onChange={(name) => update({ ...project, name })}
          />
          <TextField
            label="Kunde"
            value={project.customer ?? ''}
            onChange={(customer) => update({ ...project, customer })}
            placeholder="optional"
          />
        </div>
        <dl className="stats stats-top">
          <div className="stat stat-strong">
            <dt>Paletten gesamt</dt>
            <dd>{fmtInt(totals.pallets)}</dd>
          </div>
          <div className="stat stat-strong">
            <dt>Überleger gesamt</dt>
            <dd>{fmtInt(totals.lintels)} Stk</dd>
          </div>
          <div className="stat">
            <dt>Wandabschnitte</dt>
            <dd>{fmt(sections.length)}</dd>
          </div>
        </dl>
        <Warnings items={result.warnings} />
      </Card>

      <nav className="tabs no-print">
        <button
          type="button"
          className={tab === 'walls' ? 'tab active' : 'tab'}
          onClick={() => setTab('walls')}
        >
          Wände
        </button>
        <button
          type="button"
          className={tab === 'demand' ? 'tab active' : 'tab'}
          onClick={() => setTab('demand')}
        >
          Bedarf und Bestellung
        </button>
      </nav>

      {tab === 'walls' ? (
        <>
          {sections.length === 0 && (
            <Card>
              <Empty>
                {brickTypes.length === 0
                  ? 'Lege zuerst im Katalog einen Ziegeltyp an.'
                  : 'Noch kein Wandabschnitt. Ein Abschnitt entspricht einer Wandstärke in einem Geschoss.'}
              </Empty>
            </Card>
          )}
          {sections.length > 0 && (
            <div className="group-head">
              <h3>Wandabschnitte</h3>
              <span className="badge">{fmt(sections.length)}</span>
              <span className="group-rule" aria-hidden="true" />
            </div>
          )}
          {sections.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              brickTypes={brickTypes}
              result={result.sections.find((r) => r.sectionId === section.id) ?? null}
              onChange={patchSection}
              onDelete={() => removeSection(section.id)}
              onDuplicate={() => copySection(section)}
              defaultOpen={section.id === zuletztAngelegt}
            />
          ))}
          <div className="btn-row">
            <Button
              variant="primary"
              onClick={addSection}
              disabled={brickTypes.length === 0}
            >
              + Wandabschnitt
            </Button>
          </div>
        </>
      ) : (
        <DemandView project={project} rows={result.demand} onChange={update} />
      )}
    </>
  )
}
