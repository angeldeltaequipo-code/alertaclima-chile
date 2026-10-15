// Sesión de la persona (inicio con Google). Se guarda en este dispositivo; el servidor la firma.
import { guardar, leer } from './almacen'

const oyentes = new Set()
let actual = leer('cuenta:sesion', null) // { token, usuario }

export const sesionActual = () => actual
export const tokenSesion = () => actual?.token ?? null
export const cabeceraSesion = () => (actual?.token ? { authorization: `Bearer ${actual.token}` } : {})

export function guardarSesion(token, usuario) {
  actual = { token, usuario }
  guardar('cuenta:sesion', actual)
  oyentes.forEach((f) => f(actual))
}

export function cerrarSesion() {
  actual = null
  guardar('cuenta:sesion', null)
  oyentes.forEach((f) => f(null))
}

export function alCambiarSesion(fn) {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}
