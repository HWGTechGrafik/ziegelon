/**
 * Meldung, wenn eine neuere Fassung bereitliegt.
 *
 * Aktualisiert wird auf Zuruf, nicht still. Ein automatisches Neuladen
 * verschluckt einen halb erfassten Wandabschnitt - auf der Baustelle tippt
 * man das nicht gern zweimal. Deshalb steht in vite.config.ts `prompt` und
 * nicht `autoUpdate`.
 *
 * Der Streifen legt sich unten quer, statt den Bildschirm zu sperren: wer
 * gerade misst, soll weiterarbeiten koennen. "Später" laesst ihn bis zum
 * naechsten Start verschwinden.
 */
import { useEffect, useRef, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'
import { Button } from './components'

export function UpdateHinweis() {
  const [bereit, setBereit] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  const einspielen = useRef<((neuLaden?: boolean) => Promise<void>) | null>(null)
  // React fuehrt Effekte im Entwicklungsmodus absichtlich zweimal aus. Ohne
  // diese Sperre meldete sich der Service Worker doppelt an.
  const angemeldet = useRef(false)

  useEffect(() => {
    if (angemeldet.current) return
    angemeldet.current = true
    einspielen.current = registerSW({
      onNeedRefresh: () => setBereit(true),
    })
  }, [])

  if (!bereit) return null

  return (
    <div className="update-hinweis" role="status">
      <p>
        <strong>Neue Version verfügbar.</strong> Beim Aktualisieren wird die App
        neu geladen – offene Eingaben vorher fertig eintragen.
      </p>
      <div className="update-schalter">
        <Button onClick={() => setBereit(false)}>Später</Button>
        <Button
          variant="primary"
          disabled={laeuft}
          onClick={() => {
            setLaeuft(true)
            void einspielen.current?.(true)
          }}
        >
          {laeuft ? 'Wird geladen …' : 'Jetzt aktualisieren'}
        </Button>
      </div>
    </div>
  )
}
