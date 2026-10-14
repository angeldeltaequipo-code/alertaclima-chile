import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { saludRouter } from './routes/salud.js'
import { reportesRouter } from './routes/reportes.js'
import { adminRouter, alertasRouter } from './routes/alertas.js'
import { ErrorValidacion } from './services/reportes.js'

export const origenesPermitidos = () =>
  (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim())

export function crearApp({ emitir, avisarComunas } = {}) {
  const app = express()
  app.disable('x-powered-by')
  // Detrás del proxy del hosting, la IP real viene en X-Forwarded-For.
  // TRUST_PROXY: "true" (confiar en toda la cadena), un número de saltos, o "0" para no confiar.
  const tp = process.env.TRUST_PROXY ?? 'true'
  app.set('trust proxy', tp === 'true' ? true : tp === 'false' ? false : Number(tp))
  app.use(helmet())
  app.use(cors({ origin: origenesPermitidos() }))
  app.use(express.json({ limit: '20kb' }))

  app.use('/api/salud', saludRouter)
  app.use('/api/reportes', reportesRouter({ emitir }))
  app.use('/api/alertas', alertasRouter())
  app.use('/api/admin', adminRouter({ avisarComunas }))

  app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }))
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof ErrorValidacion) return res.status(err.estado).json({ error: err.message })
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Datos mal formados' })
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  })
  return app
}
