import { useEffect, useState } from 'react'
import { API_URL } from '../services/reportes'
import { guardar, leer } from '../services/almacen'

const CADA = 10 * 60 * 1000
const MAX_EDAD_MIN = 90

const revivir = (o) => (o ? { ...o, hora: new Date(o.hora) } : null)
const vigente = (o) => o && Date.now() - o.hora.getTime() <= MAX_EDAD_MIN * 60000

/**
 * Medición real de la estación meteorológica más cercana al punto de la comuna.
 * null si no hay una estación cerca o la medición es vieja: la app usa el modelo.
 */
export function useObservacion({ cut, punto, enLinea, ahorro }) {
  const clave = cut ? `obs:${cut}` : null
  const [obs, setObs] = useState(() => (clave ? revivir(leer(clave)) : null))

  useEffect(() => {
    setObs(clave ? revivir(leer(clave)) : null)
  }, [clave])

  useEffect(() => {
    if (!API_URL || !punto || !enLinea || !clave) return
    let vivo = true
    const cargar = async () => {
      try {
        const r = await fetch(`${API_URL}/api/observacion?lat=${punto.lat.toFixed(4)}&lng=${punto.lng.toFixed(4)}`)
        if (!r.ok) return
        const { observacion } = await r.json()
        if (!vivo) return
        setObs(revivir(observacion))
        guardar(clave, observacion)
      } catch {
        /* sin medición: se sigue con el modelo */
      }
    }
    cargar()
    const id = setInterval(cargar, ahorro ? CADA * 3 : CADA)
    return () => {
      vivo = false
      clearInterval(id)
    }
  }, [clave, punto?.lat, punto?.lng, enLinea, ahorro]) // eslint-disable-line react-hooks/exhaustive-deps

  return vigente(obs) ? obs : null
}
