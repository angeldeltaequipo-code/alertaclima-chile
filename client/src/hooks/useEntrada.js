import { useEffect, useState } from 'react'

/**
 * Clase de animación de entrada solo la primera vez: al volver a una pestaña (que estaba
 * oculta) el navegador repetiría la animación y la app se sentiría lenta.
 */
export function useEntrada(clase = 'lista-entrar', ms = 1600) {
  const [activa, setActiva] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setActiva(false), ms)
    return () => clearTimeout(t)
  }, [ms])
  return activa ? clase : ''
}
