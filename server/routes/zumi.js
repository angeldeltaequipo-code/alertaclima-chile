import { Router } from 'express'
import { pool } from '../db/pool.js'
import { exigirCuentaSiActiva } from '../services/cuentas.js'
import { iaActiva, preguntarIA, revisarCupo } from '../services/zumi.js'
import { limitesDe, planDe } from '../services/planes.js'

/** Conversación con ZUMI. Con IA solo si hay clave; la app tiene su respaldo sin IA. */
export function zumiRouter({ preguntar = preguntarIA } = {}) {
  const r = Router()
  r.get('/config', (req, res) => res.json({ ia: iaActiva() }))
  r.post('/preguntar', exigirCuentaSiActiva(pool), async (req, res, next) => {
    try {
      if (!iaActiva()) return res.status(503).json({ error: 'La conversación con IA no está activa', codigo: 'sin-ia' })
      const { plan } = await planDe(pool, req.usuario?.id)
      revisarCupo(req.usuario ? `u${req.usuario.id}` : `ip${req.ip}`, Date.now(), { porDia: limitesDe(plan).zumiDia })
      const { pregunta, contexto, historial } = req.body ?? {}
      const respuesta = await preguntar({ pregunta, contexto, historial, nombre: req.usuario?.nombre?.split(' ')[0] })
      res.json({ respuesta, fuente: 'ia' })
    } catch (e) {
      next(e)
    }
  })
  return r
}
