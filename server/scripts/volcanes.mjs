// Descarga el reporte semanal de volcanes del Smithsonian y guarda los de Chile en
// client/public/datos/volcanes.json. Lo corre GitHub Actions a diario: el Smithsonian bloquea
// los pedidos desde Render, así que el servidor usa este archivo publicado como respaldo.
import { readFileSync, writeFileSync } from 'node:fs'
import { interpretarVolcanes } from '../services/riesgos.js'

const destino = new URL('../../client/public/datos/volcanes.json', import.meta.url)
const r = await fetch('https://volcano.si.edu/news/WeeklyVolcanoRSS.xml', {
  headers: { 'User-Agent': 'AlertaClima-Chile/1.0 (+https://angeldeltaequipo-code.github.io/alertaclima-chile/)' },
})
if (!r.ok) throw new Error(`Smithsonian respondió ${r.status}`)
const volcanes = interpretarVolcanes(new TextDecoder('latin1').decode(Buffer.from(await r.arrayBuffer())))
let antes = null
try {
  antes = JSON.parse(readFileSync(destino, 'utf8')).volcanes
} catch {}
if (JSON.stringify(antes) === JSON.stringify(volcanes)) {
  console.log('Sin cambios')
} else {
  writeFileSync(destino, `${JSON.stringify({ fuente: 'Smithsonian GVP', actualizado: new Date().toISOString(), volcanes }, null, 1)}\n`)
  console.log(`Guardados ${volcanes.length} volcanes`)
}
