import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { saludRouter } from './routes/salud.js'

export function crearApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(helmet())
  app.use(
    cors({
      origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim()),
    }),
  )
  app.use(express.json({ limit: '20kb' }))

  app.use('/api/salud', saludRouter)

  app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }))
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  })
  return app
}
