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

const piperListo = () => existsSync(path.join(DIR_VOZ, MODELO))
export const geminiActivo = () => Boolean(process.env.GEMINI_API_KEY)
export const proveedorVoz = () => (process.env.VOZ_ACTIVA === 'false' ? null : geminiActivo() ? 'gemini' : piperListo() ? 'piper' : null)
export const vozActiva = () => proveedorVoz() !== null

// ---------- Voz con IA de Google (Gemini): humana, expresiva, con el estilo de ZUMI ----------
// GEMINI_API_KEY (aistudio.google.com), GEMINI_VOZ (voz prediseñada) y GEMINI_TTS_MODELO.
export const ESTILO_ZUMI =
  process.env.ZUMI_ESTILO_VOZ ??
  'Personaje animado: un panda rojo joven, súper extrovertido, juguetón y con mucha energía, tierno y cariñoso. Habla en español latino, rápido y sonriendo, con entusiasmo y chispa, como el héroe alegre de una película animada.'
const MODELOS_GEMINI = () => (process.env.GEMINI_TTS_MODELO ? [process.env.GEMINI_TTS_MODELO] : ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts', 'gemini-3.1-flash-tts-preview'])

/** Texto + estilo → WAV (16 bits, mono). Usa la API de «interactions» de Gemini. */
// Voces de Gemini que se pueden probar (para elegir la de ZUMI); la que usa la app es GEMINI_VOZ.
export const VOCES_PRUEBA = ['Fenrir', 'Puck', 'Leda', 'Sadachbia', 'Laomedeia', 'Zephyr', 'Aoede']

export async function vozGemini(texto, { fetchFn = fetch, estilo = ESTILO_ZUMI, voz = process.env.GEMINI_VOZ ?? 'Fenrir' } = {}) {
  let ultimoError = null
  for (const model of MODELOS_GEMINI()) {
    const r = await fetchFn('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        input: [{ type: 'user_input', content: [{ type: 'text', text: texto, annotations: [{ type: 'speech_metadata', style: estilo }] }] }],
        response_format: { type: 'audio' },
        generation_config: { speech_config: [{ voice: voz }] },
      }),
      signal: AbortSignal.timeout(20000),
    })
    if (!r.ok) {
      ultimoError = new Error(`Gemini ${r.status} ${(await r.text().catch(() => '')).slice(0, 160)}`)
      if (r.status === 404 || r.status === 400) continue // otro modelo
      throw ultimoError
    }
    const d = await r.json()
    const audio = (d.steps ?? []).filter((x) => x.type === 'model_output').flatMap((x) => x.content ?? []).filter((c) => c.type === 'audio').at(-1)
    if (!audio?.data) throw new Error('Gemini no devolvió audio')
    const b = Buffer.from(audio.data, 'base64')
    return b.subarray(0, 4).toString() === 'RIFF' ? b : pcmAWav(b, 24000)
  }
  throw ultimoError ?? new Error('Gemini sin modelo de voz disponible')
}

function pcmAWav(pcm, rate) {
  const h = Buffer.alloc(44)
  h.write('RIFF', 0)
  h.writeUInt32LE(36 + pcm.length, 4)
  h.write('WAVEfmt ', 8)
  h.writeUInt32LE(16, 16)
  h.writeUInt16LE(1, 20)
  h.writeUInt16LE(1, 22)
  h.writeUInt32LE(rate, 24)
  h.writeUInt32LE(rate * 2, 28)
  h.writeUInt16LE(2, 32)
  h.writeUInt16LE(16, 34)
  h.write('data', 36)
  h.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([h, pcm])
}
export const ajustesVoz = () => {
  // Personaje juvenil y enérgico: tono más agudo y un ritmo algo más rápido que una voz normal.
  const tono = Math.min(1.5, Math.max(0.8, Number(process.env.VOZ_TONO ?? 1.3)))
  const ritmo = Math.min(1.4, Math.max(0.7, Number(process.env.VOZ_RITMO ?? 1.08)))
  return { tono, velocidad: Number(process.env.VOZ_VELOCIDAD ?? (ritmo / tono).toFixed(3)), salida: 16000 }
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
const clave = (t) => createHash('sha1').update(`${proveedorVoz()}|${process.env.GEMINI_VOZ ?? ''}|${JSON.stringify(ajustesVoz())}|${t}`).digest('hex')

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
// Matices de actuación de la MISMA voz (no otra voz): la película pide ritmo de escena con pausas.
export const MATICES = { escena: ' Está actuando una escena corta: habla con pausas expresivas entre frases y un ritmo algo más pausado, sin perder la energía.' }

export async function sintetizar(texto, { matiz, voz } = {}) {
  voz = VOCES_PRUEBA.includes(voz) ? voz : undefined
  const t = paraVoz(texto)
  const extra = MATICES[matiz] ?? ''
  if (!t) throw Object.assign(new Error('Texto vacío'), { status: 400 })
  const k = clave(t + (extra ? `|${matiz}` : '') + (voz ? `|v:${voz}` : ''))
  if (cache.has(k)) {
    const b = cache.get(k)
    cache.delete(k)
    cache.set(k, b)
    return b
  }
  if (proveedorVoz() === 'gemini') {
    // Una sola voz: si Gemini falla se reintenta, pero no se cambia a otra voz (salvo VOZ_RESPALDO=true).
    let error = null
    for (let intento = 0; intento < 2; intento++) {
      try {
        const b = await vozGemini(t, { estilo: ESTILO_ZUMI + extra, ...(voz ? { voz } : {}) })
        cache.set(k, b)
        if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value)
        return b
      } catch (e) {
        error = e
        console.error('Voz Gemini falló:', e.message)
        await new Promise((ok) => setTimeout(ok, 900))
      }
    }
    if (process.env.VOZ_RESPALDO !== 'true' || !piperListo()) throw error
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
  if (!piperListo() || proveedorVoz() === 'gemini') return
  sintetizar('Hola, soy Zumi.').catch((e) => console.error('Voz de ZUMI no disponible:', e.message))
}
