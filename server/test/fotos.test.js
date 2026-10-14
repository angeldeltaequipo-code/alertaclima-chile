// Fotos de reportes: limpieza de metadatos, reglas de subida, denuncias y revisión.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { limpiarJpeg, limpiarWebp, tipoImagen } from '../services/fotos.js'

const JPG = readFileSync(join(import.meta.dirname, 'fixtures', 'con-exif.jpg'))
const WEBP = readFileSync(join(import.meta.dirname, 'fixtures', 'con-exif.webp'))

test('reconoce el tipo real de imagen por sus primeros bytes', () => {
  assert.equal(tipoImagen(JPG), 'image/jpeg')
  assert.equal(tipoImagen(WEBP), 'image/webp')
  assert.equal(tipoImagen(Buffer.from('<svg onload=alert(1)>')), null)
})

test('quita los metadatos (incluida la ubicación GPS) sin dañar la imagen', () => {
  const j = limpiarJpeg(JPG)
  assert.equal(j.includes(Buffer.from('Exif')), false)
  assert.equal(j.includes(Buffer.from('CamaraDePrueba')), false)
  assert.equal(tipoImagen(j), 'image/jpeg')
  assert.ok(j.length < JPG.length)
  assert.deepEqual(j.subarray(-2), Buffer.from([0xff, 0xd9])) // termina igual
  const w = limpiarWebp(WEBP)
  assert.equal(w.includes(Buffer.from('EXIF')), false)
  assert.equal(tipoImagen(w), 'image/webp')
  assert.equal(w.readUInt32LE(4), w.length - 8) // tamaño del contenedor corregido
})

// ---- Con base de datos ----
const URL_PRUEBA = process.env.TEST_DATABASE_URL
const omitir = !URL_PRUEBA && 'define TEST_DATABASE_URL para correr estas pruebas'
if (URL_PRUEBA) process.env.DATABASE_URL = URL_PRUEBA
const TOKEN = 'clave-admin-fotos-'.padEnd(40, 'y')
process.env.ADMIN_TOKEN = TOKEN

let pool, crearApp, srv, base
const eventos = []
before(async () => {
  if (omitir) return
  ;({ pool } = await import('../db/pool.js'))
  ;({ crearApp } = await import('../app.js'))
  srv = crearApp({ emitir: (ev, r) => eventos.push([ev, r.id, r.foto_id]) }).listen(0)
  base = `http://127.0.0.1:${srv.address().port}/api`
})
after(async () => {
  if (omitir) return
  srv.close()
  await pool.end()
})

async function nuevoReporte() {
  const r = await fetch(`${base}/reportes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `10.77.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` },
    body: JSON.stringify({ categoria: 'anegamiento', lat: -35.8467, lng: -71.5931 }),
  })
  assert.equal(r.status, 201)
  return r.json()
}
const subir = (id, clave, cuerpo = JPG, tipo = 'image/jpeg') =>
  fetch(`${base}/reportes/${id}/foto`, {
    method: 'POST',
    headers: { 'content-type': tipo, ...(clave ? { 'x-clave-edicion': clave } : {}) },
    body: cuerpo,
  })

test('solo quien creó el reporte sube la foto, una vez, y sale sin metadatos', { skip: omitir }, async () => {
  const { reporte, clave_edicion } = await nuevoReporte()
  assert.ok(clave_edicion && clave_edicion.length > 20)
  assert.equal((await subir(reporte.id, null)).status, 403)
  assert.equal((await subir(reporte.id, 'otra-clave')).status, 403)
  assert.equal((await subir(reporte.id, clave_edicion, Buffer.from('<html>'), 'image/jpeg')).status, 415)
  const ok = await subir(reporte.id, clave_edicion)
  assert.equal(ok.status, 201)
  const { reporte: conFoto } = await ok.json()
  assert.ok(conFoto.foto_id)
  assert.ok(eventos.some(([ev, id, foto]) => ev === 'reporte:actualizado' && id === reporte.id && foto === conFoto.foto_id))
  assert.equal((await subir(reporte.id, clave_edicion)).status, 409) // segunda foto: no

  const img = await fetch(`${base}/fotos/${conFoto.foto_id}`)
  assert.equal(img.status, 200)
  assert.equal(img.headers.get('content-type'), 'image/jpeg')
  assert.equal(img.headers.get('cross-origin-resource-policy'), 'cross-origin')
  const bytes = Buffer.from(await img.arrayBuffer())
  assert.equal(bytes.includes(Buffer.from('Exif')), false)
})

test('la clave de edición nunca viaja a otros vecinos', { skip: omitir }, async () => {
  const { reporte } = await nuevoReporte()
  assert.equal('clave_edicion' in reporte, false)
  assert.equal('clave_edicion_hash' in reporte, false)
  const lista = await (await fetch(`${base}/reportes?comuna=07401`)).json()
  assert.ok(lista.reportes.every((x) => !('clave_edicion_hash' in x)))
})

test('2 denuncias ocultan la foto; el administrador la restaura o elimina', { skip: omitir }, async () => {
  const { reporte, clave_edicion } = await nuevoReporte()
  const { reporte: r2 } = await (await subir(reporte.id, clave_edicion)).json()
  const denunciar = (d) =>
    fetch(`${base}/fotos/${r2.foto_id}/denuncias`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dispositivo: d }),
    }).then((r) => r.json())
  const d1 = randomUUID()
  assert.equal((await denunciar(d1)).oculta, false)
  assert.equal((await denunciar(d1)).oculta, false) // el mismo dispositivo no cuenta dos veces
  assert.equal((await denunciar(randomUUID())).oculta, true)
  assert.equal((await fetch(`${base}/fotos/${r2.foto_id}`)).status, 404)

  const admin = { 'content-type': 'application/json', authorization: `Bearer ${TOKEN}` }
  const lista = await (await fetch(`${base}/admin/fotos`, { headers: admin })).json()
  assert.ok(lista.fotos.some((f) => f.id === r2.foto_id))
  assert.equal((await fetch(`${base}/admin/fotos/${r2.foto_id}/imagen`, { headers: admin })).status, 200)
  await fetch(`${base}/admin/fotos/${r2.foto_id}`, { method: 'PATCH', headers: admin, body: JSON.stringify({ accion: 'restaurar' }) })
  assert.equal((await fetch(`${base}/fotos/${r2.foto_id}`)).status, 200)
  await fetch(`${base}/admin/fotos/${r2.foto_id}`, { method: 'PATCH', headers: admin, body: JSON.stringify({ accion: 'eliminar' }) })
  assert.equal((await fetch(`${base}/fotos/${r2.foto_id}`)).status, 404)
  assert.equal((await fetch(`${base}/admin/fotos/${r2.foto_id}/imagen`, { headers: admin })).status, 404)
})
