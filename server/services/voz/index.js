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
// GEMINI_API_KEY (aistudio.google.com), ZUMI_VOZ (voz prediseñada; por defecto Zephyr, la elegida para ZUMI) y GEMINI_TTS_MODELO.
export const ESTILO_ZUMI =
  process.env.ZUMI_ESTILO_VOZ ??
  'Personaje animado: un panda rojo joven, súper extrovertido, juguetón y con mucha energía, tierno y cariñoso. Habla en español latino, rápido y sonriendo, con entusiasmo y chispa, como el héroe alegre de una película animada.'
const MODELOS_GEMINI = () => (process.env.GEMINI_TTS_MODELO ? [process.env.GEMINI_TTS_MODELO] : ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts', 'gemini-3.1-flash-tts-preview'])

/** Texto + estilo → WAV (16 bits, mono). Usa la API de «interactions» de Gemini. */
// Voces de Gemini que se pueden probar (para elegir la de ZUMI); la que usa la app es VOZ_ZUMI().
export const VOZ_ZUMI = () => process.env.ZUMI_VOZ || 'Zephyr'
export const VOCES_PRUEBA = ['Fenrir', 'Puck', 'Leda', 'Sadachbia', 'Laomedeia', 'Zephyr', 'Aoede']

/** Qué modelo generó la última frase (diagnóstico: distintos modelos suenan distinto). */
export let ultimoModelo = null
const SIN_METADATOS = new Set()
export async function vozGemini(texto, { fetchFn = fetch, estilo = ESTILO_ZUMI, voz = VOZ_ZUMI(), solo } = {}) {
  let ultimoError = null
  for (const model of solo ? [solo] : MODELOS_GEMINI()) {
    // Algunos modelos no aceptan el estilo como metadato: se les da como instrucción hablada (no la leen).
    const sinMeta = SIN_METADATOS.has(model)
    const contenido = sinMeta
      ? { type: 'text', text: `Di con la voz de un panda rojo joven, alegre, cariñoso y con mucha energía, en español latino: ${texto}` }
      : { type: 'text', text: texto, annotations: [{ type: 'speech_metadata', style: estilo }] }
    const r = await fetchFn('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        input: [{ type: 'user_input', content: [contenido] }],
        response_format: { type: 'audio' },
        generation_config: { speech_config: [{ voice: voz }] },
      }),
      signal: AbortSignal.timeout(20000),
    })
    if (!r.ok) {
      ultimoError = new Error(`Gemini ${r.status} ${(await r.text().catch(() => '')).slice(0, 160)}`)
      console.warn(`Voz: el modelo ${model} falló (${ultimoError.message.slice(0, 120)})`)
      if (r.status === 400 && !sinMeta && /speech metadata is not supported/i.test(ultimoError.message)) {
        SIN_METADATOS.add(model)
        return vozGemini(texto, { fetchFn, estilo, voz, solo: model })
      }
      if (r.status === 404 || r.status === 400 || r.status === 429) continue // otro modelo (o sin cupo en este): misma voz
      throw ultimoError
    }
    const d = await r.json()
    const audio = (d.steps ?? []).filter((x) => x.type === 'model_output').flatMap((x) => x.content ?? []).filter((c) => c.type === 'audio').at(-1)
    if (!audio?.data) throw new Error('Gemini no devolvió audio')
    const b = Buffer.from(audio.data, 'base64')
    ultimoModelo = model
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

// Caché permanente en la base de datos: cada frase se genera una sola vez (ahorra cupo y dinero de la voz
// con IA, y sobrevive a los reinicios del servidor). Se guardan como máximo VOZ_CACHE_MAX frases (las más usadas).
let base = null
export const usarBaseDeVoz = (db) => (base = db)
const CACHE_DB_MAX = () => Number(process.env.VOZ_CACHE_MAX ?? 800)
async function deBase(k) {
  if (!base) return null
  try {
    const { rows } = await base.query('UPDATE voz_cache SET usos = usos + 1, usado_en = now() WHERE clave = $1 RETURNING wav', [k])
    return rows[0]?.wav ?? null
  } catch {
    return null // sin tabla o sin base: se sigue sin caché permanente
  }
}
function aBase(k, wav) {
  if (!base) return
  base
    .query('INSERT INTO voz_cache (clave, wav) VALUES ($1, $2) ON CONFLICT (clave) DO NOTHING', [k, wav])
    .then(() =>
      // poda de vez en cuando: quedan las frases usadas más recientemente
      Math.random() < 0.05
        ? base.query('DELETE FROM voz_cache WHERE clave IN (SELECT clave FROM voz_cache ORDER BY usado_en DESC OFFSET $1)', [CACHE_DB_MAX()])
        : null,
    )
    .catch((e) => console.error('No se pudo guardar la voz en la base:', e.message))
}
const recordar = (k, b) => {
  cache.set(k, b)
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value)
}

// Cuando Gemini responde «sin cupo», no se le vuelve a preguntar hasta que se renueve (respuesta inmediata).
let sinCupoHasta = 0
export const vozSinCupo = () => Date.now() < sinCupoHasta
function anotarCupo(error) {
  const m = String(error?.message ?? '')
  if (!/\b429\b|rate limit|quota|RESOURCE_EXHAUSTED/i.test(m)) return
  const r = /retry in (?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?/i.exec(m)
  const ms = r ? ((+r[1] || 0) * 3600 + (+r[2] || 0) * 60 + (+r[3] || 0)) * 1000 : 0
  sinCupoHasta = Date.now() + Math.min(Math.max(ms, 60_000), 12 * 3600_000)
}
const clave = (t) => createHash('sha1').update(`${proveedorVoz()}|${VOZ_ZUMI()}|${JSON.stringify(ajustesVoz())}|${t}`).digest('hex')

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
  const guardada = await deBase(k)
  if (guardada) {
    const b = Buffer.from(guardada)
    recordar(k, b)
    return b
  }
  if (proveedorVoz() === 'gemini') {
    // Una sola voz: si Gemini falla se reintenta, pero no se cambia a otra voz (salvo VOZ_RESPALDO=true).
    let error = null
    for (let intento = 0; intento < 2 && !vozSinCupo(); intento++) {
      try {
        const b = await vozGemini(t, { estilo: ESTILO_ZUMI + extra, ...(voz ? { voz } : {}) })
        recordar(k, b)
        aBase(k, b)
        return b
      } catch (e) {
        error = e
        anotarCupo(e)
        console.error('Voz Gemini falló:', e.message)
        if (!vozSinCupo()) await new Promise((ok) => setTimeout(ok, 900))
      }
    }
    error ??= Object.assign(new Error('La voz de ZUMI descansa: se acabó el cupo de hoy'), { status: 503 })
    if (process.env.VOZ_RESPALDO !== 'true' || !piperListo()) throw Object.assign(error, { status: 503 })
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
  recordar(k, b)
  return b
}

/** Precalienta el modelo para que la primera frase no tarde (se llama al arrancar). */
export function precalentar() {
  if (!piperListo() || proveedorVoz() === 'gemini') return
  sintetizar('Hola, soy Zumi.').catch((e) => console.error('Voz de ZUMI no disponible:', e.message))
}
