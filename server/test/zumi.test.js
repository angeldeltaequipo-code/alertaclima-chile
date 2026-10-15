import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LIMITES_ZUMI, preguntarIA, prepararPregunta, revisarCupo } from '../services/zumi.js'

test('valida la pregunta y limita el cupo por hora', () => {
  assert.throws(() => prepararPregunta('   '), /pregunta/)
  assert.throws(() => prepararPregunta('a'.repeat(301)), /300/)
  for (let i = 0; i < LIMITES_ZUMI.porHora; i++) revisarCupo('x', 1000 + i)
  assert.throws(() => revisarCupo('x', 2000), /rato/)
  assert.doesNotThrow(() => revisarCupo('x', 1000 + 3601e3))
})

test('arma el pedido a Claude con personalidad, datos e historial, y limpia la respuesta', async () => {
  process.env.ANTHROPIC_API_KEY = 'prueba'
  let pedido
  const f = async (url, o) => {
    pedido = { url, cuerpo: JSON.parse(o.body), clave: o.headers['x-api-key'] }
    return { ok: true, json: async () => ({ content: [{ type: 'text', text: '**¡Hola!** Mañana   llueve.' }] }) }
  }
  const r = await preguntarIA({ pregunta: '¿Llueve?', contexto: { comuna: 'Talca' }, historial: [{ rol: 'zumi', texto: 'hola' }, { rol: 'persona', texto: 'hey' }, { rol: 'zumi', texto: 'dime' }], nombre: 'Ana' }, { fetchFn: f })
  assert.equal(r, '¡Hola! Mañana llueve.')
  assert.match(pedido.url, /anthropic/)
  assert.match(pedido.cuerpo.system, /ZUMI/)
  assert.equal(pedido.cuerpo.messages[0].role, 'user')
  assert.match(pedido.cuerpo.messages.at(-1).content, /<datos>\{"comuna":"Talca"\}<\/datos>[\s\S]*Ana[\s\S]*¿Llueve\?/)
  delete process.env.ANTHROPIC_API_KEY
})
