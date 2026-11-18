import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { cobertura, vigentes } from '../services/senapred.js'

const filas = JSON.parse(readFileSync(new URL('./fixtures/senapred-alertas.json', import.meta.url), 'utf8'))
const AHORA = Date.parse('2026-11-17T23:00:00Z')

test('SENAPRED: cobertura por comunas nombradas, provincia, región y nacional', () => {
  const atacama = '210d21f3-aa90-4395-8244-00a0032d6125'
  const c = cobertura('Se declara Alerta Amarilla para las comunas de Copiapó, Tierra Amarilla y Caldera por crecida', [atacama])
  assert.deepEqual(c.sort(), ['03101', '03102', '03103'].sort())
  const huasco = cobertura('Monitoreo Alerta Temprana Preventiva para la Provincia de Huasco por crecida', [atacama])
  assert.ok(huasco.includes('03301') && huasco.includes('03304') && !huasco.includes('03101')) // Vallenar y Huasco sí; Copiapó no
  const region = cobertura('Monitoreo Alerta Temprana Preventiva para la Región del Biobío por evento meteorológico', ['xx'])
  assert.ok(region.includes('08101') && region.includes('08106') && !region.includes('13101'))
  assert.ok(cobertura('Se declara Alerta Temprana Preventiva Nacional por calor').length > 340)
})

test('SENAPRED: solo vigentes (la última de cada aviso, sin las canceladas ni las viejas)', () => {
  const v = vigentes(filas, AHORA)
  assert.ok(v.length > 5)
  for (const a of v) {
    assert.ok(['preventiva', 'amarilla', 'roja'].includes(a.nivel))
    assert.ok(!/^\s*(se\s+)?cancela/i.test(a.titulo))
    assert.ok(a.comunas.length > 0, a.titulo)
    assert.match(a.fuente_url, /^https:\/\/senapred\.cl\//)
  }
  // Lota (08106) está en el Biobío: la preventiva regional por evento meteorológico le llega
  assert.ok(v.some((a) => a.comunas.includes('08106')))
  // un aviso no aparece dos veces
  const claves = v.map((a) => a.titulo)
  assert.equal(new Set(v.map((a) => a.id)).size, v.length, claves.join('\n'))
})
