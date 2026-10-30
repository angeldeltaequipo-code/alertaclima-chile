import { useEffect, useState } from 'react'
import { API_URL } from '../services/reportes'
import { obtenerComunidad } from '../services/comunidad'

const CADA = 5 * 60 * 1000

/** Noticias y redes (no oficial). Se actualiza cada 5 minutos con conexión. */
export function useComunidad({ enLinea }) {
  const [estado, setEstado] = useState({ datos: null, error: null })
  useEffect(() => {
    if (!API_URL || !enLinea) return
    let vivo = true
    const cargar = () =>
      obtenerComunidad()
        .then((datos) => vivo && setEstado({ datos, error: null }))
        .catch((e) => vivo && setEstado((x) => ({ ...x, error: e.message })))
    cargar()
    const id = setInterval(cargar, CADA)
    return () => {
      vivo = false
      clearInterval(id)
    }
  }, [enLinea])
  return estado
}
