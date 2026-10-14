// Notificaciones: suscripciones, a quién se envía, qué se envía y limpieza de suscripciones vencidas.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mensajeAlerta, tipoDeAviso } from '../services/notificaciones.js'

test('decide cuándo avisar: nueva, sube de nivel o termina; no por confirmaciones', () => {
  assert.equal(tipoDeAviso(null, { nivel: 'amarilla', estado: 'vigente' }), 'nueva')
  assert.equal(tipoDeAviso({ nivel: 'amarilla', estado: 'vigente' }, { nivel: 'roja', estado: 'vigente' }), 'sube')
  assert.equal(tipoDeAviso({ nivel: 'roja', estado: 'vigente' }, { nivel: 'amarilla', estado: 'vigente' }), null)
  assert.equal(tipoDeAviso({ nivel: 'roja', estado: 'vigente' }, { nivel: 'roja', estado: 'vigente' }), null)
  assert.equal(tipoDeAviso({ nivel: 'roja', estado: 'vigente' }, { nivel: 'roja', estado: 'cancelada' }), 'termina')
})

test('el mensaje dice el nivel, la amenaza y qué hacer', () => {
  const a = { id: '9', nivel: 'roja', amenaza: 'Desborde de cauces', titulo: 'Alerta Roja Linares', instrucciones: 'Aléjate de riberas.', fuente_nombre: 'SENAPRED' }
  const m = mensajeAlerta(a, 'nueva', 'https://app/')
  assert.equal(m.titulo, 'Alerta Roja: Desborde de cauces')
  assert.equal(m.cuerpo, 'Alerta Roja Linares. Aléjate de riberas.')
  assert.equal(m.grave, true)
  assert.equal(m.etiqueta, 'alerta-9')
  assert.equal(mensajeAlerta(a, 'termina', 'https://app/').titulo, 'Terminó: Alerta Roja')
  assert.match(mensajeAlerta({ ...a, nivel: 'evacuacion' }, 'sube', 'x').titulo, /^Sube a EVACUACIÓN/)
})

// ---- Con base de datos ----
const URL_PRUEBA = process.env.TEST_DATABASE_URL
const omitir = !URL_PRUEBA && 'define TEST_DATABASE_URL para correr estas pruebas'
if (URL_PRUEBA) process.env.DATABASE_URL = URL_PRUEBA
const TOKEN = 'clave-admin-push-'.padEnd(40, 'z')
process.env.ADMIN_TOKEN = TOKEN

let pool, crearApp, srv, base
const enviados = []
// Simula el servicio de notificaciones: el endpoint "vencido" responde 410.
const enviarFalso = async (sub, cuerpo) => {
  if (sub.endpoint.includes('vencido')) throw Object.assign(new Error('Gone'), { statusCode: 410 })
  enviados.push({ endpoint: sub.endpoint, mensaje: JSON.parse(cuerpo) })
}

before(async () => {
  if (omitir) return
  ;({ pool } = await import('../db/pool.js'))
  ;({ crearApp } = await import('../app.js'))
  await pool.query("DELETE FROM push_subscriptions WHERE endpoint LIKE 'https://push.prueba/%'")
  srv = crearApp({ enviarPush: enviarFalso }).listen(0)
  base = `http://127.0.0.1:${srv.address().port}/api`
})
after(async () => {
  if (omitir) return
  await pool.query("DELETE FROM push_subscriptions WHERE endpoint LIKE 'https://push.prueba/%'")
  srv.close()
  await pool.end()
})

const post = (ruta, cuerpo, extra = {}) =>
  fetch(`${base}${ruta}`, { method: 'POST', headers: { 'content-type': 'application/json', ...extra }, body: JSON.stringify(cuerpo) })
const sub = (nombre) => ({ endpoint: `https://push.prueba/${nombre}`, keys: { p256dh: 'BPclaveDePrueba', auth: 'authPrueba' } })
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

test('entrega la clave pública (generada y guardada sola) y valida suscripciones', { skip: omitir }, async () => {
  const { clave } = await (await fetch(`${base}/push/clave`)).json()
  assert.match(clave, /^[A-Za-z0-9_-]{80,}$/)
  const { clave: otra } = await (await fetch(`${base}/push/clave`)).json()
  assert.equal(clave, otra)
  assert.equal((await post('/push/suscripciones', { suscripcion: { endpoint: 'http://inseguro' }, comunas: ['07401'] })).status, 400)
  assert.equal((await post('/push/suscripciones', { suscripcion: sub('x'), comunas: [] })).status, 400)
  assert.equal((await post('/push/suscripciones', { suscripcion: sub('x'), comunas: ['1', '2', '3', '4', '5', '6'] })).status, 400)
})

test('una alerta nueva llega solo a los suscritos de esas comunas, una vez por teléfono', { skip: omitir }, async () => {
  await post('/push/suscripciones', { suscripcion: sub('linares'), comunas: ['07401'] })
  await post('/push/suscripciones', { suscripcion: sub('linares-y-talca'), comunas: ['07401', '07101'] })
  await post('/push/suscripciones', { suscripcion: sub('lota'), comunas: ['08106'] })
  await post('/push/suscripciones', { suscripcion: sub('vencido'), comunas: ['07401'] })
  enviados.length = 0

  const admin = { authorization: `Bearer ${TOKEN}` }
  const r = await post(
    '/admin/alertas',
    {
      nivel: 'amarilla',
      amenaza: 'Desborde de cauces',
      titulo: 'Alerta Amarilla',
      fuente_nombre: 'SENAPRED',
      fuente_url: 'https://senapred.cl/x',
      comunas: ['07401', '07101'],
    },
    admin,
  )
  const { alerta } = await r.json()
  await esperar(300)
  const destinos = enviados.map((e) => e.endpoint.split('/').pop()).sort()
  assert.deepEqual(destinos, ['linares', 'linares-y-talca']) // ni Lota ni duplicados
  assert.equal(enviados[0].mensaje.titulo, 'Alerta Amarilla: Desborde de cauces')

  // La suscripción vencida (410) se borró sola
  const { rows } = await pool.query("SELECT 1 FROM push_subscriptions WHERE endpoint = 'https://push.prueba/vencido'")
  assert.equal(rows.length, 0)

  // Confirmar no notifica; subir de nivel sí; cancelar avisa que terminó
  enviados.length = 0
  const patch = (cuerpo) =>
    fetch(`${base}/admin/alertas/${alerta.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json', ...admin }, body: JSON.stringify(cuerpo) })
  await patch({ accion: 'confirmar' })
  await esperar(200)
  assert.equal(enviados.length, 0)
  await patch({ accion: 'editar', nivel: 'roja', amenaza: 'Desborde de cauces', titulo: 'Alerta Roja', fuente_nombre: 'SENAPRED', fuente_url: 'https://senapred.cl/x', comunas: ['07401', '07101'] })
  await esperar(300)
  assert.ok(enviados.every((e) => e.mensaje.titulo.startsWith('Sube a Alerta Roja')))
  assert.equal(enviados.length, 2)
  enviados.length = 0
  await patch({ accion: 'cancelar' })
  await esperar(300)
  assert.ok(enviados.length === 2 && enviados.every((e) => e.mensaje.tipo === 'termina'))

  // Darse de baja
  await post('/push/baja', { endpoint: 'https://push.prueba/linares' })
  const { rows: quedan } = await pool.query("SELECT 1 FROM push_subscriptions WHERE endpoint = 'https://push.prueba/linares'")
  assert.equal(quedan.length, 0)
})

test('el panel puede publicar sin notificar', { skip: omitir }, async () => {
  enviados.length = 0
  const r = await post(
    '/admin/alertas',
    { nivel: 'preventiva', amenaza: 'Viento', titulo: 'Preventiva', fuente_nombre: 'SENAPRED', fuente_url: 'https://senapred.cl/y', comunas: ['07101'], notificar: false },
    { authorization: `Bearer ${TOKEN}` },
  )
  const { alerta } = await r.json()
  await esperar(300)
  assert.equal(enviados.length, 0)
  await fetch(`${base}/admin/alertas/${alerta.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ accion: 'cancelar', notificar: false }),
  })
})
