// Riesgos naturales en tiempo real, desde fuentes científicas públicas:
// - Sismos: USGS (Servicio Geológico de EE.UU.), catálogo mundial actualizado al minuto.
// - Tsunamis: boletines del Centro de Alerta de Tsunamis del Pacífico (PTWC, NOAA).
//   En Chile la autoridad oficial es el SHOA junto a SENAPRED; la app siempre lo indica.
// - Volcanes: reporte semanal del Programa Global de Volcanismo (Smithsonian), que cita a SERNAGEOMIN.
// Cada fuente se consulta como máximo cada pocos minutos (caché) para no sobrecargarlas.

const CHILE = { minLat: -56.5, maxLat: -17, minLng: -80, maxLng: -66 }
const cache = new Map() // clave -> { hasta, datos }
// Algunas fuentes rechazan pedidos sin identificación: se presenta la app con un contacto.
const CABECERAS = { 'User-Agent': 'AlertaClima-Chile/1.0 (+https://angeldeltaequipo-code.github.io/alertaclima-chile/)', Accept: '*/*' }

async function conCache(clave, ms, fn) {
  const c = cache.get(clave)
  if (c && Date.now() < c.hasta) return c.datos
  try {
    const datos = await fn()
    cache.set(clave, { hasta: Date.now() + ms, datos })
    return datos
  } catch (e) {
    console.error(`Riesgos (${clave}):`, e.message)
    if (c) return c.datos // si falla, se sirve lo último que se tenía
    return null
  }
}

const RUMBOS = { N: 'norte', NNE: 'norte', NE: 'noreste', ENE: 'este', E: 'este', ESE: 'este', SE: 'sureste', SSE: 'sur', S: 'sur', SSW: 'sur', SW: 'suroeste', WSW: 'oeste', W: 'oeste', WNW: 'oeste', NW: 'noroeste', NNW: 'norte' }

/** «34 km NNE of Ovalle, Chile» → «a 34 km al norte de Ovalle». */
export function lugarEnEspanol(lugar) {
  if (!lugar) return null
  const m = /^(\d+)\s*km\s+([NSEW]{1,3})\s+of\s+(.+?)(?:,\s*([^,]+))?$/.exec(lugar.trim())
  if (m) {
    const [, km, rumbo, ciudad, pais] = m
    return `a ${km} km al ${RUMBOS[rumbo] ?? rumbo} de ${ciudad}${pais && pais !== 'Chile' ? `, ${pais.replace('Argentina', 'Argentina').replace('Peru', 'Perú').replace('Bolivia', 'Bolivia')}` : ''}`
  }
  return lugar.replace(/, Chile$/, '').replace(/^off the coast of/, 'frente a la costa de').replace(/region$/, '')
}

export function interpretarSismo(f) {
  const p = f.properties ?? {}
  const [lng, lat, prof] = f.geometry?.coordinates ?? []
  if (lat == null || p.mag == null) return null
  return {
    id: f.id,
    magnitud: Math.round(p.mag * 10) / 10,
    lugar: lugarEnEspanol(p.place),
    hora: p.time,
    lat,
    lng,
    profundidadKm: prof != null ? Math.round(prof) : null,
    sentido: p.felt ?? null,
    alertaTsunami: p.tsunami === 1,
    url: p.url,
  }
}

export async function sismos({ fetchFn = fetch } = {}) {
  return conCache('sismos', 90 * 1000, async () => {
    const u = new URL('https://earthquake.usgs.gov/fdsnws/event/1/query')
    const desde = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 19)
    Object.entries({
      format: 'geojson',
      starttime: desde,
      minlatitude: CHILE.minLat,
      maxlatitude: CHILE.maxLat,
      minlongitude: CHILE.minLng,
      maxlongitude: CHILE.maxLng,
      minmagnitude: 2.5,
      orderby: 'time',
      limit: 150,
    }).forEach(([k, v]) => u.searchParams.set(k, v))
    const r = await fetchFn(u, { headers: CABECERAS, signal: AbortSignal.timeout(12000) })
    if (!r.ok) throw new Error(`USGS respondió ${r.status}`)
    const d = await r.json()
    return (d.features ?? []).map(interpretarSismo).filter(Boolean)
  })
}

const entre = (xml, etiqueta) => {
  const m = new RegExp(`<${etiqueta}[^>]*>([\\s\\S]*?)</${etiqueta}>`, 'i').exec(xml)
  return m ? m[1].trim() : null
}
const sinEtiquetas = (h) =>
  (h ?? '')
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Último boletín del PTWC (océano Pacífico). nivel: 'informacion' | 'aviso' | 'amenaza'. */
export function interpretarTsunami(xml) {
  const entradas = xml.split(/<entry>/i).slice(1)
  return entradas.slice(0, 3).map((e) => {
    const resumen = sinEtiquetas(entre(e, 'summary'))
    const categoria = /Category:\s*([A-Za-z]+)/i.exec(resumen)?.[1]?.toLowerCase() ?? 'information'
    const mag = /Magnitude:\s*([\d.]+)/i.exec(resumen)?.[1]
    return {
      zona: sinEtiquetas(entre(e, 'title')),
      hora: entre(e, 'updated'),
      lat: Number(entre(e, 'geo:lat')),
      lng: Number(entre(e, 'geo:long')),
      magnitud: mag ? Number(mag) : null,
      nivel: /warning/.test(categoria) ? 'alerta' : /threat|advisory|watch/.test(categoria) ? 'amenaza' : 'informacion',
      enlace: /href="([^"]+)"[^>]*rel="alternate"/.exec(e)?.[1] ?? /<link[^>]*href="([^"]+)"/.exec(e)?.[1] ?? null,
    }
  })
}

export async function tsunami({ fetchFn = fetch } = {}) {
  return conCache('tsunami', 3 * 60 * 1000, async () => {
    const r = await fetchFn('https://www.tsunami.gov/events/xml/PHEBAtom.xml', { headers: CABECERAS, signal: AbortSignal.timeout(12000) })
    if (!r.ok) throw new Error(`PTWC respondió ${r.status}`)
    const boletines = interpretarTsunami(await r.text())
    // Solo los de los últimos 2 días son relevantes.
    return boletines.filter((b) => b.hora && Date.now() - new Date(b.hora).getTime() < 2 * 864e5)
  })
}

const NIVEL_VOLCAN = { green: 'Verde', yellow: 'Amarilla', orange: 'Naranja', red: 'Roja' }

export function interpretarVolcanes(xml) {
  return xml
    .split(/<item>/i)
    .slice(1)
    .map((it) => {
      const titulo = sinEtiquetas(entre(it, 'title'))
      if (!/\(Chile\)/i.test(titulo) && !/Chile/i.test(titulo)) return null
      const desc = sinEtiquetas(entre(it, 'description'))
      const punto = entre(it, 'georss:point')?.split(/\s+/).map(Number)
      const nivel = /Alert Level[^.]*?\b(Green|Yellow|Orange|Red)\b/i.exec(desc)?.[1]?.toLowerCase()
      return {
        nombre: titulo.split('(')[0].trim(),
        estado: /New/i.test(titulo) ? 'Nueva actividad' : 'Actividad continua',
        nivel: nivel ? NIVEL_VOLCAN[nivel] : null,
        lat: punto?.[0] ?? null,
        lng: punto?.[1] ?? null,
        enlace: entre(it, 'link'),
      }
    })
    .filter(Boolean)
}

export async function volcanesActivos({ fetchFn = fetch } = {}) {
  return conCache('volcanes', 60 * 60 * 1000, async () => {
    const r = await fetchFn('https://volcano.si.edu/news/WeeklyVolcanoRSS.xml', { headers: CABECERAS, signal: AbortSignal.timeout(20000) })
    if (!r.ok) throw new Error(`Smithsonian respondió ${r.status}`)
    const buf = Buffer.from(await r.arrayBuffer())
    return interpretarVolcanes(new TextDecoder('latin1').decode(buf))
  })
}

export async function resumenRiesgos(opciones) {
  const [s, t, v] = await Promise.all([sismos(opciones), tsunami(opciones), volcanesActivos(opciones)])
  return { sismos: s, tsunami: t, volcanes: v, hora: new Date().toISOString() }
}

export function limpiarCacheRiesgos() {
  cache.clear()
}
