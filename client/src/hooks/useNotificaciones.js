import { useCallback, useEffect, useState } from 'react'
import * as N from '../services/notificaciones'

/** Estado y acciones de las notificaciones de alertas. */
export function useNotificaciones({ enLinea }) {
  const [comunas, setComunas] = useState(N.comunasSuscritas)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState(null)
  const soporte = N.soporte()

  // Al abrir la app (con señal), se confirma que la suscripción sigue viva en el servidor.
  useEffect(() => {
    if (enLinea) N.revisar()
  }, [enLinea])

  // El service worker avisa si el servicio de notificaciones renovó la suscripción.
  useEffect(() => {
    const oir = (e) => e.data?.tipo === 'renovar-suscripcion' && N.revisar()
    navigator.serviceWorker?.addEventListener('message', oir)
    return () => navigator.serviceWorker?.removeEventListener('message', oir)
  }, [])

  const correr = useCallback(async (fn) => {
    setOcupado(true)
    setError(null)
    try {
      setComunas(await fn())
      return true
    } catch (e) {
      setError(e.message)
      return false
    } finally {
      setOcupado(false)
    }
  }, [])

  return {
    soporte,
    permiso: N.permiso(),
    comunas,
    activas: comunas.length > 0,
    ocupado,
    error,
    activar: (cuts) => correr(() => N.activar(cuts)),
    agregar: (cut) => correr(() => N.cambiarComunas([...new Set([...comunas, cut])].slice(0, 5))),
    quitar: (cut) => correr(() => N.cambiarComunas(comunas.filter((c) => c !== cut))),
    desactivar: () => correr(() => N.desactivar()),
  }
}
