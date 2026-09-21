/**
 * Sicherung schreiben und wieder einspielen.
 *
 * Steht in den Einstellungen und nicht bei den Bauvorhaben: gesichert wird
 * immer alles - Bauvorhaben und Ziegel-Katalog zusammen -, das gehoert nicht
 * in eine Karte, die nur die Liste der Bauvorhaben fuehrt.
 */
import { useRef, useState } from 'react'
import { exportAll, importAll } from '../storage/repo'
import { Button, Card } from './components'

export function BackupCard() {
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const doExport = async () => {
    const json = await exportAll()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Ziegelon_Sicherung_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setFailed(false)
    setMessage('Sicherung gespeichert.')
  }

  const doImport = async (file: File) => {
    try {
      const summary = await importAll(await file.text())
      setFailed(false)
      setMessage(
        `${summary.projects} Bauvorhaben und ${summary.brickTypes} Ziegeltypen übernommen.`,
      )
    } catch (error) {
      setFailed(true)
      setMessage(error instanceof Error ? error.message : 'Die Datei ließ sich nicht lesen.')
    }
  }

  return (
    <Card
      title="Sicherung"
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
      <p className="hint">
        „Sichern“ legt alle Bauvorhaben und den Ziegel-Katalog in einer Datei ab –
        der Weg auf ein zweites Gerät und zurück. Beim Einspielen bleibt
        bestehen, was hier neuer ist als in der Datei; gelöscht wird nichts.
        Die Lizenz gehört zum Gerät und steht nicht in der Sicherung.
      </p>
      {message &&
        (failed ? (
          <p className="lock-error" role="alert">
            {message}
          </p>
        ) : (
          <p className="hint">{message}</p>
        ))}
    </Card>
  )
}
