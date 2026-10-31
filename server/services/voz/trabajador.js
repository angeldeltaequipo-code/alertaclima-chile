// Hilo aparte que genera la voz de ZUMI (la síntesis ocupa la CPU y no debe frenar al servidor).
// Recibe { id, texto } y responde { id, wav } o { id, error }.
import { parentPort, workerData } from 'node:worker_threads'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const sherpa = require('sherpa-onnx-node')
const { dir, modelo, velocidad, tono, salida } = workerData

const tts = new sherpa.OfflineTts({
  model: { vits: { model: `${dir}/${modelo}`, tokens: `${dir}/tokens.txt`, dataDir: `${dir}/espeak-ng-data` }, numThreads: 1, provider: 'cpu' },
  maxNumSentences: 1,
})

/**
 * Voz de personaje: se genera más lenta y luego se reproduce más rápido (remuestreo), así sube el
 * tono sin cambiar el ritmo. Sale en WAV de 16 bits a `salida` Hz.
 */
function wav(samples, rate) {
  const fuente = rate * tono // la tasa «real» a la que se escucharía tras subir el tono
  const n = Math.floor((samples.length * salida) / fuente)
  const buf = Buffer.alloc(44 + n * 2)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + n * 2, 4)
  buf.write('WAVEfmt ', 8)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(salida, 24)
  buf.writeUInt32LE(salida * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(n * 2, 40)
  const paso = fuente / salida
  for (let i = 0; i < n; i++) {
    const x = i * paso
    const j = Math.floor(x)
    const f = x - j
    const v = (samples[j] ?? 0) * (1 - f) + (samples[j + 1] ?? 0) * f
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767 * 0.95))), 44 + i * 2)
  }
  return buf
}

parentPort.on('message', ({ id, texto }) => {
  try {
    const a = tts.generate({ text: texto, sid: 0, speed: velocidad })
    const b = wav(a.samples, a.sampleRate)
    parentPort.postMessage({ id, wav: b }, [b.buffer])
  } catch (e) {
    parentPort.postMessage({ id, error: e.message })
  }
})
parentPort.postMessage({ listo: true })
