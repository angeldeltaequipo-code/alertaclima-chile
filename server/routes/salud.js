import { Router } from 'express'
import { dbDisponible } from '../db/pool.js'

// Estado del servicio. Lo usa Docker para saber si el contenedor está sano
// y, más adelante, la página pública de estado.
export const saludRouter = Router()

saludRouter.get('/', async (req, res) => {
  const db = await dbDisponible()
  res.status(db.ok ? 200 : 503).json({
    servicio: 'alertaclima',
    estado: db.ok ? 'ok' : 'degradado',
    baseDeDatos: db,
    hora: new Date().toISOString(),
  })
})
