import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { autorizacionRevenueCat, estadoFlow, eventoRevenueCat, firmaFlow, limitesDe, suscribirWeb, tarjetaRegistrada } from '../services/planes.js'
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

test('firma de Flow: parámetros ordenados, nombre+valor, HMAC-SHA256', () => {
  const esperada = createHmac('sha256', 'sec').update('amount1990apiKeyKplanIdp1').digest('hex')
  assert.equal(firmaFlow({ planId: 'p1', apiKey: 'K', amount: '1990' }, 'sec'), esperada)
})

// Flow falso: responde según la ruta y anota lo que se le pidió.
function flowFalso(respuestas) {
  const llamadas = []
  const f = async (url, o = {}) => {
    const u = new URL(url)
    const ruta = u.pathname.replace(/^\/api/, '')
    const params = Object.fromEntries(o.body ? new URLSearchParams(o.body) : u.searchParams)
    llamadas.push({ ruta, params })
    const r = respuestas[ruta]
    if (r === undefined) return { ok: false, status: 400, json: async () => ({ code: 1, message: 'no existe' }) }
    return { ok: true, json: async () => (typeof r === 'function' ? r(params) : r) }
  }
  return { f, llamadas }
}

test('suscripción web con Flow: crea cliente y devuelve el enlace para registrar la tarjeta', async () => {
  process.env.COBRO_ACTIVO = 'true'
  process.env.FLOW_API_KEY = 'K'
  process.env.FLOW_SECRET_KEY = 'S'
  const { f, llamadas } = flowFalso({
    '/plans/get': { planId: 'x' },
    '/customer/create': { customerId: 'cus_1' },
    '/customer/register': { url: 'https://flow/registrar', token: 'tok1' },
  })
  const db = dbFalsa()
  const r = await suscribirWeb(db, { id: 5, nombre: 'Rosa M.' }, { periodo: 'anual', correo: 'ana@correo.cl' }, { fetchFn: f })
  assert.equal(r.url, 'https://flow/registrar?token=tok1')
  const crear = llamadas.find((l) => l.ruta === '/customer/create')
  assert.equal(crear.params.externalId, 'u:5')
  assert.equal(crear.params.s, firmaFlow(Object.fromEntries(Object.entries(crear.params).filter(([k]) => k !== 's')), 'S'))
  assert.match(llamadas.find((l) => l.ruta === '/customer/register').params.url_return, /\/api\/pagos\/flow\/tarjeta\?p=anual$/)
  await assert.rejects(suscribirWeb(db, { id: 5 }, { periodo: 'anual', correo: 'malo' }, { fetchFn: f }), /correo/)
})

test('al volver de Flow con la tarjeta registrada se crea la suscripción', async () => {
  const { f, llamadas } = flowFalso({
    '/customer/getRegisterStatus': { status: '1', customerId: 'cus_1' },
    '/subscription/create': (p) => ({ subscriptionId: 'sus_1', planId: p.planId, status: 2, trial_end: '2026-11-06 10:00:00' }),
  })
  const db = {
    q: [],
    query: async (sql, p) => {
      db.q.push({ sql, p })
      if (/FROM usuarios WHERE flow_cliente/.test(sql)) return { rows: [{ id: 5 }] }
      if (/INSERT INTO suscripciones/.test(sql)) return { rows: [{ id: 7, nueva: true }] }
      return { rows: [] }
    },
  }
  const destino = await tarjetaRegistrada(db, { token: 't', periodo: 'mensual' }, { fetchFn: f })
  assert.match(destino, /\?plan=gracias$/)
  assert.equal(llamadas.find((l) => l.ruta === '/subscription/create').params.planId, 'alertaclima_familia_mensual')
  const ins = db.q.find((x) => /INSERT INTO suscripciones/.test(x.sql))
  assert.deepEqual([ins.p[1], ins.p[2], ins.p[4]], ['flow', 'sus_1', 'prueba'])
  const { f: f2 } = flowFalso({ '/customer/getRegisterStatus': { status: '0' } })
  assert.match(await tarjetaRegistrada(db, { token: 't' }, { fetchFn: f2 }), /plan=cancelado/)
})

test('estados de Flow: prueba, activa, morosa y cancelada al final del periodo', () => {
  assert.equal(estadoFlow({ status: 2 }).estado, 'prueba')
  assert.equal(estadoFlow({ status: 1, morose: 0, period_end: '2026-12-01 00:00:00' }).estado, 'activa')
  assert.equal(estadoFlow({ status: 1, morose: 1 }).estado, 'problema_pago')
  const c = estadoFlow({ status: 1, cancel_at_period_end: 1, period_end: '2026-12-01 00:00:00' })
  assert.equal(c.estado, 'cancelada')
  assert.equal(c.venceEn.toISOString(), '2026-12-01T03:00:00.000Z')
  assert.equal(estadoFlow({ status: 4 }).estado, 'cancelada')
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
