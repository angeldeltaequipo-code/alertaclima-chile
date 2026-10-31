// «ZUMI te enseña»: escenas cortas tipo película (hechas con Higgsfield, con su voz y la boca
// perfectamente sincronizada porque salen juntas del mismo video). Consejos para cuidarse:
// lluvia, calor, sismos y la mochila de emergencia. La escena que sirve para hoy aparece primero.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const BASE = import.meta.env.BASE_URL
const RUTA = `${BASE}zumi/cine/`

export const ESCENAS_CINE = [
  { id: 'hola', titulo: '¡Hola, soy ZUMI!', tema: 'Bienvenida', guion: '¡Hola, hola! ¡Soy ZUMI! Desde hoy cuido el clima de tu casa y de toda tu familia. ¿Listo? ¡Vamos!' },
  { id: 'lluvia', titulo: 'Se viene la lluvia', tema: 'Lluvia', guion: '¡Uy, se viene la lluvia! Paraguas, chaqueta y botas… ¡y antes de salir, revisa las alertas en la app!' },
  { id: 'calor', titulo: '¡Qué calor!', tema: 'Calor', guion: '¡Qué calor! Toma mucha agua, usa bloqueador y busca la sombra, sobre todo al mediodía.' },
  { id: 'sismo', titulo: 'Si tiembla', tema: 'Sismos', guion: 'Si tiembla: agáchate, cúbrete y afírmate. Cuando pase, revisa a tu familia y sigue a Senapred.' },
  { id: 'mochila', titulo: 'Tu mochila de emergencia', tema: 'Prepárate', guion: '¡Agua, linterna, radio, pilas y tus remedios! Una mochila lista te puede salvar el día.' },
]

/** Orden según el día: lo que sirve hoy primero (lluvia si va a llover, calor si hace calor). */
export function ordenarEscenas({ ahora, horas, dias } = {}) {
  const llueve = (horas ?? []).slice(0, 12).some((h) => (h.lluvia ?? 0) >= 0.5)
  const calor = (ahora?.temperatura ?? 0) >= 28 || (dias?.[0]?.max ?? 0) >= 30
  const visto = (id) => {
    try {
      return localStorage.getItem(`ac:cine:${id}`) === '1'
    } catch {
      return false
    }
  }
  const puntaje = (e) => (e.id === 'lluvia' && llueve ? 10 : 0) + (e.id === 'calor' && calor ? 10 : 0) + (e.id === 'hola' && !visto('hola') ? 8 : 0) - (visto(e.id) ? 3 : 0)
  return [...ESCENAS_CINE].sort((a, b) => puntaje(b) - puntaje(a))
}

export function ReproductorCine({ inicial, lista, onCerrar }) {
  const [i, setI] = useState(() => Math.max(0, lista.findIndex((e) => e.id === inicial)))
  const [fin, setFin] = useState(false)
  const v = useRef(null)
  const e = lista[i]
  useEffect(() => {
    setFin(false)
    v.current?.play().catch(() => {})
    try {
      localStorage.setItem(`ac:cine:${e.id}`, '1')
    } catch {
      /* sin almacenamiento */
    }
  }, [e.id])
  useEffect(() => {
    const k = (ev) => ev.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onCerrar])
  const siguiente = () => setI((i + 1) % lista.length)

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`ZUMI: ${e.titulo}`} className="fixed inset-0 z-[1300] flex justify-center bg-black text-white">
      <div className="relative h-full w-full max-w-[min(100vw,calc(100dvh*0.5625))]">
        <video
          ref={v}
          key={e.id}
          src={`${RUTA}${e.id}.mp4`}
          poster={`${RUTA}${e.id}.webp`}
          playsInline
          autoPlay
          onEnded={() => setFin(true)}
          onClick={() => (v.current.paused ? v.current.play() : v.current.pause())}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="safe-top absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent px-4 pt-3 pb-8">
          <span className="rounded-full bg-white/15 px-3 py-1 text-[13px] font-bold tracking-wide uppercase">{e.tema}</span>
          <span className="flex-1" />
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid size-12 place-items-center rounded-full bg-black/40 text-[26px]">
            ×
          </button>
        </div>
        <div className="safe-bottom absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-4 pt-16 pb-5">
          <p className="text-[19px] leading-snug font-bold">{e.guion}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                v.current.currentTime = 0
                v.current.play().catch(() => {})
                setFin(false)
              }}
              className="min-h-12 flex-1 rounded-full bg-white/15 text-[16px] font-bold"
            >
              ↻ Repetir
            </button>
            <button type="button" onClick={siguiente} className={`min-h-12 flex-1 rounded-full text-[16px] font-bold ${fin ? 'bg-senal text-sobre-senal' : 'bg-white/15'}`}>
              Siguiente ›
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.querySelector('.con-cosmos') ?? document.body,
  )
}

/** Tarjeta en «Ahora»: fila de escenas con su portada. */
export default function CineZumi({ datos }) {
  const [abierta, setAbierta] = useState(null)
  const lista = ordenarEscenas(datos)
  return (
    <section aria-labelledby="t-cine" className="tarjeta">
      <h2 id="t-cine" className="titulo-tarjeta">
        ZUMI te enseña
      </h2>
      <p className="mt-1 text-[15px] text-texto-2">Videos cortos para cuidarte a ti y a los tuyos. Toca uno para verlo con sonido.</p>
      <ul className="-mx-4 mt-3 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {lista.map((e, k) => (
          <li key={e.id} className="w-[42%] max-w-44 shrink-0 snap-start">
            <button type="button" onClick={() => setAbierta(e.id)} className="block w-full text-left">
              <span className="relative block aspect-[9/16] overflow-hidden rounded-2xl bg-superficie-2">
                <img src={`${RUTA}${e.id}.webp`} alt="" loading="lazy" className="h-full w-full object-cover" />
                <span className="absolute inset-0 grid place-items-center" aria-hidden="true">
                  <span className="grid size-14 place-items-center rounded-full bg-black/45 text-[24px] text-white backdrop-blur-sm">▶</span>
                </span>
                {k === 0 && <span className="absolute top-2 left-2 rounded-full bg-senal px-2 py-0.5 text-[12px] font-black text-sobre-senal">Para hoy</span>}
              </span>
              <span className="mt-1.5 block text-[16px] leading-tight font-bold">{e.titulo}</span>
            </button>
          </li>
        ))}
      </ul>
      {abierta && <ReproductorCine inicial={abierta} lista={lista} onCerrar={() => setAbierta(null)} />}
    </section>
  )
}
