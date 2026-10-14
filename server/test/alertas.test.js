// Pruebas de alertas oficiales contra una base real con PostGIS y comunas cargadas.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'

const URL_PRUEBA = process.env.TEST_DATABASE_URL
const omitir = !URL_PRUEBA && 'define TEST_DATABASE_URL para correr estas pruebas'
if (URL_PRUEBA) process.env.DATABASE_URL = URL_PRUEBA
const TOKEN = 'clave-de-prueba-'.padEnd(40, 'x')
process.env.ADMIN_TOKEN = TOKEN

let pool, A, crearApp
before(async () => {
  if (omitir) return
  ;({ pool } = await import('../db/pool.js'))
  A = await import('../services/alertas.js')
  ;({ crearApp } = await import('../app.js'))
})
after(async () => {
  if (!omitir) await pool.end()
})

const base = {
  nivel: 'roja',
  amenaza: 'Sistema frontal',
  titulo: 'Alerta Roja por sistema frontal',
  fuente_nombre: 'SENAPRED',
  fuente_url: 'https://senapred.cl/alertas/ejemplo',
}

test('solo acepta fuentes oficiales con https', { skip: omitir }, () => {
  assert.ok(A.fuenteValida('https://senapred.cl/x'))
  assert.ok(A.fuenteValida('https://www.senapred.cl/x'))
  assert.ok(A.fuenteValida('https://meteochile.gob.cl/x'))
  assert.ok(!A.fuenteValida('http://senapred.cl/x'))
  assert.ok(!A.fuenteValida('https://senapred.cl.estafa.com/x'))
  assert.ok(!A.fuenteValida('https://twitter.com/senapred'))
})

test('una alerta por región cubre todas sus comunas y se ordena por gravedad', { skip: omitir }, async () => {
  const amarilla = await A.crearAlerta(pool, { ...base, nivel: 'amarilla', titulo: 'Amarilla Maule', regiones: ['07'] })
  assert.equal(amarilla.comunas.length, 30) // las 30 comunas del Maule
  const roja = await A.crearAlerta(pool, { ...base, comunas: ['07401'] })
  const enLinares = await A.alertasDeComuna(pool, '07401')
  const ids = enLinares.map((a) => a.id)
  assert.ok(ids.indexOf(roja.id) < ids.indexOf(amarilla.id)) // la roja primero
  const enTalca = await A.alertasDeComuna(pool, '07101')
  assert.ok(enTalca.some((a) => a.id === amarilla.id))
  assert.ok(!enTalca.some((a) => a.id === roja.id))
  await A.actualizarAlerta(pool, roja.id, { accion: 'cancelar' })
  await A.actualizarAlerta(pool, amarilla.id, { accion: 'cancelar' })
  assert.ok(!(await A.alertasDeComuna(pool, '07401')).some((a) => a.id === roja.id))
})

test('rechaza alertas sin fuente oficial, sin cobertura o ya vencidas', { skip: omitir }, async () => {
  await assert.rejects(A.crearAlerta(pool, { ...base, fuente_url: 'https://facebook.com/x', comunas: ['07401'] }), {
    estado: 400,
  })
  await assert.rejects(A.crearAlerta(pool, { ...base, comunas: [] }), /al menos una comuna/)
  await assert.rejects(A.crearAlerta(pool, { ...base, comunas: ['07401'], vigente_hasta: '2020-01-01T00:00:00Z' }), /ya pasó/)
})

test('una alerta sin confirmar por más de N horas se marca como sin confirmar', { skip: omitir }, async () => {
  const a = await A.crearAlerta(pool, { ...base, comunas: ['07401'] })
  await pool.query(`UPDATE official_alerts SET confirmada_en = now() - INTERVAL '13 hours' WHERE id = $1`, [a.id])
  let lista = await A.alertasDeComuna(pool, '07401')
  assert.equal(lista.find((x) => x.id === a.id).sin_confirmar, true)
  await A.actualizarAlerta(pool, a.id, { accion: 'confirmar' })
  lista = await A.alertasDeComuna(pool, '07401')
  assert.equal(lista.find((x) => x.id === a.id).sin_confirmar, false)
  await A.actualizarAlerta(pool, a.id, { accion: 'cancelar' })
  await assert.rejects(A.actualizarAlerta(pool, a.id, { accion: 'confirmar' }), { estado: 409 })
})

test('las alertas vencidas dejan de mostrarse solas', { skip: omitir }, async () => {
  const a = await A.crearAlerta(pool, { ...base, comunas: ['07401'], vigente_hasta: new Date(Date.now() + 3600e3).toISOString() })
  await pool.query(`UPDATE official_alerts SET vigente_hasta = now() - INTERVAL '1 minute' WHERE id = $1`, [a.id])
  assert.ok(!(await A.alertasDeComuna(pool, '07401')).some((x) => x.id === a.id))
})

test('editar cambia la cobertura y avisa a las comunas de antes y de después', { skip: omitir }, async () => {
  const a = await A.crearAlerta(pool, { ...base, comunas: ['07401'] })
  const { alerta, comunasAfectadas } = await A.actualizarAlerta(pool, a.id, {
    accion: 'editar',
    ...base,
    nivel: 'evacuacion',
    comunas: ['07402'],
  })
  assert.equal(alerta.nivel, 'evacuacion')
  assert.deepEqual(alerta.comunas, ['07402'])
  assert.deepEqual(comunasAfectadas.sort(), ['07401', '07402'])
  await A.actualizarAlerta(pool, a.id, { accion: 'cancelar' })
})

test('API: lectura pública, administración protegida y bitácora', { skip: omitir }, async () => {
  const avisos = []
  const app = crearApp({ avisarComunas: (c) => avisos.push(...c) })
  const srv = app.listen(0)
  const url = `http://127.0.0.1:${srv.address().port}/api`
  const admin = { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` }
  try {
    assert.equal((await fetch(`${url}/admin/alertas`)).status, 401)
    assert.equal((await fetch(`${url}/admin/alertas`, { headers: { authorization: 'Bearer mala' } })).status, 401)
    const c = await fetch(`${url}/admin/alertas`, {
      method: 'POST',
      headers: admin,
      body: JSON.stringify({ ...base, nivel: 'preventiva', comunas: ['07401'] }),
    })
    assert.equal(c.status, 201)
    const { alerta } = await c.json()
    assert.deepEqual(avisos, ['07401'])
    const pub = await (await fetch(`${url}/alertas?comuna=07401`)).json()
    assert.ok(pub.alertas.some((a) => a.id === alerta.id))
    assert.equal(pub.horasSinConfirmar, 12)
    const p = await fetch(`${url}/admin/alertas/${alerta.id}`, {
      method: 'PATCH',
      headers: admin,
      body: JSON.stringify({ accion: 'cancelar' }),
    })
    assert.equal(p.status, 200)
    const log = await (await fetch(`${url}/admin/bitacora`, { headers: admin })).json()
    assert.ok(log.registros.some((r) => r.accion === 'alerta:cancelar' && r.detalle.id === alerta.id))
  } finally {
    srv.close()
  }
})
