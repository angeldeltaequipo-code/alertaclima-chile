import { useEffect, useState } from 'react'
import { alCambiarNarrador, callar, hablar } from '../services/narrador'

const BASE = import.meta.env.BASE_URL
import { comunaEnPunto } from '../services/comunas'
import BotonGoogle from './BotonGoogle'

const PUNTOS = [
  {
    titulo: 'Lluvia y radar en vivo',
    corto: 'Radar en vivo',
    texto: 'Mira dónde llueve ahora y cuánta agua viene, hora a hora.',
    color: '#38bdf8',
    icono: <path d="M7 15h10a4 4 0 0 0 .4-8 6 6 0 0 0-11.6 1.4A3.3 3.3 0 0 0 7 15zM9 18l-1 2M13 18l-1 2M17 18l-1 2" />,
  },
  {
    titulo: 'Alertas oficiales al instante',
    corto: 'Alertas y sismos',
    texto: 'Te avisamos y el teléfono vibra cuando hay una alerta en tu comuna.',
    color: '#fbbf24',
    icono: <path d="M12 3l9.5 17h-19zM12 10v4.5M12 17.5v.01" />,
  },
  {
    titulo: 'Tus vecinos en tiempo real',
    corto: 'Chat de tu comuna',
    texto: 'Reportes con fotos, chat de tu comuna, cámaras y ríos cercanos.',
    color: '#34d399',
    icono: (
      <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 19a5.5 5.5 0 0 1 11 0M10.5 19a5.5 5.5 0 0 1 11 0" />
    ),
  },
]

/** Primera pantalla: qué es AlertaClima y cómo empezar en un toque. */
export default function Bienvenida({ onElegir, onBuscar, cuenta }) {
  const [sinCuenta, setSinCuenta] = useState(false)
  // Paso 1: entrar con Google (si está activo y aún no hay sesión). Paso 2: elegir la comuna.
  const pasoCuenta = cuenta?.estado === 'sin-sesion' && cuenta.clientId && !sinCuenta
  const [buscando, setBuscando] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const [hablandoZumi, setHablandoZumi] = useState(false)
  useEffect(() => {
    const quitar = alCambiarNarrador((e) => setHablandoZumi(e.hablando))
    return () => {
      quitar()
      callar()
    }
  }, [])
  // La voz necesita un toque de la persona (los navegadores no dejan hablar solo al abrir).
  const escuchar = () => (hablandoZumi ? callar() : hablar(dice, { silencio: false }))

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

  const primerNombre = cuenta?.usuario?.nombre?.split(' ')[0]
  const dice = pasoCuenta
    ? [
        '¡Hola! Soy ZUMI.',
        'Te aviso de la lluvia, los sismos y las alertas de tu comuna.',
        '¡Entra con Google y empecemos!',
      ]
    : [primerNombre ? `¡Listo, ${primerNombre}!` : '¡Perfecto!', 'Ahora dime dónde estás para cuidarte en tu comuna.']

  return (
    <div
      className="bienvenida fixed inset-0 z-[1000] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="t-bienvenida"
    >
      <div className="bienvenida-estrellas" aria-hidden="true" />
      <div className="safe-bottom relative mx-auto flex min-h-full max-w-md flex-col">
        {/* ZUMI en su estudio, hablándole a la persona */}
        <div className="bienvenida-zumi relative h-[56dvh] min-h-[330px] w-full">
          <div className="absolute inset-0 overflow-hidden">
            <video
              autoPlay
              muted
              loop
              playsInline
              poster={`${BASE}zumi/zumi-v-cerca.jpg`}
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover object-[50%_20%]"
            >
              <source src={`${BASE}zumi/zumi-v-cerca.webm`} type="video/webm" />
              <source src={`${BASE}zumi/zumi-v-cerca.mp4`} type="video/mp4" />
            </video>
            <div className="bienvenida-zumi-velo absolute inset-0" aria-hidden="true" />
          </div>
          <div className="safe-top absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-4">
            <span id="t-bienvenida" className="entrar text-[20px] font-bold tracking-tight text-white drop-shadow">
              AlertaClima
            </span>
            <button
              type="button"
              onClick={escuchar}
              aria-label={hablandoZumi ? 'ZUMI está hablando' : 'Escuchar a ZUMI'}
              className="boton-vidrio flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[14px] font-bold"
            >
              {hablandoZumi ? (
                <span className="ondas-voz scale-75" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 9v6h4l5 4V5L8 9z" />
                  <path d="M16.5 8.5a5 5 0 0 1 0 7" />
                </svg>
              )}
              {hablandoZumi ? 'Hablando' : 'Escúchame'}
            </button>
          </div>
          {/* Globo con lo que dice ZUMI */}
          <div className="absolute inset-x-4 bottom-0 z-10 translate-y-[38%]">
            <p
              className="entrar globo-bienvenida text-[18px] leading-snug font-bold"
              style={{ animationDelay: '250ms' }}
              aria-live="polite"
            >
              {dice.map((f, i) => (
                <span
                  key={`${pasoCuenta}-${i}`}
                  className="palabra-entra"
                  style={{ animationDelay: `${400 + i * 700}ms` }}
                >
                  {f}{' '}
                </span>
              ))}
            </p>
          </div>
        </div>

        <div className="relative flex flex-1 flex-col px-5 pt-16 pb-5">
          {pasoCuenta ? (
            <>
              <div className="entrar" style={{ animationDelay: '500ms' }}>
                <BotonGoogle clientId={cuenta.clientId} />
              </div>
              <p
                className="entrar mt-3 text-center text-[13px] leading-snug text-white/70"
                style={{ animationDelay: '600ms' }}
              >
                Solo mostramos tu nombre, la inicial de tu apellido y tu foto. Al continuar aceptas los{' '}
                <a href="./terminos.html" target="_blank" rel="noopener" className="underline">
                  términos
                </a>{' '}
                y la{' '}
                <a href="./privacidad.html" target="_blank" rel="noopener" className="underline">
                  política de privacidad
                </a>
                .
              </p>
              <ul
                className="entrar mt-5 flex flex-wrap justify-center gap-2 text-[13px] font-bold text-white/85"
                style={{ animationDelay: '700ms' }}
              >
                {PUNTOS.map((p) => (
                  <li
                    key={p.titulo}
                    className="flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1.5 ring-1 ring-white/10"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={p.color}
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      {p.icono}
                    </svg>
                    {p.corto}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setSinCuenta(true)}
                className="entrar mt-auto min-h-12 w-full pt-4 text-[15px] font-bold text-white/70 underline"
                style={{ animationDelay: '800ms' }}
              >
                Seguir sin cuenta (solo clima y alertas)
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={ubicarme}
                disabled={buscando}
                className="entrar flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-senal text-[18px] font-bold text-sobre-senal shadow-lg disabled:opacity-70"
                style={{ animationDelay: '400ms' }}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
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
                style={{ animationDelay: '480ms' }}
              >
                Elegir mi comuna
              </button>
              {mensaje && (
                <p role="alert" className="mt-3 text-center text-[15px] font-bold text-amber-300">
                  {mensaje}
                </p>
              )}
              <p className="mt-4 text-center text-[13px] text-white/60">
                Gratis. El clima y las alertas no necesitan cuenta.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
