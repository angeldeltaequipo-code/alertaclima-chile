import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  distanciaKm,
  fenomeno,
  humedadRelativa,
  interpretarMetar,
  observacionCercana,
  reiniciarCache,
} from '../services/observaciones.js'

// Reportes reales de Carriel Sur del 14-10-2026, usados como ejemplo.
const SCIE_1700 = {
  icaoId: 'SCIE',
  name: 'Concepcion/Sur Intl, BI, CL',
  lat: -36.773,
  lon: -73.063,
  elev: 8,
  reportTime: '2026-10-14T17:00:00.000Z',
  temp: 16,
  dewp: 14,
  wspd: 8,
  rawOb: 'METAR SCIE 141700Z 01008KT 330V040 9999 -SHRA SCT030 BKN080 16/14 Q1020 RMK TCU EN VC',
  clouds: [
    { cover: 'SCT', base: 3000 },
    { cover: 'BKN', base: 8000 },
  ],
}
const SCIE_2100 = {
  ...SCIE_1700,
  reportTime: '2026-10-14T21:00:00.000Z',
  temp: 18,
  dewp: 13,
  wspd: 11,
  rawOb: 'METAR SCIE 142100Z 02011KT 9999 FEW030 18/13 Q1019',
  clouds: [{ cover: 'FEW', base: 3000 }],
}

test('interpreta lluvia, tormenta y niebla del METAR', () => {
  assert.deepEqual(fenomeno(SCIE_1700.rawOb), { texto: 'Chubascos débiles', precipitacion: true, intensidad: 'débil' })
  assert.equal(fenomeno('METAR SCEL 141700Z 18010KT 9999 +RA OVC010 10/09 Q1012').texto, 'Lluvia fuerte')
  assert.equal(fenomeno('METAR SCEL 141700Z 18010KT 9999 TSRA OVC010 10/09 Q1012').texto, 'Tormenta con lluvia')
  assert.equal(fenomeno('METAR SCEL 141700Z 18010KT 0300 FG VV001 08/08 Q1012').texto, 'Niebla')
  assert.equal(fenomeno('METAR SCEL 141700Z 18010KT 9999 FEW030 18/13 Q1019 RMK RA EN VC'), null) // comentario, no fenómeno
  assert.equal(fenomeno(SCIE_2100.rawOb), null)
})

test('calcula humedad y convierte nudos a km/h', () => {
  assert.equal(humedadRelativa(18, 13), 73)
  const o = interpretarMetar(SCIE_2100)
  assert.equal(o.nombre, 'Concepción (aeropuerto Carriel Sur)')
  assert.equal(o.viento, 20)
  assert.equal(o.cielo, 'Pocas nubes')
  assert.equal(o.temperatura, 18)
})

beforeEach(() => reiniciarCache())

const fetchFalso = (lista) => async () => ({ ok: true, json: async () => lista })
const LOTA = { lat: -37.08994, lng: -73.1577 }

test('elige la estación más cercana con el reporte más reciente', async () => {
  const o = await observacionCercana(LOTA, {
    fetchFn: fetchFalso([SCIE_1700, SCIE_2100]),
    ahora: new Date('2026-10-14T21:20:00Z').getTime(),
  })
  assert.equal(o.id, 'SCIE')
  assert.equal(o.temperatura, 18)
  assert.ok(o.distanciaKm > 30 && o.distanciaKm < 40, `distancia ${o.distanciaKm}`)
  assert.ok(Math.abs(distanciaKm(LOTA, { lat: -36.773, lng: -73.063 }) - o.distanciaKm) < 0.1)
})

test('no usa mediciones viejas ni estaciones lejanas', async () => {
  const viejo = await observacionCercana(LOTA, {
    fetchFn: fetchFalso([SCIE_2100]),
    ahora: new Date('2026-10-14T23:00:00Z').getTime(), // 2 h después
  })
  assert.equal(viejo, null)
  reiniciarCache()
  const lejos = await observacionCercana({ lat: -35.8467, lng: -71.5931 }, {
    fetchFn: fetchFalso([SCIE_2100]),
    ahora: new Date('2026-10-14T21:10:00Z').getTime(),
  })
  assert.equal(lejos, null) // Linares está a más de 40 km de Concepción
})

test('si la fuente falla, no se cae: responde sin medición', async () => {
  const o = await observacionCercana(LOTA, { fetchFn: async () => ({ ok: false, status: 503 }) })
  assert.equal(o, null)
})
