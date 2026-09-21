/**
 * Sperrbildschirm. Ohne gueltige Lizenz laeuft nichts.
 *
 * **Hier gibt es bewusst keinen Generator.** Ein Generator vor der Sperre
 * macht die Sperre wertlos - jeder erzeugt sich selbst einen Schluessel.
 * Schluessel gibt der Betrieb mit der nicht mitgelieferten Datei unter
 * `privat/lizenzgenerator/` aus.
 *
 * Der Schluessel wird eingefuegt, nicht getippt: eine Signatur ist zu lang
 * zum Abtippen. Deshalb gibt es zusaetzlich den Weg ueber eine Lizenzdatei.
 */
import { useRef, useState } from 'react'
import logo from '../assets/branding/derived/Ziegelon_logo.png'
import { IS_DEVELOPMENT_KEY } from '../lib/license-key'
import { formatDate, verifyLicense, type LicenseInfo } from '../lib/license'
import { saveLicense } from '../storage/repo'

export function LockScreen({ onUnlocked }: { onUnlocked: (info: LicenseInfo) => void }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const submit = async (value: string) => {
    const candidate = value.trim()
    if (!candidate) return
    setBusy(true)
    setError(null)
    const result = await verifyLicense(candidate)
    setBusy(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    await saveLicense(candidate)
    onUnlocked(result.info)
  }

  const readFile = async (file: File) => {
    const text = await file.text()
    setInput(text.trim())
    await submit(text)
  }

  return (
    <div className="lock">
      <div className="lock-box">
        <img className="lock-logo" src={logo} alt="Ziegelon" />
        <p className="lead">
          Bitte einmalig den Lizenzschlüssel einfügen. Danach fragt die App nicht
          mehr danach.
        </p>

        <label className="field" htmlFor="license">
          <span>Lizenzschlüssel</span>
          <textarea
            id="license"
            className={error ? 'input textarea wrong' : 'input textarea'}
            rows={4}
            spellCheck={false}
            autoComplete="off"
            placeholder="ZGL1.…"
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              setError(null)
            }}
          />
        </label>

        {error && (
          <p className="lock-error" role="alert">
            {error}
          </p>
        )}

        <div className="btn-row">
          <button
            type="button"
            className="btn btn-primary lock-main"
            disabled={busy || !input.trim()}
            onClick={() => void submit(input)}
          >
            {busy ? 'Wird geprüft …' : 'Freischalten'}
          </button>
          <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
            Lizenzdatei wählen
          </button>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept=".ziegelon,.txt,text/plain"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void readFile(file)
            e.target.value = ''
          }}
        />

        <p className="hint">
          Den Schlüssel bekommst du von dem, der dir die App gegeben hat.
        </p>

        {IS_DEVELOPMENT_KEY && (
          <p className="lock-dev" role="status">
            Entwicklungsschlüssel aktiv – vor der Auslieferung im Lizenzgenerator
            ein eigenes Schlüsselpaar erzeugen.
          </p>
        )}
      </div>
    </div>
  )
}

/** Zeile fuer die Fusszeile: auf wen die Lizenz laeuft. */
export function LicenseLine({ info }: { info: LicenseInfo }) {
  return (
    <p className="license-line">
      Lizenziert für {info.customer}
      {info.expiresOn ? ` · gültig bis ${formatDate(info.expiresOn)}` : ''}
    </p>
  )
}
