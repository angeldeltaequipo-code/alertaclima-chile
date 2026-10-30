import { useEffect, useState } from 'react'
import { guardar, guardarTexto, leer } from '../services/almacen'

const oscuroDelSistema = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false

/**
 * Tema: "auto" (sigue al teléfono, por defecto), "claro" u "oscuro".
 * Devuelve [tema elegido, cambiar, tema que se está viendo].
 */
export function useTema() {
  const [tema, setTema] = useState(() => {
    try {
      const t = localStorage.getItem('ac:tema')
      return t === 'claro' || t === 'oscuro' ? t : 'auto'
    } catch {
      return 'auto'
    }
  })
  const [sistemaOscuro, setSistemaOscuro] = useState(oscuroDelSistema)
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    const cambio = () => setSistemaOscuro(mq.matches)
    mq?.addEventListener?.('change', cambio)
    return () => mq?.removeEventListener?.('change', cambio)
  }, [])
  const resuelto = tema === 'auto' ? (sistemaOscuro ? 'oscuro' : 'claro') : tema
  useEffect(() => {
    document.documentElement.dataset.tema = resuelto
    guardarTexto('tema', tema)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resuelto === 'claro' ? '#f3f6f9' : '#0f1b26')
  }, [tema, resuelto])
  return [tema, setTema, resuelto]
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

/**
 * Tamaño de letra: "normal", "grande" (por defecto, pensado para leer sin lentes) o "muy".
 * Se aplica como data-letra en <html>; el CSS agranda el contenido de las pestañas.
 */
export function useLetra() {
  const [letra, setLetra] = useState(() => {
    const v = leer('letra', 'grande')
    return ['normal', 'grande', 'muy'].includes(v) ? v : 'grande'
  })
  useEffect(() => {
    document.documentElement.dataset.letra = letra
    guardar('letra', letra)
  }, [letra])
  return [letra, setLetra]
}
