import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { avisoMercadoPago, autorizacionRevenueCat, eventoRevenueCat, firmaMercadoPagoValida, limitesDe, suscribirWeb } from '../services/planes.js'
import { revisarCupo } from '../services/zumi.js'

// Base de datos falsa: anota las consultas y responde lo mínimo.
function dbFalsa() {
  const q = []
  return {
    q,
    query: async (sql, p) => {
      q.push({ sql, p })
      if (/INSERT INTO suscripciones/.test(sql)) return { rows: [{ id: 7, nueva: true }] }
      return { rows: [], rowCount: 1 }
    },
  }
}

test('sin cobro activo todos tienen los límites del plan Familia', () => {
  delete process.env.COBRO_ACTIVO
  assert.equal(limitesDe('gratis').comunas, 5)
  process.env.COBRO_ACTIVO = 'true'
  assert.equal(limitesDe('gratis').comunas, 1)
  assert.equal(limitesDe('familia').familiares, 5)
})

test('verifica la firma de los avisos de Mercado Pago', () => {
  const secreto = 'abc'
  const v1 = createHmac('sha256', secreto).update('id:123;request-id:r1;ts:99;').digest('hex')
  assert.equal(firmaMercadoPagoValida({ firma: `ts=99,v1=${v1}`, requestId: 'r1', dataId: '123' }, secreto), true)
  assert.equal(firmaMercadoPagoValida({ firma: `ts=99,v1=${v1}`, requestId: 'r2', dataId: '123' }, secreto), false)
  assert.equal(firmaMercadoPagoValida({ firma: 'nada' }, secreto), false)
})

test('crea la suscripción web con prueba gratis y guarda el enlace', async () => {
  process.env.COBRO_ACTIVO = 'true'
  process.env.MP_ACCESS_TOKEN = 'TEST'
  let cuerpo
  const f = async (url, o) => ((cuerpo = JSON.parse(o.body)), { ok: true, json: async () => ({ id: 'pre1', init_point: 'https://mp/pagar' }) })
  const db = dbFalsa()
  const r = await suscribirWeb(db, { id: 5 }, { periodo: 'anual', correo: 'ana@correo.cl' }, { fetchFn: f })
  assert.equal(r.url, 'https://mp/pagar')
  assert.equal(cuerpo.external_reference, 'u:5')
  assert.equal(cuerpo.auto_recurring.frequency, 12)
  assert.equal(cuerpo.auto_recurring.currency_id, 'CLP')
  assert.equal(cuerpo.auto_recurring.free_trial.frequency, 7)
  await assert.rejects(suscribirWeb(db, { id: 5 }, { periodo: 'anual', correo: 'malo' }, { fetchFn: f }), /correo/)
})

test('aviso de Mercado Pago: autorizada sin cobros = en prueba; cancelada', async () => {
  const db = dbFalsa()
  const resp = (status, cobros) => async () => ({ ok: true, json: async () => ({ id: 'pre1', status, external_reference: 'u:5', next_payment_date: '2026-12-01T00:00:00Z', summarized: { charged_quantity: cobros }, auto_recurring: { frequency: 1, transaction_amount: 1990, free_trial: { frequency: 7 } } }) })
  assert.equal((await avisoMercadoPago(db, { tipo: 'subscription_preapproval', id: 'pre1' }, { fetchFn: resp('authorized', 0) })).estado, 'prueba')
  assert.equal((await avisoMercadoPago(db, { tipo: 'subscription_preapproval', id: 'pre1' }, { fetchFn: resp('authorized', 2) })).estado, 'activa')
  assert.equal((await avisoMercadoPago(db, { tipo: 'subscription_preapproval', id: 'pre1' }, { fetchFn: resp('cancelled', 2) })).estado, 'cancelada')
  assert.equal((await avisoMercadoPago(db, { tipo: 'payment', id: '9' })).ignorado, true)
})

test('eventos de RevenueCat: compra, prueba, vencimiento y autorización', async () => {
  const db = dbFalsa()
  const base = { app_user_id: 'u:9', store: 'PLAY_STORE', original_transaction_id: 'GPA.1', product_id: 'familia_anual', expiration_at_ms: Date.now() + 1e9, currency: 'CLP', price_in_purchased_currency: 14990 }
  assert.equal((await eventoRevenueCat(db, { event: { ...base, type: 'INITIAL_PURCHASE', period_type: 'TRIAL' } })).estado, 'prueba')
  assert.equal((await eventoRevenueCat(db, { event: { ...base, type: 'RENEWAL', period_type: 'NORMAL' } })).estado, 'activa')
  assert.equal((await eventoRevenueCat(db, { event: { ...base, type: 'EXPIRATION' } })).estado, 'vencida')
  assert.equal((await eventoRevenueCat(db, { event: { ...base, app_user_id: '$RCAnonymousID:x', type: 'RENEWAL' } })).ignorado, true)
  const ins = db.q.find((x) => /INSERT INTO suscripciones/.test(x.sql))
  assert.equal(ins.p[1], 'google')
  assert.equal(ins.p[3], 'anual')
  process.env.REVENUECAT_WEBHOOK_SECRET = 'clave-secreta'
  assert.equal(autorizacionRevenueCat('Bearer clave-secreta'), true)
  assert.equal(autorizacionRevenueCat('Bearer otra'), false)
})

test('cupo diario de ZUMI según el plan', () => {
  for (let i = 0; i < 5; i++) revisarCupo('plan-test', 1000 + i * 4000e3, { porDia: 5 })
  assert.throws(() => revisarCupo('plan-test', 1000 + 5 * 4000e3, { porDia: 5 }), (e) => e.motivo === 'limite-plan')
})
