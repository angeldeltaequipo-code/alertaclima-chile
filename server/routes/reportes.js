import { Router } from 'express'
import { pool } from '../db/pool.js'
import { hashReportante, hashVotante } from '../services/privacidad.js'
import { crearReporte, ErrorValidacion, listarReportes, votar } from '../services/reportes.js'

// Rutas HTTP de los reportes. `emitir(evento, reporte)` avisa en tiempo real a la sala de la comuna.
export function reportesRouter({ emitir = () => {} } = {}) {
  const r = Router()

  r.get('/', async (req, res, next) => {
    try {
      const reportes = await listarReportes(pool, req.query.comuna)
      res.set('Cache-Control', 'no-store').json({ reportes, hora: new Date().toISOString() })
    } catch (e) {
      next(e)
    }
  })

  r.post('/', async (req, res, next) => {
    try {
      const reporte = await crearReporte(pool, req.body, hashReportante(req.ip))
      emitir('reporte:nuevo', reporte)
      res.status(201).json({ reporte })
    } catch (e) {
      next(e)
    }
  })

  r.post('/:id/votos', async (req, res, next) => {
    try {
      const { voto, dispositivo } = req.body ?? {}
      if (typeof dispositivo !== 'string' || !/^[\w-]{16,64}$/.test(dispositivo)) {
        throw new ErrorValidacion('Falta el identificador del dispositivo')
      }
      const reporte = await votar(pool, req.params.id, Number(voto), hashVotante(dispositivo))
      emitir(reporte.estado === 'activo' ? 'reporte:actualizado' : 'reporte:retirado', reporte)
      res.json({ reporte })
    } catch (e) {
      next(e)
    }
  })

  return r
}
