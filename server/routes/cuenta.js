import { Router } from 'express'
import { pool } from '../db/pool.js'
import { borrarCuenta, cuentasActivas, exigirCuenta, ingresarConApple, ingresarConGoogle, publico } from '../services/cuentas.js'

/** Inicio de sesión con Google y datos de la cuenta. */
export function cuentaRouter({ verificar, verificarApple } = {}) {
  const r = Router()

  // La app pregunta si el inicio de sesión está activo y con qué ID de cliente (es público, no es secreto).
  r.get('/config', (req, res) => {
    res.set('Cache-Control', 'public, max-age=300').json({
      activa: cuentasActivas(),
      googleClientId: process.env.GOOGLE_CLIENT_ID ?? null,
      // App nativa: ID de cliente de Google para iPhone (público) y si se ofrece Apple.
      googleClientIdIos: String(process.env.GOOGLE_CLIENT_ID_IOS ?? '').split(',')[0].trim() || null,
      apple: cuentasActivas(),
    })
  })

  r.post('/google', async (req, res, next) => {
    try {
      res.json(await ingresarConGoogle(pool, req.body?.credencial, verificar ? { verificar } : {}))
    } catch (e) {
      next(e)
    }
  })

  r.post('/apple', async (req, res, next) => {
    try {
      const b = req.body ?? {}
      res.json(await ingresarConApple(pool, { credencial: b.credencial, nombre: b.nombre, apellido: b.apellido }, verificarApple ? { verificar: verificarApple } : {}))
    } catch (e) {
      next(e)
    }
  })

  r.get('/yo', exigirCuenta(pool), (req, res) => res.json({ usuario: publico(req.usuario) }))

  r.post('/borrar', exigirCuenta(pool), async (req, res, next) => {
    try {
      await borrarCuenta(pool, req.usuario.id)
      res.json({ ok: true })
    } catch (e) {
      next(e)
    }
  })

  return r
}
