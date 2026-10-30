import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { audienciasGoogle, ingresarConApple, verificarConApple } from '../services/cuentas.js'

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' }
const llaves = async () => ({ ok: true, json: async () => ({ keys: [jwk] }) })
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
function token(datos, { kid = 'k1', alg = 'RS256' } = {}) {
  const h = b64({ alg, kid })
  const p = b64({ iss: 'https://appleid.apple.com', aud: 'cl.alertaclima.app', exp: Math.floor(Date.now() / 1000) + 600, sub: '001.abc', ...datos })
  return `${h}.${p}.${sign('RSA-SHA256', Buffer.from(`${h}.${p}`), privateKey).toString('base64url')}`
}

test('verifica el token de Apple: firma, emisor, audiencia y vencimiento', async () => {
  assert.equal((await verificarConApple(token({}), { fetchFn: llaves })).sub, '001.abc')
  await assert.rejects(verificarConApple(token({ aud: 'otra.app' }), { fetchFn: llaves }), /Audiencia/)
  await assert.rejects(verificarConApple(token({ iss: 'https://malo' }), { fetchFn: llaves }), /Emisor/)
  await assert.rejects(verificarConApple(token({ exp: 1 }), { fetchFn: llaves }), /vencido/)
  await assert.rejects(verificarConApple(token({}, { alg: 'none' }), { fetchFn: llaves }), /Algoritmo/)
  const t = token({}).split('.')
  await assert.rejects(verificarConApple(`${t[0]}.${b64({ iss: 'https://appleid.apple.com', aud: 'cl.alertaclima.app', exp: 9e9, sub: 'otro' })}.${t[2]}`, { fetchFn: llaves }), /Firma/)
})

test('ingresar con Apple crea la cuenta con «Nombre I.» y entrega sesión', async () => {
  const q = []
  const pool = { query: async (sql, p) => (q.push({ sql, p }), { rows: [{ id: 9, nombre: p[1], foto_url: null, bloqueado: false, creado_en: new Date(), nueva: false }] }) }
  const r = await ingresarConApple(pool, { credencial: 'x', nombre: 'Rosa', apellido: 'Muñoz' }, { verificar: async () => ({ sub: '001.abc' }) })
  assert.equal(r.usuario.nombre, 'Rosa M.')
  assert.ok(r.sesion)
  assert.match(q[0].sql, /apple_sub/)
  await assert.rejects(ingresarConApple(pool, { credencial: 'x' }, { verificar: async () => { throw new Error('no') } }), /Apple/)
})

test('Google acepta el ID de la web y el de la app de iPhone', () => {
  process.env.GOOGLE_CLIENT_ID = 'web.apps'
  process.env.GOOGLE_CLIENT_ID_IOS = 'ios.apps'
  assert.deepEqual(audienciasGoogle(), ['web.apps', 'ios.apps'])
  delete process.env.GOOGLE_CLIENT_ID_IOS
  assert.deepEqual(audienciasGoogle(), ['web.apps'])
})
