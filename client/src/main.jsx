import { StrictMode, Suspense, lazy, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Service worker: guarda la interfaz para abrir sin conexión y se actualiza solo.
registerSW({ immediate: true })

// El panel de administración vive en la misma app, en la dirección …/#admin.
const PanelAdmin = lazy(() => import('./components/admin/PanelAdmin.jsx'))

function Raiz() {
  const [admin, setAdmin] = useState(() => location.hash === '#admin')
  useEffect(() => {
    const cambio = () => setAdmin(location.hash === '#admin')
    window.addEventListener('hashchange', cambio)
    return () => window.removeEventListener('hashchange', cambio)
  }, [])
  if (!admin) return <App />
  return (
    <Suspense fallback={<p className="p-6">Cargando panel…</p>}>
      <PanelAdmin />
    </Suspense>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Raiz />
  </StrictMode>,
)
