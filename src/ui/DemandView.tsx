/**
 * Bedarf und Bestellung - das Gegenstueck zum Excel-Blatt "Bestellung".
 *
 * Der entscheidende Unterschied: der Ueberlegerbedarf entsteht hier von selbst
 * aus den erfassten Oeffnungen. In der Excel musste man dafuer die Tabelle
 * nach Laenge filtern und die Stueckzahlen von Hand herueberschreiben.
 */
import { Fragment, useState } from 'react'
import type { DemandRow } from '../calc/project'
import { targetKey } from '../calc/project'
import { newId, now } from '../domain/factory'
import type { OrderEntry, Project, StockEntry } from '../domain/types'
import { fmt, fmtInt } from './format'
import { Button, Card, Empty, NumberField, TextField } from './components'

interface Props {
  project: Project
  rows: DemandRow[]
  onChange: (project: Project) => void
}

const today = () => new Date().toISOString().slice(0, 10)

export function DemandView({ project, rows, onChange }: Props) {
  const [openKey, setOpenKey] = useState<string | null>(null)

  if (rows.length === 0) {
    return (
      <Card title="Bedarf und Bestellung">
        <Empty>
          Noch kein Bedarf. Erfasse zuerst Wandabschnitte mit Längen und Öffnungen.
        </Empty>
      </Card>
    )
  }

  const totalOpen = rows.filter((r) => r.open > 0).length

  return (
    <Card
      title="Bedarf und Bestellung"
      actions={<Button onClick={() => window.print()}>Drucken / PDF</Button>}
    >
      <p className="hint no-print">
        {totalOpen === 0
          ? 'Alles bestellt oder durch Restbestand gedeckt.'
          : `${totalOpen} Position${totalOpen === 1 ? '' : 'en'} noch offen.`}
      </p>

      <table className="table table-demand">
        <thead>
          <tr>
            <th>Position</th>
            <th className="num">Bedarf</th>
            <th className="num">bestellt</th>
            <th className="num">Rest</th>
            <th className="num">offen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const key = targetKey(row.target)
            const isOpen = openKey === key
            return (
              <Fragment key={key}>
                <tr
                  className={isOpen ? 'row-open' : ''}
                  onClick={() => setOpenKey(isOpen ? null : key)}
                >
                  <td>
                    <span className="link-like">{row.label}</span>
                    <span className="unit">{row.unit}</span>
                  </td>
                  <td className="num strong">{fmtInt(row.required)}</td>
                  <td className="num">{fmtInt(row.ordered)}</td>
                  <td className="num">{fmtInt(row.inStock)}</td>
                  <td className={row.open > 0 ? 'num open' : 'num done'}>
                    {row.open > 0 ? fmtInt(row.open) : '–'}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="detail-row no-print">
                    <td colSpan={5}>
                      <RowDetail project={project} row={row} onChange={onChange} />
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </Card>
  )
}

function RowDetail({
  project,
  row,
  onChange,
}: {
  project: Project
  row: DemandRow
  onChange: (project: Project) => void
}) {
  const key = targetKey(row.target)
  const [quantity, setQuantity] = useState(Math.max(0, row.open))
  const [orderedOn, setOrderedOn] = useState(today())
  const [note, setNote] = useState('')

  const orders = project.orders.filter((o) => !o.deletedAt && targetKey(o.target) === key)
  const stock = project.stock.find((s) => !s.deletedAt && targetKey(s.target) === key)

  const addOrder = () => {
    if (quantity <= 0) return
    const entry: OrderEntry = {
      id: newId(),
      updatedAt: now(),
      target: row.target,
      quantity,
      orderedOn,
    }
    if (note.trim()) entry.note = note.trim()
    onChange({ ...project, orders: [...project.orders, entry] })
    setNote('')
  }

  const removeOrder = (id: string) =>
    onChange({
      ...project,
      orders: project.orders.map((o) =>
        o.id === id ? { ...o, deletedAt: now(), updatedAt: now() } : o,
      ),
    })

  const setStock = (value: number) => {
    if (stock) {
      onChange({
        ...project,
        stock: project.stock.map((s) =>
          s.id === stock.id ? { ...s, quantity: value, updatedAt: now() } : s,
        ),
      })
      return
    }
    const entry: StockEntry = {
      id: newId(),
      updatedAt: now(),
      target: row.target,
      quantity: value,
    }
    onChange({ ...project, stock: [...project.stock, entry] })
  }

  return (
    <div className="detail">
      <div className="detail-cols">
        <div>
          <h4>Bestellungen</h4>
          {orders.length === 0 && <Empty>Noch nichts bestellt.</Empty>}
          <ul className="bookings">
            {orders.map((o) => (
              <li key={o.id}>
                <span className="qty">
                  {fmtInt(o.quantity)} {row.unit}
                </span>
                <span className="date">
                  {new Date(o.orderedOn).toLocaleDateString('de-AT')}
                </span>
                {o.note && <span className="note">{o.note}</span>}
                <Button variant="danger" title="Buchung löschen" onClick={() => removeOrder(o.id)}>
                  ×
                </Button>
              </li>
            ))}
          </ul>

          <div className="grid grid-3">
            <NumberField
              label="Menge"
              suffix={row.unit === 'Paletten' ? 'Pal' : 'Stk'}
              min={0}
              value={quantity}
              onChange={setQuantity}
            />
            <div className="field">
              <label htmlFor={`date-${key}`}>Datum</label>
              <input
                id={`date-${key}`}
                className="input"
                type="date"
                value={orderedOn}
                onChange={(e) => setOrderedOn(e.target.value)}
              />
            </div>
            <TextField label="Notiz" value={note} onChange={setNote} placeholder="optional" />
          </div>
          <Button variant="primary" onClick={addOrder} disabled={quantity <= 0}>
            Bestellung buchen
          </Button>
        </div>

        <div>
          <h4>Restbestand</h4>
          <NumberField
            label="Vorhanden"
            suffix={row.unit === 'Paletten' ? 'Pal' : 'Stk'}
            min={0}
            value={stock?.quantity ?? 0}
            onChange={setStock}
            hint="Wird vom Bedarf abgezogen, bevor bestellt wird."
          />
          <p className="hint">
            Bedarf {fmt(row.required)} − bestellt {fmt(row.ordered)} − Rest{' '}
            {fmt(row.inStock)} = <strong>offen {fmt(row.open)}</strong>
          </p>
        </div>
      </div>
    </div>
  )
}
