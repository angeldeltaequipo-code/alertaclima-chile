// Teselas vectoriales reales de OpenStreetMap (OpenFreeMap) → rasgos en metros locales.
// Sistema local: x = este (m), z = -norte (m), alrededor de un origen (lat0, lng0).
import { VectorTile } from '@mapbox/vector-tile'
import { PbfReader } from 'pbf'

export const Z = 14
const TILEJSON = 'https://tiles.openfreemap.org/planet'
let plantilla = null

async function urlTesela() {
  if (plantilla) return plantilla
  try {
    const r = await fetch(TILEJSON)
    plantilla = (await r.json()).tiles[0]
  } catch {
    plantilla = 'https://tiles.openfreemap.org/planet/latest/{z}/{x}/{y}.pbf'
  }
  return plantilla
}

export function teselaDe(lat, lng, z = Z) {
  const n = 2 ** z
  const x = Math.floor(((lng + 180) / 360) * n)
  const y = Math.floor(((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * n)
  return { x, y }
}

/** Proyección local equirectangular (precisa a decenas de km del origen). */
export function proyector(lat0, lng0) {
  const kx = 111320 * Math.cos((lat0 * Math.PI) / 180)
  const kz = 110540
  return {
    lat0,
    lng0,
    aLocal: (lat, lng) => [(lng - lng0) * kx, -(lat - lat0) * kz],
    aGeo: (x, z) => ({ lat: lat0 - z / kz, lng: lng0 + x / kx }),
  }
}

const cache = new Map()

/** Descarga y decodifica una tesela; devuelve los rasgos ya en metros locales. */
export async function cargarTesela(tx, ty, proy, { signal } = {}) {
  const clave = `${tx}/${ty}`
  let buf = cache.get(clave)
  if (!buf) {
    const url = (await urlTesela()).replace('{z}', Z).replace('{x}', tx).replace('{y}', ty)
    const r = await fetch(url, { signal })
    if (!r.ok) throw new Error(`tesela ${r.status}`)
    buf = await r.arrayBuffer()
    cache.set(clave, buf)
    if (cache.size > 40) cache.delete(cache.keys().next().value)
  }
  const t = new VectorTile(new PbfReader(new Uint8Array(buf)))
  const n = 2 ** Z
  const pt = (ext) => (p) => {
    const lng = ((tx + p.x / ext) / n) * 360 - 180
    const yy = ty + p.y / ext
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * yy) / n))) * 180) / Math.PI
    return proy.aLocal(lat, lng)
  }
  const capa = (nombre) => {
    const l = t.layers[nombre]
    const out = []
    if (!l) return out
    const P = pt(l.extent)
    for (let i = 0; i < l.length; i++) {
      const f = l.feature(i)
      const g = f.loadGeometry().map((anillo) => anillo.map(P))
      out.push({ tipo: f.type, props: f.properties, g })
    }
    return out
  }
  // bordes de la tesela en metros (para recortar lo generado)
  const P = pt(4096)
  const [x0, z0] = P({ x: 0, y: 0 })
  const [x1, z1] = P({ x: 4096, y: 4096 })
  return {
    clave,
    caja: { x0, z0, x1, z1 },
    edificios: capa('building'),
    calles: capa('transportation'),
    agua: capa('water'),
    cauces: capa('waterway'),
    cobertura: capa('landcover'),
    uso: capa('landuse'),
    parques: capa('park'),
    lugares: capa('place'),
    numeros: capa('housenumber'),
    poi: capa('poi'),
  }
}
