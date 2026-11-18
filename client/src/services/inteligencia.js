// Señales de alto valor, calculadas en el teléfono con datos abiertos:
//  - lluviaPronto: «empieza a llover en 15 minutos» (pronóstico cada 15 minutos de Open-Meteo)
//  - aire: calidad del aire (modelo CAMS vía Open-Meteo), con los niveles de episodio de Chile
//  - precision: cuánto acertó el pronóstico de ayer en tu comuna (archivo de corridas anteriores)
//  - momentosDelDia: las horas clave de hoy en una línea
const cache = new Map()
async function pedir(url, ms = 10 * 60e3) {
  const c = cache.get(url)
  if (c && Date.now() - c.t < ms) return c.d
  const r = await fetch(url, { signal: AbortSignal.timeout(9000) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const d = await r.json()
  cache.set(url, { t: Date.now(), d })
  return d
}
const ll = (p) => `latitude=${p.lat.toFixed(3)}&longitude=${p.lng.toFixed(3)}`

// ---- Lluvia en los próximos minutos ----
export async function lluviaPronto(punto) {
  const d = await pedir(`https://api.open-meteo.com/v1/forecast?${ll(punto)}&minutely_15=precipitation&forecast_minutely_15=12&past_minutely_15=1&timezone=auto`, 5 * 60e3)
  const t = d.minutely_15?.time ?? []
  const mm = d.minutely_15?.precipitation ?? []
  if (!t.length) return null
  const ahora = Date.now()
  const off = (d.utc_offset_seconds ?? 0) * 1000
  const fechas = t.map((x) => new Date(new Date(`${x}Z`).getTime() - off))
  const i0 = Math.max(0, fechas.findIndex((f) => f.getTime() + 15 * 60e3 > ahora))
  const llueve = (i) => (mm[i] ?? 0) >= 0.1
  if (llueve(i0)) {
    let j = i0
    while (j < mm.length && llueve(j)) j++
    const total = mm.slice(i0, j).reduce((a, b) => a + b, 0)
    return { estado: 'lloviendo', minutos: j >= mm.length ? null : Math.max(5, Math.round((fechas[j] - ahora) / 60e3)), mm: total, intensidad: intensidad(Math.max(...mm.slice(i0, j)) * 4) }
  }
  const k = mm.findIndex((v, i) => i > i0 && v >= 0.1)
  if (k < 0) return { estado: 'seco' }
  let j = k
  while (j < mm.length && llueve(j)) j++
  return { estado: 'empieza', minutos: Math.max(5, Math.round((fechas[k] - ahora) / 60e3)), dura: (j - k) * 15, mm: mm.slice(k, j).reduce((a, b) => a + b, 0), intensidad: intensidad(Math.max(...mm.slice(k, j)) * 4) }
}
const intensidad = (mmh) => (mmh >= 8 ? 'fuerte' : mmh >= 2 ? 'moderada' : 'débil')

// ---- Calidad del aire ----
// Niveles de episodio por MP2,5 (promedio 24 h) que usa Chile: Bueno, Regular, Alerta, Preemergencia, Emergencia.
export const NIVELES_AIRE = [
  { hasta: 50, nombre: 'Bueno', color: '#3ddc84', consejo: 'Aire limpio: ideal para salir y hacer deporte.' },
  { hasta: 80, nombre: 'Regular', color: '#ffd23f', consejo: 'Las personas sensibles (asma, adultos mayores, guaguas) pueden evitar el ejercicio fuerte al aire libre.' },
  { hasta: 110, nombre: 'Nivel alerta', color: '#ff9f43', consejo: 'Evita el ejercicio al aire libre y la calefacción a leña. Ventila temprano.' },
  { hasta: 170, nombre: 'Nivel preemergencia', color: '#ff5a5f', consejo: 'Quédate adentro lo más posible, sobre todo niños, adultos mayores y personas con enfermedades respiratorias.' },
  { hasta: Infinity, nombre: 'Nivel emergencia', color: '#b03aff', consejo: 'Aire muy contaminado: no hagas actividad física afuera y consulta si tienes síntomas.' },
]
export const nivelAire = (pm25) => NIVELES_AIRE.find((n) => pm25 < n.hasta) ?? NIVELES_AIRE.at(-1)

export async function aire(punto) {
  const d = await pedir(`https://air-quality-api.open-meteo.com/v1/air-quality?${ll(punto)}&current=pm2_5,pm10,us_aqi&hourly=pm2_5&past_days=1&forecast_days=2&timezone=auto`, 30 * 60e3)
  const horas = (d.hourly?.time ?? []).map((t, i) => ({ hora: new Date(`${t}:00`), pm25: d.hourly.pm2_5[i] })).filter((h) => h.pm25 != null)
  const ahora = Date.now()
  const pasadas = horas.filter((h) => h.hora.getTime() <= ahora).slice(-24)
  const prom24 = pasadas.length ? pasadas.reduce((a, b) => a + b.pm25, 0) / pasadas.length : d.current?.pm2_5
  const futuras = horas.filter((h) => h.hora.getTime() > ahora).slice(0, 24)
  const peor = futuras.reduce((m, h) => (h.pm25 > (m?.pm25 ?? -1) ? h : m), null)
  return { pm25: d.current?.pm2_5, pm10: d.current?.pm10, aqi: d.current?.us_aqi, prom24, nivel: nivelAire(prom24 ?? 0), futuras, peor }
}

// ---- ¿Cuánto acertó el pronóstico? ----
/** Compara lo que el pronóstico decía el día anterior con lo que pasó, en los últimos 7 días. */
export async function precision(punto) {
  const d = await pedir(
    `https://previous-runs-api.open-meteo.com/v1/forecast?${ll(punto)}&hourly=temperature_2m,temperature_2m_previous_day1,precipitation,precipitation_previous_day1&past_days=7&forecast_days=1&timezone=auto`,
    6 * 3600e3,
  )
  const h = d.hourly
  if (!h?.time?.length) return null
  const ahora = Date.now()
  const dias = new Map()
  h.time.forEach((t, i) => {
    if (new Date(`${t}:00`).getTime() > ahora - 3600e3) return
    const real = h.temperature_2m[i]
    const prev = h.temperature_2m_previous_day1[i]
    if (real == null || prev == null) return
    const k = t.slice(0, 10)
    const x = dias.get(k) ?? { err: [], llReal: 0, llPrev: 0 }
    x.err.push(Math.abs(real - prev))
    x.llReal += h.precipitation[i] ?? 0
    x.llPrev += h.precipitation_previous_day1[i] ?? 0
    dias.set(k, x)
  })
  const lista = [...dias.values()].filter((x) => x.err.length >= 12)
  if (lista.length < 3) return null
  // un día «acertado»: temperatura con error medio bajo 2 °C y lluvia sí/no correcta
  const aciertos = lista.filter((x) => x.err.reduce((a, b) => a + b, 0) / x.err.length < 2 && x.llReal >= 1 === x.llPrev >= 1).length
  const errorMedio = lista.flatMap((x) => x.err).reduce((a, b, _, arr) => a + b / arr.length, 0)
  return { dias: lista.length, aciertos, porcentaje: Math.round((aciertos / lista.length) * 100), errorMedio }
}

// ---- Tu día en 10 segundos ----
const hhmm = (d) => d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
export function momentosDelDia({ horas = [], dias = [], ahora }) {
  const hoy = dias[0]
  const fin = new Date()
  fin.setHours(23, 59, 59, 999)
  const resto = horas.filter((h) => h.hora <= fin && h.hora.getTime() > Date.now() - 30 * 60e3)
  const out = []
  const lluvia = resto.find((h) => (h.lluvia ?? 0) >= 0.3)
  if (lluvia && !(ahora?.lluvia > 0)) out.push({ hora: lluvia.hora, icono: '☂', texto: `Lluvia${lluvia.probabilidad ? ` ${lluvia.probabilidad}%` : ''}`, tono: 'lluvia', prioridad: 3 })
  const max = resto.reduce((m, h) => (h.temperatura > (m?.temperatura ?? -99) ? h : m), null)
  if (max && hoy && max.temperatura >= hoy.max - 1) out.push({ hora: max.hora, icono: '↑', texto: `Máx. ${Math.round(max.temperatura)}°`, tono: max.temperatura >= 30 ? 'calor' : 'neutro', prioridad: max.temperatura >= 30 ? 3 : 1 })
  const viento = resto.find((h) => (h.rafagas ?? 0) >= 50)
  if (viento) out.push({ hora: viento.hora, icono: '≋', texto: `Ráfagas ${Math.round(viento.rafagas)} km/h`, tono: 'alerta', prioridad: 3 })
  if (hoy?.uv >= 8 && new Date().getHours() < 15) {
    const m = new Date()
    m.setHours(13, 30, 0, 0)
    out.push({ hora: m, icono: '☀', texto: `UV ${Math.round(hoy.uv)} extremo`, tono: 'calor', prioridad: 2 })
  }
  if (hoy?.puesta && hoy.puesta.getTime() > Date.now()) out.push({ hora: hoy.puesta, icono: '◐', texto: 'Atardecer', tono: 'neutro', prioridad: 1 })
  const manana = dias[1]
  if (manana && manana.min <= 2) {
    const m = manana.salida ?? new Date(Date.now() + 864e5)
    out.push({ hora: m, icono: '❄', texto: `Helada ${Math.round(manana.min)}°`, tono: 'frio', prioridad: 3, manana: true })
  }
  return out
    .sort((a, b) => a.hora - b.hora)
    .slice(0, 5)
    .map((x) => ({ ...x, hhmm: x.manana ? `mañ ${hhmm(x.hora)}` : hhmm(x.hora) }))
}
