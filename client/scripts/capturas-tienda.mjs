// Capturas de la app publicada (datos reales) para las fichas de Google Play y App Store.
//   node scripts/capturas-tienda.mjs https://zumichile.com/app/ salida/
// Deja salida/<escena>.png a 1170 × 2532 (390 × 844 a 3x). Después se enmarcan con titulares.
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const [url = 'https://zumichile.com/app/', dir = 'capturas'] = process.argv.slice(2)
fs.mkdirSync(dir, { recursive: true })
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const espera = (ms) => new Promise((r) => setTimeout(r, ms))

async function captura(nombre, accion, prep) {
  const ctx = await b.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'es-CL',
    timezoneId: 'America/Santiago',
    colorScheme: 'dark',
    serviceWorkers: 'block',
    geolocation: { latitude: -33.4378, longitude: -70.6505 },
    permissions: ['geolocation'],
  })
  await ctx.addInitScript(() => {
    localStorage.setItem('ac:comuna', JSON.stringify('13101'))
    localStorage.setItem('ac:zumi:presentado', 'true')
    localStorage.setItem('ac:nombre', JSON.stringify('Angel'))
    localStorage.setItem('ac:paseo-voz', '0')
  })
  if (prep) await ctx.addInitScript(prep)
  const p = await ctx.newPage()
  try {
    await p.goto(url, { waitUntil: 'load' })
    await accion(p)
    await p.screenshot({ path: path.join(dir, `${nombre}.png`) })
    console.log(nombre, 'listo')
  } catch (e) {
    console.log(nombre, 'error', e.message.split('\n')[0])
  }
  await ctx.close()
}

const charm = () => localStorage.setItem('ac:presencia-ahora', 'charm')

await captura('inicio', async (p) => {
  await espera(7000)
  await p.mouse.click(195, 380)
  await espera(2500)
}, charm)

await captura('looks', async (p) => {
  await espera(6000)
  await p.getByRole('button', { name: 'Looks' }).click()
  await espera(1200)
  for (let i = 0; i < 4; i++) {
    await p.getByRole('button', { name: 'Look siguiente' }).click()
    await espera(900)
  }
  await espera(1500)
}, charm)

await captura('riesgos', async (p) => {
  await espera(5000)
  await p.getByRole('button', { name: 'Riesgos' }).first().click()
  await espera(6000)
})

await captura('mapa', async (p) => {
  await espera(5000)
  await p.getByRole('button', { name: 'Mapa' }).first().click()
  await espera(9000)
  for (let i = 0; i < 6; i++) {
    await p.mouse.move(195, 430)
    await p.mouse.wheel(0, -260)
    await espera(600)
  }
  await espera(5000)
})

await captura('ruta', async (p) => {
  await espera(5000)
  await p.evaluate(() => window.dispatchEvent(new CustomEvent('ac:ruta', { detail: { nombre: 'Valparaíso', lat: -33.0458, lng: -71.6197 } })))
  await espera(9000)
})

await captura('paseo', async (p) => {
  await espera(5000)
  await p.evaluate(() => window.dispatchEvent(new CustomEvent('ac:paseo', { detail: { id: '3d-santiago', nombre: 'Plaza de Armas de Santiago', lat: -33.43783, lng: -70.65045, rumbo: 0 } })))
  const t = Date.now()
  while (Date.now() - t < 70000) {
    if (await p.evaluate(() => window.__mundoZumi?.fotoVisible).catch(() => false)) break
    await espera(1000)
  }
  await espera(20000)
  await p.getByRole('button', { name: 'Dron' }).click().catch(() => {})
  await espera(20000)
}, () => addEventListener('DOMContentLoaded', () => {
  const st = document.createElement('style')
  st.textContent = '.paseo-cuenta{display:none!important}'
  document.head.append(st)
}))

await b.close()
