import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { crearApp, origenesPermitidos } from './app.js'
import { pool } from './db/pool.js'
import { limpiarVencidos } from './services/reportes.js'
import { leerSesion, usuarioPorId } from './services/cuentas.js'

const PUERTO = Number(process.env.PORT ?? 3000)

let io
const emitir = (evento, reporte) => io?.to(`comuna:${reporte.comuna_cut}`).emit(evento, reporte)

// Cambios en alertas oficiales: se avisa a cada comuna afectada para que la app vuelva a consultar.
const avisarComunas = (cuts) => {
  for (const cut of cuts) io?.to(`comuna:${cut}`).emit('alerta:cambio', { comuna: cut })
}

// Chat: una sala por comuna (`chat:CUT`), solo para personas con sesión.
const emitirChat = (cut, evento, datos) => io?.to(`chat:${cut}`).emit(evento, datos)

const app = crearApp({ emitir, avisarComunas, emitirChat })
const http = createServer(app)

// Tiempo real: una sala por comuna (CUT). Cada cliente sigue una sola comuna a la vez.
// Mensajes del socket chicos (aquí nunca viajan archivos) y con límite de ritmo por conexión:
// un cliente que inunda de eventos se desconecta.
io = new Server(http, { cors: { origin: origenesPermitidos() }, maxHttpBufferSize: 4e3 })
io.on('connection', (socket) => {
  let eventos = 0
  const ritmo = setInterval(() => (eventos = 0), 10000)
  socket.on('disconnect', () => clearInterval(ritmo))
  socket.use((_, siguiente) => (++eventos > 30 ? socket.disconnect(true) : siguiente()))
  socket.on('seguir-comuna', (cut) => {
    if (typeof cut !== 'string' || !/^\d{5}$/.test(cut)) return
    for (const sala of socket.rooms) if (sala.startsWith('comuna:')) socket.leave(sala)
    socket.join(`comuna:${cut}`)
  })
  // Entrar al chat de una comuna: exige una sesión válida.
  socket.on('chat:unirse', async ({ cut, sesion } = {}, responder) => {
    const fin = typeof responder === 'function' ? responder : () => {}
    if (typeof cut !== 'string' || !/^\d{5}$/.test(cut)) return fin({ ok: false })
    const id = leerSesion(sesion)
    const u = id && (await usuarioPorId(pool, id).catch(() => null))
    if (!u || u.bloqueado) return fin({ ok: false })
    for (const sala of socket.rooms) if (sala.startsWith('chat:')) socket.leave(sala)
    await socket.join(`chat:${cut}`)
    const n = io.sockets.adapter.rooms.get(`chat:${cut}`)?.size ?? 1
    io.to(`chat:${cut}`).emit('chat:presentes', { n })
    fin({ ok: true, presentes: n })
  })
  socket.on('chat:salir', () => {
    for (const sala of socket.rooms) if (sala.startsWith('chat:')) socket.leave(sala)
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
