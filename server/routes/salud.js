import { Router } from 'express'
import { dbDisponible } from '../db/pool.js'

// Estado del servicio. Lo usa Docker para saber si el contenedor está sano
// y, más adelante, la página pública de estado.
export const saludRouter = Router()

saludRouter.get('/', async (req, res) => {
  const db = await dbDisponible()
  // 200 aunque la base no responda: el servidor está vivo y atiende clima, alertas y ZUMI.
  // (Render usa esta ruta para decidir si el despliegue funciona.)
  res.status(200).json({
    servicio: 'alertaclima',
    estado: db.ok ? 'ok' : 'degradado',
    baseDeDatos: db,
    // Solo el nombre del servidor de la base (nunca usuario ni contraseña), para diagnosticar.
    hostBase: (() => {
      try {
        return new URL(process.env.DATABASE_URL ?? '').hostname.replace(/^[^.]+/, (x) => x.slice(0, 6) + '…') || null
      } catch {
        return null
      }
    })(),
    hora: new Date().toISOString(),
  })
})
