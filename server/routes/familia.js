// GPS familiar: relevo de ubicaciones CIFRADAS de punta a punta.
//
// Cada familia es un grupo con un identificador al azar (imposible de adivinar) y una clave que vive
// solo en los teléfonos de la familia (va en el enlace de invitación, después del «#», que nunca llega
// al servidor). El servidor guarda solo el último mensaje cifrado de cada integrante, por 48 horas y
// en memoria: no puede ver dónde está nadie, ni sus nombres. Nada se escribe en disco.
import { Router } from 'express'

const VIVE_MS = 48 * 3600e3
const MAX_MIEMBROS = 12
const MAX_GRUPOS = 20000
const ID = /^[A-Za-z0-9_-]{16,64}$/
const B64 = /^[A-Za-z0-9+/=_-]{8,4096}$/

export function familiaRouter({ ahora = () => Date.now() } = {}) {
  const grupos = new Map() // grupo -> Map(miembro -> { iv, datos, t })
  const limpiar = () => {
    const t = ahora()
    for (const [g, m] of grupos) {
      for (const [id, v] of m) if (t - v.t > VIVE_MS) m.delete(id)
      if (!m.size) grupos.delete(g)
    }
  }
  const reloj = setInterval(limpiar, 30 * 60e3)
  reloj.unref?.()

  // cupo simple por IP: 120 envíos por hora
  const cupo = new Map()
  const permitido = (ip) => {
    const t = ahora()
    const c = cupo.get(ip)
    if (!c || t - c.desde > 3600e3) return cupo.set(ip, { desde: t, n: 1 }), true
    c.n += 1
    return c.n <= 120
  }

  const r = Router()
  r.put('/:grupo/:miembro', (req, res) => {
    const { grupo, miembro } = req.params
    const { iv, datos } = req.body ?? {}
    if (!ID.test(grupo) || !ID.test(miembro) || !B64.test(iv ?? '') || !B64.test(datos ?? '')) return res.status(400).json({ error: 'Datos inválidos' })
    if (!permitido(req.ip)) return res.status(429).json({ error: 'Demasiados envíos. Espera un rato.' })
    let m = grupos.get(grupo)
    if (!m) {
      if (grupos.size >= MAX_GRUPOS) limpiar()
      if (grupos.size >= MAX_GRUPOS) return res.status(503).json({ error: 'Servicio lleno, intenta más tarde' })
      m = new Map()
      grupos.set(grupo, m)
    }
    if (!m.has(miembro) && m.size >= MAX_MIEMBROS) return res.status(409).json({ error: 'La familia ya tiene el máximo de integrantes' })
    m.set(miembro, { iv, datos, t: ahora() })
    res.set('Cache-Control', 'no-store').json({ ok: true })
  })

  r.get('/:grupo', (req, res) => {
    const { grupo } = req.params
    if (!ID.test(grupo)) return res.status(400).json({ error: 'Grupo inválido' })
    const m = grupos.get(grupo)
    const t = ahora()
    const miembros = m ? [...m].filter(([, v]) => t - v.t <= VIVE_MS).map(([id, v]) => ({ id, iv: v.iv, datos: v.datos, recibido: new Date(v.t).toISOString() })) : []
    res.set('Cache-Control', 'no-store').json({ miembros })
  })

  r.delete('/:grupo/:miembro', (req, res) => {
    const { grupo, miembro } = req.params
    if (!ID.test(grupo) || !ID.test(miembro)) return res.status(400).json({ error: 'Datos inválidos' })
    grupos.get(grupo)?.delete(miembro)
    res.status(204).end()
  })
  return r
}
