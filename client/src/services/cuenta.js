// Cuentas con Google: configuración, botón oficial de Google, inicio y cierre de sesión.
import { API_URL } from './reportes'
import { cabeceraSesion, cerrarSesion, guardarSesion } from './sesion'

let config = null

/** { activa, googleClientId }: si el servidor tiene el inicio de sesión configurado. */
export async function configCuenta() {
  if (config) return config
  if (!API_URL) return (config = { activa: false })
  const r = await fetch(`${API_URL}/api/cuenta/config`)
  if (!r.ok) throw new Error('No se pudo consultar el servidor')
  config = await r.json()
  return config
}

let cargaGoogle = null
/** Carga la biblioteca oficial «Sign in with Google» una sola vez. */
export function cargarGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  cargaGoogle ??= new Promise((ok, no) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => ok(window.google)
    s.onerror = () => {
      cargaGoogle = null
      no(new Error('No se pudo cargar el botón de Google. Revisa tu conexión.'))
    }
    document.head.appendChild(s)
  })
  return cargaGoogle
}

async function pedir(ruta, opciones = {}) {
  let r
  try {
    r = await fetch(`${API_URL}/api/cuenta${ruta}`, {
      ...opciones,
      headers: { 'content-type': 'application/json', ...cabeceraSesion(), ...(opciones.headers ?? {}) },
    })
  } catch {
    throw new Error('No hay conexión. Revisa tu señal y vuelve a intentarlo.')
  }
  const d = await r.json().catch(() => ({}))
  if (r.status === 401 && ruta !== '/google') cerrarSesion()
  if (!r.ok) throw new Error(d.error ?? `El servidor respondió ${r.status}`)
  return d
}

/** Entrega al servidor la credencial que dio Google y guarda la sesión. */
export async function ingresar(credencial) {
  const { usuario, sesion } = await pedir('/google', { method: 'POST', body: JSON.stringify({ credencial }) })
  guardarSesion(sesion, usuario)
  return usuario
}

/** Confirma que la sesión guardada sigue siendo válida (la cuenta pudo ser borrada o bloqueada). */
export async function confirmarSesion() {
  const { usuario } = await pedir('/yo')
  return usuario
}

export function salir() {
  try {
    window.google?.accounts?.id?.disableAutoSelect()
  } catch {
    /* sin Google cargado */
  }
  cerrarSesion()
}

export async function borrarCuenta() {
  await pedir('/borrar', { method: 'POST' })
  salir()
}
