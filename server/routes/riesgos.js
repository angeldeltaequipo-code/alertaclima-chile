import { Router } from 'express'
import { resumenRiesgos } from '../services/riesgos.js'

/** GET /api/riesgos → sismos (7 días), boletines de tsunami y volcanes activos de Chile. */
export function riesgosRouter() {
  const r = Router()
  r.get('/', async (req, res, next) => {
    try {
      res.set('Cache-Control', 'public, max-age=60').json(await resumenRiesgos())
    } catch (e) {
      next(e)
    }
  })
  return r
}
