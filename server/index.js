import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { crearApp, origenesPermitidos } from './app.js'
import { pool } from './db/pool.js'
import { limpiarVencidos } from './services/reportes.js'

const PUERTO = Number(process.env.PORT ?? 3000)

let io
const emitir = (evento, reporte) => io?.to(`comuna:${reporte.comuna_cut}`).emit(evento, reporte)

const app = crearApp({ emitir })
const http = createServer(app)

// Tiempo real: una sala por comuna (CUT). Cada cliente sigue una sola comuna a la vez.
io = new Server(http, { cors: { origin: origenesPermitidos() } })
io.on('connection', (socket) => {
  socket.on('seguir-comuna', (cut) => {
    if (typeof cut !== 'string' || !/^\d{5}$/.test(cut)) return
    for (const sala of socket.rooms) if (sala !== socket.id) socket.leave(sala)
    socket.join(`comuna:${cut}`)
  })
})

// Limpieza periódica de reportes muy antiguos.
const limpieza = setInterval(
  () => limpiarVencidos(pool).catch((e) => console.error('Limpieza falló:', e.message)),
  6 * 60 * 60 * 1000,
)

http.listen(PUERTO, () => console.log(`AlertaClima API escuchando en el puerto ${PUERTO}`))

const cerrar = () => {
  clearInterval(limpieza)
  io.close()
  http.close(() => pool.end().finally(() => process.exit(0)))
}
process.on('SIGTERM', cerrar)
process.on('SIGINT', cerrar)
