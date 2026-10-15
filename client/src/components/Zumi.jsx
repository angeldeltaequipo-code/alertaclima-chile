import { useEffect, useRef, useState } from 'react'
import {
  NOMBRE,
  alCambiarNarrador,
  callar,
  guardarLeerAlertas,
  guardarModoNarrador,
  guardarNombre,
  hablar,
  leerAlertasEnVoz,
  modoNarrador,
  nombrePreferido,
  vozDisponible,
} from '../services/narrador'
import { guardar, leer } from '../services/almacen'

const BASE = import.meta.env.BASE_URL

export function AvatarZumi({ tam = 56, hablando = false, className = '' }) {
  return (
    <span className={`avatar-zumi ${hablando ? 'hablando' : ''} ${className}`} style={{ width: tam, height: tam }} aria-hidden="true">
      <img src={`${BASE}zumi/zumi-cara.webp`} alt="" width={tam} height={tam} />
    </span>
  )
}

function useNarrador() {
  const [e, setE] = useState({ hablando: false, frase: -1, frases: [] })
  useEffect(() => alCambiarNarrador(setE), [])
  return e
}

/** Botón flotante de ZUMI: siempre a mano para escuchar el reporte. */
export function BotonZumi({ onAbrir }) {
  const e = useNarrador()
  const [globo, setGlobo] = useState(() => !leer('zumi:presentado', false))
  useEffect(() => {
    if (!globo) return
    const t = setTimeout(() => {
      setGlobo(false)
      guardar('zumi:presentado', true)
    }, 9000)
    return () => clearTimeout(t)
  }, [globo])
  return (
    <div className="pointer-events-none fixed right-3 bottom-[5.25rem] z-[900] flex items-end gap-2">
      {globo && (
        <p className="globo-zumi pointer-events-auto max-w-[200px] rounded-2xl rounded-br-sm px-3 py-2 text-[14px] leading-snug font-bold">
          ¡Hola! Soy {NOMBRE}. Tócame y te cuento cómo está el clima.
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          setGlobo(false)
          guardar('zumi:presentado', true)
          onAbrir()
        }}
        aria-label={e.hablando ? `${NOMBRE} está hablando. Abrir` : `Escuchar a ${NOMBRE}, tu narrador del clima`}
        className="pointer-events-auto rounded-full"
      >
        <AvatarZumi tam={60} hablando={e.hablando} />
      </button>
    </div>
  )
}

/** Hoja de ZUMI: el estudio, el reporte con subtítulos y las preferencias de voz. */
export function HojaZumi({ guion, nombreCuenta, onCerrar }) {
  const e = useNarrador()
  const ref = useRef(null)
  const [nombre, setNombre] = useState(nombrePreferido)
  const [alertasVoz, setAlertasVoz] = useState(leerAlertasEnVoz)
  const [modo, setModo] = useState(modoNarrador)
  const [ajustes, setAjustes] = useState(false)
  const frases = guion(nombre || nombreCuenta)
  const sonando = e.hablando && e.frases.length

  useEffect(() => {
    const previo = document.activeElement
    ref.current?.focus()
    // Al abrir, ZUMI empieza a hablar (la persona acaba de tocar el botón).
    if (vozDisponible()) hablar(frases)
    const tecla = (ev) => ev.key === 'Escape' && onCerrar()
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('keydown', tecla)
      callar()
      previo?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const mostradas = sonando ? e.frases : frases
  return (
    <div className="fixed inset-0 z-[1150] flex items-end justify-center bg-black/70 sm:items-center" onClick={onCerrar}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`${NOMBRE}, tu narrador del clima`}
        tabIndex={-1}
        onClick={(ev) => ev.stopPropagation()}
        className="hoja-zumi safe-bottom flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-t-[28px] sm:rounded-[28px]"
      >
        <div className="relative aspect-[16/8] w-full shrink-0 overflow-hidden bg-black">
          <video
            src={`${BASE}zumi/zumi-estudio.mp4`}
            poster={`${BASE}zumi/zumi-estudio.jpg`}
            autoPlay
            muted
            loop
            playsInline
            aria-hidden="true"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/85 to-transparent px-4 pt-10 pb-3">
            <div>
              <p className="text-[24px] leading-none font-bold tracking-wide text-white">{NOMBRE}</p>
              <p className="text-[13px] text-white/80">Tu narrador del clima</p>
            </div>
            {sonando ? (
              <span className="ondas-voz" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
            ) : null}
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="absolute top-3 right-3 grid size-11 place-items-center rounded-full bg-black/50 text-white backdrop-blur">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-4">
          <ol className="space-y-1.5" aria-live="polite">
            {mostradas.map((t, i) => (
              <li
                key={i}
                className={`rounded-xl px-3 py-1.5 text-[17px] leading-snug transition-colors ${
                  sonando && i === e.frase ? 'bg-white/12 font-bold text-white' : sonando && i < e.frase ? 'text-white/55' : 'text-white/85'
                }`}
              >
                {t}
              </li>
            ))}
          </ol>

          <div className="mt-4 flex gap-2">
            {vozDisponible() ? (
              sonando ? (
                <button type="button" onClick={callar} className="min-h-12 flex-1 rounded-full bg-white/12 text-[16px] font-bold text-white">
                  Detener
                </button>
              ) : (
                <button type="button" onClick={() => hablar(frases)} className="min-h-12 flex-1 rounded-full bg-senal text-[16px] font-bold text-sobre-senal">
                  Escuchar otra vez
                </button>
              )
            ) : (
              <p className="text-[14px] text-white/70">Este navegador no puede leer en voz alta; aquí tienes el reporte escrito.</p>
            )}
            <button type="button" onClick={() => setAjustes(!ajustes)} aria-expanded={ajustes} className="min-h-12 rounded-full bg-white/12 px-4 text-[15px] font-bold text-white">
              Ajustes
            </button>
          </div>

          {ajustes && (
            <div className="mt-3 space-y-3 rounded-2xl bg-white/8 p-3 text-white">
              <label className="block">
                <span className="text-[14px] font-bold text-white/80">¿Cómo quieres que te llame {NOMBRE}?</span>
                <input
                  value={nombre}
                  maxLength={30}
                  onChange={(ev) => {
                    setNombre(ev.target.value)
                    guardarNombre(ev.target.value)
                  }}
                  placeholder={nombreCuenta ?? 'Tu nombre'}
                  className="mt-1 min-h-12 w-full rounded-xl border-2 border-white/20 bg-black/30 px-3 text-[16px] text-white placeholder:text-white/40"
                />
              </label>
              <label className="flex min-h-11 items-center justify-between gap-3 text-[15px]">
                Leer en voz alta las alertas oficiales
                <input
                  type="checkbox"
                  checked={alertasVoz}
                  onChange={(ev) => {
                    setAlertasVoz(ev.target.checked)
                    guardarLeerAlertas(ev.target.checked)
                  }}
                  className="size-6"
                />
              </label>
              <label className="flex min-h-11 items-center justify-between gap-3 text-[15px]">
                <span>
                  Modo narrador
                  <span className="block text-[13px] text-white/65">{NOMBRE} te lee el reporte cada vez que abres la app.</span>
                </span>
                <input
                  type="checkbox"
                  checked={modo}
                  onChange={(ev) => {
                    setModo(ev.target.checked)
                    guardarModoNarrador(ev.target.checked)
                  }}
                  className="size-6"
                />
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
