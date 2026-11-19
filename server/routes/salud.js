import { Router } from 'express'
import { dbDisponible, urlBase } from '../db/pool.js'

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
        return new URL(urlBase() ?? '').hostname.replace(/^[^.]+/, (x) => x.slice(0, 6) + '…') || null
      } catch {
        const v = String(process.env.DATABASE_URL ?? '').trim()
        if (!v) return 'sin configurar'
        // pista sin revelar secretos: solo si empieza con algo conocido que no es una clave
        const pista = ['psql', 'postgres', 'http', 'DATABASE_URL', 'export', 'neon', '"', "'", '<', '{'].find((x) => v.startsWith(x))
        return `formato no reconocido (largo ${v.length}${pista ? `, empieza con «${pista}»` : ''}${/\*{4,}/.test(v) ? ', trae ****: se copió con la contraseña oculta' : ''})`
      }
    })(),
    hora: new Date().toISOString(),
  })
})
