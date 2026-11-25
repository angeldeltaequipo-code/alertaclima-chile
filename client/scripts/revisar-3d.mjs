// ¿Qué ciudades tienen maqueta 3D real de Google? Abre el paseo en cada una y mira si ZUMI
// termina caminando sobre la maqueta (fotoVisible) o si queda «solo desde el aire».
//   node scripts/revisar-3d.mjs https://zumichile.com/app/ salida/
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const [url = 'https://zumichile.com/app/', dir = 'revision-3d'] = process.argv.slice(2)
fs.mkdirSync(dir, { recursive: true })
const LUGARES = [
  ['coquimbo', 'Plaza de Armas de Coquimbo', -29.9533, -71.3436],
  ['la-serena', 'Plaza de Armas de La Serena', -29.9027, -71.2519],
  ['arica', 'Plaza Colón, Arica', -18.4783, -70.321],
  ['iquique', 'Plaza Prat, Iquique', -20.2141, -70.1524],
  ['vina', 'Plaza de Viña del Mar', -33.0245, -71.5518],
  ['rancagua', 'Plaza de Los Héroes, Rancagua', -34.1703, -70.7407],
  ['talca', 'Plaza de Armas de Talca', -35.4264, -71.6554],
  ['chillan', 'Plaza de Armas de Chillán', -36.6066, -72.1034],
  ['valdivia', 'Plaza de la República, Valdivia', -39.8142, -73.2459],
  ['osorno', 'Plaza de Armas de Osorno', -40.5739, -73.1336],
  ['punta-arenas', 'Plaza Muñoz Gamero, Punta Arenas', -53.1626, -70.9081],
  ['calama', 'Plaza 23 de Marzo, Calama', -22.4567, -68.9237],
  ['linares', 'Plaza de Armas de Linares (control: sin 3D)', -35.8467, -71.5931],
]
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const res = {}
for (const [id, nombre, lat, lng] of LUGARES) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', locale: 'es-CL' })
  await ctx.addInitScript(() => {
    localStorage.setItem('ac:comuna', JSON.stringify('13101'))
    localStorage.setItem('ac:zumi:presentado', 'true')
    localStorage.setItem('ac:paseo-voz', '0')
  })
  const p = await ctx.newPage()
  let r = 'sin respuesta'
  try {
    await p.goto(url, { waitUntil: 'load' })
    await new Promise((x) => setTimeout(x, 4000))
    await p.evaluate((d) => window.dispatchEvent(new CustomEvent('ac:paseo', { detail: d })), { id: `r-${id}`, nombre, lat, lng, rumbo: 0 })
    const t = Date.now()
    while (Date.now() - t < 100000) {
      const e = await p.evaluate(() => ({ f: window.__mundoZumi?.fotoVisible, a: window.__mundoZumi?.soloAire })).catch(() => ({}))
      if (e.f) { r = '3D'; break }
      if (e.a) { r = 'solo aire'; break }
      await new Promise((x) => setTimeout(x, 1500))
    }
    await new Promise((x) => setTimeout(x, 8000))
    const e = await p.evaluate(() => ({ f: window.__mundoZumi?.fotoVisible, a: window.__mundoZumi?.soloAire })).catch(() => ({}))
    if (r === '3D' && e.a) r = 'solo aire'
    await p.screenshot({ path: path.join(dir, `${id}.png`) })
  } catch (err) {
    r = 'error ' + err.message.split('\n')[0]
  }
  res[id] = r
  console.log(id.padEnd(14), r)
  await ctx.close()
}
fs.writeFileSync(path.join(dir, 'resultado.json'), JSON.stringify(res, null, 2))
await b.close()
