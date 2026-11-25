import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { metricasRouter } from '../routes/metricas.js'
import { metricasMemoria, validarLatido, huellaDe } from '../services/metricas.js'

const app = () => {
  const a = express()
  a.use(express.json())
  a.use('/m', metricasRouter({ almacen: metricasMemoria() }))
  return a
}
const pedir = async (a, metodo, ruta, cuerpo, cabeceras = {}) => {
  const s = a.listen(0)
  const { port } = s.address()
  const r = await fetch(`http://127.0.0.1:${port}${ruta}`, { method: metodo, headers: { 'content-type': 'application/json', ...cabeceras }, body: cuerpo ? JSON.stringify(cuerpo) : undefined })
  const t = await r.text()
  s.close()
  return { estado: r.status, json: t ? JSON.parse(t) : null }
}

test('latido valida el id y no guarda el id en claro', () => {
  assert.equal(validarLatido({ id: 'corto' }), null)
  const l = validarLatido({ id: 'abcdef0123456789abcd', comuna: '07401', plataforma: 'android', avisos: true })
  assert.equal(l.comuna, '07401')
  assert.equal(l.huella, huellaDe('abcdef0123456789abcd'))
  assert.ok(!JSON.stringify(l).includes('abcdef0123456789abcd'))
})

test('el resumen exige la clave de administración', async () => {
  process.env.ADMIN_TOKEN = 'x'.repeat(40)
  const a = app()
  assert.equal((await pedir(a, 'POST', '/m/latido', { id: 'abcdef0123456789abcd' })).estado, 204)
  assert.equal((await pedir(a, 'POST', '/m/evento', { tipo: 'nada' })).estado, 400)
  assert.equal((await pedir(a, 'GET', '/m/resumen')).estado, 401)
})
