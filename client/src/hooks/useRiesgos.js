import { useEffect, useState } from 'react'
import { API_URL } from '../services/reportes'
import { obtenerRiesgos } from '../services/riesgos'

const CADA = 2 * 60 * 1000

/** Sismos, tsunamis y volcanes. Se actualiza cada 2 minutos mientras hay conexión. */
export function useRiesgos({ enLinea }) {
  const [estado, setEstado] = useState({ datos: null, error: null, cargando: false })
  useEffect(() => {
    if (!API_URL || !enLinea) return
    let vivo = true
    const cargar = async () => {
      setEstado((e) => ({ ...e, cargando: true }))
      try {
        const datos = await obtenerRiesgos()
        if (vivo) setEstado({ datos, error: null, cargando: false })
      } catch (e) {
        if (vivo) setEstado((x) => ({ ...x, error: e.message, cargando: false }))
      }
    }
    cargar()
    const id = setInterval(cargar, CADA)
    return () => {
      vivo = false
      clearInterval(id)
    }
  }, [enLinea])
  return estado
}
