// Pronóstico y condiciones actuales. Todo lo específico de Open-Meteo vive aquí.
//
// Condiciones vigentes (revisadas el 14-10-2026 en open-meteo.com/en/terms):
// - La API gratuita es solo para uso NO comercial (máx. 10.000 llamadas/día).
// - Para uso comercial hay que contratar un plan (se usa otra URL con apikey).
// - Datos bajo licencia CC BY 4.0: hay que mostrar la atribución.
import { leer, guardar } from './almacen'
import { normalizar } from './comunas'

const PRONOSTICO_URL = 'https://api.open-meteo.com/v1/forecast'
const GEOCODIFICACION_URL = 'https://geocoding-api.open-meteo.com/v1/search'

export const climaInfo = {
  nombre: 'Open-Meteo',
  url: 'https://open-meteo.com/',
}

/**
 * Punto representativo de la comuna para pedir el clima: el pueblo o ciudad
 * cabecera (no el centro geográfico, que en comunas cordilleranas cae en la montaña).
 * Se busca una vez por comuna y se guarda.
 */
export async function puntoDeComuna(comuna, { signal } = {}) {
  const clave = `punto:${comuna.cut}`
  const guardado = leer(clave)
  if (guardado) return guardado

  const respaldo = { lat: comuna.centro[0], lng: comuna.centro[1], aprox: true }
  try {
    const url = new URL(GEOCODIFICACION_URL)
    url.searchParams.set('name', comuna.nombre)
    url.searchParams.set('countryCode', 'CL')
    url.searchParams.set('count', '10')
    url.searchParams.set('language', 'es')
    const r = await fetch(url, { signal })
    if (!r.ok) return respaldo
    const { results = [] } = await r.json()
    const nombre = normalizar(comuna.nombre)
    const dentro = (x) =>
      comuna.bbox &&
      x.latitude >= comuna.bbox[0][0] - 0.02 &&
      x.latitude <= comuna.bbox[1][0] + 0.02 &&
      x.longitude >= comuna.bbox[0][1] - 0.02 &&
      x.longitude <= comuna.bbox[1][1] + 0.02
    // Un lugar poblado con el mismo nombre y dentro de la comuna.
    const elegido = results
      .filter((x) => x.country_code === 'CL' && normalizar(x.name) === nombre && dentro(x))
      .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))[0]
    if (!elegido) return respaldo
    const punto = { lat: elegido.latitude, lng: elegido.longitude, aprox: false }
    guardar(clave, punto)
    return punto
  } catch (e) {
    if (e.name === 'AbortError') throw e
    return respaldo
  }
}

export async function obtenerPronostico({ lat, lng }, { signal } = {}) {
  const url = new URL(PRONOSTICO_URL)
  const p = url.searchParams
  p.set('latitude', lat.toFixed(4))
  p.set('longitude', lng.toFixed(4))
  p.set(
    'current',
    'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,is_day,pressure_msl,dew_point_2m,uv_index,visibility,cloud_cover',
  )
  p.set(
    'hourly',
    'temperature_2m,precipitation,precipitation_probability,weather_code,is_day,wind_speed_10m,wind_gusts_10m,wind_direction_10m,pressure_msl,freezing_level_height',
  )
  p.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,sunrise,sunset,uv_index_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant',
  )
  p.set('past_hours', '3')
  p.set('timezone', 'America/Santiago')
  p.set('forecast_days', '7')
  p.set('wind_speed_unit', 'kmh')

  const r = await fetch(url, { signal })
  if (!r.ok) throw new Error(`El servicio del clima respondió ${r.status}`)
  const d = await r.json()
  return transformar(d)
}

function transformar(d) {
  // Las horas llegan sin zona ("2026-10-14T15:00"), en la hora de Chile que indica utc_offset_seconds.
  const seg = d.utc_offset_seconds ?? -10800
  const abs = Math.abs(seg)
  const _off = `${seg < 0 ? '-' : '+'}${String(Math.floor(abs / 3600)).padStart(2, '0')}:${String((abs % 3600) / 60).padStart(2, '0')}`
  const fecha = (s) => new Date(`${s}:00${_off}`)

  const c = d.current
  const ahora = {
    hora: fecha(c.time),
    temperatura: c.temperature_2m,
    sensacion: c.apparent_temperature,
    humedad: c.relative_humidity_2m,
    lluvia: c.precipitation,
    codigo: c.weather_code,
    viento: c.wind_speed_10m,
    rafagas: c.wind_gusts_10m,
    direccion: c.wind_direction_10m,
    esDeDia: c.is_day === 1,
    presion: c.pressure_msl ?? null,
    rocio: c.dew_point_2m ?? null,
    uv: c.uv_index ?? null,
    visibilidad: c.visibility ?? null,
    nubes: c.cloud_cover ?? null,
  }

  const h = d.hourly
  const inicio = new Date(ahora.hora)
  inicio.setMinutes(0, 0, 0)
  const todas = h.time.map((t, i) => ({
    hora: fecha(t),
    temperatura: h.temperature_2m[i],
    lluvia: h.precipitation[i],
    probabilidad: h.precipitation_probability?.[i] ?? null,
    codigo: h.weather_code[i],
    esDeDia: h.is_day?.[i] === 1,
    viento: h.wind_speed_10m?.[i] ?? null,
    rafagas: h.wind_gusts_10m?.[i] ?? null,
    direccion: h.wind_direction_10m?.[i] ?? null,
    presion: h.pressure_msl?.[i] ?? null,
    isoterma: h.freezing_level_height?.[i] ?? null,
  }))
  const iInicio = Math.max(0, todas.findIndex((x) => x.hora >= inicio))
  const horas = todas.slice(iInicio, iInicio + 24)
  // Tendencia de la presión en las últimas 3 horas (una baja rápida anuncia mal tiempo).
  const antes = todas[iInicio - 3]?.presion
  ahora.tendenciaPresion = antes != null && ahora.presion != null ? Math.round((ahora.presion - antes) * 10) / 10 : null

  const dd = d.daily
  const dias = dd.time.map((t, i) => ({
    fecha: new Date(`${t}T12:00:00${_off}`),
    codigo: dd.weather_code[i],
    max: dd.temperature_2m_max[i],
    min: dd.temperature_2m_min[i],
    lluvia: dd.precipitation_sum[i],
    probabilidad: dd.precipitation_probability_max?.[i] ?? null,
    salida: dd.sunrise?.[i] ? fecha(dd.sunrise[i]) : null,
    puesta: dd.sunset?.[i] ? fecha(dd.sunset[i]) : null,
    uv: dd.uv_index_max?.[i] ?? null,
    viento: dd.wind_speed_10m_max?.[i] ?? null,
    rafagas: dd.wind_gusts_10m_max?.[i] ?? null,
    direccion: dd.wind_direction_10m_dominant?.[i] ?? null,
  }))

  return { ahora, horas, dias, elevacion: d.elevation ?? null, obtenido: new Date() }
}

/** Reconstruye las fechas de un pronóstico guardado en el dispositivo. */
export function revivir(g) {
  if (!g?.ahora) return null
  const f = (x) => new Date(x)
  return {
    ahora: { ...g.ahora, hora: f(g.ahora.hora) },
    horas: g.horas.map((x) => ({ ...x, hora: f(x.hora) })),
    dias: g.dias.map((x) => ({ ...x, fecha: f(x.fecha), salida: x.salida && f(x.salida), puesta: x.puesta && f(x.puesta) })),
    obtenido: f(g.obtenido),
    punto: g.punto,
    elevacion: g.elevacion ?? null,
  }
}

// ---- Códigos WMO → texto e ícono ----

const CODIGOS = {
  0: ['Despejado', 'despejado'],
  1: ['Mayormente despejado', 'despejado'],
  2: ['Parcialmente nublado', 'parcial'],
  3: ['Nublado', 'nublado'],
  45: ['Niebla', 'niebla'],
  48: ['Niebla con escarcha', 'niebla'],
  51: ['Llovizna débil', 'llovizna'],
  53: ['Llovizna', 'llovizna'],
  55: ['Llovizna intensa', 'llovizna'],
  56: ['Llovizna helada', 'llovizna'],
  57: ['Llovizna helada intensa', 'llovizna'],
  61: ['Lluvia débil', 'lluvia'],
  63: ['Lluvia moderada', 'lluvia'],
  65: ['Lluvia fuerte', 'lluvia-fuerte'],
  66: ['Lluvia helada', 'lluvia'],
  67: ['Lluvia helada fuerte', 'lluvia-fuerte'],
  71: ['Nevada débil', 'nieve'],
  73: ['Nevada moderada', 'nieve'],
  75: ['Nevada fuerte', 'nieve'],
  77: ['Granos de nieve', 'nieve'],
  80: ['Chubascos débiles', 'lluvia'],
  81: ['Chubascos', 'lluvia'],
  82: ['Chubascos violentos', 'lluvia-fuerte'],
  85: ['Chubascos de nieve', 'nieve'],
  86: ['Chubascos de nieve fuertes', 'nieve'],
  95: ['Tormenta eléctrica', 'tormenta'],
  96: ['Tormenta con granizo', 'tormenta'],
  97: ['Tormenta eléctrica fuerte', 'tormenta'],
  99: ['Tormenta con granizo fuerte', 'tormenta'],
}

export function describir(codigo) {
  const [texto, icono] = CODIGOS[codigo] ?? ['Sin dato', 'nublado']
  return { texto, icono }
}

const PUNTOS = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste']
export function direccionViento(grados) {
  return PUNTOS[Math.round((((grados % 360) + 360) % 360) / 45) % 8]
}

/** Índice UV en palabras, con la escala de la OMS. */
export function nivelUV(uv) {
  if (uv == null) return null
  if (uv < 3) return { texto: 'Bajo', consejo: 'No hace falta protegerse.' }
  if (uv < 6) return { texto: 'Moderado', consejo: 'Usa bloqueador si estarás afuera.' }
  if (uv < 8) return { texto: 'Alto', consejo: 'Bloqueador, gorro y lentes al mediodía.' }
  if (uv < 11) return { texto: 'Muy alto', consejo: 'Evita el sol entre 11 y 16 h.' }
  return { texto: 'Extremo', consejo: 'Evita el sol al mediodía; protégete siempre.' }
}

/** Escala de Beaufort resumida en palabras. */
export function nivelViento(kmh) {
  if (kmh == null) return null
  if (kmh < 6) return 'Calma'
  if (kmh < 20) return 'Brisa suave'
  if (kmh < 39) return 'Viento moderado'
  if (kmh < 62) return 'Viento fuerte'
  if (kmh < 89) return 'Temporal'
  return 'Temporal muy fuerte'
}

/** Intensidad de lluvia en mm/h, con los rangos de la Organización Meteorológica Mundial. */
export function intensidad(mmh) {
  if (mmh <= 0) return null
  if (mmh < 2.5) return 'débil'
  if (mmh < 10) return 'moderada'
  if (mmh < 50) return 'fuerte'
  return 'muy fuerte'
}

// ---- Medición real + modelo ----

function iconoDeMedicion(o) {
  const f = o.fenomeno ?? ''
  if (/Tormenta/.test(f)) return 'tormenta'
  if (/Nieve|Granizo/.test(f)) return 'nieve'
  if (/Niebla|Neblina/.test(f)) return 'niebla'
  if (o.precipitacion) return /fuerte/.test(f) ? 'lluvia-fuerte' : /Llovizna/.test(f) ? 'llovizna' : 'lluvia'
  if (o.cielo === 'Despejado') return 'despejado'
  if (o.cielo === 'Pocas nubes' || o.cielo === 'Parcialmente nublado') return 'parcial'
  if (o.cielo) return 'nublado'
  return null
}

/**
 * Condiciones "ahora": si hay una medición real cercana y reciente, manda lo medido;
 * el modelo completa lo que la estación no mide. Devuelve también de dónde salió cada dato.
 */
export function condicionesActuales(modelo, obs) {
  if (!modelo) return null
  const d = describir(modelo.codigo)
  if (!obs || obs.temperatura == null) {
    return { ...modelo, texto: d.texto, icono: d.icono, medido: false }
  }
  const icono = iconoDeMedicion(obs) ?? d.icono
  return {
    ...modelo,
    temperatura: obs.temperatura,
    // La sensación del modelo se corrige por la diferencia entre lo medido y lo estimado.
    sensacion: modelo.sensacion + (obs.temperatura - modelo.temperatura),
    humedad: obs.humedad ?? modelo.humedad,
    viento: obs.viento ?? modelo.viento,
    rafagas: obs.rafagas ?? Math.max(modelo.rafagas, obs.viento ?? 0),
    texto: obs.fenomeno ?? obs.cielo ?? d.texto,
    icono,
    medido: true,
    lloviendoEnEstacion: obs.precipitacion,
    temperaturaModelo: modelo.temperatura,
    estacion: { nombre: obs.nombre, distanciaKm: obs.distanciaKm, hora: obs.hora, fuente: obs.fuente },
  }
}
