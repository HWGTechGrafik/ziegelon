/**
 * Ziegel-Katalog.
 *
 * Tritt an die Stelle der vier fest verdrahteten Tabellenblaetter der alten
 * Excel: was dort je Blatt in den Zellen O3 bis O21 stand, ist hier ein
 * pflegbarer Datensatz. Neue Wandstaerken oder ein Lieferantenwechsel
 * brauchen damit keine Codeaenderung mehr.
 */
import { useState } from 'react'
import { newId, now } from '../domain/factory'
import type { BrickType } from '../domain/types'
import { saveBrickType, deleteBrickType } from '../storage/repo'
import { fmt } from './format'
import { useCatalogExcel } from './CatalogExcel'
import { Button, Card, Empty, NumberField, TextField } from './components'

export function CatalogView({ brickTypes }: { brickTypes: BrickType[] }) {
  const excel = useCatalogExcel(brickTypes)

  const addType = () =>
    void saveBrickType({
      id: newId(),
      updatedAt: now(),
      name: 'Neuer Ziegeltyp',
      wallThicknessCm: 25,
      bricksPerSqm: 10.7,
      bricksPerPallet: 30,
      jambBricksPerPallet: 54,
      cornerBricksPerPallet: 21,
      lintelWidthCm: 12,
    })

  return (
    <>
      <Card
        title="Ziegel-Katalog"
        actions={
          <>
            {excel.actions}
            <Button variant="primary" onClick={addType}>
              + Ziegeltyp
            </Button>
          </>
        }
      >
        <p className="hint">
          Diese Werte bestimmen die Berechnung. Die Überlegerbreite legt fest, wie
          viele Überleger nebeneinander in die Wandstärke passen. „Als Excel“ gibt
          den Katalog als Tabelle aus; beim Einlesen zählt die Spalte „Kennung“,
          nur damit findet ein umbenannter Ziegeltyp zu sich selbst zurück.
          Gelöscht wird dabei nichts.
        </p>
        {excel.panel}
        {brickTypes.length === 0 && <Empty>Noch kein Ziegeltyp angelegt.</Empty>}
      </Card>

      {brickTypes.map((brick) => (
        <BrickTypeCard key={brick.id} brick={brick} />
      ))}
    </>
  )
}

/**
 * Ein Ziegeltyp, zugeklappt.
 *
 * Mit allen Feldern offen wird die Seite bei einem Dutzend Typen unuebersichtlich
 * und man scrollt an dem vorbei, was man sucht. Die zugeklappte Zeile zeigt
 * deshalb die Kennwerte, die man im Alltag vergleicht - Staerke, Ziegel je m2
 * und je Palette.
 */
function BrickTypeCard({ brick }: { brick: BrickType }) {
  const [open, setOpen] = useState(false)

  const patch = (changes: Partial<BrickType>) =>
    void saveBrickType({ ...brick, ...changes })

  const remove = () => {
    if (window.confirm(`Ziegeltyp "${brick.name}" wirklich löschen?`)) {
      void deleteBrickType(brick.id)
    }
  }

  const summary =
    `${fmt(brick.wallThicknessCm)} cm · ${fmt(brick.bricksPerSqm)} Stk/m² · ` +
    `${fmt(brick.bricksPerPallet)} Stk/Pal`

  return (
    <Card
      title={
        <button
          type="button"
          className="disclosure"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <span className={open ? 'disclosure-mark open' : 'disclosure-mark'} aria-hidden="true">
            ›
          </span>
          <span className="disclosure-text">
            <span className="disclosure-title">{brick.name}</span>
            <span className="disclosure-summary">{summary}</span>
          </span>
        </button>
      }
      actions={
        open ? (
          <Button variant="danger" onClick={remove}>
            Löschen
          </Button>
        ) : (
          <Button onClick={() => setOpen(true)}>Bearbeiten</Button>
        )
      }
    >
      {!open ? null : (
      <>
      <div className="grid grid-2">
        <TextField
          label="Bezeichnung"
          value={brick.name}
          onChange={(name) => patch({ name })}
        />
        <NumberField
          label="Wandstärke"
          suffix="cm"
          min={0}
          value={brick.wallThicknessCm}
          onChange={(wallThicknessCm) => patch({ wallThicknessCm })}
        />
      </div>
      <div className="grid grid-3">
        <NumberField
          label="Ziegel je m²"
          suffix="Stk"
          min={0}
          value={brick.bricksPerSqm}
          onChange={(bricksPerSqm) => patch({ bricksPerSqm })}
        />
        <NumberField
          label="Ziegel je Palette"
          suffix="Stk"
          min={1}
          value={brick.bricksPerPallet}
          onChange={(bricksPerPallet) => patch({ bricksPerPallet })}
        />
        <NumberField
          label="Überlegerbreite"
          suffix="cm"
          min={1}
          value={brick.lintelWidthCm}
          onChange={(lintelWidthCm) => patch({ lintelWidthCm })}
          hint={`ergibt ${(brick.wallThicknessCm / brick.lintelWidthCm).toLocaleString(
            'de-AT',
            { maximumFractionDigits: 2 },
          )} Stück je Öffnung`}
        />
      </div>
      <div className="grid grid-2">
        <NumberField
          label="Laibungsziegel je Palette"
          suffix="Stk"
          min={1}
          value={brick.jambBricksPerPallet}
          onChange={(jambBricksPerPallet) => patch({ jambBricksPerPallet })}
        />
        <NumberField
          label="Ecksteine je Palette"
          suffix="Stk"
          min={1}
          value={brick.cornerBricksPerPallet}
          onChange={(cornerBricksPerPallet) => patch({ cornerBricksPerPallet })}
        />
      </div>
      </>
      )}
    </Card>
  )
}
