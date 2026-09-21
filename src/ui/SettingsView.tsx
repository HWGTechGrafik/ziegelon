/**
 * Einstellungen: Darstellung und Auskunft zur Lizenz.
 */
import { DEFAULT_THEME, type Theme } from '../domain/types'
import { formatDate, type LicenseInfo } from '../lib/license'
import { IS_DEVELOPMENT_KEY } from '../lib/license-key'
import { saveTheme } from '../storage/repo'
import { Card } from './components'
import { applyTheme } from './theme'

const CHOICES: Array<{ value: Theme; label: string; hint: string }> = [
  { value: 'light', label: 'Hell', hint: 'Immer hell' },
  { value: 'dark', label: 'Dunkel', hint: 'Immer dunkel' },
  { value: 'system', label: 'System', hint: 'Folgt dem Gerät' },
]

export function SettingsView({
  theme,
  license,
}: {
  theme: Theme | undefined
  license: LicenseInfo
}) {
  const current = theme ?? DEFAULT_THEME

  const choose = (next: Theme) => {
    // Sofort anwenden, damit die Umschaltung nicht auf die Datenbank wartet.
    applyTheme(next)
    void saveTheme(next)
  }

  return (
    <>
      <Card title="Darstellung">
        <div className="choices" role="radiogroup" aria-label="Darstellung">
          {CHOICES.map((choice) => (
            <button
              key={choice.value}
              type="button"
              role="radio"
              aria-checked={current === choice.value}
              className={current === choice.value ? 'choice active' : 'choice'}
              onClick={() => choose(choice.value)}
            >
              <span className="choice-label">{choice.label}</span>
              <span className="choice-hint">{choice.hint}</span>
            </button>
          ))}
        </div>
        <p className="hint">
          Im dunklen Modus zeigt die Kopfzeile nur das Ziegelon-Symbol: der
          Schriftzug ist in Markendunkel gehalten und wäre dort nicht lesbar.
        </p>
      </Card>

      <Card title="Lizenz">
        <dl className="stats">
          <div className="stat">
            <dt>Lizenziert für</dt>
            <dd>{license.customer}</dd>
          </div>
          <div className="stat">
            <dt>Nummer</dt>
            <dd>{license.number}</dd>
          </div>
          <div className="stat">
            <dt>Ausgestellt</dt>
            <dd>{formatDate(license.issuedOn)}</dd>
          </div>
          <div className="stat">
            <dt>Gültig bis</dt>
            <dd>{license.expiresOn ? formatDate(license.expiresOn) : 'unbefristet'}</dd>
          </div>
        </dl>
        {IS_DEVELOPMENT_KEY && (
          <p className="lock-dev">
            Entwicklungsschlüssel aktiv – vor der Auslieferung im Lizenzgenerator
            ein eigenes Schlüsselpaar erzeugen.
          </p>
        )}
      </Card>
    </>
  )
}
