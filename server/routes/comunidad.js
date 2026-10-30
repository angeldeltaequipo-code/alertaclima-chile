import { Router } from 'express'
import { loQueSeComenta } from '../services/comunidad.js'

/** GET /api/comunidad → noticias y publicaciones públicas recientes sobre emergencias en Chile (NO oficial). */
export function comunidadRouter() {
  const r = Router()
  r.get('/', async (req, res, next) => {
    try {
      res.set('Cache-Control', 'public, max-age=120').json(await loQueSeComenta())
    } catch (e) {
      next(e)
    }
  })
  return r
}
