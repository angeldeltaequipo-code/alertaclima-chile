// Regiones y comunas de Chile con su Código Único Territorial (CUT).
// Origen: ver client/src/data/FUENTES.md
import regiones from '../data/comunas.json'

export { regiones }

const indice = new Map()
for (const r of regiones) {
  for (const c of r.comunas) indice.set(c.cut, { ...c, region: r })
}

export const totalComunas = indice.size

export function comunaPorCut(cut) {
  return indice.get(cut) ?? null
}

export function normalizar(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** Busca comunas por nombre, sin importar tildes ni mayúsculas. Prioriza las que empiezan igual. */
export function buscarComunas(texto, limite = 30) {
  const q = normalizar(texto)
  if (!q) return []
  const empiezan = []
  const contienen = []
  for (const c of indice.values()) {
    const n = normalizar(c.nombre)
    if (n.startsWith(q)) empiezan.push(c)
    else if (n.includes(q)) contienen.push(c)
  }
  return [...empiezan, ...contienen].slice(0, limite)
}

// ---- Límites comunales (se cargan por región, bajo demanda) ----

const cacheLimites = new Map()

export async function limitesRegion(regionCut) {
  if (!cacheLimites.has(regionCut)) {
    const url = new URL(`limites/${regionCut}.json`, document.baseURI)
    cacheLimites.set(
      regionCut,
      fetch(url).then((r) => {
        if (!r.ok) throw new Error(`No se pudieron cargar los límites (${r.status})`)
        return r.json()
      }),
    )
  }
  try {
    return await cacheLimites.get(regionCut)
  } catch (e) {
    cacheLimites.delete(regionCut)
    throw e
  }
}

export async function limiteComuna(cut) {
  const fc = await limitesRegion(cut.slice(0, 2))
  return fc.features.find((f) => f.properties.cut === cut) ?? null
}

function puntoEnAnillo([lng, lat], anillo) {
  let dentro = false
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i]
    const [xj, yj] = anillo[j]
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro
  }
  return dentro
}

function puntoEnGeometria(punto, geom) {
  const poligonos = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates
  return poligonos.some(
    ([exterior, ...hoyos]) => puntoEnAnillo(punto, exterior) && !hoyos.some((h) => puntoEnAnillo(punto, h)),
  )
}

/** Encuentra la comuna que contiene un punto. Devuelve null si está fuera de Chile. */
export async function comunaEnPunto(lat, lng) {
  const candidatas = [...indice.values()].filter(
    (c) => c.bbox && lat >= c.bbox[0][0] && lat <= c.bbox[1][0] && lng >= c.bbox[0][1] && lng <= c.bbox[1][1],
  )
  const regionesCandidatas = [...new Set(candidatas.map((c) => c.cut.slice(0, 2)))]
  for (const rc of regionesCandidatas) {
    const fc = await limitesRegion(rc)
    const f = fc.features.find(
      (f) => candidatas.some((c) => c.cut === f.properties.cut) && puntoEnGeometria([lng, lat], f.geometry),
    )
    if (f) return comunaPorCut(f.properties.cut)
  }
  return null
}
