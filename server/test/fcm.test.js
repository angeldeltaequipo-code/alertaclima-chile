import { test } from 'node:test'
import assert from 'node:assert/strict'
import { enviarFCM, esNativa, mensajeFCM } from '../services/fcm.js'

test('reconoce suscripciones nativas', () => {
  assert.equal(esNativa('fcm:abc'), true)
  assert.equal(esNativa('https://fcm.googleapis.com/x'), false)
})

test('arma el mensaje con prioridad y canal según la gravedad', () => {
  const m = mensajeFCM('TOKEN', { titulo: 'Alerta Roja', cuerpo: 'Evacúa', url: 'https://x', nivel: 'roja', grave: true, etiqueta: 'alerta-1', tipo: 'nueva' })
  assert.equal(m.message.token, 'TOKEN')
  assert.equal(m.message.android.priority, 'HIGH')
  assert.equal(m.message.android.notification.channel_id, 'alertas-graves')
  assert.equal(m.message.apns.payload.aps['interruption-level'], 'time-sensitive')
  assert.equal(m.message.data.nivel, 'roja')
})

test('sin credenciales no envía y avisa', async () => {
  delete process.env.FCM_CREDENCIALES
  await assert.rejects(enviarFCM('fcm:abc', '{}'), (e) => e.statusCode === 503)
})
