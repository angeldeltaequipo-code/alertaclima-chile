import { useCallback, useEffect, useRef, useState } from 'react'
import { obtenerPronostico, puntoDeComuna, revivir } from '../services/clima'
import { guardar, leer } from '../services/almacen'

const CADA_NORMAL = 15 * 60 * 1000
const CADA_AHORRO = 60 * 60 * 1000

/** Clima actual y pronóstico de la comuna. Guarda el último resultado para verlo sin señal. */
export function useClima({ comuna, ahorro, enLinea }) {
  const cut = comuna?.cut
  const [datos, setDatos] = useState(() => (cut ? revivir(leer(`clima:${cut}`)) : null))
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)
  const actual = useRef(cut)

  // Al cambiar de comuna se muestra lo guardado de esa comuna (o nada) mientras carga.
  if (actual.current !== cut) {
    actual.current = cut
    setDatos(cut ? revivir(leer(`clima:${cut}`)) : null)
    setError(null)
  }

  const cargar = useCallback(
    async (signal) => {
      if (!comuna) return
      setCargando(true)
      try {
        const punto = await puntoDeComuna(comuna, { signal })
        const d = await obtenerPronostico(punto, { signal })
        d.punto = punto
        setDatos(d)
        setError(null)
        guardar(`clima:${comuna.cut}`, d)
      } catch (e) {
        if (e.name !== 'AbortError')
          setError(e instanceof TypeError ? 'No hubo respuesta del servicio del clima. Revisa tu conexión' : e.message)
      } finally {
        setCargando(false)
      }
    },
    [comuna],
  )

  useEffect(() => {
    if (!enLinea || !comuna) return
    const ctrl = new AbortController()
    cargar(ctrl.signal)
    const id = setInterval(() => cargar(ctrl.signal), ahorro ? CADA_AHORRO : CADA_NORMAL)
    return () => {
      ctrl.abort()
      clearInterval(id)
    }
  }, [cargar, ahorro, enLinea, comuna])

  return { datos, error, cargando, recargar: () => cargar() }
}
