import { useState } from 'react'
import { comunaEnPunto } from '../services/comunas'

const PUNTOS = [
  {
    titulo: 'Lluvia y radar en vivo',
    texto: 'Mira dónde llueve ahora y cuánta agua viene, hora a hora.',
    color: '#38bdf8',
    icono: <path d="M7 15h10a4 4 0 0 0 .4-8 6 6 0 0 0-11.6 1.4A3.3 3.3 0 0 0 7 15zM9 18l-1 2M13 18l-1 2M17 18l-1 2" />,
  },
  {
    titulo: 'Alertas oficiales al instante',
    texto: 'Te avisamos y el teléfono vibra cuando hay una alerta en tu comuna.',
    color: '#fbbf24',
    icono: <path d="M12 3l9.5 17h-19zM12 10v4.5M12 17.5v.01" />,
  },
  {
    titulo: 'Tus vecinos en tiempo real',
    texto: 'Reportes con fotos, chat de tu comuna, cámaras y ríos cercanos.',
    color: '#34d399',
    icono: <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 19a5.5 5.5 0 0 1 11 0M10.5 19a5.5 5.5 0 0 1 11 0" />,
  },
]

/** Primera pantalla: qué es AlertaClima y cómo empezar en un toque. */
export default function Bienvenida({ onElegir, onBuscar }) {
  const [buscando, setBuscando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  const ubicarme = () => {
    if (!navigator.geolocation) return onBuscar()
    setBuscando(true)
    setMensaje(null)
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const c = await comunaEnPunto(coords.latitude, coords.longitude)
          if (c) onElegir(c.cut, { lat: coords.latitude, lng: coords.longitude })
          else setMensaje('Tu ubicación no está en Chile. Busca tu comuna por nombre.')
        } catch {
          setMensaje('No pudimos ubicar tu comuna. Búscala por nombre.')
        } finally {
          setBuscando(false)
        }
      },
      () => {
        setBuscando(false)
        setMensaje('No pudimos usar tu ubicación. Busca tu comuna por nombre.')
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60 * 1000 },
    )
  }

  return (
    <div className="bienvenida fixed inset-0 z-[1000] overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="t-bienvenida">
      <div className="bienvenida-estrellas" aria-hidden="true" />
      <div className="safe-top safe-bottom relative mx-auto flex min-h-full max-w-md flex-col px-6 pt-10 pb-6">
        <div className="entrar mx-auto grid size-24 place-items-center rounded-[28px] bienvenida-logo" aria-hidden="true">
          <svg width="56" height="56" viewBox="0 0 32 32">
            <path d="M9 21h14.5a5.5 5.5 0 0 0 .6-10.97A8 8 0 0 0 8.6 12.2 4.5 4.5 0 0 0 9 21z" fill="#fff" />
            <path d="M12 24l-1.5 3M17 24l-1.5 3M22 24l-1.5 3" stroke="#7dd3fc" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </div>
        <h1 id="t-bienvenida" className="entrar mt-6 text-center text-[34px] leading-tight font-bold text-white" style={{ animationDelay: '80ms' }}>
          AlertaClima
        </h1>
        <p className="entrar mt-2 text-center text-[18px] leading-snug text-white/80" style={{ animationDelay: '160ms' }}>
          El clima, las alertas y tus vecinos, en un solo lugar.
        </p>

        <ul className="mt-8 space-y-3">
          {PUNTOS.map((p, i) => (
            <li key={p.titulo} className="entrar flex items-start gap-3 rounded-2xl bg-white/8 p-3.5 ring-1 ring-white/10 backdrop-blur" style={{ animationDelay: `${260 + i * 110}ms` }}>
              <span className="grid size-11 shrink-0 place-items-center rounded-xl" style={{ background: `${p.color}26`, color: p.color }} aria-hidden="true">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  {p.icono}
                </svg>
              </span>
              <span>
                <span className="block text-[17px] font-bold text-white">{p.titulo}</span>
                <span className="block text-[15px] leading-snug text-white/75">{p.texto}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-8">
          <button
            type="button"
            onClick={ubicarme}
            disabled={buscando}
            className="entrar flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-senal text-[18px] font-bold text-sobre-senal shadow-lg disabled:opacity-70"
            style={{ animationDelay: '650ms' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="6.5" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
            </svg>
            {buscando ? 'Buscando tu comuna…' : 'Usar mi ubicación'}
          </button>
          <button
            type="button"
            onClick={onBuscar}
            className="entrar mt-3 min-h-13 w-full rounded-full bg-white/10 py-3 text-[17px] font-bold text-white ring-1 ring-white/20"
            style={{ animationDelay: '720ms' }}
          >
            Elegir mi comuna
          </button>
          {mensaje && (
            <p role="alert" className="mt-3 text-center text-[15px] font-bold text-amber-300">
              {mensaje}
            </p>
          )}
          <p className="mt-4 text-center text-[13px] text-white/60">Gratis. El clima y las alertas no necesitan cuenta.</p>
        </div>
      </div>
    </div>
  )
}
