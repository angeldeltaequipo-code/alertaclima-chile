import { test } from 'node:test'
import assert from 'node:assert/strict'
import { paraVoz, ajustesVoz } from '../services/voz/index.js'

test('la voz dice los números y símbolos como se leen', () => {
  assert.equal(paraVoz('Hoy hay 18° y viento de 12 km/h'), 'Hoy hay 18 grados y viento de 12 kilómetros por hora')
  assert.equal(paraVoz('Caerán 2,5 mm a las 15:00'), 'Caerán 2 coma 5 milímetros a las 15 horas')
  assert.equal(paraVoz('Soy ZUMI 🐼, sigue a SENAPRED'), 'Soy Zumi , sigue a Senapred')
  assert.ok(paraVoz('a'.repeat(1000)).length <= 400)
})

test('tono de personaje: sube el tono sin cambiar el ritmo', () => {
  const a = ajustesVoz()
  assert.ok(a.tono > 1 && a.tono <= 1.5)
  assert.ok(Math.abs(a.velocidad * a.tono - 1) < 0.01)
})
