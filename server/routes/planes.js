import { Router } from 'express'
import { pool } from '../db/pool.js'
import { exigirCuenta } from '../services/cuentas.js'
import { exigirAdmin } from '../services/autorizacion.js'
import {
  LIMITES,
  autorizacionRevenueCat,
  avisoMercadoPago,
  cancelarWeb,
  cobroActivo,
  eventoRevenueCat,
  firmaMercadoPagoValida,
  limitesDe,
  mercadoPagoActivo,
  metricas,
  planDe,
  precios,
  regalarPlan,
  suscribirWeb,
} from '../services/planes.js'

/** GET /api/planes (público), /yo, /web, /cancelar. */
export function planesRouter() {
  const r = Router()
  r.get('/', (req, res) => {
    res.set('Cache-Control', 'public, max-age=300').json({
      cobroActivo: cobroActivo(),
      precios: precios(),
      limites: LIMITES,
      pagos: { web: cobroActivo() && mercadoPagoActivo(), app: cobroActivo() },
    })
  })
  r.get('/yo', exigirCuenta(pool), async (req, res, next) => {
    try {
      const p = await planDe(pool, req.usuario.id)
      res.set('Cache-Control', 'no-store').json({ ...p, limites: limitesDe(p.plan), cobroActivo: cobroActivo() })
    } catch (e) {
      next(e)
    }
  })
  r.post('/web', exigirCuenta(pool), async (req, res, next) => {
    try {
      res.json(await suscribirWeb(pool, req.usuario, { periodo: req.body?.periodo, correo: req.body?.correo }))
    } catch (e) {
      next(e)
    }
  })
  r.post('/cancelar', exigirCuenta(pool), async (req, res, next) => {
    try {
      res.json(await cancelarWeb(pool, req.usuario))
    } catch (e) {
      next(e)
    }
  })
  return r
}

/** Avisos de los proveedores de pago (webhooks). Responden rápido y nunca filtran detalles. */
export function pagosRouter() {
  const r = Router()
  r.post('/mercadopago', async (req, res) => {
    const id = req.body?.data?.id ?? req.query['data.id'] ?? req.query.id
    const tipo = req.body?.type ?? req.query.type ?? req.query.topic
    if (!firmaMercadoPagoValida({ firma: req.get('x-signature'), requestId: req.get('x-request-id'), dataId: req.query['data.id'] ?? id })) {
      return res.status(401).json({ ok: false })
    }
    try {
      await avisoMercadoPago(pool, { tipo, id })
    } catch (e) {
      console.error('Aviso Mercado Pago:', e.message)
      return res.status(500).json({ ok: false }) // Mercado Pago reintenta
    }
    res.json({ ok: true })
  })
  r.post('/revenuecat', async (req, res) => {
    if (!autorizacionRevenueCat(req.get('authorization'))) return res.status(401).json({ ok: false })
    try {
      await eventoRevenueCat(pool, req.body)
    } catch (e) {
      console.error('Evento RevenueCat:', e.message)
      return res.status(500).json({ ok: false })
    }
    res.json({ ok: true })
  })
  return r
}

/** Administración: métricas de ingresos y regalar el plan. */
export function adminPlanesRouter() {
  const r = Router()
  r.use(exigirAdmin)
  r.get('/metricas', async (req, res, next) => {
    try {
      res.json(await metricas(pool))
    } catch (e) {
      next(e)
    }
  })
  r.post('/cortesia', async (req, res, next) => {
    try {
      res.json(await regalarPlan(pool, req.body?.usuarioId, req.body?.dias))
    } catch (e) {
      next(e)
    }
  })
  return r
}
