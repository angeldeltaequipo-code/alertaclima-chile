import { test } from 'node:test'
import assert from 'node:assert/strict'
import { correoBienvenida, enviarCorreo } from '../services/correo.js'

test('el correo de bienvenida saluda por nombre y escapa HTML', () => {
  const c = correoBienvenida('<b>Ana</b> P.')
  assert.match(c.asunto, /Bienvenido/)
  assert.ok(!c.html.includes('<b>Ana</b>'))
  assert.match(c.texto, /133/)
})

test('sin clave de Resend no envía nada; con clave llama a la API y no lanza si falla', async () => {
  delete process.env.RESEND_API_KEY
  let llamadas = 0
  const f = async () => (llamadas++, { ok: false, status: 500 })
  assert.deepEqual(await enviarCorreo({ para: 'a@b.cl', asunto: 'x', html: 'x' }, { fetchFn: f }), { enviado: false })
  assert.equal(llamadas, 0)
  process.env.RESEND_API_KEY = 're_prueba'
  process.env.CORREO_DESDE = 'AlertaClima <hola@ejemplo.cl>'
  assert.deepEqual(await enviarCorreo({ para: 'a@b.cl', asunto: 'x', html: 'x' }, { fetchFn: f }), { enviado: false })
  assert.equal(llamadas, 1)
  delete process.env.RESEND_API_KEY
})
