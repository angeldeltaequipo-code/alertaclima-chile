// El espacio en vivo: dónde está la Estación Espacial Internacional ahora mismo, y el Sol filmado
// por los telescopios espaciales de la NASA en las últimas horas.
import { distanciaKm } from './riesgos'

const BASE = import.meta.env.BASE_URL

/** Posición actual de la EEI (api.wheretheiss.at, se actualiza cada segundo). */
export async function posicionEEI({ signal } = {}) {
  const r = await fetch('https://api.wheretheiss.at/v1/satellites/25544', { signal })
  if (!r.ok) throw new Error('No se pudo ubicar la Estación Espacial')
  const d = await r.json()
  return { lat: d.latitude, lng: d.longitude, altitud: d.altitude, velocidad: d.velocity, visibilidad: d.visibility, hora: d.timestamp * 1000 }
}

/** Cómo contar dónde va la EEI respecto de la persona. */
export function describirEEI(eei, punto) {
  if (!eei) return null
  const km = punto ? Math.round(distanciaKm(punto, eei)) : null
  const sobreChile = eei.lat < -17 && eei.lat > -56 && eei.lng > -80 && eei.lng < -66
  let texto
  if (sobreChile) texto = '¡Está pasando sobre Chile ahora!'
  else if (km != null && km < 2500) texto = `Está a ${km.toLocaleString('es-CL')} km de ti: ¡muy cerca!`
  else if (km != null) texto = `Está a ${km.toLocaleString('es-CL')} km de ti`
  else texto = 'Dando la vuelta a la Tierra'
  return { km, sobreChile, texto }
}

let tierra = null
/** Contornos de los continentes (Natural Earth 1:110m, dominio público), cargados una sola vez. */
export async function contornosTierra() {
  if (!tierra) tierra = fetch(`${BASE}datos/tierra.json`).then((r) => r.json())
  return tierra
}

// Videos del Sol que la NASA renueva solos (se pueden mostrar en otras páginas).
export const SOL = [
  {
    id: 'sdo-171',
    nombre: 'El Sol en las últimas 48 horas',
    detalle: 'Observatorio de Dinámica Solar (NASA SDO), luz ultravioleta extrema: se ven los arcos de plasma de la corona.',
    video: 'https://sdo.gsfc.nasa.gov/assets/img/latest/mpeg/latest_512_0171.mp4',
    imagen: 'https://sdo.gsfc.nasa.gov/assets/img/latest/latest_512_0171.jpg',
    credito: 'NASA/SDO y los equipos AIA, EVE y HMI',
  },
  {
    id: 'soho-c3',
    nombre: 'La corona y las tormentas solares',
    detalle: 'Coronógrafo de SOHO (ESA/NASA): tapa el Sol para ver las eyecciones de masa que viajan por el espacio.',
    video: 'https://soho.nascom.nasa.gov/data/LATEST/current_c3.mp4',
    imagen: null,
    credito: 'SOHO (ESA y NASA)',
  },
]

/** Proyección ortográfica (globo visto desde lejos). Devuelve [x, y, visible]. */
export function ortografica(lng, lat, lng0, lat0, r, cx, cy) {
  const rad = Math.PI / 180
  const f = lat * rad
  const l = (lng - lng0) * rad
  const f0 = lat0 * rad
  const cosc = Math.sin(f0) * Math.sin(f) + Math.cos(f0) * Math.cos(f) * Math.cos(l)
  const x = r * Math.cos(f) * Math.sin(l)
  const y = r * (Math.cos(f0) * Math.sin(f) - Math.sin(f0) * Math.cos(f) * Math.cos(l))
  return [cx + x, cy - y, cosc >= 0]
}
