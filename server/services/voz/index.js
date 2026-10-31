// Voz propia de ZUMI: síntesis de voz libre (Piper, voz es_MX «claude», licencia Apache 2.0) con
// sherpa-onnx, en nuestro servidor. No depende de servicios pagados ni de la voz del teléfono.
//
// - El modelo se descarga al construir (scripts/descargar-voz.js) en server/voz/.
// - La síntesis corre en un hilo aparte, de a una frase, con una caché de las frases recientes.
// - Ajustes por variables: VOZ_ACTIVA ("false" la apaga), VOZ_TONO (1.25 = más aguda, de
//   personaje), VOZ_VELOCIDAD (velocidad de generación antes de subir el tono).
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { Worker } from 'node:worker_threads'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
export const DIR_VOZ = process.env.VOZ_DIR ?? path.resolve(AQUI, '../../voz/vits-piper-es_MX-claude-high')
const MODELO = 'es_MX-claude-high.onnx'
export const MAX_TEXTO = 400

export const vozActiva = () => process.env.VOZ_ACTIVA !== 'false' && existsSync(path.join(DIR_VOZ, MODELO))
export const ajustesVoz = () => {
  const tono = Math.min(1.5, Math.max(0.8, Number(process.env.VOZ_TONO ?? 1.25)))
  return { tono, velocidad: Number(process.env.VOZ_VELOCIDAD ?? (1 / tono).toFixed(3)), salida: 16000 }
}

/** Texto como se dice: números, símbolos y siglas. */
export function paraVoz(texto) {
  return String(texto ?? '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/(\d+),(\d+)\s*mm/g, '$1 coma $2 milímetros')
    .replace(/(\d+)\s*mm\b/g, '$1 milímetros')
    .replace(/(\d+)\s*km\/h/g, '$1 kilómetros por hora')
    .replace(/(\d+)\s*km\b/g, '$1 kilómetros')
    .replace(/(-?\d+)\s*°/g, '$1 grados')
    .replace(/(\d+)\s*%/g, '$1 por ciento')
    .replace(/(\d{1,2}):00/g, '$1 horas')
    .replace(/(\d{1,2}):(\d{2})/g, '$1 y $2')
    .replace(/\bSENAPRED\b/g, 'Senapred')
    .replace(/\bSHOA\b/g, 'Shoa')
    .replace(/\bCSN\b/g, 'ce ese ene')
    .replace(/\bZUMI\b/g, 'Zumi')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXTO)
}

// Caché en memoria (frases recientes: saludos, reportes repetidos)
const CACHE_MAX = 120
const cache = new Map()
const clave = (t) => createHash('sha1').update(`${JSON.stringify(ajustesVoz())}|${t}`).digest('hex')

let hilo = null
let listo = null
let sig = 0
const pendientes = new Map()
let cola = Promise.resolve()

function iniciar() {
  if (hilo) return listo
  const { tono, velocidad, salida } = ajustesVoz()
  hilo = new Worker(path.join(AQUI, 'trabajador.js'), { workerData: { dir: DIR_VOZ, modelo: MODELO, tono, velocidad, salida } })
  listo = new Promise((ok, mal) => {
    hilo.once('error', mal)
    hilo.on('message', (m) => {
      if (m.listo) return ok()
      const p = pendientes.get(m.id)
      if (!p) return
      pendientes.delete(m.id)
      if (m.error) p.mal(new Error(m.error))
      else p.ok(Buffer.from(m.wav))
    })
  })
  hilo.on('exit', () => {
    for (const p of pendientes.values()) p.mal(new Error('El motor de voz se detuvo'))
    pendientes.clear()
    hilo = null
  })
  return listo
}

/** Genera la frase (WAV). Una a la vez, en orden de llegada. */
export async function sintetizar(texto) {
  const t = paraVoz(texto)
  if (!t) throw Object.assign(new Error('Texto vacío'), { status: 400 })
  const k = clave(t)
  if (cache.has(k)) {
    const b = cache.get(k)
    cache.delete(k)
    cache.set(k, b)
    return b
  }
  await iniciar()
  const trabajo = cola.then(
    () =>
      new Promise((ok, mal) => {
        const id = ++sig
        pendientes.set(id, { ok, mal })
        hilo.postMessage({ id, texto: t })
      }),
  )
  cola = trabajo.catch(() => {})
  const b = await trabajo
  cache.set(k, b)
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value)
  return b
}

/** Precalienta el modelo para que la primera frase no tarde (se llama al arrancar). */
export function precalentar() {
  if (!vozActiva()) return
  sintetizar('Hola, soy Zumi.').catch((e) => console.error('Voz de ZUMI no disponible:', e.message))
}
