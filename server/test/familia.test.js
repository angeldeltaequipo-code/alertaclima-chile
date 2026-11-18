import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { familiaRouter } from '../routes/familia.js'

async function servidor(ahora) {
  const app = express()
  app.use(express.json())
  app.use('/f', familiaRouter({ ahora }))
  const s = app.listen(0)
  await new Promise((r) => s.once('listening', r))
  return { url: `http://127.0.0.1:${s.address().port}/f`, cerrar: () => s.close() }
}

test('GPS familiar: guarda y entrega solo datos cifrados, por 48 horas', async () => {
  let t = Date.now()
  const { url, cerrar } = await servidor(() => t)
  const g = 'grupoDePruebaAbcdef123'
  const put = (m, body) => fetch(`${url}/${g}/${m}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  assert.equal((await put('mamaAbcdef1234567', { iv: 'aaaaaaaaaaaaaaaa', datos: 'Y2lmcmFkb2NpZnJhZG8=' })).status, 200)
  assert.equal((await put('corto', { iv: 'aaaaaaaaaaaaaaaa', datos: 'x' })).status, 400)
  let d = await (await fetch(`${url}/${g}`)).json()
  assert.equal(d.miembros.length, 1)
  assert.equal(d.miembros[0].datos, 'Y2lmcmFkb2NpZnJhZG8=')
  t += 49 * 3600e3
  d = await (await fetch(`${url}/${g}`)).json()
  assert.equal(d.miembros.length, 0)
  assert.equal((await fetch(`${url}/${g}/mamaAbcdef1234567`, { method: 'DELETE' })).status, 204)
  cerrar()
})
