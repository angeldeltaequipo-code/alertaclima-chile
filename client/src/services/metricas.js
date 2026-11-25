// Métricas de uso sin datos personales: un «latido» al día por instalación y conteo de acciones.
// El id es un número al azar que inventa la app (no identifica a la persona ni al teléfono).
import { API_URL } from './reportes'
import { esNativa, plataforma } from './nativo'

const K = 'ac:instalacion'
function idInstalacion() {
  try {
    let id = localStorage.getItem(K)
    if (!id) {
      id = crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`
      localStorage.setItem(K, id)
    }
    return id
  } catch {
    return null
  }
}
const enviar = (ruta, cuerpo) =>
  fetch(`${API_URL}/api/metricas/${ruta}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(cuerpo), keepalive: true }).catch(() => {})

/** Una vez por día (al abrir la app). */
export function latido(comunaCut) {
  const id = idInstalacion()
  if (!id || !API_URL) return
  const hoy = new Date().toISOString().slice(0, 10)
  try {
    if (localStorage.getItem('ac:latido') === `${hoy}|${comunaCut}`) return
    localStorage.setItem('ac:latido', `${hoy}|${comunaCut}`)
  } catch {
    /* sin almacenamiento */
  }
  const pwa = matchMedia?.('(display-mode: standalone)').matches
  enviar('latido', {
    id,
    comuna: comunaCut,
    plataforma: esNativa() ? plataforma() : pwa ? 'pwa' : 'web',
    avisos: typeof Notification !== 'undefined' && Notification.permission === 'granted',
  })
}

/** Cuenta una acción (sin decir quién): pregunta, llamada, paseo, viaje, sos, reporte… */
export const evento = (tipo) => API_URL && enviar('evento', { tipo })
