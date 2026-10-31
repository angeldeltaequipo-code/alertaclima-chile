import { zumiRouter } from './routes/zumi.js'
import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { saludRouter } from './routes/salud.js'
import { fotosRouter, reportesRouter } from './routes/reportes.js'
import { adminRouter, alertasRouter } from './routes/alertas.js'
import { camarasRouter, evacuacionRouter, observacionRouter } from './routes/observacion.js'
import { pushRouter } from './routes/push.js'
import { cuentaRouter } from './routes/cuenta.js'
import { chatRouter } from './routes/chat.js'
import { riesgosRouter } from './routes/riesgos.js'
import { comunidadRouter } from './routes/comunidad.js'
import { vozRouter } from './routes/voz.js'
import { adminPlanesRouter, pagosRouter, planesRouter } from './routes/planes.js'
import { ErrorValidacion } from './services/reportes.js'

// Además de la web, la app de tiendas: Android carga desde https://localhost e iPhone desde alertaclima://localhost.
export const ORIGENES_APP = ['https://localhost', 'alertaclima://localhost', 'capacitor://localhost']
export const origenesPermitidos = () => [...(process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim()), ...ORIGENES_APP]

export function crearApp({ emitir, avisarComunas, enviarPush, emitirChat, verificarGoogle } = {}) {
  const emitirReporte = emitir
  const app = express()
  app.disable('x-powered-by')
  // Detrás del proxy del hosting, la IP real viene en X-Forwarded-For.
  // TRUST_PROXY: "true" (confiar en toda la cadena), un número de saltos, o "0" para no confiar.
  const tp = process.env.TRUST_PROXY ?? 'true'
  app.set('trust proxy', tp === 'true' ? true : tp === 'false' ? false : Number(tp))
  // Las fotos se muestran desde la app publicada en otro dominio: se permite cargarlas entre sitios.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.use(cors({ origin: origenesPermitidos() }))
  app.use(express.json({ limit: '20kb' }))

  app.use('/api/salud', saludRouter)
  app.use('/api/reportes', reportesRouter({ emitir: emitirReporte }))
  app.use('/api/fotos', fotosRouter({ emitir: emitirReporte }))
  app.use('/api/alertas', alertasRouter())
  app.use('/api/observacion', observacionRouter())
  app.use('/api/camaras', camarasRouter())
  app.use('/api/evacuacion', evacuacionRouter())
  app.use('/api/push', pushRouter({ enviarPush }))
  app.use('/api/cuenta', cuentaRouter({ verificar: verificarGoogle }))
  app.use('/api/chat', chatRouter({ emitirChat }))
  app.use('/api/riesgos', riesgosRouter())
  app.use('/api/zumi', zumiRouter())
  app.use('/api/comunidad', comunidadRouter())
  app.use('/api/voz', vozRouter())
  app.use('/api/planes', planesRouter())
  app.use('/api/pagos', pagosRouter())
  app.use('/api/admin/planes', adminPlanesRouter())
  app.use('/api/admin', adminRouter({ avisarComunas, emitir: emitirReporte, enviarPush, emitirChat }))

  app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }))
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ErrorValidacion) return res.status(err.estado).json({ error: err.message, ...(err.motivo ? { motivo: err.motivo } : {}) })
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Datos mal formados' })
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'El archivo pesa demasiado' })
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  })
  return app
}
