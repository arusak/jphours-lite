import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import { RegistrationProvider } from './services/platform/RegistrationContext'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RegistrationProvider>
      <App />
    </RegistrationProvider>
  </StrictMode>,
)
