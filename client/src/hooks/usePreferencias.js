import { useEffect, useState } from 'react'
import { guardar, guardarTexto, leer } from '../services/almacen'

/** Tema claro/oscuro. Oscuro por defecto. */
export function useTema() {
  const [tema, setTema] = useState(() => {
    try {
      return localStorage.getItem('ac:tema') === 'claro' ? 'claro' : 'oscuro'
    } catch {
      return 'oscuro'
    }
  })
  useEffect(() => {
    document.documentElement.dataset.tema = tema
    guardarTexto('tema', tema)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tema === 'claro' ? '#ffffff' : '#0E1A24')
  }, [tema])
  return [tema, setTema]
}

/**
 * Modo ahorro: manual, o automático con batería bajo 20 % sin cargar
 * (solo en navegadores que exponen la API de batería).
 * Devuelve { activo, manual, porBateria, setManual }.
 */
export function useAhorro() {
  const [manual, setManualState] = useState(() => leer('ahorro', null)) // null = automático
  const [porBateria, setPorBateria] = useState(false)

  useEffect(() => {
    let bateria
    const revisar = () => setPorBateria(!!bateria && !bateria.charging && bateria.level < 0.2)
    if (navigator.getBattery) {
      navigator
        .getBattery()
        .then((b) => {
          bateria = b
          revisar()
          b.addEventListener('levelchange', revisar)
          b.addEventListener('chargingchange', revisar)
        })
        .catch(() => {})
    }
    return () => {
      bateria?.removeEventListener('levelchange', revisar)
      bateria?.removeEventListener('chargingchange', revisar)
    }
  }, [])

  const setManual = (v) => {
    setManualState(v)
    guardar('ahorro', v)
  }

  const activo = manual === null ? porBateria : manual
  useEffect(() => {
    document.documentElement.classList.toggle('ahorro', activo)
  }, [activo])

  return { activo, manual, porBateria, setManual }
}

/** Comuna elegida, recordada en el dispositivo. */
export function useComunaGuardada() {
  const [cut, setCutState] = useState(() => leer('comuna', null))
  const setCut = (v) => {
    setCutState(v)
    guardar('comuna', v)
  }
  return [cut, setCut]
}
