// Cuentas con Google (verificación simulada) y chat por comuna.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { firmarSesion, leerSesion, nombreMostrado } from '../services/cuentas.js'
import { limpiarTexto } from '../services/chat.js'

test('nombre e inicial del apellido', () => {
  assert.equal(nombreMostrado({ given_name: 'Ángel', family_name: 'Lara Soto' }), 'Ángel L.')
  assert.equal(nombreMostrado({ name: 'María José Pérez' }), 'María J.')
  assert.equal(nombreMostrado({ given_name: 'Ana' }), 'Ana')
})

test('la sesión firmada se valida, vence y no se puede alterar', () => {
  const t = firmarSesion(42, 1000)
  assert.equal(leerSesion(t, 2000), '42')
  assert.equal(leerSesion(t, 1000 + 61 * 24 * 3600 * 1000), null)
  const [datos, f] = t.split('.')
  const falso = Buffer.from(JSON.stringify({ u: '1', e: 9e15 })).toString('base64url')
  assert.equal(leerSesion(`${falso}.${f}`), null)
  assert.equal(leerSesion(`${datos}.x${f.slice(1)}`, 2000), null)
  assert.equal(leerSesion('basura'), null)
})

test('el chat rechaza enlaces, vacíos y textos largos, y limpia caracteres raros', () => {
  assert.throws(() => limpiarTexto('mira https://estafa.cl'), /enlaces/)
  assert.throws(() => limpiarTexto('entra a www.algo.com'), /enlaces/)
  assert.throws(() => limpiarTexto('   '), /Escribe/)
  assert.throws(() => limpiarTexto('a'.repeat(501)), /500/)
  assert.equal(limpiarTexto(' Se cortó la luz en​ calle Prat \n\n\n\nok '), 'Se cortó la luz en calle Prat \n\nok')
})

// ---- Con base de datos ----
const URL_PRUEBA = process.env.TEST_DATABASE_URL
const omitir = !URL_PRUEBA && 'define TEST_DATABASE_URL para correr estas pruebas'
if (URL_PRUEBA) process.env.DATABASE_URL = URL_PRUEBA
const TOKEN = 'clave-admin-chat-'.padEnd(40, 'z')

let pool, srv, base
const emitidos = []
// Google simulado: la "credencial" es el sub de la persona.
const verificarGoogle = async (cred) => {
  if (cred === 'mala') throw new Error('firma inválida')
  return { sub: `prueba-${cred}`, given_name: cred, family_name: 'Prueba', email_verified: true, picture: 'https://lh3.googleusercontent.com/a/x' }
}

before(async () => {
  if (omitir) return
  process.env.GOOGLE_CLIENT_ID = 'cliente-de-prueba.apps.googleusercontent.com'
  process.env.ADMIN_TOKEN = TOKEN
  ;({ pool } = await import('../db/pool.js'))
  const { crearApp } = await import('../app.js')
  await pool.query("DELETE FROM usuarios WHERE google_sub LIKE 'prueba-%'")
  srv = crearApp({ verificarGoogle, emitirChat: (cut, ev, d) => emitidos.push({ cut, ev, d }) }).listen(0)
  base = `http://127.0.0.1:${srv.address().port}/api`
})
after(async () => {
  if (omitir) return
  await pool.query("DELETE FROM usuarios WHERE google_sub LIKE 'prueba-%'")
  delete process.env.GOOGLE_CLIENT_ID
  srv.close()
  await pool.end()
})

const pedir = (ruta, { metodo = 'GET', cuerpo, sesion, admin } = {}) =>
  fetch(`${base}${ruta}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      ...(sesion ? { authorization: `Bearer ${sesion}` } : {}),
      ...(admin ? { authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
const ingresar = async (nombre) => (await (await pedir('/cuenta/google', { metodo: 'POST', cuerpo: { credencial: nombre } })).json()).sesion
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

test('inicio de sesión: crea la cuenta, entrega sesión y rechaza credenciales malas', { skip: omitir }, async () => {
  const cfg = await (await pedir('/cuenta/config')).json()
  assert.equal(cfg.activa, true)
  const r = await pedir('/cuenta/google', { metodo: 'POST', cuerpo: { credencial: 'Ana' } })
  assert.equal(r.status, 200)
  const { usuario, sesion } = await r.json()
  assert.equal(usuario.nombre, 'Ana P.')
  const yo = await (await pedir('/cuenta/yo', { sesion })).json()
  assert.equal(yo.usuario.id, usuario.id)
  assert.equal((await pedir('/cuenta/google', { metodo: 'POST', cuerpo: { credencial: 'mala' } })).status, 401)
  assert.equal((await pedir('/cuenta/yo')).status, 401)
})

test('chat: sin sesión no se lee ni se escribe; con sesión, publica y emite en tiempo real', { skip: omitir }, async () => {
  const cut = (await pool.query('SELECT cut FROM comunas LIMIT 1')).rows[0].cut.trim()
  assert.equal((await pedir(`/chat/${cut}`)).status, 401)
  const s = await ingresar('Beto')
  const r = await pedir(`/chat/${cut}`, { metodo: 'POST', sesion: s, cuerpo: { texto: 'Hay agua en la calle Prat' } })
  assert.equal(r.status, 201)
  const { mensaje } = await r.json()
  assert.equal(mensaje.autor.nombre, 'Beto P.')
  assert.ok(emitidos.some((e) => e.ev === 'chat:mensaje' && e.d.id === mensaje.id))
  const lista = await (await pedir(`/chat/${cut}`, { sesion: s })).json()
  assert.ok(lista.mensajes.some((m) => m.id === mensaje.id))
  // Demasiado rápido
  assert.equal((await pedir(`/chat/${cut}`, { metodo: 'POST', sesion: s, cuerpo: { texto: 'otro' } })).status, 429)
  // Enlaces no
  await esperar(4100)
  assert.equal((await pedir(`/chat/${cut}`, { metodo: 'POST', sesion: s, cuerpo: { texto: 'ver bit.ly/x' } })).status, 400)
})

test('3 denuncias ocultan el mensaje; el autor no puede denunciarse; admin modera y bloquea', { skip: omitir }, async () => {
  const cut = (await pool.query('SELECT cut FROM comunas LIMIT 1')).rows[0].cut.trim()
  const autor = await ingresar('Carla')
  const { mensaje } = await (await pedir(`/chat/${cut}`, { metodo: 'POST', sesion: autor, cuerpo: { texto: 'rumor falso' } })).json()
  assert.equal((await pedir(`/chat/mensajes/${mensaje.id}/denunciar`, { metodo: 'POST', sesion: autor })).status, 400)
  for (const n of ['D1', 'D2']) {
    const r = await (await pedir(`/chat/mensajes/${mensaje.id}/denunciar`, { metodo: 'POST', sesion: await ingresar(n) })).json()
    assert.equal(r.oculto, false)
  }
  const d3 = await ingresar('D3')
  assert.equal((await (await pedir(`/chat/mensajes/${mensaje.id}/denunciar`, { metodo: 'POST', sesion: d3 })).json()).oculto, true)
  assert.ok(emitidos.some((e) => e.ev === 'chat:oculto' && e.d.id === mensaje.id))
  const lista = await (await pedir(`/chat/${cut}`, { sesion: d3 })).json()
  assert.ok(!lista.mensajes.some((m) => m.id === mensaje.id))
  // Panel: lo ve denunciado y bloquea al autor
  const den = await (await pedir('/admin/chat/denunciados', { admin: true })).json()
  const visto = den.mensajes.find((m) => m.id === mensaje.id)
  assert.ok(visto)
  assert.equal((await pedir(`/admin/usuarios/${visto.autor.id}/bloqueo`, { metodo: 'POST', admin: true, cuerpo: { motivo: 'rumores' } })).status, 200)
  assert.equal((await pedir(`/chat/${cut}`, { sesion: autor })).status, 403)
})

test('reportes exigen cuenta cuando el inicio de sesión está activo; borrar la cuenta borra sus mensajes', { skip: omitir }, async () => {
  const r = await pedir('/reportes', { metodo: 'POST', cuerpo: { categoria: 'otro', titulo: 'x', lat: -33.45, lng: -70.66 } })
  assert.equal(r.status, 401)
  const cut = (await pool.query('SELECT cut FROM comunas LIMIT 1')).rows[0].cut.trim()
  const s = await ingresar('Eva')
  await pedir(`/chat/${cut}`, { metodo: 'POST', sesion: s, cuerpo: { texto: 'hola vecinos' } })
  assert.equal((await pedir('/cuenta/borrar', { metodo: 'POST', sesion: s })).status, 200)
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM chat_mensajes m JOIN usuarios u ON u.id = m.usuario_id WHERE u.google_sub = 'prueba-Eva'")
  assert.equal(rows[0].n, 0)
  assert.equal((await pedir('/cuenta/yo', { sesion: s })).status, 401)
})
