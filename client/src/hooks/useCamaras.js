import { useEffect, useState } from 'react'
import { API_URL } from '../services/reportes'

// Las imágenes de Windy (plan gratuito) caducan a los 10 minutos: se renuevan antes.
const CADA = 8 * 60 * 1000

/** Cámaras públicas cercanas al punto. disponible=false si el servidor no tiene clave de Windy. */
export function useCamaras({ punto, enLinea }) {
  const [estado, setEstado] = useState({ disponible: false, camaras: [] })

  useEffect(() => {
    if (!API_URL || !punto || !enLinea) return
    let vivo = true
    const cargar = async () => {
      try {
        const r = await fetch(`${API_URL}/api/camaras?lat=${punto.lat.toFixed(4)}&lng=${punto.lng.toFixed(4)}`)
        if (!r.ok) return
        const d = await r.json()
        if (vivo) setEstado({ disponible: d.disponible, camaras: d.camaras ?? [], error: d.error ?? null, cargada: new Date() })
      } catch {
        /* sin cámaras por ahora */
      }
    }
    cargar()
    const id = setInterval(cargar, CADA)
    return () => {
      vivo = false
      clearInterval(id)
    }
  }, [punto?.lat, punto?.lng, enLinea]) // eslint-disable-line react-hooks/exhaustive-deps

  return estado
}
