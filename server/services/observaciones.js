// Mediciones reales de estaciones meteorológicas: lo que de verdad está pasando,
// a diferencia del pronóstico, que es una estimación de un modelo.
//
// ---- Interfaz FuenteObservaciones ----
// { nombre, async estaciones() } → [{ id, nombre, lat, lng, hora, temperatura, humedad,
//   viento, rafagas, precipitacion, cielo, fuente }]
// Hoy: estaciones de aeropuertos (METAR, publicadas por la DGAC y distribuidas por
// aviationweather.gov, sin registro). Próximo: la red de estaciones automáticas de la
// Dirección Meteorológica de Chile (requiere usuario y clave: DMC_USUARIO / DMC_TOKEN).

const DISTANCIA_MAX_KM = Number(process.env.OBS_DISTANCIA_MAX_KM ?? 40)
const ANTIGUEDAD_MAX_MIN = Number(process.env.OBS_ANTIGUEDAD_MAX_MIN ?? 90)
const CACHE_MS = 10 * 60 * 1000

// Aeropuertos chilenos que publican METAR, con un nombre que la gente reconozca.
export const AEROPUERTOS = {
  SCAR: 'Arica (aeropuerto Chacalluta)',
  SCDA: 'Iquique (aeropuerto Diego Aracena)',
  SCCF: 'Calama (aeropuerto El Loa)',
  SCFA: 'Antofagasta (aeropuerto Cerro Moreno)',
  SCAT: 'Copiapó (aeropuerto Desierto de Atacama)',
  SCSE: 'La Serena (aeropuerto La Florida)',
  SCVM: 'Viña del Mar (aeródromo Torquemada)',
  SCEL: 'Santiago (aeropuerto Arturo Merino Benítez)',
  SCTB: 'Santiago (aeródromo Tobalaba)',
  SCRG: 'Rancagua (aeródromo La Independencia)',
  SCCH: 'Chillán (aeródromo Bernardo O’Higgins)',
  SCIE: 'Concepción (aeropuerto Carriel Sur)',
  SCQP: 'Temuco (aeropuerto La Araucanía)',
  SCVD: 'Valdivia (aeródromo Pichoy)',
  SCJO: 'Osorno (aeródromo Cañal Bajo)',
  SCTE: 'Puerto Montt (aeropuerto El Tepual)',
  SCPQ: 'Castro (aeródromo Mocopulli)',
  SCCY: 'Coyhaique (aeródromo Teniente Vidal)',
  SCBA: 'Balmaceda (aeródromo)',
  SCCI: 'Punta Arenas (aeropuerto Carlos Ibáñez del Campo)',
  SCNT: 'Puerto Natales (aeródromo Teniente Julio Gallardo)',
  SCGZ: 'Puerto Williams (aeródromo Guardiamarina Zañartu)',
  SCIP: 'Rapa Nui (aeropuerto Mataveri)',
  SCIR: 'Juan Fernández (aeródromo Robinson Crusoe)',
}

// ---- Interpretación del METAR ----

const NUBES = { SKC: 'Despejado', CLR: 'Despejado', NSC: 'Despejado', CAVOK: 'Despejado', FEW: 'Pocas nubes', SCT: 'Parcialmente nublado', BKN: 'Mayormente nublado', OVC: 'Nublado' }
const ORDEN_NUBES = ['SKC', 'CLR', 'NSC', 'CAVOK', 'FEW', 'SCT', 'BKN', 'OVC']

/** Humedad relativa a partir de temperatura y punto de rocío (fórmula de Magnus). */
export function humedadRelativa(t, td) {
  if (t == null || td == null) return null
  const g = (x) => (17.625 * x) / (243.04 + x)
  return Math.round(100 * Math.exp(g(td) - g(t)))
}

/** Fenómeno presente (lluvia, llovizna, tormenta, niebla, nieve) a partir del texto del METAR. */
export function fenomeno(raw) {
  // Solo el cuerpo del mensaje; lo que viene después de RMK son comentarios.
  const cuerpo = ` ${String(raw).split(' RMK ')[0]} `
  const m = cuerpo.match(/ ([+-]|VC)?(TS|SH)?(RA|DZ|SN|GR|GS|PL)+ /)
  const ts = / ([+-])?TS[A-Z]* /.test(cuerpo)
  if (m) {
    const [, int, desc, tipo] = m
    if (int === 'VC') return { texto: 'Lluvia en las cercanías', precipitacion: false, tipo: 'cercana' }
    const base = /SN/.test(m[0]) ? 'Nieve' : /GR|GS/.test(m[0]) ? 'Granizo' : tipo === 'DZ' ? 'Llovizna' : desc === 'SH' ? 'Chubascos' : 'Lluvia'
    const plural = base === 'Chubascos'
    const nivel = int === '-' ? (plural ? ' débiles' : ' débil') : int === '+' ? (plural ? ' fuertes' : ' fuerte') : ''
    return {
      texto: `${ts || desc === 'TS' ? 'Tormenta con ' + base.toLowerCase() : base}${ts || desc === 'TS' ? '' : nivel}`,
      precipitacion: true,
      intensidad: int === '-' ? 'débil' : int === '+' ? 'fuerte' : 'moderada',
    }
  }
  if (ts) return { texto: 'Tormenta eléctrica', precipitacion: false }
  if (/ (FG|BR) /.test(cuerpo)) return { texto: / FG /.test(cuerpo) ? 'Niebla' : 'Neblina', precipitacion: false }
  return null
}

function cielo(m) {
  if (/ CAVOK /.test(` ${m.rawOb} `)) return 'Despejado'
  const capas = (m.clouds ?? []).map((c) => c.cover).filter((c) => ORDEN_NUBES.includes(c))
  if (!capas.length && m.cover) capas.push(m.cover)
  if (!capas.length) return null
  const peor = capas.sort((a, b) => ORDEN_NUBES.indexOf(b) - ORDEN_NUBES.indexOf(a))[0]
  return NUBES[peor] ?? null
}

const kmh = (kt) => (kt == null ? null : Math.round(kt * 1.852))

export function interpretarMetar(m) {
  const fen = fenomeno(m.rawOb ?? '')
  return {
    id: m.icaoId,
    nombre: AEROPUERTOS[m.icaoId] ?? m.name,
    lat: m.lat,
    lng: m.lon,
    elevacion: m.elev ?? null,
    hora: new Date(m.reportTime ?? m.obsTime * 1000).toISOString(),
    temperatura: m.temp ?? null,
    humedad: humedadRelativa(m.temp, m.dewp),
    viento: kmh(typeof m.wspd === 'number' ? m.wspd : null),
    rafagas: kmh(m.wgst ?? null),
    fenomeno: fen?.texto ?? null,
    precipitacion: fen?.precipitacion ?? false,
    cielo: cielo(m),
    fuente: 'Estación aeronáutica (DGAC), vía aviationweather.gov',
  }
}

// ---- Fuente: aeropuertos ----

let cache = { hasta: 0, datos: [] }
let enCurso = null

const fuenteAeropuertos = {
  nombre: 'aeropuertos',
  async estaciones({ fetchFn = fetch } = {}) {
    if (Date.now() < cache.hasta) return cache.datos
    if (!enCurso) {
      enCurso = (async () => {
        try {
          const ids = Object.keys(AEROPUERTOS).join(',')
          const r = await fetchFn(`https://aviationweather.gov/api/data/metar?ids=${ids}&format=json&hours=3`, {
            headers: { 'User-Agent': 'AlertaClima-Chile/1.0 (alertas climaticas comunitarias)' },
            signal: AbortSignal.timeout(10000),
          })
          if (!r.ok) throw new Error(`aviationweather.gov respondió ${r.status}`)
          const lista = await r.json()
          // Puede venir más de un reporte por estación: se queda el más reciente.
          const porId = new Map()
          for (const m of lista) {
            const o = interpretarMetar(m)
            if (o.temperatura == null) continue
            const previo = porId.get(o.id)
            if (!previo || previo.hora < o.hora) porId.set(o.id, o)
          }
          cache = { hasta: Date.now() + CACHE_MS, datos: [...porId.values()] }
        } catch (e) {
          console.error('Observaciones (aeropuertos):', e.message)
          // Si falla, se mantiene lo último que se tenía unos minutos más.
          cache = { hasta: Date.now() + 2 * 60 * 1000, datos: cache.datos }
        } finally {
          enCurso = null
        }
        return cache.datos
      })()
    }
    return enCurso
  },
}

export const FUENTES_OBS = [fuenteAeropuertos]

export function reiniciarCache() {
  cache = { hasta: 0, datos: [] }
}

/** Distancia en km entre dos puntos (haversine). */
export function distanciaKm(a, b) {
  const R = 6371
  const rad = (x) => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/**
 * La medición útil más cercana a un punto: a menos de DISTANCIA_MAX_KM y con menos
 * de ANTIGUEDAD_MAX_MIN de antigüedad. Si no hay, devuelve null (y la app usa el modelo).
 */
export async function observacionCercana(punto, opciones = {}) {
  const ahora = opciones.ahora ?? Date.now()
  const listas = await Promise.all(FUENTES_OBS.map((f) => f.estaciones(opciones)))
  const candidatas = listas
    .flat()
    .map((e) => ({ ...e, distanciaKm: Math.round(distanciaKm(punto, e) * 10) / 10 }))
    .filter((e) => e.distanciaKm <= DISTANCIA_MAX_KM && ahora - new Date(e.hora).getTime() <= ANTIGUEDAD_MAX_MIN * 60000)
    .sort((a, b) => a.distanciaKm - b.distanciaKm)
  return candidatas[0] ?? null
}
