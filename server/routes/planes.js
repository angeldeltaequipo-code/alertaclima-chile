import express, { Router } from 'express'
import { pool } from '../db/pool.js'
import { exigirCuenta } from '../services/cuentas.js'
import { exigirAdmin } from '../services/autorizacion.js'
import {
  LIMITES,
  autorizacionRevenueCat,
  avisoFlow,
  cancelarWeb,
  cobroActivo,
  eventoRevenueCat,
  limitesDe,
  flowActivo,
  metricas,
  planDe,
  precios,
  regalarPlan,
  sincronizarFlow,
  suscribirWeb,
  tarjetaRegistrada,
} from '../services/planes.js'

/** GET /api/planes (público), /yo, /web, /cancelar. */
export function planesRouter() {
  const r = Router()
  r.get('/', (req, res) => {
    res.set('Cache-Control', 'public, max-age=300').json({
      cobroActivo: cobroActivo(),
      precios: precios(),
      limites: LIMITES,
      pagos: { web: cobroActivo() && flowActivo(), app: cobroActivo() },
    })
  })
  r.get('/yo', exigirCuenta(pool), async (req, res, next) => {
    try {
      // Si pagó en la web, se confirma con Flow de vez en cuando (por si se perdió un aviso).
      await sincronizarFlow(pool, req.usuario.id, { soloViejas: true }).catch((e) => console.error('Sincronizar Flow:', e.message))
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
  // Flow envía formularios (application/x-www-form-urlencoded) con un token; todo se verifica consultando a Flow.
  r.use(express.urlencoded({ extended: false, limit: '10kb' }))
  r.post('/flow/tarjeta', async (req, res) => {
    let destino
    try {
      destino = await tarjetaRegistrada(pool, { token: req.body?.token, periodo: req.query.p })
    } catch (e) {
      console.error('Registro de tarjeta Flow:', e.message)
      destino = `${process.env.APP_URL ?? 'https://angeldeltaequipo-code.github.io/alertaclima-chile/'}?plan=error`
    }
    res.redirect(303, destino)
  })
  r.post('/flow', async (req, res) => {
    try {
      await avisoFlow(pool, { token: req.body?.token })
    } catch (e) {
      console.error('Aviso Flow:', e.message)
      return res.status(500).json({ ok: false }) // Flow reintenta
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
