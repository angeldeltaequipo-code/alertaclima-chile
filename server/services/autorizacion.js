import { createHash, timingSafeEqual } from 'node:crypto'

// Acceso al panel de administración con una clave larga (ADMIN_TOKEN), mientras
// llegan las cuentas con roles de la Fase 5. Sin ADMIN_TOKEN, el panel queda cerrado.

const MAX_FALLOS = 10
const VENTANA_MS = 15 * 60 * 1000
const fallos = new Map() // ip -> { n, desde }

const resumen = (t) => createHash('sha256').update(t).digest()

export function exigirAdmin(req, res, next) {
  const token = process.env.ADMIN_TOKEN
  if (!token || token.length < 32) {
    return res.status(503).json({ error: 'El panel de administración no está habilitado en este servidor' })
  }
  const ahora = Date.now()
  const f = fallos.get(req.ip)
  if (f && ahora - f.desde < VENTANA_MS && f.n >= MAX_FALLOS) {
    return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' })
  }
  const enviado = (req.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (enviado && timingSafeEqual(resumen(enviado), resumen(token))) {
    fallos.delete(req.ip)
    return next()
  }
  const reg = f && ahora - f.desde < VENTANA_MS ? f : { n: 0, desde: ahora }
  reg.n++
  fallos.set(req.ip, reg)
  return res.status(401).json({ error: 'Clave de administración incorrecta' })
}
