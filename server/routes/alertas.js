import { Router } from 'express'
import { pool } from '../db/pool.js'
import { exigirAdmin } from '../services/autorizacion.js'
import {
  actualizarAlerta,
  alertasDeComuna,
  bitacora,
  crearAlerta,
  horasSinConfirmar,
  listarAlertasAdmin,
} from '../services/alertas.js'

/** Lectura pública: alertas vigentes de una comuna. */
export function alertasRouter() {
  const r = Router()
  r.get('/', async (req, res, next) => {
    try {
      const alertas = await alertasDeComuna(pool, req.query.comuna)
      res.set('Cache-Control', 'no-store').json({ alertas, horasSinConfirmar: horasSinConfirmar(), hora: new Date().toISOString() })
    } catch (e) {
      next(e)
    }
  })
  return r
}

/** Administración: crear, confirmar, editar y cancelar alertas. Todo queda en la bitácora. */
export function adminRouter({ avisarComunas = () => {} } = {}) {
  const r = Router()
  r.use(exigirAdmin)

  r.get('/sesion', (req, res) => res.json({ ok: true }))

  r.get('/alertas', async (req, res, next) => {
    try {
      res.json({ alertas: await listarAlertasAdmin(pool), horasSinConfirmar: horasSinConfirmar() })
    } catch (e) {
      next(e)
    }
  })

  r.post('/alertas', async (req, res, next) => {
    try {
      const alerta = await crearAlerta(pool, req.body)
      avisarComunas(alerta.comunas)
      res.status(201).json({ alerta })
    } catch (e) {
      next(e)
    }
  })

  r.patch('/alertas/:id', async (req, res, next) => {
    try {
      const { alerta, comunasAfectadas } = await actualizarAlerta(pool, req.params.id, req.body)
      avisarComunas(comunasAfectadas)
      res.json({ alerta })
    } catch (e) {
      next(e)
    }
  })

  r.get('/bitacora', async (req, res, next) => {
    try {
      res.json({ registros: await bitacora(pool) })
    } catch (e) {
      next(e)
    }
  })

  return r
}
