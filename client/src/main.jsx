import { StrictMode, Suspense, lazy, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

import { esNativa, iniciarNativo } from './services/nativo'

// Service worker: guarda la interfaz para abrir sin conexión y se actualiza solo.
// En la app de tienda (Capacitor) la interfaz ya viene dentro de la app: no hace falta.
if (!esNativa()) registerSW({ immediate: true })
// Tocar una notificación nativa abre el detalle de alertas.
iniciarNativo({ onAbrirAviso: () => window.dispatchEvent(new CustomEvent('ac:abrir-alertas')) })

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
