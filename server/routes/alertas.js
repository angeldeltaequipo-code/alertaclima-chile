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
import { fotosPorRevisar, leerFotoAdmin, revisarFoto } from '../services/fotos.js'
import { reportePorId } from '../services/reportes.js'
import { contarSuscritos, notificarAlerta, tipoDeAviso } from '../services/notificaciones.js'

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
export function adminRouter({ avisarComunas = () => {}, emitir = () => {}, enviarPush } = {}) {
  // Las notificaciones salen en segundo plano: la respuesta al panel no espera a que lleguen.
  const notificar = (alerta, tipo, cuerpo) => {
    if (!tipo || cuerpo?.notificar === false) return
    notificarAlerta(pool, alerta, tipo, enviarPush ? { enviar: enviarPush } : {}).catch((e) =>
      console.error('Notificaciones:', e.message),
    )
  }
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
      notificar(alerta, 'nueva', req.body)
      res.status(201).json({ alerta })
    } catch (e) {
      next(e)
    }
  })

  r.patch('/alertas/:id', async (req, res, next) => {
    try {
      const { antes, alerta, comunasAfectadas } = await actualizarAlerta(pool, req.params.id, req.body)
      avisarComunas(comunasAfectadas)
      notificar(alerta, tipoDeAviso(antes, alerta), req.body)
      res.json({ alerta })
    } catch (e) {
      next(e)
    }
  })

  // Fotos ocultas por denuncias: el administrador las ve y decide si restaurarlas o eliminarlas.
  r.get('/fotos', async (req, res, next) => {
    try {
      res.json({ fotos: await fotosPorRevisar(pool) })
    } catch (e) {
      next(e)
    }
  })

  r.get('/fotos/:id/imagen', async (req, res, next) => {
    try {
      const f = await leerFotoAdmin(pool, req.params.id)
      res.set({ 'Content-Type': f.mime, 'Cache-Control': 'no-store' }).send(f.datos)
    } catch (e) {
      next(e)
    }
  })

  r.patch('/fotos/:id', async (req, res, next) => {
    try {
      const reporteId = await revisarFoto(pool, req.params.id, req.body?.accion)
      const reporte = await reportePorId(pool, reporteId)
      if (reporte) emitir('reporte:actualizado', reporte)
      res.json({ ok: true })
    } catch (e) {
      next(e)
    }
  })

  // Cuántos teléfonos recibirían una notificación para estas comunas.
  r.get('/suscritos', async (req, res, next) => {
    try {
      const cuts = String(req.query.comunas ?? '').split(',').filter((c) => /^\d{5}$/.test(c))
      res.json({ suscritos: cuts.length ? await contarSuscritos(pool, cuts) : 0 })
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
