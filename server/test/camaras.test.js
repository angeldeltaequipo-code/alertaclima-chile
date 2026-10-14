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
    pedido ??= { url: String(url), clave: opciones.headers['x-windy-api-key'] }
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

test('si cerca hay pocas cámaras, amplía la búsqueda y marca las lejanas', async () => {
  process.env.WINDY_API_KEY = 'clave-de-prueba'
  const radios = []
  const fetchFn = async (url) => {
    const radio = Number(new URL(url).searchParams.get('nearby').split(',')[2])
    radios.push(radio)
    const lista = radio === 30 ? [ejemplo] : [ejemplo, ...[5, 6, 7].map((id) => ({ ...ejemplo, webcamId: id, title: `Cámara ${id}`, location: { ...ejemplo.location, latitude: -36.2, longitude: -72.9 } }))]
    return { ok: true, json: async () => ({ webcams: lista }) }
  }
  const r = await camarasCercanas({ lat: -36.85, lng: -73.06 }, { fetchFn })
  assert.deepEqual(radios, [30, 120])
  assert.equal(r.camaras.length, 4) // sin repetir la cercana
  assert.equal(r.camaras[0].lejana, false)
  assert.equal(r.camaras.at(-1).lejana, true)
  delete process.env.WINDY_API_KEY
})

test('solo acepta reproductores de windy.com', () => {
  const con = interpretarCamara({ ...ejemplo, player: { day: 'https://webcams.windy.com/webcams/public/player?webcamId=1&playerType=day' } }, LOTA)
  assert.match(con.reproductor, /^https:\/\/webcams\.windy\.com\//)
  const malo = interpretarCamara({ ...ejemplo, player: { day: 'https://malo.example/x' } }, LOTA)
  assert.equal(malo.reproductor, null)
})

test('no repite la misma cámara publicada dos veces en el mismo lugar', async () => {
  process.env.WINDY_API_KEY = 'clave-de-prueba'
  const fetchFn = async () => ({ ok: true, json: async () => ({ webcams: [ejemplo, { ...ejemplo, webcamId: 99 }] }) })
  const r = await camarasCercanas({ lat: -10, lng: -70 }, { fetchFn })
  assert.equal(r.camaras.length, 1)
  delete process.env.WINDY_API_KEY
})
