import { test } from 'node:test'
import assert from 'node:assert/strict'
import { avisarSenapred } from '../services/avisos-senapred.js'

// Base falsa con lo justo para senapred_avisados
function base() {
  const filas = new Map()
  return {
    filas,
    async query(sql, p) {
      if (sql.startsWith('SELECT nivel')) return { rows: filas.has(p[0]) ? [{ nivel: filas.get(p[0]).nivel }] : [] }
      if (sql.startsWith('INSERT INTO senapred_avisados')) filas.set(p[0], { nivel: p[1] })
      return { rows: [] }
    },
  }
}
const ahora = Date.parse('2026-11-25T20:00:00Z')
const alerta = (o = {}) => ({ id: 'senapred-1', nivel: 'amarilla', amenaza: 'Lluvia', comunas: ['05101'], vigente_desde: '2026-11-25T19:50:00Z', estado: 'vigente', ...o })

test('una alerta nueva se avisa una sola vez', async () => {
  const db = base()
  const enviados = []
  const notificar = async (_p, a, tipo) => (enviados.push([a.id, tipo]), { enviadas: 3 })
  await avisarSenapred(db, [alerta()], { ahora, notificar })
  await avisarSenapred(db, [alerta()], { ahora, notificar })
  assert.deepEqual(enviados, [['senapred-1', 'nueva']])
})

test('si sube de nivel se vuelve a avisar', async () => {
  const db = base()
  const enviados = []
  const notificar = async (_p, a, tipo) => (enviados.push(tipo), { enviadas: 1 })
  await avisarSenapred(db, [alerta()], { ahora, notificar })
  await avisarSenapred(db, [alerta({ nivel: 'roja' })], { ahora, notificar })
  assert.deepEqual(enviados, ['nueva', 'sube'])
})

test('las alertas viejas (más de 12 h) no se avisan', async () => {
  const db = base()
  let n = 0
  await avisarSenapred(db, [alerta({ vigente_desde: '2026-11-24T01:00:00Z' })], { ahora, notificar: async () => (n++, {}) })
  assert.equal(n, 0)
})
