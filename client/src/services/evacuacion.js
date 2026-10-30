// Vías de evacuación y zonas de encuentro cercanas (OpenStreetMap, vía nuestro servidor).
import { API_URL } from './reportes'
import { distanciaKm } from './riesgos'

// Si nuestro servidor no logra consultar OpenStreetMap, el teléfono le pregunta directo a Overpass
// (permite pedidos desde el navegador). Misma consulta y misma forma de respuesta que el servidor.
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']

export function interpretarOverpass(d) {
  const puntos = []
  const rutas = []
  const vistos = new Set()
  const media = (g, k) => g.reduce((a, p) => a + p[k], 0) / g.length
  for (const el of d.elements ?? []) {
    const t = el.tags ?? {}
    if (t.emergency === 'assembly_point') {
      const lat = el.lat ?? el.center?.lat ?? (el.geometry ? media(el.geometry, 'lat') : null)
      const lng = el.lon ?? el.center?.lon ?? (el.geometry ? media(el.geometry, 'lon') : null)
      if (lat == null || lng == null) continue
      puntos.push({ id: `${el.type}${el.id}`, lat, lng, nombre: t.name ?? null, tsunami: t['assembly_point:tsunami'] === 'yes' || /tsunami/i.test(t.name ?? '') })
      continue
    }
    const lineas = el.type === 'way' ? [el.geometry] : (el.members ?? []).filter((m) => m.type === 'way' && m.geometry).map((m) => m.geometry)
    for (const g of lineas) {
      if (!g || g.length < 2) continue
      const clave = `${g[0].lat},${g[0].lon},${g.length}`
      if (vistos.has(clave)) continue
      vistos.add(clave)
      rutas.push({ tsunami: t.evacuation_route === 'tsunami' || t.hazard === 'tsunami' || /tsunami/i.test(t.name ?? ''), coords: g.map((p) => [p.lon, p.lat]) })
    }
  }
  return { puntos, rutas }
}

async function directoOverpass({ lat, lng }) {
  const zlat = Math.round(lat / 0.3) * 0.3
  const zlng = Math.round(lng / 0.3) * 0.3
  const caja = `(${(zlat - 0.35).toFixed(3)},${(zlng - 0.4).toFixed(3)},${(zlat + 0.35).toFixed(3)},${(zlng + 0.4).toFixed(3)})`
  const q = `[out:json][timeout:25];(nwr["emergency"="assembly_point"]${caja};way["evacuation_route"]${caja};relation["route"="evacuation"]${caja};);out geom 4000;`
  let error
  for (const url of OVERPASS) {
    try {
      const r = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: q }), signal: AbortSignal.timeout(30000) })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return { ...interpretarOverpass(await r.json()), fuente: '© colaboradores de OpenStreetMap (ODbL)' }
    } catch (e) {
      error = e
    }
  }
  throw error
}

export async function obtenerEvacuacion(punto) {
  let mensaje = 'No se pudieron cargar las vías de evacuación'
  try {
    const r = await fetch(`${API_URL}/api/evacuacion?lat=${punto.lat.toFixed(4)}&lng=${punto.lng.toFixed(4)}`)
    const d = await r.json().catch(() => ({}))
    if (r.ok) return d
    if (r.status === 400) throw new Error(d.error ?? mensaje)
    mensaje = d.error ?? mensaje
  } catch (e) {
    if (/inválida/.test(e.message)) throw e
  }
  try {
    return await directoOverpass(punto)
  } catch {
    throw new Error(mensaje)
  }
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
