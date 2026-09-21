import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { applyTheme, readCachedTheme } from './ui/theme'
import './styles/brand.css'
import './styles/app.css'

// Vor dem ersten Rendern: sonst blitzt beim Start die helle Oberflaeche auf,
// bevor die Einstellung aus der Datenbank da ist.
applyTheme(readCachedTheme())

const root = document.getElementById('root')
if (!root) throw new Error('Das Wurzelelement #root fehlt in index.html.')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
