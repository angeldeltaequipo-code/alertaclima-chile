// «Viaja con ZUMI»: el mapa vuela en 3D hasta un lugar histórico de Chile y ZUMI te lo cuenta en voz:
// el clima de ahora allí, un dato verdadero y una pregunta para jugar. Si aciertas, ganas el sello del
// lugar en tu pasaporte. Si hay video real de ZUMI en ese lugar, aparece como una postal que se agranda.
import { useEffect, useMemo, useRef, useState } from 'react'
import { LUGARES, NARRADOR, climaEn, leerPasaporte, sellar } from '../services/viajes'
import { describir } from '../services/clima'
import { alCambiarNarrador, callar, hablar, nombrePreferido } from '../services/narrador'

const grados = (v) => `${Math.round(v)}°`

function Video({ base, className, loop = true, onEnded, style, autoPlay = true }) {
  return (
    <video key={base} muted playsInline loop={loop} autoPlay={autoPlay} preload="auto" disablePictureInPicture aria-hidden="true" className={className} style={style} onEnded={onEnded}>
      <source src={`${base}.webm`} type="video/webm" />
      <source src={`${base}.mp4`} type="video/mp4" />
    </video>
  )
}

/** La cara de ZUMI en una burbuja: habla de verdad (video) mientras suena su voz. */
function Burbuja({ hablando, size = 64 }) {
  return (
    <span className="relative block shrink-0 overflow-hidden rounded-full bg-[#2a1a10] shadow-[0_0_0_3px_rgba(255,201,60,.9),0_8px_24px_rgba(0,0,0,.45)]" style={{ width: size, height: size }}>
      <img src={NARRADOR.avatar} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <Video base={NARRADOR.reposo} className="absolute inset-0 h-full w-full object-cover" />
      <Video base={NARRADOR.habla} className="absolute inset-0 h-full w-full object-cover transition-opacity duration-200" style={{ opacity: hablando ? 1 : 0 }} />
      {hablando && <span className="onda-voz absolute inset-0 rounded-full" aria-hidden="true" />}
    </span>
  )
}

export default function ViajeZumi({ lugar, onCambiar, onCerrar }) {
  const [clima, setClima] = useState(null)
  const [hablando, setHablando] = useState(false)
  const [respuesta, setRespuesta] = useState(null) // índice elegido
  const [grande, setGrande] = useState(false)
  const [sellos, setSellos] = useState(leerPasaporte)
  const [texto, setTexto] = useState('')
  const quien = nombrePreferido()
  const i = LUGARES.findIndex((l) => l.id === lugar.id)
  const tira = useRef(null)

  useEffect(() => alCambiarNarrador((e) => setHablando(Boolean(e?.hablando))), [])
  useEffect(() => {
    const f = () => setSellos(leerPasaporte())
    window.addEventListener('ac:pasaporte', f)
    return () => window.removeEventListener('ac:pasaporte', f)
  }, [])

  // Al llegar: clima del lugar y ZUMI lo cuenta (espera el vuelo de la cámara).
  useEffect(() => {
    setRespuesta(null)
    setClima(null)
    setGrande(Boolean(lugar.video))
    const ctrl = new AbortController()
    let hablo = false
    const contar = (c) => {
      if (hablo) return
      hablo = true
      const desc = c ? describir(c.codigo).texto.toLowerCase() : null
      const frases = [
        `¡${quien ? `${quien}, l` : 'L'}legamos a ${lugar.nombre}!`,
        c ? `Ahora mismo hay ${Math.round(c.temp)} grados${desc ? ` y está ${desc}` : ''}${c.dia ? '' : ', porque allá ya es de noche'}.` : null,
        lugar.dato,
        `Ahora te pregunto yo: ${lugar.pregunta}`,
      ].filter(Boolean)
      setTexto(lugar.dato)
      hablar(frases)
    }
    let c0 = null
    climaEn(lugar, { signal: ctrl.signal })
      .then((c) => {
        c0 = c
        setClima(c)
      })
      .catch(() => null)
    // ZUMI empieza a contar cuando la cámara ya llegó (unos 3 segundos), con o sin el clima.
    const t = setTimeout(() => !ctrl.signal.aborted && contar(c0), 1600)
    return () => {
      ctrl.abort()
      clearTimeout(t)
      callar()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lugar.id])

  // La tira de destinos mantiene a la vista el lugar actual.
  useEffect(() => {
    tira.current?.querySelector(`[data-lugar="${lugar.id}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [lugar.id])

  const responder = (k) => {
    if (respuesta != null) return
    setRespuesta(k)
    navigator.vibrate?.(k === lugar.correcta ? [12, 40, 12] : 30)
    if (k === lugar.correcta) {
      const p = sellar(lugar.id)
      const n = Object.keys(p).length
      hablar([`¡Exacto! Ganaste el sello de ${lugar.nombre}.`, n >= LUGARES.length ? '¡Completaste todo tu pasaporte! Eres un verdadero explorador de Chile.' : `Llevas ${n} de ${LUGARES.length} sellos. ¿Vamos al siguiente?`])
    } else hablar([`¡Casi! La respuesta era: ${lugar.opciones[lugar.correcta]}.`, 'No importa, ¡lo importante es explorar juntos! Puedes intentarlo otra vez más tarde.'])
  }

  const siguiente = (d = 1) => onCambiar(LUGARES[(i + d + LUGARES.length) % LUGARES.length])
  const desc = clima ? describir(clima.codigo) : null
  const total = Object.keys(sellos).length
  const opciones = useMemo(() => lugar.opciones.map((o, k) => ({ o, k })), [lugar])

  return (
    <div className="viaje-zumi pointer-events-none absolute inset-0 z-[600]" role="region" aria-label={`ZUMI en ${lugar.nombre}`}>
      {/* Título del lugar, como en un documental */}
      <div key={lugar.id} className="viaje-titulo pointer-events-none absolute top-4 right-0 left-0 px-16 text-center text-white">
        <p className="text-[13px] font-black tracking-[0.22em] text-[#ffc93c] uppercase">ZUMI viaja a</p>
        <h2 className="text-[30px] leading-tight font-black drop-shadow-[0_2px_10px_rgba(0,0,0,.7)]">{lugar.nombre}</h2>
        <p className="text-[14px] font-semibold text-white/85 drop-shadow">{lugar.sub}</p>
        {clima && (
          <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1 text-[15px] font-bold backdrop-blur">
            {grados(clima.temp)} · {desc?.texto}
            {!clima.dia && ' · de noche'}
          </p>
        )}
      </div>

      {/* Postal con el video real de ZUMI en el lugar (si existe): grande al llegar, luego chica */}
      {lugar.video && (
        <button
          type="button"
          onClick={() => setGrande(!grande)}
          aria-label={grande ? 'Achicar la postal de ZUMI' : 'Ver a ZUMI en grande'}
          className={`postal-zumi pointer-events-auto absolute overflow-hidden rounded-[22px] bg-black shadow-2xl ring-2 ring-white/80 transition-all duration-500 ${grande ? 'grande' : 'chica'}`}
        >
          <img src={lugar.poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <Video base={lugar.video} loop={false} onEnded={() => setGrande(false)} className="absolute inset-0 h-full w-full object-cover" />
        </button>
      )}

      {/* Tarjeta de ZUMI: lo que cuenta, la pregunta y los destinos */}
      <div className={`safe-bottom absolute right-0 bottom-0 left-0 px-3 pb-3 transition-all duration-500 ${grande && lugar.video ? 'pointer-events-none translate-y-8 opacity-0' : 'pointer-events-auto'}`}>
        <div className="tarjeta-viaje mx-auto max-w-xl rounded-[26px] p-3.5 text-white">
          <div className="flex items-start gap-3">
            <Burbuja hablando={hablando} />
            <div className="min-w-0 flex-1">
              <p className="text-[16px] leading-snug font-semibold">{texto || '…'}</p>
            </div>
            <button type="button" onClick={onCerrar} aria-label="Terminar el viaje" className="grid size-10 shrink-0 place-items-center rounded-full bg-white/15 active:scale-95">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <p className="mt-3 text-[15px] font-black">{lugar.pregunta}</p>
          <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="Opciones">
            {opciones.map(({ o, k }) => {
              const elegida = respuesta === k
              const bien = respuesta != null && k === lugar.correcta
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => responder(k)}
                  disabled={respuesta != null}
                  className={`min-h-12 rounded-2xl px-2 text-[15px] leading-tight font-bold transition active:scale-95 ${bien ? 'bg-emerald-400 text-slate-950' : elegida ? 'bg-rose-500 text-white' : 'bg-white/14 text-white'} ${respuesta != null && !bien && !elegida ? 'opacity-50' : ''}`}
                >
                  {o}
                </button>
              )
            })}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button type="button" onClick={() => siguiente(-1)} aria-label="Lugar anterior" className="grid size-11 shrink-0 place-items-center rounded-full bg-white/15 active:scale-95">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
            <div ref={tira} className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none]" aria-label="Destinos">
              {LUGARES.map((l) => (
                <button
                  key={l.id}
                  data-lugar={l.id}
                  type="button"
                  onClick={() => onCambiar(l)}
                  aria-current={l.id === lugar.id}
                  className={`flex min-h-10 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-bold whitespace-nowrap ${l.id === lugar.id ? 'bg-[#ffc93c] text-slate-950' : 'bg-white/12 text-white'}`}
                >
                  {sellos[l.id] && <span aria-label="con sello">✓</span>}
                  {l.nombre.split(',')[0]}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => siguiente(1)} className="flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-[#ffc93c] px-4 text-[15px] font-black text-slate-950 active:scale-95">
              Siguiente
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" aria-hidden="true">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-center text-[13px] font-bold text-white/70">
            Pasaporte de ZUMI: {total} de {LUGARES.length} sellos
          </p>
        </div>
      </div>
    </div>
  )
}
