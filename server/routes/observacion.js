import { Router } from 'express'
import { observacionCercana } from '../services/observaciones.js'
import { ErrorValidacion } from '../services/reportes.js'

/** GET /api/observacion?lat=&lng= → la medición real más cercana, o null si no hay una útil. */
export function observacionRouter() {
  const r = Router()
  r.get('/', async (req, res, next) => {
    try {
      const lat = Number(req.query.lat)
      const lng = Number(req.query.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -60 || lat > -15 || lng < -115 || lng > -60) {
        throw new ErrorValidacion('Ubicación inválida')
      }
      const observacion = await observacionCercana({ lat, lng })
      res.set('Cache-Control', 'public, max-age=300').json({ observacion })
    } catch (e) {
      next(e)
    }
  })
  return r
}
