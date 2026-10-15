import { useEffect, useRef } from 'react'
import BotonGoogle from './BotonGoogle'

const MOTIVOS = {
  chat: 'Para conversar con tus vecinos en el chat de tu comuna.',
  reportar: 'Para reportar lo que pasa en tu calle.',
  votar: 'Para confirmar o desmentir reportes de vecinos.',
  notificaciones: 'Para recibir avisos de alertas en tu teléfono.',
}

/** Hoja inferior: «Inicia sesión para participar», con el botón de Google. */
export default function PuertaCuenta({ cuenta }) {
  const ref = useRef(null)
  useEffect(() => {
    const previo = document.activeElement
    ref.current?.focus()
    const tecla = (e) => e.key === 'Escape' && cuenta.cerrarPuerta()
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('keydown', tecla)
      previo?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-black/60 sm:items-center" onClick={cuenta.cerrarPuerta}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="t-puerta"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="safe-bottom w-full max-w-md rounded-t-3xl bg-superficie p-5 shadow-2xl sm:rounded-3xl"
      >
        <h2 id="t-puerta" className="text-[22px] leading-tight font-bold">
          Entra con tu cuenta de Google
        </h2>
        <p className="mt-2 text-[16px]">{MOTIVOS[cuenta.puerta] ?? 'Para participar en AlertaClima.'}</p>
        <ul className="mt-3 space-y-1.5 text-[15px] text-texto-2">
          <li>• Es gratis y toma un toque.</li>
          <li>• Los demás solo ven tu nombre, la inicial de tu apellido y tu foto.</li>
          <li>• No vemos tu correo ni tu contraseña.</li>
        </ul>
        <div className="mt-4">
          <BotonGoogle clientId={cuenta.clientId} onListo={cuenta.cerrarPuerta} />
        </div>
        <button type="button" onClick={cuenta.cerrarPuerta} className="mt-3 min-h-12 w-full rounded-full text-[16px] font-bold text-texto-2">
          Ahora no
        </button>
        <p className="mt-1 text-center text-[13px] text-texto-2">El clima, el mapa y las alertas oficiales siguen disponibles sin cuenta.</p>
      </div>
    </div>
  )
}
