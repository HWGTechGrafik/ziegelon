/**
 * Rahmen der App: Lizenzpruefung, Kopfzeile, Navigation, Auswahl der Ansicht.
 */
import { useEffect, useState } from 'react'
import logo from './assets/branding/derived/Ziegelon_logo.png'
import symbol from './assets/branding/derived/Ziegelon_symbol.png'
import { verifyLicense, type LicenseInfo } from './lib/license'
import { seedCatalogIfEmpty } from './storage/repo'
import { useBrickTypes, useProject, useProjects, useSettings } from './storage/hooks'
import { CatalogView } from './ui/CatalogView'
import { LicenseLine, LockScreen } from './ui/LockScreen'
import { ProjectListView } from './ui/ProjectListView'
import { ProjectView } from './ui/ProjectView'
import { hrefFor, navigate, useRoute } from './ui/router'

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

  if (!licenseChecked) return <p className="empty">Wird geladen …</p>
  if (!license) return <LockScreen onUnlocked={setLicense} />

  return <Shell license={license} />
}

function Shell({ license }: { license: LicenseInfo }) {
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
        </a>
        <nav className="app-nav">
          <a
            className={route.view === 'catalog' ? 'nav-link active' : 'nav-link'}
            href={hrefFor({ view: 'catalog' })}
          >
            Katalog
          </a>
        </nav>
      </header>

      <main className="app-main">
        {loading ? (
          <p className="empty">Wird geladen …</p>
        ) : route.view === 'catalog' ? (
          <CatalogView brickTypes={brickTypes} />
        ) : route.view === 'project' ? (
          answersRoute && lookup?.project ? (
            <ProjectView project={lookup.project} brickTypes={brickTypes} />
          ) : (
            <p className="empty">Wird geladen …</p>
          )
        ) : (
          <ProjectListView projects={projects} />
        )}
      </main>

      <footer className="app-foot no-print">
        <LicenseLine info={license} />
      </footer>
    </div>
  )
}
