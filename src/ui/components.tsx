/**
 * Gemeinsame Bausteine der Oberflaeche.
 *
 * Die Felder sind bewusst gross und beschriftet: die App wird auf der
 * Baustelle am Handy bedient, oft mit Handschuhen und bei Sonnenlicht.
 */
import { useEffect, useId, useState, type ReactNode } from 'react'
import { parseNumber, toInput } from './format'

export function Card({
  title,
  actions,
  className,
  children,
}: {
  title?: ReactNode
  actions?: ReactNode
  /** Zusatzklasse fuer Karten, die sich abheben sollen - etwa card-section. */
  className?: string
  children: ReactNode
}) {
  return (
    <section className={className ? `card ${className}` : 'card'}>
      {(title || actions) && (
        <header className="card-head">
          {title && <h2>{title}</h2>}
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}

type ButtonProps = {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'danger'
  type?: 'button' | 'submit'
  disabled?: boolean
  title?: string
}

export function Button({
  children,
  onClick,
  variant = 'ghost',
  type = 'button',
  disabled = false,
  title,
}: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant}`}
      type={type}
      onClick={onClick}
      disabled={disabled}
      {...(title ? { title, 'aria-label': title } : {})}
    >
      {children}
    </button>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: (id: string) => ReactNode
}) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hint && <p className="hint">{hint}</p>}
    </div>
  )
}

/**
 * Zahleneingabe, die Komma und Punkt annimmt.
 *
 * Der Text wird lokal gehalten, damit Zwischenstaende wie "2," beim Tippen
 * nicht sofort zurueckgesetzt werden. Nach aussen geht nur, was sich lesen
 * laesst - Unsinn laesst den letzten gueltigen Wert stehen.
 */
export function NumberField({
  label,
  value,
  onChange,
  suffix,
  min,
  hint,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  suffix?: string
  min?: number
  hint?: string
}) {
  const [text, setText] = useState(() => toInput(value))

  // Wenn der Wert von aussen wechselt (anderer Datensatz), Feld nachziehen -
  // aber nicht, solange derselbe Wert nur anders geschrieben dasteht.
  useEffect(() => {
    const parsed = parseNumber(text)
    if (parsed === null || parsed !== value) setText(toInput(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const commit = (next: string) => {
    setText(next)
    const parsed = parseNumber(next)
    if (parsed === null) return
    if (min !== undefined && parsed < min) return
    onChange(parsed)
  }

  return (
    <Field label={label} {...(hint ? { hint } : {})}>
      {(id) => (
        <div className="input-wrap">
          <input
            id={id}
            className="input"
            type="text"
            inputMode="decimal"
            value={text}
            onChange={(e) => commit(e.target.value)}
            onBlur={() => setText(toInput(value))}
          />
          {suffix && <span className="suffix">{suffix}</span>}
        </div>
      )}
    </Field>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <Field label={label}>
      {(id) => (
        <input
          id={id}
          className="input"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...(placeholder ? { placeholder } : {})}
        />
      )}
    </Field>
  )
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <Field label={label}>
      {(id) => (
        <select
          id={id}
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value as T)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  hint?: string
}) {
  const id = useId()
  return (
    <div className="field toggle">
      <label htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span>{label}</span>
      </label>
      {hint && <p className="hint">{hint}</p>}
    </div>
  )
}

export function Warnings({ items }: { items: string[] }) {
  if (items.length === 0) return null
  const unique = [...new Set(items)]
  return (
    <ul className="warnings" role="alert">
      {unique.map((w) => (
        <li key={w}>{w}</li>
      ))}
    </ul>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>
}
