// Graba la app publicada funcionando de verdad (red real, datos reales) para el sitio de ZUMI.
//   node scripts/grabar-demos.mjs https://zumichile.com/app/ salida/
// Deja salida/<demo>.webm y salida/recortes.json (desde qué segundo empieza lo bueno).
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const [url = 'https://zumichile.com/app/', dir = 'demos'] = process.argv.slice(2)
fs.mkdirSync(dir, { recursive: true })
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const VP = { width: 390, height: 844 }
const recortes = {}
const espera = (ms) => new Promise((r) => setTimeout(r, ms))

async function grabar(nombre, accion, prep) {
  const ctx = await b.newContext({
    viewport: VP,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
    colorScheme: 'dark',
    serviceWorkers: 'block',
    geolocation: { latitude: -33.4378, longitude: -70.6505 },
    permissions: ['geolocation'],
    recordVideo: { dir: path.join(dir, 'tmp'), size: VP },
  })
  await ctx.addInitScript(() => {
    localStorage.setItem('ac:comuna', JSON.stringify('13101'))
    localStorage.setItem('ac:zumi:presentado', 'true')
    localStorage.setItem('ac:nombre', JSON.stringify('Angel'))
    localStorage.setItem('ac:paseo-voz', '0')
  })
  if (prep) await ctx.addInitScript(prep)
  const p = await ctx.newPage()
  const t0 = Date.now()
  let desde = 0
  const marcar = () => (desde = (Date.now() - t0) / 1000)
  try {
    await p.goto(url, { waitUntil: 'load' })
    await accion(p, marcar)
  } catch (e) {
    console.log(nombre, 'error', e.message.split('\n')[0])
  }
  const v = p.video()
  await ctx.close()
  const f = await v.path()
  fs.renameSync(f, path.join(dir, `${nombre}.webm`))
  recortes[nombre] = Math.max(0, desde)
  console.log(nombre, 'listo desde', recortes[nombre].toFixed(1), 's')
}

// 1) Looks de ZUMI: cambia de estilo
await grabar(
  'looks',
  async (p, marcar) => {
    await espera(6000)
    await p.getByRole('button', { name: 'Looks' }).click()
    await espera(1500)
    marcar()
    for (let i = 0; i < 6; i++) {
      await p.getByRole('button', { name: 'Look siguiente' }).click()
      await espera(1700)
    }
  },
  () => localStorage.setItem('ac:presencia-ahora', 'charm'),
)

// 2) Charm: ZUMI vivo, reacciona al tocarlo
await grabar('charm', async (p, marcar) => {
  await espera(6000)
  marcar()
  for (let i = 0; i < 4; i++) {
    await p.mouse.click(195, 380)
    await espera(2000)
  }
}, () => localStorage.setItem('ac:presencia-ahora', 'charm'))

// 3) Mapa vivo: globo, Chile y radar
await grabar('mapa', async (p, marcar) => {
  await espera(5000)
  await p.getByRole('button', { name: 'Mapa' }).first().click()
  await espera(7000)
  marcar()
  for (let i = 0; i < 8; i++) {
    await p.mouse.move(195, 430)
    await p.mouse.wheel(0, -260)
    await espera(700)
  }
  await p.getByRole('button', { name: /Radar/ }).first().click().catch(() => {})
  await espera(6000)
})

// 4) Riesgos: tsunami, sismos, volcanes
await grabar('riesgos', async (p, marcar) => {
  await espera(5000)
  await p.getByRole('button', { name: 'Riesgos' }).first().click()
  await espera(5000)
  marcar()
  for (let i = 0; i < 6; i++) {
    await p.mouse.wheel(0, 260)
    await espera(900)
  }
  await espera(1500)
})

// 5) Viaja con ZUMI: ruta con el clima del camino
await grabar('ruta', async (p, marcar) => {
  await espera(5000)
  await p.evaluate(() => window.dispatchEvent(new CustomEvent('ac:ruta', { detail: { nombre: 'Valparaíso', lat: -33.0458, lng: -71.6197 } })))
  await espera(3000)
  marcar()
  await espera(9000)
})

// 6) Paseo 3D sobre la ciudad real (Santiago)
await grabar('paseo', async (p, marcar) => {
  await espera(5000)
  await p.evaluate(() => window.dispatchEvent(new CustomEvent('ac:paseo', { detail: { id: '3d-santiago', nombre: 'Plaza de Armas de Santiago', lat: -33.43783, lng: -70.65045, rumbo: 0 } })))
  const t = Date.now()
  while (Date.now() - t < 70000) {
    const listo = await p.evaluate(() => window.__mundoZumi?.fotoVisible).catch(() => false)
    if (listo) break
    await espera(1000)
  }
  const cerrarFicha = () => p.getByRole('button', { name: 'Cerrar', exact: true }).click({ timeout: 800 }).catch(() => {})
  // En la nube no hay GPU: se da tiempo para que la maqueta cargue nítida antes de grabar lo bueno
  await espera(20000)
  await cerrarFicha()
  await p.getByRole('button', { name: 'Dron' }).click().catch(() => {})
  await espera(12000)
  await cerrarFicha()
  marcar()
  // vuelo de dron: gira lento sobre la plaza
  await p.mouse.move(195, 640)
  await p.mouse.down()
  await p.mouse.move(150, 600, { steps: 10 })
  await espera(7000)
  await p.mouse.up()
  await cerrarFicha()
  await espera(4000)
})

fs.writeFileSync(path.join(dir, 'recortes.json'), JSON.stringify(recortes, null, 2))
fs.rmSync(path.join(dir, 'tmp'), { recursive: true, force: true })
await b.close()
