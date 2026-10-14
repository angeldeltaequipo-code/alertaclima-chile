import { test } from 'node:test'
import assert from 'node:assert/strict'
import { camarasCercanas, interpretarCamara } from '../services/camaras.js'

const LOTA = { lat: -37.0899, lng: -73.1577 }
const ejemplo = {
  webcamId: 1234567890,
  title: 'Concepción: Costanera',
  status: 'active',
  lastUpdatedOn: '2026-10-14T21:10:00.000Z',
  location: { city: 'Concepción', region: 'Biobío', latitude: -36.82, longitude: -73.05 },
  images: { current: { preview: 'https://imgproxy.windy.com/x/preview.jpg', thumbnail: 'https://imgproxy.windy.com/x/thumb.jpg' } },
  urls: { detail: 'https://www.windy.com/webcams/1234567890' },
}

test('sin clave de Windy, la función queda apagada y lo dice', async () => {
  delete process.env.WINDY_API_KEY
  assert.deepEqual(await camarasCercanas(LOTA), { disponible: false, camaras: [] })
})

test('interpreta una cámara y descarta las que no tienen imagen o ubicación', () => {
  const c = interpretarCamara(ejemplo, LOTA)
  assert.equal(c.id, '1234567890')
  assert.equal(c.lugar, 'Concepción, Biobío')
  assert.equal(c.enlace, 'https://www.windy.com/webcams/1234567890')
  assert.ok(c.distanciaKm > 25 && c.distanciaKm < 35)
  assert.equal(interpretarCamara({ ...ejemplo, images: {} }, LOTA), null)
  assert.equal(interpretarCamara({ ...ejemplo, location: {} }, LOTA), null)
})

test('con clave, consulta a Windy con la cabecera correcta y ordena por distancia', async () => {
  process.env.WINDY_API_KEY = 'clave-de-prueba'
  let pedido
  const fetchFn = async (url, opciones) => {
    pedido = { url: String(url), clave: opciones.headers['x-windy-api-key'] }
    const lejana = { ...ejemplo, webcamId: 2, location: { ...ejemplo.location, latitude: -36.9, longitude: -73.1 } }
    return { ok: true, json: async () => ({ webcams: [ejemplo, lejana, { ...ejemplo, webcamId: 3, status: 'inactive' }] }) }
  }
  const r = await camarasCercanas({ lat: -37.0901, lng: -73.1579 }, { fetchFn })
  assert.equal(pedido.clave, 'clave-de-prueba')
  assert.match(pedido.url, /nearby=-37\.0901%2C-73\.1579%2C30/)
  assert.equal(r.disponible, true)
  assert.deepEqual(r.camaras.map((c) => c.id), ['2', '1234567890']) // la inactiva se descarta
  delete process.env.WINDY_API_KEY
})
