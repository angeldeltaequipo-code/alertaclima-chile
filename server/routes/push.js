import { Router } from 'express'
import { pool } from '../db/pool.js'
import { cuentaOpcional } from '../services/cuentas.js'
import { cobroActivo, limitesDe, planDe } from '../services/planes.js'
import { ErrorValidacion } from '../services/reportes.js'
import { borrarSuscripcion, clavesVapid, enviarPrueba, guardarSuscripcion, renovarSuscripcion } from '../services/notificaciones.js'

/** Suscripciones a notificaciones de alertas oficiales. */
export function pushRouter({ enviarPush } = {}) {
  const r = Router()

  // Clave pública que el navegador necesita para suscribirse.
  r.get('/clave', async (req, res, next) => {
    try {
      const { publicKey } = await clavesVapid(pool)
      res.set('Cache-Control', 'public, max-age=86400').json({ clave: publicKey })
    } catch (e) {
      next(e)
    }
  })

  r.post('/suscripciones', cuentaOpcional(pool), async (req, res, next) => {
    try {
      // Plan gratis: avisos de 1 comuna; plan Familia: hasta 5 (solo cuando el cobro está activo).
      if (cobroActivo() && Array.isArray(req.body?.comunas)) {
        const { plan } = await planDe(pool, req.usuario?.id)
        const max = limitesDe(plan).comunas
        if (req.body.comunas.length > max) {
          const e = new ErrorValidacion(`Tu plan permite avisos de ${max} comuna${max === 1 ? '' : 's'}. Con el plan Familia puedes seguir hasta 5.`, 402)
          e.motivo = 'limite-plan'
          throw e
        }
      }
      const resultado = await guardarSuscripcion(pool, req.body?.suscripcion, req.body?.comunas)
      res.status(201).json({ ok: true, comunas: resultado.comunas })
    } catch (e) {
      next(e)
    }
  })

  r.post('/baja', async (req, res, next) => {
    try {
      await borrarSuscripcion(pool, req.body?.endpoint)
      res.json({ ok: true })
    } catch (e) {
      next(e)
    }
  })

  r.post('/prueba', async (req, res, next) => {
    try {
      await enviarPrueba(pool, req.body?.endpoint, enviarPush ? { enviar: enviarPush } : {})
      res.json({ ok: true })
    } catch (e) {
      next(e)
    }
  })

  r.post('/renovar', async (req, res, next) => {
    try {
      res.json(await renovarSuscripcion(pool, req.body?.anterior, req.body?.suscripcion))
    } catch (e) {
      next(e)
    }
  })

  return r
}
