/**
 * Rahmen der App: Lizenzpruefung, Kopfzeile, Navigation, Auswahl der Ansicht.
 */
import { useEffect, useState } from 'react'
import logo from './assets/branding/derived/Ziegelon_logo.png'
import symbol from './assets/branding/derived/Ziegelon_symbol.png'
import { verifyLicense, type LicenseInfo } from './lib/license'
import { DEFAULT_COUNT_JAMBS, DEFAULT_THEME, type Theme } from './domain/types'
import { seedCatalogIfEmpty } from './storage/repo'
import { useBrickTypes, useProject, useProjects, useSettings } from './storage/hooks'
import { CatalogView } from './ui/CatalogView'
import { SettingsView } from './ui/SettingsView'
import { applyTheme } from './ui/theme'
import { LicenseLine, LockScreen } from './ui/LockScreen'
import { ProjectListView } from './ui/ProjectListView'
import { ProjectView } from './ui/ProjectView'
import { UpdateHinweis } from './ui/UpdateHinweis'
import { hrefFor, navigate, useRoute } from './ui/router'
import { VERSION_KURZ } from './version'

export function App() {
  const settings = useSettings()
  const [license, setLicense] = useState<LicenseInfo | null>(null)
  const [licenseChecked, setLicenseChecked] = useState(false)

  // Der gespeicherte Schluessel wird bei jedem Start neu geprueft, nicht nur
  // einmal beim Eintippen. Sonst liefe eine befristete Lizenz nach dem
  // Ablaufdatum einfach weiter.
  useEffect(() => {
    if (settings === undefined) return
    const stored = settings?.license
    if (!stored) {
      setLicense(null)
      setLicenseChecked(true)
      return
    }
    let current = true
    void verifyLicense(stored).then((result) => {
      if (!current) return
      setLicense(result.ok ? result.info : null)
      setLicenseChecked(true)
    })
    return () => {
      current = false
    }
  }, [settings])

  // Die gespeicherte Wahl gewinnt ueber den Zwischenspeicher, sobald sie da
  // ist - etwa nach dem Einspielen einer Sicherung auf einem anderen Geraet.
  const theme = settings?.theme
  useEffect(() => {
    if (theme) applyTheme(theme)
  }, [theme])

  if (!licenseChecked) return <p className="empty">Wird geladen …</p>
  // Der Hinweis liegt ausserhalb der Sperre: auch ein noch nicht
  // freigeschaltetes Geraet soll die neuere Fassung holen koennen.
  if (!license)
    return (
      <>
        <LockScreen onUnlocked={setLicense} />
        <UpdateHinweis />
      </>
    )

  return (
    <Shell
      license={license}
      theme={theme ?? DEFAULT_THEME}
      countJambs={settings?.countJambs ?? DEFAULT_COUNT_JAMBS}
    />
  )
}

function Shell({
  license,
  theme,
  countJambs,
}: {
  license: LicenseInfo
  theme: Theme
  countJambs: boolean
}) {
  const route = useRoute()
  const projects = useProjects()
  const brickTypes = useBrickTypes()
  const lookup = useProject(route.view === 'project' ? route.id : null)

  useEffect(() => {
    void seedCatalogIfEmpty()
  }, [])

  // Ein Bauvorhaben, das es nicht mehr gibt - zurueck zur Liste, statt eine
  // leere Seite zu zeigen. Nur wenn die Antwort auch wirklich zu dieser id
  // gehoert, sonst greift der Sprung schon beim Oeffnen.
  const answersRoute = route.view === 'project' && lookup?.id === route.id
  useEffect(() => {
    if (answersRoute && !lookup?.project) navigate({ view: 'projects' })
  }, [answersRoute, lookup])

  const loading = projects === undefined || brickTypes === undefined

  return (
    <div className="app">
      <header className="app-head no-print">
        <a className="brand" href={hrefFor({ view: 'projects' })}>
          {/* Volllogo nur auf heller Flaeche - der Schriftzug ist markendunkel. */}
          <img className="brand-logo" src={logo} alt="Ziegelon" />
          <img className="brand-symbol" src={symbol} alt="Ziegelon" />
          {/*
            Beschriftet, weil ein Logo allein nicht verraet, dass es der Weg
            zurueck zur Uebersicht ist. Traegt dieselbe Hervorhebung wie die
            Navigation daneben, damit erkennbar ist, wo man gerade steht.
          */}
          <span className={route.view === 'projects' ? 'brand-label active' : 'brand-label'}>
            Dashboard
          </span>
        </a>
        <nav className="app-nav">
          <a
            className={route.view === 'catalog' ? 'nav-link active' : 'nav-link'}
            href={hrefFor({ view: 'catalog' })}
          >
            Katalog
          </a>
          <a
            className={route.view === 'settings' ? 'nav-link active' : 'nav-link'}
            href={hrefFor({ view: 'settings' })}
          >
            Einstellungen
          </a>
        </nav>
      </header>

      <main className="app-main">
        {loading ? (
          <p className="empty">Wird geladen …</p>
        ) : route.view === 'catalog' ? (
          <CatalogView brickTypes={brickTypes} />
        ) : route.view === 'settings' ? (
          <SettingsView
            theme={theme}
            countJambs={countJambs}
            license={license}
            brickTypes={brickTypes}
          />
        ) : route.view === 'project' ? (
          answersRoute && lookup?.project ? (
            <ProjectView
              project={lookup.project}
              brickTypes={brickTypes}
              countJambs={countJambs}
            />
          ) : (
            <p className="empty">Wird geladen …</p>
          )
        ) : (
          <ProjectListView projects={projects} />
        )}
      </main>

      <footer className="app-foot no-print">
        <LicenseLine info={license} />
        <p className="version-line">{VERSION_KURZ}</p>
      </footer>

      <UpdateHinweis />
    </div>
  )
}
