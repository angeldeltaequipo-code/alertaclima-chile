// Chat por comuna: lectura, envío, denuncias y borrado de mensajes propios.
import { API_URL } from './reportes'
import { cabeceraSesion, cerrarSesion } from './sesion'

export const LARGO_MAXIMO = 500

async function pedir(ruta, opciones = {}) {
  let r
  try {
    r = await fetch(`${API_URL}/api/chat${ruta}`, {
      ...opciones,
      headers: { 'content-type': 'application/json', ...cabeceraSesion(), ...(opciones.headers ?? {}) },
    })
  } catch {
    throw new Error('No hay conexión. Revisa tu señal.')
  }
  const d = await r.json().catch(() => ({}))
  if (r.status === 401) cerrarSesion()
  if (!r.ok) throw new Error(d.error ?? `El servidor respondió ${r.status}`)
  return d
}

const revivir = (m) => ({ ...m, hora: new Date(m.hora) })

export async function leerMensajes(cut, antes) {
  const { mensajes } = await pedir(`/${cut}${antes ? `?antes=${antes}` : ''}`)
  return mensajes.map(revivir)
}

export async function enviarMensaje(cut, texto) {
  const { mensaje } = await pedir(`/${cut}`, { method: 'POST', body: JSON.stringify({ texto }) })
  return revivir(mensaje)
}

export const denunciarMensaje = (id) => pedir(`/mensajes/${id}/denunciar`, { method: 'POST' })
export const borrarMensaje = (id) => pedir(`/mensajes/${id}`, { method: 'DELETE' })
export { revivir as revivirMensaje }
