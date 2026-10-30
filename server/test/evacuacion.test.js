import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evacuacionCerca, interpretarOverpass } from '../services/evacuacion.js'

const respuesta = {
  elements: [
    { type: 'node', id: 1, lat: -33.04, lon: -71.62, tags: { emergency: 'assembly_point', 'assembly_point:tsunami': 'yes', name: 'Zona de seguridad Plaza' } },
    { type: 'way', id: 2, tags: { evacuation_route: 'yes' }, geometry: [{ lat: -33.05, lon: -71.63 }, { lat: -33.04, lon: -71.62 }] },
    { type: 'relation', id: 3, tags: { route: 'evacuation', evacuation_route: 'tsunami' }, members: [{ type: 'way', geometry: [{ lat: -33.06, lon: -71.64 }, { lat: -33.05, lon: -71.63 }] }] },
    { type: 'way', id: 4, tags: { emergency: 'assembly_point' }, geometry: [{ lat: -33.0, lon: -71.6 }, { lat: -33.02, lon: -71.62 }] },
  ],
}

test('interpreta zonas de encuentro y rutas de evacuación', () => {
  const r = interpretarOverpass(respuesta)
  assert.equal(r.puntos.length, 2)
  assert.equal(r.puntos[0].tsunami, true)
  assert.equal(r.puntos[1].lat, -33.01)
  assert.equal(r.rutas.length, 2)
  assert.equal(r.rutas[1].tsunami, true)
  assert.deepEqual(r.rutas[0].coords[0], [-71.63, -33.05])
})

test('consulta varios servidores Overpass a la vez, tolera fallas y guarda en caché', async () => {
  const urls = []
  const f = async (url) => (urls.push(url), urls.length === 1 ? { ok: false, status: 504 } : { ok: true, json: async () => respuesta })
  const r = await evacuacionCerca({ lat: -33.04, lng: -71.62 }, { fetchFn: f })
  assert.equal(r.puntos.length, 2)
  const n = urls.length
  assert.ok(n >= 2)
  await evacuacionCerca({ lat: -33.05, lng: -71.61 }, { fetchFn: f })
  assert.equal(urls.length, n)
  await assert.rejects(evacuacionCerca({ lat: 10, lng: 10 }, { fetchFn: f }), /inválida/)
})
