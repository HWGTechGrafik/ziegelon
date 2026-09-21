import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/brand.css'
import './styles/app.css'

const root = document.getElementById('root')
if (!root) throw new Error('Das Wurzelelement #root fehlt in index.html.')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
