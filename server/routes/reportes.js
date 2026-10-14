import express, { Router } from 'express'
import { pool } from '../db/pool.js'
import { hashReportante, hashVotante } from '../services/privacidad.js'
import { crearReporte, ErrorValidacion, listarReportes, reportePorId, votar } from '../services/reportes.js'
import { REGLAS_FOTOS, agregarFoto, denunciarFoto, hashClave, leerFoto, nuevaClaveEdicion } from '../services/fotos.js'

const dispositivoValido = (d) => typeof d === 'string' && /^[\w-]{16,64}$/.test(d)

// Rutas HTTP de los reportes. `emitir(evento, reporte)` avisa en tiempo real a la sala de la comuna.
export function reportesRouter({ emitir = () => {} } = {}) {
  const r = Router()

  r.get('/', async (req, res, next) => {
    try {
      const reportes = await listarReportes(pool, req.query.comuna)
      res.set('Cache-Control', 'no-store').json({ reportes, hora: new Date().toISOString() })
    } catch (e) {
      next(e)
    }
  })

  r.post('/', async (req, res, next) => {
    try {
      // La clave de edición se entrega una sola vez a quien creó el reporte (para subir la foto).
      const clave = nuevaClaveEdicion()
      const reporte = await crearReporte(pool, req.body, hashReportante(req.ip), hashClave(clave))
      emitir('reporte:nuevo', reporte)
      res.status(201).json({ reporte, clave_edicion: clave })
    } catch (e) {
      next(e)
    }
  })

  r.post(
    '/:id/foto',
    express.raw({ type: ['image/jpeg', 'image/webp'], limit: REGLAS_FOTOS.maxBytes }),
    async (req, res, next) => {
      try {
        await agregarFoto(pool, req.params.id, req.get('x-clave-edicion'), req.body)
        const reporte = await reportePorId(pool, req.params.id)
        emitir('reporte:actualizado', reporte)
        res.status(201).json({ reporte })
      } catch (e) {
        next(e)
      }
    },
  )

  r.post('/:id/votos', async (req, res, next) => {
    try {
      const { voto, dispositivo } = req.body ?? {}
      if (!dispositivoValido(dispositivo)) throw new ErrorValidacion('Falta el identificador del dispositivo')
      const reporte = await votar(pool, req.params.id, Number(voto), hashVotante(dispositivo))
      emitir(reporte.estado === 'activo' ? 'reporte:actualizado' : 'reporte:retirado', reporte)
      res.json({ reporte })
    } catch (e) {
      next(e)
    }
  })

  return r
}

/** Fotos: lectura pública (solo las visibles) y denuncias. */
export function fotosRouter({ emitir = () => {} } = {}) {
  const r = Router()

  r.get('/:id', async (req, res, next) => {
    try {
      const f = await leerFoto(pool, req.params.id)
      res.set({ 'Content-Type': f.mime, 'Cache-Control': 'public, max-age=3600' }).send(f.datos)
    } catch (e) {
      next(e)
    }
  })

  r.post('/:id/denuncias', async (req, res, next) => {
    try {
      const { dispositivo } = req.body ?? {}
      if (!dispositivoValido(dispositivo)) throw new ErrorValidacion('Falta el identificador del dispositivo')
      const resultado = await denunciarFoto(pool, req.params.id, hashVotante(dispositivo))
      if (resultado.estado !== 'visible') {
        const reporte = await reportePorId(pool, resultado.report_id)
        if (reporte) emitir('reporte:actualizado', reporte)
      }
      res.json({ oculta: resultado.estado !== 'visible' })
    } catch (e) {
      next(e)
    }
  })

  return r
}
