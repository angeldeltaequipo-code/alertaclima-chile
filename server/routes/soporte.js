// Chat de soporte de zumichile.com.
//   Personas:  POST /conversaciones · GET /conversaciones/:id?desde= · POST /conversaciones/:id/mensajes
//   Angel:     GET /admin · GET /admin/:id · POST /admin/:id/mensajes   (clave ADMIN_TOKEN)
//   GET /estado → { angelEnLinea } (Angel está «en línea» si abrió su bandeja hace menos de 3 minutos)
import { Router } from 'express'
import { exigirAdmin } from '../services/autorizacion.js'
import { ErrorSoporte, ID, avisarAngel, avisarVisita, validar } from '../services/soporte.js'

export function soporteRouter({ almacen, ahora = () => Date.now(), avisos = { avisarAngel, avisarVisita } }) {
  const r = Router()
  let angelVisto = 0
  const enLinea = () => ahora() - angelVisto < 3 * 60e3

  // cupo por IP: 40 mensajes por hora
  const cupo = new Map()
  const permitido = (ip) => {
    const t = ahora()
    const c = cupo.get(ip)
    if (!c || t - c.desde > 3600e3) return cupo.set(ip, { desde: t, n: 1 }), true
    return ++c.n <= 40
  }
  const intento = (fn) => async (req, res, next) => {
    try {
      await fn(req, res)
    } catch (e) {
      if (e instanceof ErrorSoporte) return res.status(e.estado).json({ error: e.message })
      next(e)
    }
  }
  const segundoPlano = (p) => Promise.resolve(p).catch((e) => console.error('Soporte, aviso:', e.message))

  r.get('/estado', (req, res) => res.set('Cache-Control', 'no-store').json({ angelEnLinea: enLinea() }))

  r.post('/conversaciones', intento(async (req, res) => {
    if (!permitido(req.ip)) throw new ErrorSoporte('Muchos mensajes seguidos. Espera un rato.', 429)
    const v = validar(req.body)
    const id = await almacen.crear(v)
    const d = await almacen.datos(id, { visita: true })
    segundoPlano(avisos.avisarAngel(d.conversacion, v.texto))
    res.status(201).json({ id, ...d, angelEnLinea: enLinea() })
  }))

  r.get('/conversaciones/:id', intento(async (req, res) => {
    if (!ID.test(req.params.id)) throw new ErrorSoporte('Conversación no encontrada', 404)
    const d = await almacen.datos(req.params.id, { desde: Number(req.query.desde) || 0, visita: true })
    if (!d) throw new ErrorSoporte('Conversación no encontrada', 404)
    res.set('Cache-Control', 'no-store').json({ mensajes: d.mensajes, angelEnLinea: enLinea() })
  }))

  r.post('/conversaciones/:id/mensajes', intento(async (req, res) => {
    if (!ID.test(req.params.id)) throw new ErrorSoporte('Conversación no encontrada', 404)
    if (!permitido(req.ip)) throw new ErrorSoporte('Muchos mensajes seguidos. Espera un rato.', 429)
    const v = validar(req.body)
    if (v.nombre || v.contacto) await almacen.actualizarContacto(req.params.id, v)
    const m = await almacen.agregar(req.params.id, 'visita', v.texto)
    if (!m) throw new ErrorSoporte('Conversación no encontrada', 404)
    const d = await almacen.datos(req.params.id, { desde: Number.MAX_SAFE_INTEGER, visita: true })
    segundoPlano(avisos.avisarAngel(d.conversacion, v.texto))
    res.status(201).json({ mensaje: m, angelEnLinea: enLinea() })
  }))

  // Datos de contacto (para avisar por correo cuando Angel responda)
  r.post('/conversaciones/:id/contacto', intento(async (req, res) => {
    if (!ID.test(req.params.id) || !(await almacen.existe(req.params.id))) throw new ErrorSoporte('Conversación no encontrada', 404)
    const nombre = String(req.body?.nombre ?? '').trim().slice(0, 60) || null
    const contacto = String(req.body?.contacto ?? '').trim().slice(0, 120) || null
    await almacen.actualizarContacto(req.params.id, { nombre, contacto })
    res.json({ ok: true })
  }))

  // ---- Bandeja de Angel ----
  const admin = Router()
  admin.use(exigirAdmin)
  admin.use((req, res, next) => {
    angelVisto = ahora()
    next()
  })
  admin.get('/', intento(async (req, res) => res.set('Cache-Control', 'no-store').json({ conversaciones: await almacen.lista() })))
  admin.get('/:id', intento(async (req, res) => {
    const d = await almacen.datos(req.params.id, { desde: Number(req.query.desde) || 0 })
    if (!d) throw new ErrorSoporte('Conversación no encontrada', 404)
    await almacen.leida(req.params.id)
    res.set('Cache-Control', 'no-store').json(d)
  }))
  admin.post('/:id/mensajes', intento(async (req, res) => {
    const { texto } = validar(req.body)
    const m = await almacen.agregar(req.params.id, 'angel', texto)
    if (!m) throw new ErrorSoporte('Conversación no encontrada', 404)
    const d = await almacen.datos(req.params.id, { desde: Number.MAX_SAFE_INTEGER })
    segundoPlano(avisos.avisarVisita(d.conversacion, texto))
    res.status(201).json({ mensaje: m })
  }))
  r.use('/admin', admin)
  return r
}
