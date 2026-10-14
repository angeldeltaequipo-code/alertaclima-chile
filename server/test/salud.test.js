import { test } from 'node:test'
import assert from 'node:assert/strict'
import { crearApp } from '../app.js'

// Sin base de datos disponible, /api/salud debe responder 503 "degradado" (no caerse).
test('salud responde aunque la base de datos no esté', async () => {
  process.env.DATABASE_URL = 'postgres://nadie:nada@127.0.0.1:1/nada'
  const app = crearApp()
  const srv = app.listen(0)
  try {
    const { port } = srv.address()
    const r = await fetch(`http://127.0.0.1:${port}/api/salud`)
    const cuerpo = await r.json()
    assert.equal(r.status, 503)
    assert.equal(cuerpo.estado, 'degradado')
    assert.equal(cuerpo.baseDeDatos.ok, false)
  } finally {
    srv.close()
  }
})

test('rutas desconocidas de la API devuelven 404 en español', async () => {
  const app = crearApp()
  const srv = app.listen(0)
  try {
    const { port } = srv.address()
    const r = await fetch(`http://127.0.0.1:${port}/api/no-existe`)
    assert.equal(r.status, 404)
    assert.equal((await r.json()).error, 'Ruta no encontrada')
  } finally {
    srv.close()
  }
})
