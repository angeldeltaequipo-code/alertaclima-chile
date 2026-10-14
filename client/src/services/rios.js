// Ríos, esteros y quebradas cercanos, a partir de los cauces que ya trae el mapa
// (capa "waterway" de OpenMapTiles, con datos de OpenStreetMap). No usa otro servicio.

const CLASES = new Set(['river', 'stream', 'canal'])

/** Tipo de cauce en palabras, según su nombre o su clase en el mapa. */
export function tipoCauce(nombre, clase) {
  const n = nombre.toLowerCase()
  if (n.startsWith('río') || n.startsWith('rio ')) return 'Río'
  if (n.startsWith('quebrada')) return 'Quebrada'
  if (n.startsWith('estero')) return 'Estero'
  if (n.startsWith('canal')) return 'Canal'
  if (n.startsWith('zanjón') || n.startsWith('zanjon')) return 'Zanjón'
  if (clase === 'river') return 'Río'
  if (clase === 'canal') return 'Canal'
  return 'Cauce'
}

// Distancia en metros de un punto a un segmento, con una proyección local plana (precisa a escala de ciudad).
function distSegmento(p, a, b, kx) {
  const ax = (a[0] - p[0]) * kx
  const ay = (a[1] - p[1]) * 111320
  const bx = (b[0] - p[0]) * kx
  const by = (b[1] - p[1]) * 111320
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy
  const t = l2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / l2)) : 0
  return Math.hypot(ax + t * dx, ay + t * dy)
}

function lineas(geom) {
  if (geom.type === 'LineString') return [geom.coordinates]
  if (geom.type === 'MultiLineString') return geom.coordinates
  return []
}

/**
 * Agrupa los tramos por nombre y devuelve los cauces más cercanos al punto.
 * features: GeoJSON con properties { name | name:es | name:latin, class }.
 * punto: { lat, lng }. Devuelve [{ nombre, tipo, distanciaM, geometria (MultiLineString) }].
 */
export function caucesCercanos(features, punto, { maximo = 6, radioM = 25000 } = {}) {
  const p = [punto.lng, punto.lat]
  const kx = 111320 * Math.cos((punto.lat * Math.PI) / 180)
  const grupos = new Map()
  for (const f of features) {
    const pr = f.properties ?? {}
    const nombre = (pr['name:es'] || pr.name || pr['name:latin'] || '').trim()
    if (!nombre || !CLASES.has(pr.class)) continue
    let g = grupos.get(nombre)
    if (!g) grupos.set(nombre, (g = { nombre, clase: pr.class, distanciaM: Infinity, tramos: [] }))
    if (pr.class === 'river') g.clase = 'river'
    for (const linea of lineas(f.geometry)) {
      g.tramos.push(linea)
      for (let i = 0; i < linea.length - 1; i++) {
        const d = distSegmento(p, linea[i], linea[i + 1], kx)
        if (d < g.distanciaM) g.distanciaM = d
      }
    }
  }
  return [...grupos.values()]
    .filter((g) => g.distanciaM <= radioM)
    .sort((a, b) => a.distanciaM - b.distanciaM)
    .slice(0, maximo)
    .map((g) => ({
      nombre: g.nombre,
      tipo: tipoCauce(g.nombre, g.clase),
      distanciaM: Math.round(g.distanciaM),
      geometria: { type: 'MultiLineString', coordinates: g.tramos },
    }))
}

export function distanciaTexto(m) {
  if (m < 50) return 'aquí mismo'
  if (m < 1000) return `a ${Math.round(m / 10) * 10} m`
  return `a ${(m / 1000).toLocaleString('es-CL', { maximumFractionDigits: 1 })} km`
}
