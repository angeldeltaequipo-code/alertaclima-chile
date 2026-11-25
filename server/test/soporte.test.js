import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { soporteRouter } from '../routes/soporte.js'
import { almacenMemoria, avisarVisita } from '../services/soporte.js'

const TOKEN = 'x'.repeat(40)
async function servidor() {
  process.env.ADMIN_TOKEN = TOKEN
  const avisos = { angel: [], visita: [] }
  const app = express()
  app.use(express.json())
  app.use('/s', soporteRouter({ almacen: almacenMemoria(), avisos: { avisarAngel: async (c, t) => avisos.angel.push(t), avisarVisita: async (c, t) => avisos.visita.push(t) } }))
  const s = app.listen(0)
  await new Promise((r) => s.once('listening', r))
  return { url: `http://127.0.0.1:${s.address().port}/s`, avisos, cerrar: () => s.close() }
}
const post = (u, b, h = {}) => fetch(u, { method: 'POST', headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(b) })

test('Soporte: la persona escribe, Angel responde y la respuesta llega al chat', async () => {
  const { url, avisos, cerrar } = await servidor()
  assert.equal((await post(`${url}/conversaciones`, { texto: '   ' })).status, 400)
  const c = await (await post(`${url}/conversaciones`, { texto: '¿Funciona en Linares?', pagina: '/' })).json()
  assert.match(c.id, /^[A-Za-z0-9_-]{20,}$/)
  assert.equal(c.mensajes.length, 1)
  assert.equal(c.angelEnLinea, false)
  assert.deepEqual(avisos.angel, ['¿Funciona en Linares?'])
  // sin clave no se entra a la bandeja
  assert.equal((await fetch(`${url}/admin`)).status, 401)
  const A = { authorization: `Bearer ${TOKEN}` }
  const lista = await (await fetch(`${url}/admin`, { headers: A })).json()
  assert.equal(lista.conversaciones[0].sin_leer, 1)
  assert.equal(lista.conversaciones[0].ultimo.texto, '¿Funciona en Linares?')
  assert.equal((await post(`${url}/admin/${c.id}/mensajes`, { texto: '¡Sí! En las 346 comunas.' }, A)).status, 201)
  assert.deepEqual(avisos.visita, ['¡Sí! En las 346 comunas.'])
  const d = await (await fetch(`${url}/conversaciones/${c.id}?desde=${c.mensajes[0].id}`)).json()
  assert.equal(d.mensajes.length, 1)
  assert.equal(d.mensajes[0].autor, 'angel')
  assert.equal(d.angelEnLinea, true)
  assert.equal((await fetch(`${url}/conversaciones/no-existe-aaaaaaaaaaaaaaaa`)).status, 404)
  assert.equal((await post(`${url}/conversaciones/${c.id}/contacto`, { nombre: 'Ana', contacto: 'ana@ejemplo.cl' })).status, 200)
  cerrar()
})

test('Soporte: el correo con la respuesta solo sale si la persona dejó correo y no está mirando', async () => {
  const enviados = []
  const enviar = async (m) => (enviados.push(m), { enviado: true })
  const ahora = Date.now()
  assert.equal(await avisarVisita({ contacto: 'ana@ejemplo.cl', visto_en: new Date(ahora - 10e3) }, 'hola', { ahora, enviar }), false)
  assert.equal(await avisarVisita({ contacto: '+56 9 1234', visto_en: new Date(ahora - 600e3) }, 'hola', { ahora, enviar }), false)
  assert.equal(await avisarVisita({ contacto: 'ana@ejemplo.cl', nombre: 'Ana', visto_en: new Date(ahora - 600e3) }, 'hola', { ahora, enviar }), true)
  assert.equal(enviados[0].para, 'ana@ejemplo.cl')
})
