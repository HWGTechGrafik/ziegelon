/**
 * Winziger Hash-Router.
 *
 * Bewusst ohne Router-Bibliothek: die App hat drei Ansichten, und der Hash
 * sorgt dafuer, dass die Zurueck-Taste am Handy das tut, was man erwartet -
 * eine Ebene zurueck statt die App zu schliessen.
 */
import { useEffect, useState } from 'react'

export type Route =
  | { view: 'projects' }
  | { view: 'project'; id: string }
  | { view: 'catalog' }
  | { view: 'settings' }

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts[0] === 'katalog') return { view: 'catalog' }
  if (parts[0] === 'einstellungen') return { view: 'settings' }
  if (parts[0] === 'projekt' && parts[1]) return { view: 'project', id: parts[1] }
  return { view: 'projects' }
}

export function hrefFor(route: Route): string {
  switch (route.view) {
    case 'catalog':
      return '#/katalog'
    case 'settings':
      return '#/einstellungen'
    case 'project':
      return `#/projekt/${route.id}`
    default:
      return '#/'
  }
}

export function navigate(route: Route): void {
  window.location.hash = hrefFor(route)
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}
