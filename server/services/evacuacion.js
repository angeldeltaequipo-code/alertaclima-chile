// Vías de evacuación y zonas de encuentro (tsunami y emergencias) desde OpenStreetMap, donde
// municipios, SENAPRED y voluntarios las han mapeado. Se piden a la API Overpass por zona y se
// guardan en caché un día (cambian muy poco). Licencia de los datos: ODbL © colaboradores de OSM.
//
// Ojo: el mapa no reemplaza la señalética ni las instrucciones oficiales; la app lo dice siempre.
import { ErrorValidacion } from './reportes.js'

const SERVIDORES = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
const CACHE_MS = 24 * 3600e3
const cache = new Map() // zona -> { hasta, datos }
const CABECERAS = { 'User-Agent': 'AlertaClima-Chile/1.0 (+https://angeldeltaequipo-code.github.io/alertaclima-chile/)', 'content-type': 'application/x-www-form-urlencoded' }

export function consultaOverpass([s, o, n, e]) {
  const caja = `(${s},${o},${n},${e})`
  return `[out:json][timeout:40];
(
  nwr["emergency"="assembly_point"]${caja};
  way["evacuation_route"]${caja};
  relation["route"="evacuation"]${caja};
);
out geom 4000;`
}

/** Convierte la respuesta de Overpass en puntos de encuentro y rutas (líneas). */
export function interpretarOverpass(d) {
  const puntos = []
  const rutas = []
  const vistos = new Set()
  for (const el of d.elements ?? []) {
    const t = el.tags ?? {}
    if (t.emergency === 'assembly_point') {
      const lat = el.lat ?? el.center?.lat ?? (el.geometry ? el.geometry.reduce((a, p) => a + p.lat, 0) / el.geometry.length : null)
      const lng = el.lon ?? el.center?.lon ?? (el.geometry ? el.geometry.reduce((a, p) => a + p.lon, 0) / el.geometry.length : null)
      if (lat == null || lng == null) continue
      puntos.push({ id: `${el.type}${el.id}`, lat: +lat.toFixed(6), lng: +lng.toFixed(6), nombre: t.name ?? null, tsunami: t['assembly_point:tsunami'] === 'yes' || /tsunami/i.test(t.name ?? '') })
      continue
    }
    const lineas = el.type === 'way' ? [el.geometry] : (el.members ?? []).filter((m) => m.type === 'way' && m.geometry).map((m) => m.geometry)
    for (const g of lineas) {
      if (!g || g.length < 2) continue
      const clave = `${g[0].lat},${g[0].lon},${g.length}`
      if (vistos.has(clave)) continue
      vistos.add(clave)
      rutas.push({ tsunami: t.evacuation_route === 'tsunami' || t.hazard === 'tsunami' || /tsunami/i.test(t.name ?? ''), coords: g.map((p) => [+p.lon.toFixed(6), +p.lat.toFixed(6)]) })
    }
  }
  return { puntos, rutas }
}

export async function evacuacionCerca(punto, { fetchFn = fetch } = {}) {
  const { lat, lng } = punto
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -57 || lat > -17 || lng < -110 || lng > -66) throw new ErrorValidacion('Ubicación inválida')
  // Zonas de ~0,3° para compartir caché entre vecinos
  const zlat = Math.round(lat / 0.3) * 0.3
  const zlng = Math.round(lng / 0.3) * 0.3
  const zona = `${zlat.toFixed(1)},${zlng.toFixed(1)}`
  const c = cache.get(zona)
  if (c && Date.now() < c.hasta) return c.datos
  const caja = [zlat - 0.35, zlng - 0.4, zlat + 0.35, zlng + 0.4].map((x) => x.toFixed(3))
  let ultimoError
  for (const url of SERVIDORES) {
    try {
      const r = await fetchFn(url, { method: 'POST', headers: CABECERAS, body: 'data=' + encodeURIComponent(consultaOverpass(caja)), signal: AbortSignal.timeout(45000) })
      if (!r.ok) throw new Error(`Overpass respondió ${r.status}`)
      const datos = { ...interpretarOverpass(await r.json()), fuente: '© colaboradores de OpenStreetMap (ODbL)' }
      cache.set(zona, { hasta: Date.now() + CACHE_MS, datos })
      if (cache.size > 300) cache.delete(cache.keys().next().value)
      return datos
    } catch (e) {
      ultimoError = e
    }
  }
  console.error('Evacuación:', ultimoError?.message)
  if (c) return c.datos
  throw new ErrorValidacion('No se pudieron cargar las vías de evacuación. Intenta más tarde.', 503)
}
