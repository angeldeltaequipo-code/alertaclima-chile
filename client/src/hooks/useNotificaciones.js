import { useCallback, useEffect, useState } from 'react'
import * as N from '../services/notificaciones'

/** Estado y acciones de las notificaciones de alertas. */
export function useNotificaciones({ enLinea }) {
  const [comunas, setComunas] = useState(N.comunasSuscritas)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState(null) // { mensaje, codigo }
  const [permiso, setPermiso] = useState(N.permiso)
  const [prueba, setPrueba] = useState(null) // null | 'enviando' | 'enviada' | mensaje de error
  const soporte = N.soporte()

  // Al abrir la app (con señal), se confirma que la suscripción sigue viva en el servidor.
  useEffect(() => {
    if (enLinea) N.revisar().then(setComunas)
  }, [enLinea])

  // Si la persona cambia el permiso en el navegador, la app se entera sola.
  useEffect(
    () =>
      N.vigilarPermiso((p) => {
        setPermiso(p)
        if (p !== 'denied') setError((e) => (e?.codigo === 'bloqueadas' ? null : e))
        if (p === 'denied') N.revisar().then(setComunas)
      }),
    [],
  )

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
      setError({ mensaje: e.message, codigo: e.codigo ?? 'otro' })
      return false
    } finally {
      setPermiso(N.permiso())
      setOcupado(false)
    }
  }, [])

  const probar = async () => {
    setPrueba('enviando')
    try {
      await N.probar()
      setPrueba('enviada')
    } catch (e) {
      setPrueba(e.message)
    }
  }

  return {
    soporte,
    entorno: N.entorno(),
    permiso,
    bloqueadas: permiso === 'denied',
    comunas,
    activas: comunas.length > 0,
    ocupado,
    error,
    prueba,
    probar,
    activar: (cuts) => correr(() => N.activar(cuts)),
    agregar: (cut) => correr(() => N.cambiarComunas([...new Set([...comunas, cut])].slice(0, 5))),
    quitar: (cut) => correr(() => N.cambiarComunas(comunas.filter((c) => c !== cut))),
    desactivar: () => correr(() => N.desactivar()),
  }
}
