import { useCallback, useEffect, useState } from 'react'
import { estadoComuna } from '../services/alertas'
import { escuchar, seguirComuna } from '../services/tiempoReal'

/** Alertas oficiales de la comuna: se consultan cada 2 min (10 en modo ahorro) y al llegar un aviso en vivo. */
export function useAlertas({ comuna, enLinea, ahorro }) {
  const cut = comuna?.cut
  const [estado, setEstado] = useState(null)

  const cargar = useCallback(async () => {
    if (!cut) return
    setEstado(await estadoComuna(cut))
  }, [cut])

  useEffect(() => {
    setEstado(null)
    cargar()
  }, [cargar, enLinea])

  useEffect(() => {
    if (!enLinea) return
    const id = setInterval(cargar, (ahorro ? 10 : 2) * 60 * 1000)
    return () => clearInterval(id)
  }, [cargar, enLinea, ahorro])

  useEffect(() => {
    if (!cut || !enLinea) return
    seguirComuna(cut)
    return escuchar('alerta:cambio', (m) => m?.comuna === cut && cargar())
  }, [cut, enLinea, cargar])

  return { estado, recargar: cargar }
}
