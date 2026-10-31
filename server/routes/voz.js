import { Router } from 'express'
import { MAX_TEXTO, sintetizar, vozActiva } from '../services/voz/index.js'

// Límite por IP: frases por minuto (un reporte completo son ~8 frases).
const VENTANA = 60_000
const MAXIMO = 40
const usos = new Map()
function permitido(ip) {
  const ahora = Date.now()
  const lista = (usos.get(ip) ?? []).filter((t) => ahora - t < VENTANA)
  if (lista.length >= MAXIMO) return false
  lista.push(ahora)
  usos.set(ip, lista)
  if (usos.size > 5000) usos.clear()
  return true
}

/**
 * GET /api/voz/estado → { activa }
 * GET /api/voz?t=texto → audio/wav con la voz de ZUMI (se guarda en caché del navegador un día).
 */
export function vozRouter() {
  const r = Router()
  r.get('/estado', (req, res) => res.set('Cache-Control', 'public, max-age=300').json({ activa: vozActiva() }))
  r.get('/', async (req, res, next) => {
    try {
      if (!vozActiva()) return res.status(503).json({ error: 'La voz de ZUMI no está disponible' })
      const t = String(req.query.t ?? '').trim()
      if (!t || t.length > MAX_TEXTO) return res.status(400).json({ error: `Texto entre 1 y ${MAX_TEXTO} caracteres` })
      if (!permitido(req.ip)) return res.status(429).json({ error: 'Demasiadas frases seguidas; espera un momento' })
      const wav = await sintetizar(t)
      res.set({ 'Content-Type': 'audio/wav', 'Cache-Control': 'public, max-age=86400', 'Content-Length': wav.length }).send(wav)
    } catch (e) {
      next(e)
    }
  })
  return r
}
