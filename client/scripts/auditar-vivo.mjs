// Auditoría de la app publicada, como la vería una persona nueva en un celular con red real.
// Guarda capturas de cada pantalla, errores de consola, peticiones fallidas y tiempos.
//   node scripts/auditar-vivo.mjs https://zumichile.com/ salida/
import { chromium, devices } from 'playwright'
import fs from 'fs'

const [url = 'https://zumichile.com/', dir = 'auditoria'] = process.argv.slice(2)
fs.mkdirSync(dir, { recursive: true })
const informe = { url, pasos: [], errores: [], fallidas: [], tiempos: {} }
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })

async function sesion(nombre, prep) {
  const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'es-CL', timezoneId: 'America/Santiago', colorScheme: 'dark', serviceWorkers: 'block', geolocation: { latitude: -35.8467, longitude: -71.5934 }, permissions: ['geolocation'] })
  if (prep) await ctx.addInitScript(prep)
  const p = await ctx.newPage()
  p.on('pageerror', (e) => informe.errores.push(`[${nombre}] pageerror ${e.message.slice(0, 200)}`))
  p.on('console', (m) => (m.type() === 'error' || m.text().startsWith('paseo:')) && informe.errores.push(`[${nombre}] console ${m.text().slice(0, 200)}`))
  p.on('requestfailed', (r) => informe.fallidas.push(`[${nombre}] ${r.failure()?.errorText} ${r.url().slice(0, 140)}`))
  p.on('response', (r) => r.status() >= 400 && informe.fallidas.push(`[${nombre}] HTTP ${r.status()} ${r.url().slice(0, 140)}`))
  return { ctx, p }
}
const foto = async (p, n) => {
  await p.screenshot({ path: `${dir}/${n}.png` }).catch(() => {})
  informe.pasos.push(n)
}
const paso = async (n, f) => {
  try {
    await f()
  } catch (e) {
    informe.errores.push(`[paso ${n}] ${e.message.split('\n')[0].slice(0, 200)}`)
  }
}

// 1) Primera vez: bienvenida
{
  const { ctx, p } = await sesion('nuevo')
  const t0 = Date.now()
  await p.goto(url, { waitUntil: 'domcontentloaded' })
  await p.waitForLoadState('load').catch(() => {})
  informe.tiempos.carga_ms = Date.now() - t0
  await p.waitForTimeout(4000)
  await foto(p, '01-bienvenida')
  for (let i = 2; i <= 6; i++) {
    await paso('historia' + i, async () => {
      await p.mouse.click(360, 420)
      await p.waitForTimeout(1500)
      await foto(p, `0${i}-historia`)
    })
  }
  informe.texto_bienvenida = (await p.locator('body').innerText()).slice(0, 1500)
  await ctx.close()
}

// 2) Usuario que ya entró (Linares)
{
  const { ctx, p } = await sesion('usuario', () => {
    localStorage.setItem('ac:comuna', JSON.stringify('07401'))
    localStorage.setItem('ac:zumi:presentado', 'true')
    localStorage.setItem('ac:nombre', JSON.stringify('Angel'))
    localStorage.setItem('ac:paseo-voz', '0')
  })
  const t0 = Date.now()
  await p.goto(url)
  await p.getByText(/°/).first().waitFor({ timeout: 20000 }).catch(() => {})
  informe.tiempos.temperatura_visible_ms = Date.now() - t0
  await p.waitForTimeout(5000)
  // si hay una alerta nueva a pantalla completa, primero se fotografía y se cierra (como haría una persona)
  if (await p.getByRole('button', { name: 'Entendido' }).count()) {
    await foto(p, '09-aviso-alerta')
    await p.getByRole('button', { name: 'Entendido' }).first().click()
    await p.waitForTimeout(1500)
  }
  await foto(p, '10-ahora')
  informe.texto_ahora = (await p.locator('body').innerText()).slice(0, 3000)
  await paso('scroll', async () => {
    await p.mouse.wheel(0, 900)
    await p.waitForTimeout(1200)
    await foto(p, '11-ahora-abajo')
    await p.mouse.wheel(0, 900)
    await p.waitForTimeout(1200)
    await foto(p, '12-ahora-funciones')
  })
  for (const [n, t] of [['20-mapa', 'Mapa'], ['30-riesgos', 'Riesgos'], ['40-chat', 'Chat'], ['50-ajustes', 'Ajustes']]) {
    await paso(n, async () => {
      await p.locator('nav').getByRole('button', { name: t }).first().click()
      await p.waitForTimeout(6000)
      await foto(p, n)
      informe['texto_' + t] = (await p.locator('body').innerText()).slice(0, 2500)
    })
  }
  await paso('ruta', async () => {
    await p.locator('nav').getByRole('button', { name: 'Mapa' }).first().click()
    await p.waitForTimeout(1500)
    await p.getByText('¿A dónde vas?').first().click()
    await p.waitForTimeout(800)
    await p.keyboard.type('Talca')
    await p.waitForTimeout(1500)
    await foto(p, '21-ruta-buscar')
    await p.getByRole('button', { name: /Talca/ }).first().click()
    await p.waitForTimeout(9000)
    await foto(p, '22-ruta')
    informe.texto_ruta = (await p.locator('body').innerText()).slice(0, 2500)
  })
  await paso('paseo', async () => {
    await p.goto(url)
    await p.waitForTimeout(3000)
    await p.evaluate(() => window.dispatchEvent(new CustomEvent('ac:paseo')))
    await p.waitForTimeout(12000)
    await foto(p, '60-paseo')
    informe.texto_paseo = (await p.locator('body').innerText()).slice(0, 2000)
    await p.keyboard.down('ArrowUp')
    await p.waitForTimeout(4000)
    await p.keyboard.up('ArrowUp')
    await p.waitForTimeout(4000)
    await foto(p, '61-paseo-camina')
  })
  await paso('zumi', async () => {
    await p.goto(url)
    await p.waitForTimeout(3000)
    if (await p.getByRole('button', { name: 'Entendido' }).count()) await p.getByRole('button', { name: 'Entendido' }).first().click()
    await p.getByRole('button', { name: /Hablar con ZUMI/ }).first().click()
    await p.waitForTimeout(4000)
    await foto(p, '70-zumi')
  })
  await ctx.close()
}
await b.close()
fs.writeFileSync(`${dir}/informe.json`, JSON.stringify(informe, null, 2))
console.log(`Listo: ${informe.pasos.length} capturas, ${informe.errores.length} errores, ${informe.fallidas.length} peticiones fallidas`)
