import { useEffect, useState } from 'react'

/** Instalación de la PWA: botón nativo en Android/Chrome, instrucciones en iPhone. */
export function useInstalar() {
  const [evento, setEvento] = useState(null)
  const [instalada, setInstalada] = useState(
    () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true,
  )
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

  useEffect(() => {
    const antes = (e) => {
      e.preventDefault()
      setEvento(e)
    }
    const listo = () => {
      setInstalada(true)
      setEvento(null)
    }
    window.addEventListener('beforeinstallprompt', antes)
    window.addEventListener('appinstalled', listo)
    return () => {
      window.removeEventListener('beforeinstallprompt', antes)
      window.removeEventListener('appinstalled', listo)
    }
  }, [])

  const instalar = async () => {
    if (!evento) return
    evento.prompt()
    await evento.userChoice.catch(() => {})
    setEvento(null)
  }

  return { instalada, puedeInstalar: !!evento, esIOS, instalar }
}
