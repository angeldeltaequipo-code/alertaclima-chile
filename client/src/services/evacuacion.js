// Vías de evacuación y zonas de encuentro cercanas (OpenStreetMap, vía nuestro servidor).
import { API_URL } from './reportes'
import { distanciaKm } from './riesgos'

export async function obtenerEvacuacion(punto) {
  const r = await fetch(`${API_URL}/api/evacuacion?lat=${punto.lat.toFixed(4)}&lng=${punto.lng.toFixed(4)}`)
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudieron cargar las vías de evacuación')
  return d
}

/** Las zonas de encuentro más cercanas al punto, con distancia en km. */
export function zonasCercanas(puntos, punto, n = 3) {
  if (!punto) return []
  return (puntos ?? [])
    .map((p) => ({ ...p, km: distanciaKm(punto, p) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, n)
}

/** Enlace para llegar caminando (Google Maps). */
export const comoLlegar = (p) => `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=walking`
