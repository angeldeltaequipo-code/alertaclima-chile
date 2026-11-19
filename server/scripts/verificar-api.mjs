// Verificación de punta a punta contra el servidor publicado: ¿funciona de verdad cada parte?
//   node server/scripts/verificar-api.mjs https://alertaclima-api.onrender.com
// Sale con código 1 si algo esencial falla. No crea cuentas ni datos permanentes
// (la prueba de familia usa un grupo al azar que el servidor olvida solo).
const API = (process.argv[2] ?? 'https://alertaclima-api.onrender.com').replace(/\/$/, '')
const LINARES = '07401'
const filas = []

async function pedir(ruta, opciones = {}) {
  const t0 = Date.now()
  const r = await fetch(API + ruta, { ...opciones, headers: { 'content-type': 'application/json', ...(opciones.headers ?? {}) }, signal: AbortSignal.timeout(60000) })
  let cuerpo = null
  try {
    cuerpo = await r.json()
  } catch {
    /* sin JSON */
  }
  return { status: r.status, cuerpo, ms: Date.now() - t0 }
}

async function prueba(nombre, esencial, fn) {
  try {
    const { ok, detalle } = await fn()
    filas.push({ nombre, esencial, ok, detalle })
  } catch (e) {
    filas.push({ nombre, esencial, ok: false, detalle: `excepción: ${e.message}` })
  }
}

await prueba('Servidor vivo', true, async () => {
  const r = await pedir('/api/salud')
  return { ok: r.status === 200, detalle: `HTTP ${r.status} en ${r.ms} ms · estado ${r.cuerpo?.estado}` }
})
await prueba('Base de datos', true, async () => {
  const r = await pedir('/api/salud')
  const db = r.cuerpo?.baseDeDatos
  return { ok: Boolean(db?.ok), detalle: db?.ok ? 'conectada' : `sin conexión${db?.error ? `: ${String(db.error).slice(0, 120)}` : ''}` }
})
await prueba('Alertas SENAPRED (Linares)', true, async () => {
  const r = await pedir(`/api/alertas?comuna=${LINARES}`)
  return { ok: r.status === 200 && Array.isArray(r.cuerpo?.alertas), detalle: `HTTP ${r.status} · ${r.cuerpo?.alertas?.length ?? '?'} alertas` }
})
await prueba('Sismos, tsunami y volcanes', true, async () => {
  const r = await pedir('/api/riesgos')
  return { ok: r.status === 200 && Array.isArray(r.cuerpo?.sismos), detalle: `HTTP ${r.status} · ${r.cuerpo?.sismos?.length ?? '?'} sismos` }
})
await prueba('Reportes de vecinos', true, async () => {
  const r = await pedir(`/api/reportes?comuna=${LINARES}`)
  return { ok: r.status === 200, detalle: `HTTP ${r.status}${r.cuerpo?.error ? ` · ${r.cuerpo.error}` : ''}` }
})
await prueba('Lo que se comenta', false, async () => {
  const r = await pedir('/api/comunidad')
  return { ok: r.status === 200, detalle: `HTTP ${r.status}` }
})
await prueba('Familia: enviar y recibir ubicación cifrada', true, async () => {
  const id = () => Math.random().toString(36).slice(2, 12).padEnd(10, 'x')
  const g = id()
  const m = id()
  const p = await pedir(`/api/familia/${g}/${m}`, { method: 'PUT', body: JSON.stringify({ iv: 'AAAAAAAAAAAAAAAA', datos: 'cHJ1ZWJhLWRlLWNpZnJhZG8=' }) })
  const l = await pedir(`/api/familia/${g}`)
  await pedir(`/api/familia/${g}/${m}`, { method: 'DELETE' }).catch(() => {})
  const ok = p.status === 200 && l.cuerpo?.miembros?.some((x) => x.id === m)
  return { ok, detalle: `PUT ${p.status} · GET ${l.status} · ${ok ? 'llega a la familia' : JSON.stringify(p.cuerpo ?? l.cuerpo).slice(0, 120)}` }
})
await prueba('Cuentas con Google', true, async () => {
  const r = await pedir('/api/cuenta/config')
  return { ok: r.status === 200 && Boolean(r.cuerpo?.activa ?? r.cuerpo?.googleClientId ?? r.cuerpo?.clienteGoogle), detalle: `HTTP ${r.status} · ${JSON.stringify(r.cuerpo).slice(0, 140)}` }
})
await prueba('Chat de vecinos (leer)', true, async () => {
  const r = await pedir(`/api/chat/${LINARES}`)
  return { ok: r.status === 200 || r.status === 401, detalle: `HTTP ${r.status}${r.cuerpo?.error ? ` · ${r.cuerpo.error}` : ''}` }
})
await prueba('ZUMI con IA', false, async () => {
  const r = await pedir('/api/zumi/config')
  return { ok: r.status === 200, detalle: `HTTP ${r.status} · ${JSON.stringify(r.cuerpo).slice(0, 140)}` }
})
await prueba('Voz de ZUMI', false, async () => {
  const r = await pedir('/api/voz/estado')
  return { ok: r.status === 200, detalle: `HTTP ${r.status} · ${JSON.stringify(r.cuerpo).slice(0, 140)}` }
})
await prueba('Avisos push (clave)', false, async () => {
  const r = await pedir('/api/push/clave')
  return { ok: r.status === 200, detalle: `HTTP ${r.status}` }
})
await prueba('Planes', false, async () => {
  const r = await pedir('/api/planes')
  return { ok: r.status === 200, detalle: `HTTP ${r.status}` }
})

const lineas = filas.map((f) => `${f.ok ? '✅' : f.esencial ? '❌' : '⚠️'} ${f.nombre} — ${f.detalle}`)
console.log(`Verificación de ${API} · ${new Date().toISOString()}\n` + lineas.join('\n'))
if (process.env.GITHUB_STEP_SUMMARY) {
  const fs = await import('node:fs')
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## ¿Funciona de verdad?\n\n${lineas.map((l) => `- ${l}`).join('\n')}\n`)
}
process.exit(filas.some((f) => f.esencial && !f.ok) ? 1 : 0)
