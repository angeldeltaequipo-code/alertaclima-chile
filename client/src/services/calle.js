// Vista de calle real (Mapillary): fotos a pie de calle, subidas por personas (CC BY-SA).
import { API_URL } from './reportes'

let config = null
/** ¿Está activa la vista de calle? { activa, token } (se pregunta una vez). */
export function configCalle() {
  if (!API_URL) return Promise.resolve({ activa: false })
  config ??= fetch(`${API_URL}/api/calle/config`)
    .then((r) => (r.ok ? r.json() : { activa: false }))
    .catch(() => {
      config = null
      return { activa: false }
    })
  return config
}

/** Fotos a pie de calle cerca de un punto (la más cercana primero). Busca más lejos si no hay. */
export async function fotosCalle({ lat, lng }) {
  for (const radio of [60, 200]) {
    const r = await fetch(`${API_URL}/api/calle/cerca?lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}&radio=${radio}`)
    if (!r.ok) throw new Error(r.status === 503 ? 'no-configurada' : 'sin-servicio')
    const { fotos } = await r.json()
    if (fotos.length) return fotos
  }
  return []
}

/** Abre la vista de calle en un punto (la muestra App). */
export const abrirCalle = (p) => window.dispatchEvent(new CustomEvent('ac:calle', { detail: p }))
