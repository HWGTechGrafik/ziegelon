/**
 * Editor fuer einen Wandabschnitt - das Gegenstueck zu einem Tabellenblatt
 * der alten Excel, nur ohne dessen Zeilenlimit.
 *
 * Das Ergebnis steht direkt unter der Eingabe und rechnet beim Tippen mit.
 * In der Excel musste man dafuer ans andere Ende des Blatts scrollen.
 */
import {
  BEARING_MAX_CM,
  BEARING_MIN_CM,
  type BrickType,
  type Opening,
  type WallRun,
  type WallSection,
} from '../domain/types'
import { createOpening, createWallRun, newId, now } from '../domain/factory'
import type { SectionResult } from '../calc/section'
import { fmt, fmtInt, fmtM } from './format'
import {
  Button,
  Card,
  NumberField,
  SelectField,
  TextField,
  Toggle,
  Warnings,
} from './components'

interface Props {
  section: WallSection
  brickTypes: BrickType[]
  result: SectionResult | null
  onChange: (section: WallSection) => void
  onDelete: () => void
  onDuplicate: () => void
}

export function SectionCard({
  section,
  brickTypes,
  result,
  onChange,
  onDelete,
  onDuplicate,
}: Props) {
  const patch = (changes: Partial<WallSection>) =>
    onChange({ ...section, ...changes, updatedAt: now() })

  const patchRun = (id: string, changes: Partial<WallRun>) =>
    patch({
      wallRuns: section.wallRuns.map((r) =>
        r.id === id ? { ...r, ...changes, updatedAt: now() } : r,
      ),
    })

  const patchOpening = (id: string, changes: Partial<Opening>) =>
    patch({
      openings: section.openings.map((o) =>
        o.id === id ? { ...o, ...changes, updatedAt: now() } : o,
      ),
    })

  const brick = brickTypes.find((b) => b.id === section.brickTypeId)

  // Die meisten Abschnitte heissen nach ihrer Staerke. Dann stuende die
  // Zahl zweimal nebeneinander - einmal als Ueberschrift, einmal als
  // Abzeichen. Das Abzeichen traegt nur, was die Ueberschrift nicht sagt.
  const staerke = brick ? `${fmt(brick.wallThicknessCm)} cm` : null
  const zeigtStaerke =
    staerke !== null && (section.label ?? '').replace(/\s/g, '') !== staerke.replace(/\s/g, '')

  return (
    <Card
      title={
        <span className="section-title">
          {section.label || 'Wandabschnitt'}
          {zeigtStaerke && <span className="badge">{staerke}</span>}
        </span>
      }
      actions={
        <>
          <Button onClick={onDuplicate} title="Abschnitt kopieren">
            Kopieren
          </Button>
          <Button variant="danger" onClick={onDelete} title="Abschnitt loeschen">
            Löschen
          </Button>
        </>
      }
    >
      <div className="grid grid-2">
        <TextField
          label="Bezeichnung"
          value={section.label ?? ''}
          onChange={(label) => patch({ label })}
          placeholder="z. B. Erdgeschoss Außenwand"
        />
        <SelectField
          label="Ziegeltyp"
          value={section.brickTypeId}
          options={brickTypes.map((b) => ({ value: b.id, label: b.name }))}
          onChange={(brickTypeId) => patch({ brickTypeId })}
        />
      </div>

      <div className="grid grid-3">
        <NumberField
          label="Geschoßhöhe"
          suffix="m"
          min={0}
          value={section.storeyHeightM}
          onChange={(storeyHeightM) => patch({ storeyHeightM })}
        />
        <NumberField
          label="Außenecken"
          suffix="Stk"
          min={0}
          value={section.outerCorners}
          onChange={(outerCorners) => patch({ outerCorners })}
        />
        <NumberField
          label="Auflage je Seite"
          suffix="cm"
          min={BEARING_MIN_CM}
          value={section.bearingCmPerSide}
          onChange={(bearingCmPerSide) => patch({ bearingCmPerSide })}
          hint={`zulässig ${BEARING_MIN_CM}–${BEARING_MAX_CM} cm`}
        />
      </div>

      {section.bearingCmPerSide > BEARING_MAX_CM && (
        <Warnings items={[`Die Auflage liegt über ${BEARING_MAX_CM} cm.`]} />
      )}

      <Toggle
        label="Türlaibungen mitzählen"
        checked={section.countDoorJambs}
        onChange={(countDoorJambs) => patch({ countDoorJambs })}
        hint="Aus, wenn die Türen ohne gemauerte Laibung ausgeführt werden."
      />

      <h3 className="sub">Wandlängen</h3>
      {section.wallRuns.length === 0 && (
        <p className="empty">Noch keine Wandlänge erfasst.</p>
      )}
      <div className="rows">
        {section.wallRuns.map((run) => (
          <div className="row row-run" key={run.id}>
            <NumberField
              label="Länge"
              suffix="m"
              min={0}
              value={run.lengthM}
              onChange={(lengthM) => patchRun(run.id, { lengthM })}
            />
            <NumberField
              label="Anzahl"
              suffix="Stk"
              min={0}
              value={run.count}
              onChange={(count) => patchRun(run.id, { count })}
            />
            <Button
              variant="danger"
              title="Zeile löschen"
              onClick={() =>
                patch({ wallRuns: section.wallRuns.filter((r) => r.id !== run.id) })
              }
            >
              ×
            </Button>
          </div>
        ))}
      </div>
      <Button
        variant="primary"
        onClick={() => patch({ wallRuns: [...section.wallRuns, createWallRun()] })}
      >
        + Wandlänge
      </Button>

      <h3 className="sub">Öffnungen</h3>
      {section.openings.length === 0 && (
        <p className="empty">Noch keine Öffnung erfasst.</p>
      )}
      <div className="rows">
        {section.openings.map((opening) => (
          <div className="row row-opening" key={opening.id}>
            <SelectField
              label="Art"
              value={opening.kind}
              options={[
                { value: 'window', label: 'Fenster' },
                { value: 'door', label: 'Tür' },
              ]}
              onChange={(kind) => patchOpening(opening.id, { kind })}
            />
            <NumberField
              label="Breite"
              suffix="m"
              min={0}
              value={opening.widthM}
              onChange={(widthM) => patchOpening(opening.id, { widthM })}
            />
            <NumberField
              label="Höhe"
              suffix="m"
              min={0}
              value={opening.heightM}
              onChange={(heightM) => patchOpening(opening.id, { heightM })}
            />
            <NumberField
              label="Anzahl"
              suffix="Stk"
              min={0}
              value={opening.count}
              onChange={(count) => patchOpening(opening.id, { count })}
            />
            <Button
              variant="danger"
              title="Zeile löschen"
              onClick={() =>
                patch({ openings: section.openings.filter((o) => o.id !== opening.id) })
              }
            >
              ×
            </Button>
          </div>
        ))}
      </div>
      <div className="btn-row">
        <Button
          variant="primary"
          onClick={() =>
            patch({ openings: [...section.openings, createOpening('window')] })
          }
        >
          + Fenster
        </Button>
        <Button
          variant="primary"
          onClick={() =>
            patch({ openings: [...section.openings, createOpening('door')] })
          }
        >
          + Tür
        </Button>
      </div>

      {result && <SectionResultView result={result} />}
    </Card>
  )
}

function SectionResultView({ result }: { result: SectionResult }) {
  return (
    <div className="result">
      <h3 className="sub">Ergebnis</h3>
      <Warnings items={result.warnings} />
      <dl className="stats">
        <Stat label="Wandfläche brutto" value={`${fmt(result.grossAreaSqm)} m²`} />
        <Stat
          label="Öffnungen"
          value={`${fmt(result.windowAreaSqm + result.doorAreaSqm)} m²`}
        />
        <Stat label="Wandfläche netto" value={`${fmt(result.netAreaSqm)} m²`} strong />
        <Stat
          label="Ziegel"
          value={`${fmtInt(result.bricks)} Stk`}
          note={`${fmtInt(result.brickPallets)} Paletten · ${fmtInt(result.brickRemainder)} Stk Rest`}
          strong
        />
        <Stat
          label="Laibung"
          value={`${fmtInt(result.jambBricks)} Stk`}
          note={`${fmtInt(result.jambPallets)} Paletten`}
        />
        <Stat
          label="Ecksteine"
          value={`${fmtInt(result.cornerBricks)} Stk`}
          note={`${fmtInt(result.cornerPallets)} Paletten`}
        />
      </dl>
      {result.lintels.length > 0 && (
        <>
          <table className="table">
            <thead>
              <tr>
                <th>Überleger</th>
                <th className="num">Stück</th>
              </tr>
            </thead>
            <tbody>
              {result.lintels.map((l) => (
                <tr key={l.lengthM}>
                  <td>{fmtM(l.lengthM)}</td>
                  <td className="num">{fmt(l.pieces)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">
            Überleger werden je Öffnung nicht gerundet. Aufgerundet wird erst die
            Summe über alle Abschnitte – siehe Bedarf und Bestellung.
          </p>
        </>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  note,
  strong = false,
}: {
  label: string
  value: string
  note?: string
  strong?: boolean
}) {
  return (
    <div className={strong ? 'stat stat-strong' : 'stat'}>
      <dt>{label}</dt>
      <dd>
        {value}
        {note && <span className="stat-note">{note}</span>}
      </dd>
    </div>
  )
}

/** Kopiert einen Abschnitt inklusive aller Zeilen mit frischen IDs. */
export function duplicateSection(section: WallSection): WallSection {
  const ts = now()
  const copy: WallSection = {
    ...section,
    id: newId(),
    updatedAt: ts,
    wallRuns: section.wallRuns.map((r) => ({ ...r, id: newId(), updatedAt: ts })),
    openings: section.openings.map((o) => ({ ...o, id: newId(), updatedAt: ts })),
  }
  // Nur setzen, wenn es eine Bezeichnung gibt - sonst bliebe ein leeres Feld
  // mit dem Zusatz "(Kopie)" stehen.
  if (section.label) copy.label = `${section.label} (Kopie)`
  return copy
}
