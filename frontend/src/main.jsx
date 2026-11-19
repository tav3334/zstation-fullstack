import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/theme.css'
import './styles/modals.css'
import './styles/responsive.css'
import App from './App.jsx'
import AppErrorBoundary from './components/AppErrorBoundary.jsx'
import ConnectionStatus from './components/ConnectionStatus.jsx'
import './styles/app-status.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <ConnectionStatus />
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
