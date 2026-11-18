// La memoria de ZUMI: junta todas las bases, agrega una entrada por cada comuna de Chile y responde.
// Se carga aparte (no pesa en el arranque de la app) y queda lista en memoria.
import REGIONES_DATOS from '../../data/comunas.json'
import { buscar, indexar, respuestaDe, sinTildes } from './motor'
import app from './app'
import emergencias from './emergencias'
import clima from './clima'
import chile, { REGIONES } from './chile'
import zumi from './zumi'
import { describir } from '../clima'

const CAPITAL = Object.fromEntries(REGIONES.map(([n, cap]) => [sinTildes(n), cap]))

// Una entrada por comuna: dónde queda y de qué región es.
const COMUNAS = REGIONES_DATOS.flatMap((r) =>
  r.comunas.map((c) => ({ ...c, region: r.etiqueta, capital: CAPITAL[sinTildes(r.nombre)] ?? CAPITAL[sinTildes(r.nombreOficial ?? '')] })),
)
const porComuna = COMUNAS.map((c) => [
  `en que region esta ${c.nombre}|donde queda ${c.nombre}|${c.nombre} de que region es|donde esta ${c.nombre}|ubicacion de ${c.nombre}`,
  () =>
    `${c.nombre} está en la ${c.region}${c.capital && sinTildes(c.capital) !== sinTildes(c.nombre) ? `, cuya capital es ${c.capital}` : c.capital ? ', y es su capital' : ''}. Si quieres, te cuento cómo está el clima allá: pregúntame cómo está el clima en ${c.nombre}.`,
  { tema: 'chile' },
])

const TODAS = [...emergencias, ...app, ...clima, ...zumi, ...chile, ...porComuna]
const base = indexar(TODAS)

export const totalFrases = base.frases.length
export const totalRespuestas = TODAS.length

/** Respuesta de la memoria: { texto, puntaje, tema, frase } o null. */
export function deMemoria(pregunta, ctx = {}) {
  const [m] = buscar(base, pregunta, 1)
  if (!m) return null
  const e = TODAS[m.id]
  return { texto: respuestaDe(e, ctx), puntaje: m.puntaje, tema: e[2]?.tema ?? 'general', frase: m.frase }
}

const SUGERIR = {
  emergencias: ['¿Qué hago si tiembla?', '¿Qué lleva la mochila de emergencia?', '¿Cuáles son los números de emergencia?'],
  salud: ['¿Qué hago con un golpe de calor?', '¿Cómo hago RCP?', '¿Qué es el hanta?'],
  clima: ['¿Va a llover mañana?', '¿Qué es la isoterma cero?', '¿Qué es el índice UV?'],
  chile: ['¿Cuál es la comida típica de Chile?', '¿Qué significa cachai?', '¿Qué visitar en Los Lagos?'],
  app: ['¿Cómo funciona el GPS familiar?', '¿Qué hace el botón SOS?', '¿Cuánto cuesta ZUMI+?'],
  zumi: ['¿Qué animal eres?', 'Cuéntame un dato curioso', '¿Sabes bailar cueca?'],
  vida: ['¿Qué ropa me pongo?', '¿Puedo tender la ropa?', '¿Cómo cuido mis plantas de la helada?'],
}

/**
 * Nunca «no sé»: si la pregunta se parece a algo que ZUMI conoce, lo ofrece; si no, propone temas.
 */
export function respaldo(pregunta, { nombre } = {}) {
  const opciones = buscar(base, pregunta, 3)
  const [m] = opciones
  if (m && m.puntaje >= 0.45) {
    const e = TODAS[m.id]
    return `${nombre ? `${nombre}, ` : ''}creo que me preguntas algo como «${m.frase}». Te cuento: ${respuestaDe(e, {})}`
  }
  const temas = Object.values(SUGERIR)
  const tres = [0, 1, 2].map((i) => temas[(Math.floor(Math.random() * temas.length) + i * 2) % temas.length][i])
  return `${nombre ? `Uy, ${nombre}` : 'Uy'}, esa pregunta me pilló volando, ¡pero aprendo todos los días! Te puedo ayudar con el clima de cualquier comuna de Chile, emergencias, primeros auxilios, la app o datos de Chile. Por ejemplo: ${tres.join(' ')}`
}

// ---- El clima de cualquier comuna de Chile, al momento ----
const NOMBRES = COMUNAS.map((c) => ({ c, n: sinTildes(c.nombre) })).sort((a, b) => b.n.length - a.n.length)
const PIDE_CLIMA = /\b(clima|tiempo|temperatura|grados|llov|lluv|llue|calor|frio|pronostico|viento|nieve|neva|como esta|como estara|hace)/

/** ¿Pregunta por el clima en otra comuna? Devuelve la comuna o null. */
export function comunaPedida(pregunta) {
  const t = ` ${sinTildes(pregunta).replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ')} `
  if (!PIDE_CLIMA.test(t)) return null
  for (const { c, n } of NOMBRES) {
    const i = t.indexOf(` ${n} `)
    if (i < 0) continue
    // el nombre tiene que venir después de «en», «de», «para» o «a» (así «Navidad» o «Primavera» sueltas no se confunden)
    const antes = t.slice(Math.max(0, i - 6), i)
    if (/\b(en|de|para|a|por|sobre)\s*$/.test(antes)) return c
  }
  return null
}

export async function climaDeComuna(c, pregunta) {
  const [lat, lng] = c.centro
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code&forecast_days=3&timezone=auto`
  const r = await fetch(u, { signal: AbortSignal.timeout(8000) })
  if (!r.ok) throw new Error('sin clima')
  const d = await r.json()
  const t = sinTildes(pregunta)
  const k = /pasado manana/.test(t) ? 2 : /manana/.test(t) ? 1 : 0
  const g = (n) => `${Math.round(n)} grados`
  const dia = { max: d.daily.temperature_2m_max[k], min: d.daily.temperature_2m_min[k], mm: d.daily.precipitation_sum[k], prob: d.daily.precipitation_probability_max?.[k], codigo: d.daily.weather_code[k] }
  const cuando = k === 2 ? 'Pasado mañana' : k === 1 ? 'Mañana' : 'Hoy'
  const lluvia = dia.mm >= 1 ? `, con unos ${Math.round(dia.mm)} milímetros de lluvia` : dia.prob >= 40 ? `, con ${dia.prob} por ciento de probabilidad de lluvia` : ', sin lluvia importante'
  const ahora = k === 0 && d.current ? `En ${c.nombre} ahora hay ${g(d.current.temperature_2m)} y ${describir(d.current.weather_code).texto.toLowerCase()}. ` : `${cuando} en ${c.nombre}: `
  return `${ahora}${k === 0 ? 'Hoy' : ''}${k === 0 ? ' la' : 'la'} máxima será de ${g(dia.max)} y la mínima de ${g(dia.min)}${lluvia}.`.replace(/\s+/g, ' ')
}
