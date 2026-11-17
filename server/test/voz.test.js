import { test } from 'node:test'
import assert from 'node:assert/strict'
import { paraVoz, ajustesVoz } from '../services/voz/index.js'

test('la voz dice los números y símbolos como se leen', () => {
  assert.equal(paraVoz('Hoy hay 18° y viento de 12 km/h'), 'Hoy hay 18 grados y viento de 12 kilómetros por hora')
  assert.equal(paraVoz('Caerán 2,5 mm a las 15:00'), 'Caerán 2 coma 5 milímetros a las 15 horas')
  assert.equal(paraVoz('Soy ZUMI 🐼, sigue a SENAPRED'), 'Soy Zumi , sigue a Senapred')
  assert.ok(paraVoz('a'.repeat(1000)).length <= 400)
})

test('tono de personaje: más agudo y un poco más rápido', () => {
  const a = ajustesVoz()
  assert.ok(a.tono > 1 && a.tono <= 1.5)
  assert.ok(a.velocidad * a.tono > 0.95 && a.velocidad * a.tono < 1.2)
})

test('voz Gemini: pide el estilo de ZUMI y devuelve WAV', async () => {
  const { vozGemini } = await import('../services/voz/index.js')
  process.env.GEMINI_API_KEY = 'prueba'
  let cuerpo = null
  const pcm = Buffer.alloc(4800)
  const fetchFn = async (url, op) => {
    cuerpo = JSON.parse(op.body)
    return { ok: true, json: async () => ({ steps: [{ type: 'model_output', content: [{ type: 'audio', data: pcm.toString('base64') }] }] }) }
  }
  const wav = await vozGemini('¡Hola!', { fetchFn })
  assert.equal(wav.subarray(0, 4).toString(), 'RIFF')
  assert.equal(wav.readUInt32LE(24), 24000)
  assert.match(cuerpo.input[0].content[0].annotations[0].style, /panda rojo/)
  assert.ok(cuerpo.generation_config.speech_config[0].voice)
  delete process.env.GEMINI_API_KEY
})

test('si Gemini no tiene el modelo, prueba el siguiente', async () => {
  const { vozGemini } = await import('../services/voz/index.js')
  process.env.GEMINI_API_KEY = 'prueba'
  const vistos = []
  const fetchFn = async (url, op) => {
    const m = JSON.parse(op.body).model
    vistos.push(m)
    if (vistos.length === 1) return { ok: false, status: 404, text: async () => 'no existe' }
    return { ok: true, json: async () => ({ steps: [{ type: 'model_output', content: [{ type: 'audio', data: Buffer.alloc(10).toString('base64') }] }] }) }
  }
  await vozGemini('hola', { fetchFn })
  assert.equal(vistos.length, 2)
  delete process.env.GEMINI_API_KEY
})

test('la voz se guarda en la base y no se vuelve a generar', async () => {
  const { sintetizar, usarBaseDeVoz } = await import('../services/voz/index.js')
  process.env.GEMINI_API_KEY = 'prueba'
  const filas = new Map()
  const db = {
    query: async (sql, args) => {
      if (sql.startsWith('UPDATE voz_cache')) return { rows: filas.has(args[0]) ? [{ wav: filas.get(args[0]) }] : [] }
      if (sql.startsWith('INSERT INTO voz_cache')) filas.set(args[0], args[1])
      return { rows: [] }
    },
  }
  usarBaseDeVoz(db)
  let llamadas = 0
  const fetchOriginal = globalThis.fetch
  globalThis.fetch = async () => (llamadas++, { ok: true, json: async () => ({ steps: [{ type: 'model_output', content: [{ type: 'audio', data: Buffer.alloc(48).toString('base64') }] }] }) })
  try {
    const texto = `Frase guardada ${Math.random()}`
    await sintetizar(texto)
    await new Promise((r) => setTimeout(r, 10))
    assert.equal(filas.size, 1)
    assert.equal(llamadas, 1)
  } finally {
    globalThis.fetch = fetchOriginal
    usarBaseDeVoz(null)
    delete process.env.GEMINI_API_KEY
  }
})

test('sin cupo de Gemini, la voz responde «descansa» al instante sin reintentar', async () => {
  const { sintetizar, vozSinCupo } = await import('../services/voz/index.js')
  process.env.GEMINI_API_KEY = 'prueba'
  let llamadas = 0
  const fetchOriginal = globalThis.fetch
  globalThis.fetch = async () => (llamadas++, { ok: false, status: 429, text: async () => 'Rate limit exceeded (limit: 10 requests per day on Free Tier). Please retry in 3h2m1s' })
  try {
    await assert.rejects(sintetizar(`Sin cupo ${Math.random()}`), (e) => e.status === 503)
    assert.ok(vozSinCupo())
    const antes = llamadas
    const t0 = Date.now()
    await assert.rejects(sintetizar(`Otra ${Math.random()}`), (e) => e.status === 503)
    assert.equal(llamadas, antes) // no vuelve a llamar a Gemini
    assert.ok(Date.now() - t0 < 200)
  } finally {
    globalThis.fetch = fetchOriginal
    delete process.env.GEMINI_API_KEY
  }
})
