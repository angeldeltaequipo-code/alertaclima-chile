import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { crearApp } from './app.js'
import { pool } from './db/pool.js'

const PUERTO = Number(process.env.PORT ?? 3000)

const app = crearApp()
const http = createServer(app)

// Tiempo real: una sala por comuna (CUT). Los eventos de reportes llegan en la Fase 2.
const io = new Server(http, {
  cors: { origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim()) },
})
io.on('connection', (socket) => {
  socket.on('seguir-comuna', (cut) => {
    if (typeof cut !== 'string' || !/^\d{5}$/.test(cut)) return
    for (const sala of socket.rooms) if (sala !== socket.id) socket.leave(sala)
    socket.join(`comuna:${cut}`)
  })
})

http.listen(PUERTO, () => console.log(`AlertaClima API escuchando en el puerto ${PUERTO}`))

const cerrar = () => {
  io.close()
  http.close(() => pool.end().finally(() => process.exit(0)))
}
process.on('SIGTERM', cerrar)
process.on('SIGINT', cerrar)
