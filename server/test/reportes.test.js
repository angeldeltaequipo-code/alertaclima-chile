// Pruebas contra una base de datos real con PostGIS y las comunas cargadas.
// Corre con: TEST_DATABASE_URL=postgres://... npm test
// Sin TEST_DATABASE_URL estas pruebas se omiten.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const URL_PRUEBA = process.env.TEST_DATABASE_URL
const omitir = !URL_PRUEBA && 'define TEST_DATABASE_URL para correr estas pruebas'
if (URL_PRUEBA) process.env.DATABASE_URL = URL_PRUEBA

let pool, R, crearApp
before(async () => {
  if (omitir) return
  ;({ pool } = await import('../db/pool.js'))
  R = await import('../services/reportes.js')
  ;({ crearApp } = await import('../app.js'))
})
after(async () => {
  if (!omitir) await pool.end()
})

const LINARES = { lat: -35.84667, lng: -71.59308 }
const nuevoHash = () => `prueba-${randomUUID()}`

test('crea un reporte y el servidor asigna la comuna por ubicación', { skip: omitir }, async () => {
  const r = await R.crearReporte(pool, { categoria: 'anegamiento', ...LINARES, comuna_cut: '13101' }, nuevoHash())
  assert.equal(r.comuna_cut, '07401') // Linares, aunque el cliente diga otra cosa
  assert.equal(r.titulo, 'Calle anegada')
  assert.equal(r.lat, -35.8467) // redondeado a 4 decimales
  assert.equal(r.estado, 'activo')
  const lista = await R.listarReportes(pool, '07401')
  assert.ok(lista.some((x) => x.id === r.id))
})

test('rechaza ubicaciones fuera de Chile y categorías inválidas', { skip: omitir }, async () => {
  await assert.rejects(R.crearReporte(pool, { categoria: 'anegamiento', lat: -34.6, lng: -58.4 }, nuevoHash()), {
    estado: 422,
  })
  await assert.rejects(R.crearReporte(pool, { categoria: 'meteorito', ...LINARES }, nuevoHash()), { estado: 400 })
})

test('máximo 5 reportes por hora por reportante', { skip: omitir }, async () => {
  const h = nuevoHash()
  for (let i = 0; i < 5; i++) await R.crearReporte(pool, { categoria: 'corte_luz', ...LINARES }, h)
  await assert.rejects(R.crearReporte(pool, { categoria: 'corte_luz', ...LINARES }, h), { estado: 429 })
  // Otro reportante sí puede
  await R.crearReporte(pool, { categoria: 'corte_luz', ...LINARES }, nuevoHash())
})

test('el límite no se puede saltar enviando en paralelo', { skip: omitir }, async () => {
  const h = nuevoHash()
  const res = await Promise.allSettled(
    Array.from({ length: 8 }, () => R.crearReporte(pool, { categoria: 'otro', ...LINARES }, h)),
  )
  assert.equal(res.filter((x) => x.status === 'fulfilled').length, 5)
})

test('3 desmentidos netos ocultan el reporte', { skip: omitir }, async () => {
  const r = await R.crearReporte(pool, { categoria: 'arbol_caido', ...LINARES }, nuevoHash())
  await R.votar(pool, r.id, -1, 'v1')
  const r2 = await R.votar(pool, r.id, -1, 'v2')
  assert.equal(r2.estado, 'activo')
  const r3 = await R.votar(pool, r.id, -1, 'v3')
  assert.equal(r3.estado, 'oculto')
  assert.equal(r3.desmentidos, 3)
  const lista = await R.listarReportes(pool, '07401')
  assert.ok(!lista.some((x) => x.id === r.id))
  await assert.rejects(R.votar(pool, r.id, 1, 'v4'), { estado: 409 })
})

test('las confirmaciones compensan los desmentidos y extienden la vigencia', { skip: omitir }, async () => {
  const r = await R.crearReporte(pool, { categoria: 'desborde', ...LINARES }, nuevoHash())
  await R.votar(pool, r.id, 1, 'c1')
  await R.votar(pool, r.id, -1, 'd1')
  await R.votar(pool, r.id, -1, 'd2')
  const r4 = await R.votar(pool, r.id, -1, 'd3') // neto = 3 − 1 = 2: sigue activo
  assert.equal(r4.estado, 'activo')
  assert.equal(r4.confirmaciones, 1)
  // Vencimiento: la confirmación extiende como mínimo a 6 h desde ahora y nunca más de 48 h desde la creación
  assert.ok(new Date(r4.vence) <= new Date(new Date(r.creado).getTime() + 48 * 3600e3))
})

test('un dispositivo vota una sola vez por reporte (puede cambiar su voto)', { skip: omitir }, async () => {
  const r = await R.crearReporte(pool, { categoria: 'corte_ruta', ...LINARES }, nuevoHash())
  await R.votar(pool, r.id, 1, 'mismo')
  const a = await R.votar(pool, r.id, 1, 'mismo')
  assert.equal(a.confirmaciones, 1)
  const b = await R.votar(pool, r.id, -1, 'mismo')
  assert.equal(b.confirmaciones, 0)
  assert.equal(b.desmentidos, 1)
})

test('API HTTP: crear, listar y votar, con aviso en tiempo real', { skip: omitir }, async () => {
  const eventos = []
  const app = crearApp({ emitir: (ev, rep) => eventos.push([ev, rep.id]) })
  const srv = app.listen(0)
  const base = `http://127.0.0.1:${srv.address().port}/api/reportes`
  try {
    const c = await fetch(base, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.9.${Math.floor(Math.random() * 250)}.1` },
      body: JSON.stringify({ categoria: 'anegamiento', titulo: '  Calle   Independencia  ', ...LINARES }),
    })
    assert.equal(c.status, 201)
    const { reporte } = await c.json()
    assert.equal(reporte.titulo, 'Calle Independencia')
    const l = await (await fetch(`${base}?comuna=07401`)).json()
    assert.ok(l.reportes.some((x) => x.id === reporte.id))
    const v = await fetch(`${base}/${reporte.id}/votos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ voto: 1, dispositivo: randomUUID() }),
    })
    assert.equal(v.status, 200)
    assert.deepEqual(eventos.map((e) => e[0]), ['reporte:nuevo', 'reporte:actualizado'])
    const malo = await fetch(base, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{malo' })
    assert.equal(malo.status, 400)
    assert.equal((await malo.json()).error, 'Datos mal formados')
  } finally {
    srv.close()
  }
})
