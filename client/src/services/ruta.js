// Ruta ZUMI: la guía de viaje por Chile. Calcula el camino en auto (OSRM, datos de OpenStreetMap),
// mira el pronóstico en cada tramo justo a la hora en que vas a pasar por ahí (Open-Meteo), marca los
// tramos con riesgo (lluvia fuerte, nieve o hielo, viento, niebla, tormenta), sugiere la mejor hora
// para salir y dónde descansar, y abre la navegación en Waze o Google Maps.
import REGIONES from '../data/comunas.json'
import { buscarComunas, comunaPorCut, normalizar } from './comunas'
import { LUGARES } from './viajes'
import { describir, puntoDeComuna } from './clima'

const COMUNAS = REGIONES.flatMap((r) => r.comunas.map((c) => ({ ...c, region: r.nombre })))
const R = 6371
const rad = (x) => (x * Math.PI) / 180
export function km(a, b) {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
/** La comuna más cercana a un punto (por su centro): basta para nombrar un tramo de la ruta. */
export function comunaCercana(p) {
  let mejor = null
  let d = Infinity
  for (const c of COMUNAS) {
    const x = km(p, { lat: c.centro[0], lng: c.centro[1] })
    if (x < d) {
      d = x
      mejor = c
    }
  }
  return mejor
}

// Pasos fronterizos y puntos de montaña donde el clima cambia todo.
export const PASOS = [
  { nombre: 'Paso Los Libertadores (Cristo Redentor)', lat: -32.832, lng: -70.091, ruta: 'Ruta 60 · Los Andes ↔ Mendoza' },
  { nombre: 'Paso Pino Hachado', lat: -38.66, lng: -70.9, ruta: 'Ruta 181 · Curacautín ↔ Neuquén' },
  { nombre: 'Paso Mamuil Malal', lat: -39.58, lng: -71.47, ruta: 'Pucón ↔ Junín de los Andes' },
  { nombre: 'Paso Cardenal Samoré', lat: -40.71, lng: -71.94, ruta: 'Ruta 215 · Osorno ↔ Bariloche' },
  { nombre: 'Paso Jama', lat: -23.24, lng: -67.03, ruta: 'Ruta 27 · San Pedro de Atacama ↔ Jujuy' },
  { nombre: 'Paso Pehuenche', lat: -35.98, lng: -70.4, ruta: 'Ruta 115 · Talca ↔ Malargüe' },
]

// ---- Buscar destino ----
const DESTACADOS = [
  ...LUGARES.map((l) => ({ id: `l-${l.id}`, nombre: l.nombre, sub: l.sub, lat: l.lat, lng: l.lng })),
  ...PASOS.map((p, i) => ({ id: `p-${i}`, nombre: p.nombre, sub: p.ruta, lat: p.lat, lng: p.lng })),
  { id: 'scl', nombre: 'Aeropuerto de Santiago (SCL)', sub: 'Pudahuel · Región Metropolitana', lat: -33.393, lng: -70.794 },
  { id: 'valle-nevado', nombre: 'Valle Nevado', sub: 'Centro de ski · Lo Barnechea', lat: -33.357, lng: -70.249 },
  { id: 'farellones', nombre: 'Farellones', sub: 'Lo Barnechea · camino de montaña', lat: -33.354, lng: -70.312 },
  { id: 'portillo', nombre: 'Portillo', sub: 'Centro de ski · Ruta 60', lat: -32.836, lng: -70.13 },
  { id: 'cajon', nombre: 'Cajón del Maipo', sub: 'San José de Maipo', lat: -33.64, lng: -70.35 },
  { id: 'carretera-austral', nombre: 'Carretera Austral (inicio)', sub: 'Ruta 7 · Puerto Montt', lat: -41.47, lng: -72.94 },
]

export function buscarLugares(texto, limite = 8) {
  const t = normalizar(texto)
  if (t.length < 2) return []
  const dest = DESTACADOS.filter((d) => normalizar(d.nombre).includes(t)).map((d) => ({ ...d, tipo: 'lugar' }))
  const com = buscarComunas(texto, limite).map((c) => ({ id: `c-${c.cut}`, nombre: c.nombre, sub: c.region?.etiqueta ?? c.region ?? '', lat: c.centro?.[0] ?? c.lat, lng: c.centro?.[1] ?? c.lng, tipo: 'comuna' }))
  return [...dest, ...com].filter((x) => x.lat != null).slice(0, limite)
}

/**
 * Una comuna como destino es su ciudad (la cabecera), nunca su centro geográfico: en comunas grandes
 * (Linares, San Fernando, Cochamó…) el centro cae en plena cordillera, a decenas de km del pueblo.
 * Se busca el poblado con ese nombre dentro de la comuna (Open-Meteo, luego OpenStreetMap).
 * Si no se encuentra, se avisa (`aprox`) en vez de llevar a la persona a un punto en el cerro.
 */
export async function resolverDestino(d, { signal } = {}) {
  if (d?.tipo !== 'comuna') return d
  const comuna = comunaPorCut(String(d.id).replace(/^c-/, ''))
  if (!comuna) return d
  const p = await puntoDeComuna(comuna, { signal }).catch((e) => {
    if (e.name === 'AbortError') throw e
    return null
  })
  if (p && !p.aprox) return { ...d, lat: p.lat, lng: p.lng, aprox: false }
  try {
    const dentro = (x) => !comuna.bbox || (x.lat >= comuna.bbox[0][0] - 0.02 && x.lat <= comuna.bbox[1][0] + 0.02 && x.lng >= comuna.bbox[0][1] - 0.02 && x.lng <= comuna.bbox[1][1] + 0.02)
    const r = (await buscarDireccion(`${comuna.nombre}, Chile`, { signal })).find((x) => normalizar(x.nombre) === normalizar(comuna.nombre) && dentro(x))
    if (r) return { ...d, lat: r.lat, lng: r.lng, aprox: false }
  } catch (e) {
    if (e.name === 'AbortError') throw e
  }
  return { ...d, aprox: true }
}

/** Direcciones o lugares exactos (OpenStreetMap). Solo en Chile. */
export async function buscarDireccion(texto, { signal } = {}) {
  const u = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=cl&limit=5&accept-language=es&q=${encodeURIComponent(texto)}`
  const r = await fetch(u, { signal })
  if (!r.ok) return []
  return (await r.json()).map((x) => ({ id: `o-${x.place_id}`, nombre: x.name || x.display_name.split(',')[0], sub: x.display_name.split(',').slice(1, 3).join(',').trim(), lat: Number(x.lat), lng: Number(x.lon), tipo: 'direccion' }))
}

// ---- Destinos recientes (en el teléfono) ----
const K_RECIENTES = 'ac:ruta-recientes'
export function recientes() {
  try {
    return JSON.parse(localStorage.getItem(K_RECIENTES) ?? '[]')
  } catch {
    return []
  }
}
export function anotarReciente(d) {
  try {
    const l = [{ id: d.id, nombre: d.nombre, sub: d.sub, lat: d.lat, lng: d.lng, tipo: d.tipo }, ...recientes().filter((x) => x.id !== d.id && x.nombre !== d.nombre)].slice(0, 6)
    localStorage.setItem(K_RECIENTES, JSON.stringify(l))
  } catch {
    /* sin almacenamiento */
  }
}

// ---- Calcular la ruta ----
/** La ruta principal y hasta dos alternativas (para comparar por tiempo y por clima). */
export async function calcularRutas(origen, destino, { signal } = {}) {
  const u = `https://router.project-osrm.org/route/v1/driving/${origen.lng},${origen.lat};${destino.lng},${destino.lat}?overview=full&geometries=geojson&alternatives=2&steps=true`
  const r = await fetch(u, { signal })
  if (!r.ok) throw new Error('No pude calcular la ruta')
  const d = await r.json()
  if (!d.routes?.length) throw new Error('No encontré un camino en auto hasta ahí')
  return d.routes.map(convertirRuta)
}

export async function calcularRuta(origen, destino, { signal } = {}) {
  const rumbo = origen.rumbo != null ? `&bearings=${Math.round(origen.rumbo)},60;` : ''
  const u = `https://router.project-osrm.org/route/v1/driving/${origen.lng},${origen.lat};${destino.lng},${destino.lat}?overview=full&geometries=geojson&alternatives=false&steps=true${rumbo}`
  const r = await fetch(u, { signal })
  if (!r.ok) throw new Error('No pude calcular la ruta')
  const d = await r.json()
  const ruta = d.routes?.[0]
  if (!ruta) throw new Error('No encontré un camino en auto hasta ahí')
  return convertirRuta(ruta)
}

function convertirRuta(ruta) {
  const pasos = (ruta.legs?.[0]?.steps ?? []).map((p) => ({
    tipo: p.maneuver.type,
    mod: p.maneuver.modifier ?? null,
    salida: p.maneuver.exit ?? null,
    nombre: p.name || '',
    ref: p.ref || '',
    destinos: p.destinations || '',
    lat: p.maneuver.location[1],
    lng: p.maneuver.location[0],
    metros: p.distance,
    segundos: p.duration,
  }))
  // la vía principal de la ruta (la más larga): «por Ruta 5 Sur»
  const vias = new Map()
  for (const p of pasos) if (p.nombre || p.ref) vias.set(p.ref || p.nombre, (vias.get(p.ref || p.nombre) ?? 0) + p.metros)
  const via = [...vias].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
  return { coords: ruta.geometry.coordinates, metros: ruta.distance, segundos: ruta.duration, pasos, via: via && /^\d|^[A-Z]-?\d/.test(via) ? `Ruta ${via.split(';')[0]}` : via }
}

// ---- Navegación paso a paso ----
const ORDINAL = ['', 'primera', 'segunda', 'tercera', 'cuarta', 'quinta', 'sexta', 'séptima', 'octava']
const LADO = {
  uturn: 'da la vuelta en U',
  'sharp right': 'gira cerrado a la derecha',
  right: 'gira a la derecha',
  'slight right': 'mantente a la derecha',
  straight: 'sigue derecho',
  'slight left': 'mantente a la izquierda',
  left: 'gira a la izquierda',
  'sharp left': 'gira cerrado a la izquierda',
}
const calle = (p) => {
  const n = p.nombre && p.ref && !p.nombre.includes(p.ref) ? `${p.nombre} (${p.ref.split(';')[0]})` : p.nombre || (p.ref ? `la ${p.ref.split(';')[0]}` : '')
  return n
}
/** La indicación en palabras: «Gira a la derecha en Avenida Brasil». */
export function indicacion(p) {
  const c = calle(p)
  const en = c ? ` en ${c}` : ''
  const por = c ? ` por ${c}` : ''
  const lado = LADO[p.mod] ?? 'sigue'
  const hacia = p.destinos ? ` hacia ${p.destinos.split(',')[0].split(':').pop().trim()}` : ''
  switch (p.tipo) {
    case 'depart':
      return `Sal${por || ' por el camino'}`
    case 'arrive':
      return p.mod === 'left' ? 'Llegarás a tu destino, a la izquierda' : p.mod === 'right' ? 'Llegarás a tu destino, a la derecha' : 'Llegarás a tu destino'
    case 'roundabout':
    case 'rotary':
      return `En la rotonda, toma la ${ORDINAL[p.salida] ?? `salida ${p.salida}`}${p.salida && ORDINAL[p.salida] ? ' salida' : ''}${c ? ` hacia ${c}` : ''}`
    case 'exit roundabout':
    case 'exit rotary':
      return `Sal de la rotonda${por}`
    case 'fork':
      return `En la bifurcación, ${p.mod?.includes('left') ? 'mantente a la izquierda' : 'mantente a la derecha'}${hacia || por}`
    case 'on ramp':
      return `Toma la entrada${c ? ` a ${c}` : ''}${hacia}`
    case 'off ramp':
      return `Toma la salida${hacia || por}`
    case 'merge':
      return `Incorpórate${c ? ` a ${c}` : ' al camino'}`
    case 'end of road':
      return `Al final del camino, ${lado}${en}`
    case 'new name':
    case 'continue':
      return p.mod && p.mod !== 'straight' ? `${lado[0].toUpperCase()}${lado.slice(1)}${por}` : `Sigue${por || ' derecho'}`
    default:
      return `${lado[0].toUpperCase()}${lado.slice(1)}${en}`
  }
}
/** Ícono de la maniobra (flecha). */
export function flecha(p) {
  if (p.tipo === 'arrive') return '◉'
  if (p.tipo === 'roundabout' || p.tipo === 'rotary') return '↻'
  return { uturn: '↶', 'sharp right': '↱', right: '↱', 'slight right': '↗', straight: '↑', 'slight left': '↖', left: '↰', 'sharp left': '↰' }[p.mod] ?? '↑'
}
export const distanciaDicha = (m) => (m >= 950 ? `${(Math.round(m / 100) / 10).toString().replace('.', ',')} kilómetros` : `${m >= 100 ? Math.round(m / 50) * 50 : Math.max(10, Math.round(m / 10) * 10)} metros`)
export const distanciaCorta = (m) => (m >= 950 ? `${(m / 1000).toFixed(1).replace('.', ',')} km` : `${m >= 100 ? Math.round(m / 50) * 50 : Math.max(10, Math.round(m / 10) * 10)} m`)

/** Prepara la ruta para navegar: distancias acumuladas y en qué punto del trazado está cada maniobra. */
export function prepararNavegacion(ruta) {
  const c = ruta.coords
  const acum = [0]
  for (let i = 1; i < c.length; i++) acum.push(acum[i - 1] + km({ lat: c[i - 1][1], lng: c[i - 1][0] }, { lat: c[i][1], lng: c[i][0] }) * 1000)
  let desde = 0
  const pasos = ruta.pasos.map((p) => {
    let mejor = desde
    let d = Infinity
    for (let i = desde; i < Math.min(c.length, desde + 4000); i++) {
      const x = km(p, { lat: c[i][1], lng: c[i][0] })
      if (x < d) {
        d = x
        mejor = i
      }
      if (d < 0.002) break
    }
    desde = mejor
    return { ...p, metro: acum[mejor], texto: indicacion(p) }
  })
  return { coords: c, acum, total: acum.at(-1), pasos, segundos: ruta.segundos }
}

/** Dónde voy en la ruta: avance (metros), distancia a la ruta (m) y el índice del tramo. */
export function ubicarEnRuta(nav, p, desde = 0) {
  const { coords: c, acum } = nav
  const cosLat = Math.cos((p.lat * Math.PI) / 180)
  const X = (lng) => lng * 111320 * cosLat
  const Y = (lat) => lat * 110540
  const px = X(p.lng)
  const py = Y(p.lat)
  let mejor = { d: Infinity, avance: 0, i: desde }
  const ini = Math.max(0, desde - 30)
  const fin = Math.min(c.length - 1, desde + 1500)
  for (let i = ini; i < fin; i++) {
    const ax = X(c[i][0]), ay = Y(c[i][1]), bx = X(c[i + 1][0]), by = Y(c[i + 1][1])
    const dx = bx - ax, dy = by - ay
    const L = dx * dx + dy * dy || 1
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L))
    const qx = ax + t * dx, qy = ay + t * dy
    const d = Math.hypot(px - qx, py - qy)
    if (d < mejor.d) mejor = { d, avance: acum[i] + t * (acum[i + 1] - acum[i]), i, lat: qy / 110540, lng: qx / (111320 * cosLat) }
  }
  return mejor
}

/** Puntos de control a lo largo de la ruta (cada ~40 km, máximo 14), con su avance (0..1). */
export function muestrear(coords) {
  const acum = [0]
  for (let i = 1; i < coords.length; i++) acum.push(acum[i - 1] + km({ lat: coords[i - 1][1], lng: coords[i - 1][0] }, { lat: coords[i][1], lng: coords[i][0] }))
  const total = acum.at(-1) || 1
  const n = Math.max(2, Math.min(14, Math.ceil(total / 40) + 1))
  const puntos = []
  let j = 0
  for (let k = 0; k < n; k++) {
    const meta = (total * k) / (n - 1)
    while (j < acum.length - 1 && acum[j] < meta) j++
    puntos.push({ lat: coords[j][1], lng: coords[j][0], avance: acum[j] / total, i: j, kmDesde: acum[j] })
  }
  return { puntos, totalKm: total, acum }
}

// ---- Clima a lo largo de la ruta ----
/** Pronóstico por hora de todos los puntos, en una sola consulta. */
export async function pronosticoPuntos(puntos, { signal } = {}) {
  const lat = puntos.map((p) => p.lat.toFixed(3)).join(',')
  const lng = puntos.map((p) => p.lng.toFixed(3)).join(',')
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,precipitation,snowfall,weather_code,wind_gusts_10m,visibility&forecast_days=3&timezone=UTC`
  const r = await fetch(u, { signal })
  if (!r.ok) throw new Error('Sin pronóstico')
  const d = await r.json()
  return Array.isArray(d) ? d : [d]
}

/** Riesgo de manejar con estas condiciones: 0 tranquilo, 1 atención, 2 peligro, con el motivo. */
export function riesgoManejo(h) {
  const motivos = []
  let n = 0
  const sube = (v, m) => {
    n = Math.max(n, v)
    motivos.push(m)
  }
  if (h.nieve > 0.2 || (h.temp <= 0.5 && h.lluvia > 0.1)) sube(2, h.nieve > 0.2 ? 'nieve en el camino' : 'posible hielo')
  else if (h.temp <= 2) sube(1, 'riesgo de escarcha')
  if (h.codigo >= 95) sube(2, 'tormenta eléctrica')
  if (h.lluvia >= 4) sube(2, 'lluvia intensa')
  else if (h.lluvia >= 1) sube(1, 'lluvia')
  if (h.rafagas >= 80) sube(2, 'viento muy fuerte')
  else if (h.rafagas >= 55) sube(1, 'viento fuerte')
  if (h.visibilidad != null && h.visibilidad < 300) sube(2, 'niebla espesa')
  else if (h.codigo === 45 || h.codigo === 48 || (h.visibilidad != null && h.visibilidad < 1500)) sube(1, 'niebla')
  return { nivel: n, motivos }
}

/** Condiciones de cada punto a la hora en que llegarás ahí, si sales a la hora «salida». */
export function condiciones(puntos, pron, salida, segundos) {
  return puntos.map((p, k) => {
    const eta = new Date(salida.getTime() + p.avance * segundos * 1000)
    const f = pron[k]?.hourly
    if (!f) return { ...p, eta }
    const hora = eta.toISOString().slice(0, 13) + ':00'
    let i = f.time.indexOf(hora)
    if (i < 0) i = Math.min(f.time.length - 1, Math.max(0, Math.round((eta - new Date(f.time[0] + 'Z')) / 36e5)))
    const h = { temp: f.temperature_2m[i], lluvia: f.precipitation[i], nieve: f.snowfall?.[i] ?? 0, codigo: f.weather_code[i], rafagas: f.wind_gusts_10m?.[i] ?? 0, visibilidad: f.visibility?.[i] }
    return { ...p, eta, ...h, texto: describir(h.codigo).texto, icono: describir(h.codigo).icono, riesgo: riesgoManejo(h) }
  })
}

/** ¿A qué hora conviene salir? Compara salir ahora con salir más tarde (hasta 8 horas). */
export function mejorSalida(puntos, pron, segundos, ahora = new Date()) {
  const opciones = [0, 1, 2, 3, 4, 6, 8].map((h) => {
    const salida = new Date(ahora.getTime() + h * 36e5)
    const c = condiciones(puntos, pron, salida, segundos)
    const llegada = new Date(salida.getTime() + segundos * 1000)
    // la noche suma riesgo (menos visibilidad, más cansancio)
    // la noche solo pesa en viajes largos (cansancio y menos visibilidad por horas)
    const noche = segundos > 2 * 3600 ? c.filter((x) => x.eta.getHours() >= 22 || x.eta.getHours() < 6).length * 0.3 : 0
    const puntaje = c.reduce((s, x) => s + (x.riesgo?.nivel ?? 0) ** 2, 0) + noche
    return { horas: h, salida, llegada, puntaje, peligro: c.some((x) => x.riesgo?.nivel === 2) }
  })
  const ahoraOp = opciones[0]
  const mejor = opciones.reduce((a, b) => (b.puntaje < a.puntaje - 0.5 ? b : a), ahoraOp)
  return { ahora: ahoraOp, mejor, opciones }
}

/** Paradas para descansar: cada 2 horas de manejo (recomendación de CONASET). */
export function descansos(puntos, segundos) {
  const horas = segundos / 3600
  if (horas < 2.2) return []
  const out = []
  for (let t = 2; t < horas - 0.4; t += 2) {
    const avance = t / horas
    const p = puntos.reduce((a, b) => (Math.abs(b.avance - avance) < Math.abs(a.avance - avance) ? b : a))
    const c = comunaCercana(p)
    out.push({ ...p, horas: t, lugar: c?.nombre })
  }
  return out
}

/** Pasos fronterizos o de alta montaña por los que pasa la ruta (a menos de 15 km). */
export function pasosEnRuta(coords) {
  return PASOS.filter((p) => coords.some((c, i) => i % 5 === 0 && km(p, { lat: c[1], lng: c[0] }) < 15))
}

// ---- Abrir la navegación ----
export const enlaceWaze = (d) => `https://waze.com/ul?ll=${d.lat},${d.lng}&navigate=yes`
export const enlaceGoogle = (o, d) => `https://www.google.com/maps/dir/?api=1${o ? `&origin=${o.lat},${o.lng}` : ''}&destination=${d.lat},${d.lng}&travelmode=driving`

export const duracion = (s) => {
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`
}
export const horaCL = (d) => d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
export const diaCL = (d) => {
  const hoy = new Date()
  const man = new Date(hoy.getTime() + 864e5)
  return d.toDateString() === hoy.toDateString() ? 'hoy' : d.toDateString() === man.toDateString() ? 'mañana' : d.toLocaleDateString('es-CL', { weekday: 'long' })
}

/** Lo que ZUMI dice del viaje, en una frase. */
export function resumenZumi(destino, ruta, cond, mejor) {
  const peligros = cond.filter((c) => c.riesgo?.nivel === 2)
  const atencion = cond.filter((c) => c.riesgo?.nivel === 1)
  const base = `A ${destino.nombre} son ${Math.round(ruta.metros / 1000)} kilómetros, unas ${duracion(ruta.segundos).replace(' h ', ' horas y ').replace(' min', ' minutos')}.`
  let clima
  if (peligros.length) {
    const p = peligros[0]
    clima = ` Ojo: ${p.riesgo.motivos[0]} cerca de ${comunaCercana(p)?.nombre ?? 'la ruta'} a las ${horaCL(p.eta)}.`
  } else if (atencion.length) {
    const p = atencion[0]
    clima = ` Atento a ${p.riesgo.motivos[0]} cerca de ${comunaCercana(p)?.nombre ?? 'la ruta'}.`
  } else clima = ' El camino se ve tranquilo, sin problemas de clima.'
  const sugerencia = mejor && mejor.mejor.horas > 0 && (peligros.length || atencion.length || ruta.segundos > 2 * 3600) && mejor.ahora.puntaje - mejor.mejor.puntaje >= 1 ? ` Si puedes, sal en ${mejor.mejor.horas} ${mejor.mejor.horas === 1 ? 'hora' : 'horas'}: el clima en la ruta estará mejor.` : ''
  return base + clima + sugerencia
}
