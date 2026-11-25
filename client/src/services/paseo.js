// «Pasea con ZUMI»: datos reales alrededor de donde camina la persona.
//  - Lugares con historia: Wikipedia en español (geosearch + resumen), sin llave
//  - Fotos reales tomadas ahí mismo: Wikimedia Commons (geosearch de archivos), con autor y licencia
//  - El clima de ese lugar ahora: Open-Meteo
// Todo se pide directo desde el teléfono; si algo falla, el paseo sigue igual (solo con menos datos).
import { distanciaKm } from './familiaGPS'

export const PLAZA_LINARES = { id: 'plaza-linares', nombre: 'Plaza de Armas de Linares', lat: -35.84672, lng: -71.59338, rumbo: 20 }

// Lugares para empezar a pasear (el piloto es Linares).
export const PASEOS = [
  PLAZA_LINARES,
  { id: 'plaza-santiago', nombre: 'Plaza de Armas de Santiago', lat: -33.43783, lng: -70.65045, rumbo: 0 },
  { id: 'valpo', nombre: 'Cerro Concepción, Valparaíso', lat: -33.04205, lng: -71.62735, rumbo: 320 },
  { id: 'talca', nombre: 'Plaza de Armas de Talca', lat: -35.42673, lng: -71.66644, rumbo: 0 },
  { id: 'concepcion', nombre: 'Plaza de la Independencia, Concepción', lat: -36.82698, lng: -73.05024, rumbo: 0 },
  { id: 'serena', nombre: 'Plaza de Armas de La Serena', lat: -29.90455, lng: -71.25087, rumbo: 0 },
  { id: 'pto-varas', nombre: 'Costanera de Puerto Varas', lat: -41.31768, lng: -72.98348, rumbo: 90 },
]

// Ciudades donde Google tiene la ciudad escaneada en 3D (comprobado en la app, nov. 2026):
// ahí se camina por las calles y casas reales.
export const CIUDADES_3D = [
  { id: '3d-santiago', nombre: 'Plaza de Armas de Santiago', sub: 'Santiago · 3D real', lat: -33.43783, lng: -70.65045, rumbo: 0 },
  { id: '3d-providencia', nombre: 'Costanera Center, Providencia', sub: 'Providencia · 3D real', lat: -33.4176, lng: -70.6065, rumbo: 90 },
  { id: '3d-lascondes', nombre: 'El Golf, Las Condes', sub: 'Las Condes · 3D real', lat: -33.4153, lng: -70.5996, rumbo: 60 },
  { id: '3d-valpo', nombre: 'Plaza Sotomayor, Valparaíso', sub: 'Valparaíso · 3D real', lat: -33.0389, lng: -71.6273, rumbo: 0 },
  { id: '3d-conce', nombre: 'Plaza de la Independencia, Concepción', sub: 'Concepción · 3D real', lat: -36.82698, lng: -73.05024, rumbo: 0 },
  { id: '3d-antofa', nombre: 'Plaza Colón, Antofagasta', sub: 'Antofagasta · 3D real', lat: -23.6464, lng: -70.3979, rumbo: 270 },
  { id: '3d-temuco', nombre: 'Plaza Aníbal Pinto, Temuco', sub: 'Temuco · 3D real', lat: -38.7393, lng: -72.5984, rumbo: 0 },
  { id: '3d-pmontt', nombre: 'Costanera de Puerto Montt', sub: 'Puerto Montt · 3D real', lat: -41.4718, lng: -72.9396, rumbo: 180 },
  { id: '3d-ptovaras', nombre: 'Costanera de Puerto Varas', sub: 'Puerto Varas · 3D real', lat: -41.31768, lng: -72.98348, rumbo: 90 },
  { id: '3d-copiapo', nombre: 'Plaza de Armas de Copiapó', sub: 'Copiapó · 3D real', lat: -27.3668, lng: -70.3323, rumbo: 0 },
  { id: '3d-angeles', nombre: 'Plaza de Armas de Los Ángeles', sub: 'Los Ángeles · 3D real', lat: -37.4697, lng: -72.3537, rumbo: 0 },
]

/** Dónde parte el vuelo: la ciudad en 3D real de tu comuna si la hay (a menos de 25 km); si no, Santiago. */
export function paseoParaComuna(comuna) {
  const c = comuna?.centro
  if (!c) return CIUDADES_3D[0]
  const km = (x) => Math.hypot((x.lat - c[0]) * 111, (x.lng - c[1]) * 111 * Math.cos((c[0] * Math.PI) / 180))
  const cerca = [...CIUDADES_3D].sort((a, b) => km(a) - km(b))[0]
  return km(cerca) <= 25 ? cerca : CIUDADES_3D[0]
}

// Lo que ZUMI cuenta aunque no haya internet para Wikipedia (datos verificables, sin inventar).
const CURADOS = {
  'plaza-linares': [
    { titulo: 'Plaza de Armas de Linares', lat: -35.84672, lng: -71.59338, texto: 'Linares fue fundada en 1794 por Ambrosio O’Higgins con el nombre de Villa de San Ambrosio de Linares. Esta plaza es el corazón de la ciudad desde entonces.' },
  ],
}

const WIKI = 'https://es.wikipedia.org/w/api.php'
const COMMONS = 'https://commons.wikimedia.org/w/api.php'
const qs = (o) => new URLSearchParams({ format: 'json', origin: '*', ...o }).toString()
const limpiarHtml = (s) => String(s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

/** Primeras oraciones de un resumen, sin paréntesis largos (que suenan mal en voz). */
export function resumir(texto, max = 2) {
  const t = String(texto ?? '')
    .replace(/\s*\([^)]{25,}\)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const oraciones = t.match(/[^.!?]+[.!?]+/g) ?? (t ? [t] : [])
  return oraciones.slice(0, max).join(' ').trim()
}

/** Lugares con artículo en Wikipedia a menos de `radio` metros, del más cercano al más lejano. */
export async function lugaresCerca({ lat, lng }, { radio = 1200, signal, id } = {}) {
  const curados = (CURADOS[id] ?? []).map((c) => ({ ...c, id: `cur-${c.titulo}`, fuente: 'ZUMI' }))
  try {
    const r = await fetch(
      `${WIKI}?${qs({ action: 'query', generator: 'geosearch', ggscoord: `${lat}|${lng}`, ggsradius: String(radio), ggslimit: '20', prop: 'coordinates|extracts|pageimages', exintro: '1', explaintext: '1', exsentences: '3', exlimit: '20', piprop: 'thumbnail', pithumbsize: '480' })}`,
      { signal },
    )
    if (!r.ok) throw new Error(String(r.status))
    const j = await r.json()
    const wiki = Object.values(j?.query?.pages ?? {})
      // fuera eventos, listas y noticias: solo lugares que se pueden ver desde el aire
      .filter((p) => p.coordinates?.[0] && p.extract && !/^(Anexo|Editat[oó]n|Elecci[oó]n|Atentado|Incendio|Terremoto|Accidente|Caso|Masacre|Protesta|Marcha|Estallido|Festival|Copa|Campeonato|Temporada)/i.test(p.title))
      .map((p) => ({
        id: `w-${p.pageid}`,
        titulo: p.title,
        lat: p.coordinates[0].lat,
        lng: p.coordinates[0].lon,
        texto: resumir(p.extract, 3),
        foto: p.thumbnail?.source ?? null,
        url: `https://es.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`,
        fuente: 'Wikipedia',
      }))
    // si Wikipedia tiene el mismo lugar, gana Wikipedia (más completo)
    const mismo = (w, c) => w.titulo.toLowerCase() === c.titulo.toLowerCase() || distanciaKm(w, c) < 0.012
    const todos = [...wiki, ...curados.filter((c) => !wiki.some((w) => mismo(w, c)))]
    return ordenar(todos, { lat, lng })
  } catch (e) {
    if (e.name === 'AbortError') throw e
    return ordenar(curados, { lat, lng })
  }
}

/** Fotos reales tomadas a menos de `radio` metros (Wikimedia Commons), con autor y licencia. */
export async function fotosCerca({ lat, lng }, { radio = 400, signal } = {}) {
  try {
    const r = await fetch(
      `${COMMONS}?${qs({ action: 'query', generator: 'geosearch', ggsnamespace: '6', ggsprimary: 'all', ggscoord: `${lat}|${lng}`, ggsradius: String(radio), ggslimit: '24', prop: 'imageinfo|coordinates', iiprop: 'url|extmetadata|mime', iiurlwidth: '720', iiextmetadatafilter: 'Artist|LicenseShortName|ImageDescription' })}`,
      { signal },
    )
    if (!r.ok) return []
    const j = await r.json()
    return ordenar(
      Object.values(j?.query?.pages ?? {})
        .map((p) => {
          const ii = p.imageinfo?.[0]
          const m = ii?.extmetadata ?? {}
          const c = p.coordinates?.[0]
          if (!ii?.thumburl || !/^image\/(jpeg|png|webp)/.test(ii.mime ?? 'image/jpeg') || !c) return null
          return {
            id: `c-${p.pageid}`,
            url: ii.thumburl,
            pagina: ii.descriptionurl,
            lat: c.lat,
            lng: c.lon,
            autor: limpiarHtml(m.Artist?.value).slice(0, 60) || 'Autor en Wikimedia Commons',
            licencia: limpiarHtml(m.LicenseShortName?.value) || 'Wikimedia Commons',
            titulo: limpiarHtml(m.ImageDescription?.value).slice(0, 90) || p.title.replace(/^File:|\.[a-z]+$/gi, '').replace(/_/g, ' '),
          }
        })
        .filter(Boolean),
      { lat, lng },
    )
  } catch (e) {
    if (e.name === 'AbortError') throw e
    return []
  }
}

/** El clima en ese lugar ahora mismo (para el cielo del paseo). */
export async function climaAqui({ lat, lng }, { signal } = {}) {
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}&current=temperature_2m,precipitation,weather_code,is_day,cloud_cover&timezone=auto`, { signal })
    if (!r.ok) return null
    const c = (await r.json())?.current
    if (!c) return null
    return { temp: Math.round(c.temperature_2m), lluvia: c.precipitation > 0.1 || [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(c.weather_code), dia: c.is_day === 1, nubes: c.cloud_cover ?? 0, codigo: c.weather_code }
  } catch {
    return null
  }
}

function ordenar(l, p) {
  return l.map((x) => ({ ...x, m: Math.round(distanciaKm(p, x) * 1000) })).sort((a, b) => a.m - b.m)
}

/** Mover un punto `metros` hacia `rumbo` (grados, 0 = norte). */
export function avanzar({ lat, lng }, rumbo, metros) {
  const R = 6371000
  const d = metros / R
  const b = (rumbo * Math.PI) / 180
  const f1 = (lat * Math.PI) / 180
  const l1 = (lng * Math.PI) / 180
  const f2 = Math.asin(Math.sin(f1) * Math.cos(d) + Math.cos(f1) * Math.sin(d) * Math.cos(b))
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(f1), Math.cos(d) - Math.sin(f1) * Math.sin(f2))
  return { lat: (f2 * 180) / Math.PI, lng: (l2 * 180) / Math.PI }
}

/** Rumbo de A hacia B (grados). */
export function rumboHacia(a, b) {
  const f1 = (a.lat * Math.PI) / 180
  const f2 = (b.lat * Math.PI) / 180
  const dl = ((b.lng - a.lng) * Math.PI) / 180
  const y = Math.sin(dl) * Math.cos(f2)
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/** «a tu izquierda», «al frente»… según hacia dónde mira la persona. */
export function ladoDe(miRumbo, hacia) {
  const d = ((hacia - miRumbo + 540) % 360) - 180
  if (Math.abs(d) < 30) return 'al frente'
  if (Math.abs(d) > 150) return 'detrás de ti'
  return d > 0 ? 'a tu derecha' : 'a tu izquierda'
}

/** Lo que ZUMI dice al acercarse a un lugar. */
export function narracion(lugar, miRumbo, yo) {
  const lado = ladoDe(miRumbo, rumboHacia(yo, lugar))
  const cerca = lugar.m < 25 ? 'Estás en' : `${lado[0].toUpperCase()}${lado.slice(1)}, a ${Math.max(10, Math.round(lugar.m / 10) * 10)} metros, está`
  return `${cerca} ${lugar.titulo}. ${resumir(lugar.texto, 2)}`
}
