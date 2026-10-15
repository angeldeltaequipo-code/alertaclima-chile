import { useEffect, useState } from 'react'
import * as C from '../services/cuenta'
import { alCambiarSesion, sesionActual } from '../services/sesion'

/**
 * Estado de la cuenta.
 * estado: 'cargando' | 'desactivada' (el servidor aún no tiene inicio de sesión) | 'sin-sesion' | 'con-sesion'
 */
export function useCuenta({ enLinea }) {
  const [config, setConfig] = useState(null)
  const [sesion, setSesion] = useState(sesionActual)
  const [puerta, setPuerta] = useState(null) // motivo por el que se pide iniciar sesión, o null

  useEffect(() => alCambiarSesion(setSesion), [])

  useEffect(() => {
    if (!enLinea || config) return
    C.configCuenta()
      .then(setConfig)
      .catch(() => {})
  }, [enLinea, config])

  // Al abrir la app se confirma que la sesión sigue válida.
  useEffect(() => {
    if (enLinea && sesion?.token) C.confirmarSesion().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enLinea])

  const activa = config?.activa === true
  const estado = !config ? (sesion ? 'con-sesion' : 'cargando') : !activa ? 'desactivada' : sesion ? 'con-sesion' : 'sin-sesion'

  /** Ejecuta `accion` si hay sesión (o si las cuentas no están activas); si no, muestra la puerta. */
  const conCuenta = (motivo, accion) => {
    if (!activa || sesion) return accion()
    setPuerta(motivo)
  }

  return {
    estado,
    activa,
    clientId: config?.googleClientId ?? null,
    usuario: sesion?.usuario ?? null,
    token: sesion?.token ?? null,
    puerta,
    pedir: setPuerta,
    cerrarPuerta: () => setPuerta(null),
    conCuenta,
    salir: C.salir,
    borrar: C.borrarCuenta,
  }
}
