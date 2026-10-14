// Una sola conexión en tiempo real (Socket.io) para toda la app, compartida por
// reportes y alertas. Se carga aparte para no pesar en el arranque.
import { API_URL } from './reportes'

let socket = null
let cargando = null
let comunaActual = null
const oyentesEstado = new Set()

function avisarEstado() {
  const vivo = Boolean(socket?.connected)
  for (const f of oyentesEstado) f(vivo)
}

async function obtener() {
  if (socket) return socket
  if (!cargando) {
    cargando = import('socket.io-client').then(({ io }) => {
      socket = io(API_URL, { transports: ['websocket', 'polling'], reconnectionDelayMax: 30000 })
      socket.on('connect', () => {
        if (comunaActual) socket.emit('seguir-comuna', comunaActual)
        avisarEstado()
      })
      socket.on('disconnect', avisarEstado)
      return socket
    })
  }
  return cargando
}

/** Sigue una comuna: el servidor manda solo los eventos de esa sala. */
export async function seguirComuna(cut) {
  if (!API_URL || !cut) return
  comunaActual = cut
  const s = await obtener()
  if (s.connected) s.emit('seguir-comuna', cut)
}

/** Escucha un evento. Devuelve la función para dejar de escuchar. */
export function escuchar(evento, fn) {
  if (!API_URL) return () => {}
  let activo = true
  obtener().then((s) => activo && s.on(evento, fn))
  return () => {
    activo = false
    socket?.off(evento, fn)
  }
}

export function alCambiarConexion(fn) {
  oyentesEstado.add(fn)
  fn(Boolean(socket?.connected))
  return () => oyentesEstado.delete(fn)
}

export function desconectar() {
  socket?.disconnect()
}

export function reconectar() {
  socket?.connect()
}
