import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/custom-bulma.scss'
import './i18n'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
