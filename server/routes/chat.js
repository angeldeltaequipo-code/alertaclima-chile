import { Router } from 'express'
import { pool } from '../db/pool.js'
import { exigirCuenta } from '../services/cuentas.js'
import { borrarPropio, denunciarMensaje, listarMensajes, modoLento, publicarMensaje } from '../services/chat.js'

/** Chat por comuna. Leer y escribir exige cuenta. `emitirChat(cut, evento, datos)` avisa en tiempo real. */
export function chatRouter({ emitirChat = () => {} } = {}) {
  const r = Router()
  r.use(exigirCuenta(pool))

  r.get('/:cut', async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-store').json({ mensajes: await listarMensajes(pool, req.params.cut, req.query.antes), lento: modoLento(req.params.cut) })
    } catch (e) {
      next(e)
    }
  })

  r.post('/:cut', async (req, res, next) => {
    try {
      const { mensaje, ...aviso } = await publicarMensaje(pool, req.params.cut, req.usuario, req.body?.texto)
      emitirChat(mensaje.comuna, 'chat:mensaje', mensaje)
      res.status(201).json({ mensaje, ...aviso })
    } catch (e) {
      next(e)
    }
  })

  r.post('/mensajes/:id/denunciar', async (req, res, next) => {
    try {
      const d = await denunciarMensaje(pool, req.params.id, req.usuario)
      if (d.recienOculto) emitirChat(d.comuna, 'chat:oculto', { id: d.id })
      res.json({ ok: true, oculto: d.oculto })
    } catch (e) {
      next(e)
    }
  })

  r.delete('/mensajes/:id', async (req, res, next) => {
    try {
      const d = await borrarPropio(pool, req.params.id, req.usuario)
      emitirChat(d.comuna, 'chat:oculto', { id: d.id })
      res.json({ ok: true })
    } catch (e) {
      next(e)
    }
  })

  return r
}
