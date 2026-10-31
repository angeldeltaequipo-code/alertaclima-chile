// Descarga la voz de ZUMI (Piper es_MX «claude», Apache 2.0, convertida para sherpa-onnx) en server/voz/.
// Se ejecuta al construir en Render. Si falla, el servidor funciona igual y la app usa la voz del teléfono.
import { existsSync, mkdirSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import bz2 from 'unbzip2-stream'
import { x as extraer } from 'tar'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const NOMBRE = 'vits-piper-es_MX-claude-high'
const URL_MODELO = `https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/${NOMBRE}.tar.bz2`
const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../voz')

if (existsSync(path.join(DIR, NOMBRE, 'es_MX-claude-high.onnx'))) {
  console.log('Voz de ZUMI ya descargada')
  process.exit(0)
}
try {
  mkdirSync(DIR, { recursive: true })
  const r = await fetch(URL_MODELO)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  // Descomprime al vuelo (bzip2 + tar), sin depender de programas del sistema
  await pipeline(Readable.fromWeb(r.body), bz2(), extraer({ cwd: DIR }))
  console.log('Voz de ZUMI descargada')
} catch (e) {
  console.error('No se pudo descargar la voz de ZUMI (la app usará la voz del teléfono):', e.message)
}
