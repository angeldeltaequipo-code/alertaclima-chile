// Riesgos naturales: sismos, tsunamis y volcanes. Los datos vienen del servidor
// (USGS, PTWC/NOAA y Smithsonian) y aquí se ordenan según la comuna de la persona.
import { API_URL } from './reportes'

export async function obtenerRiesgos({ signal } = {}) {
  const r = await fetch(`${API_URL}/api/riesgos`, { signal })
  if (!r.ok) throw new Error('No se pudo consultar la información de riesgos')
  const d = await r.json()
  // volcanesConocidos: false cuando la fuente semanal no respondió (no es lo mismo que «sin actividad»).
  return { ...d, sismos: d.sismos ?? [], tsunami: d.tsunami ?? [], volcanes: d.volcanes ?? [], volcanesConocidos: d.volcanes != null }
}

export function distanciaKm(a, b) {
  const R = 6371
  const rad = (x) => (x * Math.PI) / 180
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Cómo se siente un sismo según su magnitud (orientativo: depende de la distancia y la profundidad). */
export function descripcionMagnitud(m) {
  if (m >= 8) return { texto: 'Terremoto mayor', tono: 'peligro' }
  if (m >= 7) return { texto: 'Terremoto', tono: 'peligro' }
  if (m >= 6) return { texto: 'Sismo fuerte', tono: 'peligro' }
  if (m >= 5) return { texto: 'Sismo moderado', tono: 'atento' }
  if (m >= 4) return { texto: 'Sismo leve', tono: 'info' }
  return { texto: 'Microsismo', tono: 'neutro' }
}

export const colorMagnitud = (m) => (m >= 6 ? '#e11d48' : m >= 5 ? '#f97316' : m >= 4 ? '#f59e0b' : m >= 3 ? '#38bdf8' : '#94a3b8')

// Volcanes activos de Chile vigilados por la Red Nacional de Vigilancia Volcánica (SERNAGEOMIN).
export const COLOR_VOLCAN = { Roja: '#dc2626', Naranja: '#f97316', Amarilla: '#facc15', Verde: '#22c55e', sin: '#a8a29e' }

export const VOLCANES = [
  ['Parinacota', -18.17, -69.14],
  ['Guallatiri', -18.42, -69.09],
  ['Isluga', -19.15, -68.83],
  ['Irruputuncu', -20.73, -68.56],
  ['Ollagüe', -21.3, -68.18],
  ['San Pedro', -21.89, -68.39],
  ['Láscar', -23.37, -67.73],
  ['Lastarria', -25.17, -68.5],
  ['Ojos del Salado', -27.11, -68.54],
  ['Tupungatito', -33.4, -69.82],
  ['San José', -33.79, -69.9],
  ['Planchón-Peteroa', -35.24, -70.57],
  ['Descabezado Grande', -35.58, -70.75],
  ['Laguna del Maule', -36.06, -70.49],
  ['Nevados de Chillán', -36.86, -71.38],
  ['Antuco', -37.41, -71.35],
  ['Copahue', -37.85, -71.17],
  ['Callaqui', -37.92, -71.45],
  ['Lonquimay', -38.38, -71.59],
  ['Llaima', -38.69, -71.73],
  ['Sollipulli', -38.97, -71.52],
  ['Villarrica', -39.42, -71.93],
  ['Quetrupillán', -39.5, -71.7],
  ['Lanín', -39.64, -71.5],
  ['Mocho-Choshuenco', -39.93, -72.03],
  ['Puyehue-Cordón Caulle', -40.59, -72.12],
  ['Osorno', -41.1, -72.49],
  ['Calbuco', -41.33, -72.61],
  ['Michinmahuida', -42.79, -72.44],
  ['Chaitén', -42.83, -72.65],
  ['Hudson', -45.9, -72.97],
].map(([nombre, lat, lng]) => ({ nombre, lat, lng }))

const sinTildes = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Los volcanes más cercanos al punto, marcando los que tienen actividad reportada esta semana. */
export function volcanesCercanos(punto, activos = [], n = 3) {
  return VOLCANES.map((v) => {
    const act = activos.find((a) => sinTildes(a.nombre).includes(sinTildes(v.nombre).split('-')[0]) || sinTildes(v.nombre).includes(sinTildes(a.nombre)))
    return { ...v, distanciaKm: Math.round(distanciaKm(punto, v)), actividad: act ?? null }
  })
    .sort((a, b) => a.distanciaKm - b.distanciaKm)
    .slice(0, n)
}

export const GUIAS = {
  terremoto: {
    titulo: 'Si tiembla fuerte',
    pasos: [
      'Agáchate, cúbrete bajo una mesa firme y afírmate.',
      'Aléjate de ventanas, repisas y objetos que puedan caer.',
      'No uses ascensores ni salgas corriendo mientras se mueve el piso.',
      'Si estás en la costa y el sismo no te dejó mantenerte en pie, evacúa a una zona alta apenas termine, sin esperar la alerta.',
      'Después, revisa el gas y la luz, y usa mensajes de texto en vez de llamadas para no saturar las líneas.',
    ],
  },
  tsunami: {
    titulo: 'Si hay amenaza de tsunami',
    pasos: [
      'Sube a pie a una zona segura, sobre los 30 metros de altura o tras la cota que indique tu municipio.',
      'Aléjate de la costa, ríos y esteros cercanos al mar.',
      'No vuelvas hasta que SENAPRED o el SHOA levanten la alerta: puede haber varias olas durante horas.',
    ],
  },
  volcan: {
    titulo: 'Si un volcán entra en erupción',
    pasos: [
      'Sigue las instrucciones de SENAPRED y respeta el radio de exclusión.',
      'Aléjate de ríos y quebradas que bajan del volcán: pueden traer lodo y rocas (lahares).',
      'Si cae ceniza, cierra puertas y ventanas, usa mascarilla y protege tus ojos.',
    ],
  },
}
