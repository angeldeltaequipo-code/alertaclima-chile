// Examen de ZUMI: pasa cada pregunta del banco por su memoria y mide cuántas responde bien.
//   npm run evaluar:zumi            → resumen
//   npm run evaluar:zumi -- --fallas → además, lista las que fallan
// «Bien» = responde directo (puntaje ≥ 0,7) o con seguridad media (≥ 0,55) y la respuesta contiene lo esperado.
import { build } from 'esbuild'
import { readFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const salida = join(mkdtempSync(join(tmpdir(), 'zumi-')), 'saber.mjs')
await build({ entryPoints: [join(aqui, '../src/services/saber/index.js')], bundle: true, platform: 'node', format: 'esm', outfile: salida, logLevel: 'error' })
const { decidir, totalFrases, totalRespuestas } = await import(pathToFileURL(salida))
const archivo = process.argv.includes('--ciega') ? 'evaluacion-zumi-ciega.json' : 'evaluacion-zumi.json'
const banco = JSON.parse(readFileSync(join(aqui, archivo), 'utf8'))

let bien = 0
let directa = 0
let malEntendida = 0
let sinRespuesta = 0
let aclara = 0
const fallas = []
for (const [p, esperado] of banco) {
  const m = decidir(p)
  if (m.tipo === 'aclarar') {
    aclara++
    fallas.push(`? DUDA ${p}  →  ${m.opciones.join(' | ')}`)
    continue
  }
  const ok = m.tipo !== 'nada' && esperado.some((e) => m.texto.includes(e))
  if (ok) {
    bien++
    if (m.tipo === 'responder') directa++
  } else if (m.tipo !== 'nada') {
    malEntendida++
    fallas.push(`✗ MAL  ${p}  →  «${m.frase}» (${m.puntaje.toFixed(2)})`)
  } else {
    sinRespuesta++
    fallas.push(`· NADA ${p}`)
  }
}
const pct = (n) => `${((n / banco.length) * 100).toFixed(1)} %`
console.log(`ZUMI · memoria: ${totalRespuestas} respuestas, ${totalFrases} formas de preguntar`)
console.log(`Examen ${archivo.includes('ciega') ? 'CIEGO (no usado para ajustar)' : 'de práctica'}: ${banco.length} preguntas`)
console.log(`  Responde bien:          ${bien}  (${pct(bien)})   · directo: ${directa}`)
console.log(`  Responde otra cosa:     ${malEntendida}  (${pct(malEntendida)})`)
console.log(`  Pide aclarar:           ${aclara}  (${pct(aclara)})`)
console.log(`  Sin respuesta segura:   ${sinRespuesta}  (${pct(sinRespuesta)})`)
if (process.argv.includes('--fallas')) console.log(`\n${fallas.join('\n')}`)
if (process.argv.includes('--minimo')) {
  const min = Number(process.argv[process.argv.indexOf('--minimo') + 1])
  if ((bien / banco.length) * 100 < min) {
    console.error(`\nLa precisión bajó del mínimo (${min} %).`)
    process.exit(1)
  }
}
