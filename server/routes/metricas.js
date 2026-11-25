// Métricas de uso sin datos personales.
//   POST /latido  { id, comuna, plataforma, avisos }  → 204   (la app, al abrirse; una vez por día basta)
//   POST /evento  { tipo }                            → 204   (pregunta a ZUMI, SOS, paseo…)
//   GET  /resumen                                      → panel (clave ADMIN_TOKEN)
import { Router } from 'express'
import { exigirAdmin } from '../services/autorizacion.js'
import { EVENTOS, validarLatido } from '../services/metricas.js'

export function metricasRouter({ almacen }) {
  const r = Router()
  const callado = (p) => Promise.resolve(p).catch((e) => console.error('Métricas:', e.message))
  r.post('/latido', (req, res) => {
    const l = validarLatido(req.body)
    if (!l) return res.status(400).json({ error: 'Latido inválido' })
    callado(almacen.latido(l))
    res.status(204).end()
  })
  r.post('/evento', (req, res) => {
    const t = String(req.body?.tipo ?? '')
    if (!EVENTOS.has(t)) return res.status(400).json({ error: 'Evento desconocido' })
    callado(almacen.evento(t))
    res.status(204).end()
  })
  r.get('/resumen', exigirAdmin, async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store').json(await almacen.resumen())
    } catch (e) {
      next(e)
    }
  })
  return r
}
