// El estudio de ZUMI a pantalla completa: ZUMI presenta el reporte en su estudio (el video cambia
// según lo que cuenta: saludo, pronóstico o alerta), aparecen paneles holográficos con los datos
// de cada frase, subtítulos grandes, y al final se puede conversar con él (escribiendo o hablando).
import { useEffect, useMemo, useRef, useState } from 'react'
import IconoClima from './IconoClima'
import PortalZumi from './PortalZumi'
import ZumiVideo from './ZumiVideo'
import {
  NOMBRE,
  TRAJES,
  alCambiarNarrador,
  callar,
  escenasReporte,
  guardarLeerAlertas,
  guardarModoNarrador,
  guardarNombre,
  guardarVozSilenciada,
  hablar,
  leerAlertasEnVoz,
  modoNarrador,
  nombrePreferido,
  vozDisponible,
  vozSilenciada,
} from '../services/narrador'
import { SUGERENCIAS, preguntarZumi } from '../services/zumiCerebro'
import { NIVELES } from '../services/alertas'


/** Alto de ZUMI según la pantalla: grande, pero dejando sitio a los datos y a los subtítulos. */
function useNarrador() {
  const [e, setE] = useState({ hablando: false, frase: -1, frases: [] })
  useEffect(() => alCambiarNarrador(setE), [])
  return e
}

const fmt = (n, d = 0) => Number(n).toLocaleString('es-CL', { maximumFractionDigits: d })

/** Panel holográfico con el dato de la frase que ZUMI está diciendo. */
function Holograma({ t }) {
  if (!t) return null
  let cuerpo
  let tono = 'cian'
  switch (t.tipo) {
    case 'saludo':
      cuerpo = (
        <>
          <p className="holo-etiqueta">Reporte del clima</p>
          <p className="text-[26px] leading-tight font-bold">{t.comuna}</p>
          <p className="text-[14px] text-white/75 first-letter:uppercase">{new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </>
      )
      break
    case 'alerta':
      tono = t.nivel === 'roja' ? 'rojo' : 'ambar'
      cuerpo = (
        <>
          <p className="holo-etiqueta">⚠ {t.titulo}</p>
          <p className="text-[22px] leading-tight font-bold">{t.texto}</p>
          {NIVELES[t.nivel] && <p className="text-[13px] text-white/75">Fuente oficial: SENAPRED</p>}
        </>
      )
      break
    case 'ok':
      tono = 'verde'
      cuerpo = (
        <>
          <p className="holo-etiqueta">Alertas</p>
          <p className="text-[22px] font-bold">✓ {t.texto}</p>
        </>
      )
      break
    case 'sismo':
      tono = t.magnitud >= 6 ? 'rojo' : 'ambar'
      cuerpo = (
        <div className="flex items-center gap-3">
          <span className="holo-circulo text-[24px] font-bold tabular-nums">{fmt(t.magnitud, 1)}</span>
          <span>
            <span className="holo-etiqueta block">Sismo</span>
            <span className="text-[16px] leading-snug font-bold">{t.texto}</span>
          </span>
        </div>
      )
      break
    case 'temp':
      cuerpo = (
        <div className="flex items-center gap-3">
          <IconoClima icono={t.icono} size={58} />
          <span>
            <span className="holo-etiqueta block">{t.texto}</span>
            <span className="text-[52px] leading-none font-bold tabular-nums">{t.valor}°</span>
          </span>
        </div>
      )
      break
    case 'viento':
      cuerpo = (
        <div className="flex items-center gap-3">
          <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
            <circle cx="28" cy="28" r="25" fill="none" stroke="currentColor" strokeOpacity=".35" strokeWidth="2" />
            <path d="M28 8 L35 34 L28 29 L21 34 Z" fill="currentColor" transform={`rotate(${(t.grados ?? 0) + 180} 28 28)`} />
          </svg>
          <span>
            <span className="holo-etiqueta block">Viento</span>
            <span className="text-[40px] leading-none font-bold tabular-nums">{t.valor}</span> <span className="text-[16px]">km/h</span>
          </span>
        </div>
      )
      break
    case 'lluvia': {
      const max = Math.max(1, ...(t.barras ?? []))
      cuerpo = (
        <>
          <p className="holo-etiqueta">Lluvia próximas 12 horas</p>
          <p className="text-[34px] leading-none font-bold tabular-nums">
            {fmt(t.mm, 1)} <span className="text-[16px]">mm</span>
          </p>
          <div className="mt-2 flex h-10 items-end gap-[3px]">
            {(t.barras ?? []).map((v, i) => (
              <span key={i} className="holo-barra flex-1 rounded-t-sm" style={{ height: `${Math.max(6, (v / max) * 100)}%`, opacity: v > 0 ? 1 : 0.3, animationDelay: `${i * 40}ms` }} />
            ))}
          </div>
        </>
      )
      break
    }
    case 'aluvion':
      tono = t.nivel === 'alto' ? 'rojo' : 'ambar'
      cuerpo = (
        <>
          <p className="holo-etiqueta">Aluviones y desbordes</p>
          <p className="text-[24px] font-bold">Riesgo {t.nivel === 'alto' ? 'alto' : 'en atención'}</p>
        </>
      )
      break
    case 'minmax':
      cuerpo = (
        <>
          <p className="holo-etiqueta">Hoy</p>
          <p className="flex gap-5 text-[36px] leading-none font-bold tabular-nums">
            <span>
              <span className="text-[15px] text-rose-300">máx </span>
              {t.max}°
            </span>
            <span>
              <span className="text-[15px] text-sky-300">mín </span>
              {t.min}°
            </span>
          </p>
        </>
      )
      break
    case 'vecinos':
      tono = 'verde'
      cuerpo = (
        <>
          <p className="holo-etiqueta">Vecinos</p>
          <p className="text-[30px] font-bold">
            {t.n} {t.n === 1 ? 'reporte' : 'reportes'}
          </p>
        </>
      )
      break
    case 'luna':
      tono = 'violeta'
      cuerpo = (
        <>
          <p className="holo-etiqueta">Esta noche</p>
          <p className="text-[24px] font-bold">🌙 {t.texto}</p>
        </>
      )
      break
    default:
      return null
  }
  return (
    <div key={JSON.stringify(t)} className={`holograma holo-${tono}`}>
      {cuerpo}
    </div>
  )
}

export default function EstudioZumi({ datos, nombreCuenta, conCuenta, traje = 'presentador', escenasIniciales, onCerrar }) {
  const e = useNarrador()
  const ref = useRef(null)
  const [nombre, setNombre] = useState(nombrePreferido)
  const quien = nombre || nombreCuenta
  const escenas = useMemo(() => escenasIniciales ?? escenasReporte({ ...datos, nombre: quien }), []) // eslint-disable-line react-hooks/exhaustive-deps
  const textos = useMemo(() => escenas.map((x) => x.texto), [escenas])
  const [silencio, setSilencio] = useState(() => vozSilenciada() || !vozDisponible())
  const [conversa, setConversa] = useState(false)
  const [pregunta, setPregunta] = useState('')
  const [ultima, setUltima] = useState(null) // { pregunta, texto, fuente }
  const [pensando, setPensando] = useState(false)
  const [escuchando, setEscuchando] = useState(false)
  const [ajustes, setAjustes] = useState(false)
  const historial = useRef([])
  const reconocedor = useRef(null)

  const enReporte = e.frases === textos
  const i = enReporte ? e.frase : -1
  const escena = i >= 0 ? escenas[i] : null
  const respondiendo = ultima && e.frases.length === 1 && e.frases[0] === ultima.texto && e.hablando
  const terminado = !e.hablando

  useEffect(() => {
    const previo = document.activeElement
    ref.current?.focus()
    hablar(textos, { silencio })
    const tecla = (ev) => ev.key === 'Escape' && onCerrar()
    document.addEventListener('keydown', tecla)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', tecla)
      document.body.style.overflow = ''
      callar()
      reconocedor.current?.abort?.()
      previo?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Al terminar el reporte, ZUMI invita a conversar.
  useEffect(() => {
    if (terminado && !conversa && e.frases === textos) setConversa(true)
  }, [terminado, conversa, e.frases, textos])

  const preguntar = async (texto) => {
    const q = texto.trim()
    if (!q || pensando) return
    callar()
    setConversa(true)
    setPregunta('')
    setPensando(true)
    setUltima({ pregunta: q, texto: null })
    const r = await preguntarZumi(q, { ...datos, nombre: quien }, historial.current, { conCuenta })
    historial.current = [...historial.current, { rol: 'persona', texto: q }, { rol: 'zumi', texto: r.texto }].slice(-6)
    setPensando(false)
    setUltima({ pregunta: q, ...r })
    hablar([r.texto], { silencio })
  }

  const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null
  const escuchar = () => {
    if (!SR) return
    if (escuchando) {
      reconocedor.current?.stop()
      return
    }
    callar()
    const r = new SR()
    r.lang = 'es-CL'
    r.interimResults = true
    r.maxAlternatives = 1
    r.onresult = (ev) => {
      const t = Array.from(ev.results)
        .map((x) => x[0].transcript)
        .join(' ')
      setPregunta(t)
      if (ev.results[ev.results.length - 1].isFinal) preguntar(t)
    }
    r.onend = () => setEscuchando(false)
    r.onerror = () => setEscuchando(false)
    reconocedor.current = r
    setEscuchando(true)
    r.start()
  }

  const cambiarSilencio = () => {
    const v = !silencio
    setSilencio(v)
    guardarVozSilenciada(v)
    if (e.hablando) hablar(e.frases.slice(Math.max(0, e.frase)), { silencio: v })
  }

  const subtitulo = pensando
    ? 'Déjame pensar…'
    : respondiendo || (ultima?.texto && terminado && conversa)
      ? ultima?.texto
      : (escena?.texto ?? (conversa && !e.hablando ? `¿Te ayudo con algo más${quien ? `, ${quien}` : ''}? Pregúntame lo que quieras.` : null))
  const alerta = escena?.clip === 'alerta'

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={`${NOMBRE}, tu narrador del clima`}
      tabIndex={-1}
      className={`estudio-zumi fixed inset-0 z-[1150] flex justify-center overflow-hidden bg-black text-white ${alerta ? 'en-alerta' : ''}`}
    >
      {/* Fondo desenfocado para pantallas anchas */}
      <div className="absolute inset-0 bg-[#050a18]" aria-hidden="true" />

      <div className="relative h-full w-full max-w-[min(100vw,calc(100dvh*0.62))] overflow-hidden">
        {/* ZUMI en su estudio: video con calidad de película animada, que cambia según lo que pasa */}
        <ZumiVideo
          estado={pensando ? 'pensando' : e.hablando ? 'hablando' : escuchando ? 'escuchando' : 'reposo'}
          gesto={i === 0 || Boolean(respondiendo && ultima?.pregunta && /hola|buen/i.test(ultima.pregunta)) ? 'saludo' : escena?.tarjeta?.tipo === 'ok' ? 'celebrar' : null}
          luz={alerta ? 'alerta' : 'normal'}
          posicion="center 30%"
        />
        <div className="estudio-velo absolute inset-0" aria-hidden="true" />

        {/* Barra superior */}
        <div className="safe-top absolute inset-x-0 top-0 flex items-center gap-2 px-4 pt-3">
          <span className="en-vivo flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold tracking-wider uppercase">
            <span className="size-2 rounded-full bg-red-500" aria-hidden="true" /> {NOMBRE} · en vivo
          </span>
          <span className="flex-1" />
          <button type="button" onClick={cambiarSilencio} aria-pressed={silencio} aria-label={silencio ? 'Activar la voz' : 'Silenciar la voz'} className="boton-vidrio grid size-11 place-items-center rounded-full">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 9v6h4l5 4V5L8 9z" />
              {silencio ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />}
            </svg>
          </button>
          <button type="button" onClick={() => setAjustes(!ajustes)} aria-expanded={ajustes} aria-label="Ajustes de ZUMI" className="boton-vidrio grid size-11 place-items-center rounded-full">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
              <circle cx="16" cy="7" r="2" />
              <circle cx="10" cy="17" r="2" />
            </svg>
          </button>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="boton-vidrio grid size-11 place-items-center rounded-full">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Progreso del reporte */}
        <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top)+4.1rem)] flex gap-1" aria-hidden="true">
          {escenas.map((_, k) => (
            <span key={k} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
              <span className={`block h-full rounded-full bg-white transition-all duration-500 ${enReporte && k < i ? 'w-full' : enReporte && k === i ? 'progreso-activo' : !enReporte && (conversa || terminado) ? 'w-full' : 'w-0'}`} />
            </span>
          ))}
        </div>

        {/* Panel holográfico con el dato */}
        <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top)+5.4rem)]" aria-hidden="true">
          {!conversa && <Holograma t={escena?.tarjeta} />}
        </div>

        {/* Subtítulos y conversación */}
        <div className="safe-bottom absolute inset-x-0 bottom-0 px-4 pb-4">
          {conversa && ultima?.pregunta && (
            <p className="mb-2 ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-white/90 px-3 py-2 text-[15px] font-bold text-slate-900">{ultima.pregunta}</p>
          )}
          {subtitulo && (
            <div className="subtitulo-zumi" aria-live="polite">
              <span className="mr-2 inline-block align-middle">
                <PortalZumi tam={34} traje={traje} hablando={e.hablando || pensando} />
              </span>
              <span key={subtitulo} className="subtitulo-texto">
                {subtitulo}
              </span>
              {ultima?.fuente === 'ia' && subtitulo === ultima.texto && <span className="mt-1 block text-[11px] text-white/55">Respuesta creada con IA a partir de los datos de tu comuna.</span>}
            </div>
          )}

          {conversa && (
            <div className="mt-3">
              {!pensando && !e.hablando && (
                <div className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1">
                  {!ultima && (
                    <button type="button" onClick={() => hablar(textos, { silencio })} className="boton-vidrio min-h-10 shrink-0 rounded-full px-3 text-[14px] font-bold">
                      ↻ Repetir el reporte
                    </button>
                  )}
                  {SUGERENCIAS.map((s) => (
                    <button key={s} type="button" onClick={() => preguntar(s)} className="boton-vidrio min-h-10 shrink-0 rounded-full px-3 text-[14px] font-bold">
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <form
                onSubmit={(ev) => {
                  ev.preventDefault()
                  preguntar(pregunta)
                }}
                className="flex items-center gap-2"
              >
                <label htmlFor="pregunta-zumi" className="sr-only">
                  Pregúntale algo a {NOMBRE}
                </label>
                <input
                  id="pregunta-zumi"
                  value={pregunta}
                  onChange={(ev) => setPregunta(ev.target.value)}
                  maxLength={300}
                  placeholder={escuchando ? 'Te escucho…' : `Pregúntale algo a ${NOMBRE}`}
                  className="min-h-13 min-w-0 flex-1 rounded-full border border-white/25 bg-black/45 px-4 py-3 text-[16px] text-white backdrop-blur-md placeholder:text-white/60"
                />
                {SR && (
                  <button
                    type="button"
                    onClick={escuchar}
                    aria-pressed={escuchando}
                    aria-label={escuchando ? 'Dejar de escuchar' : `Hablarle a ${NOMBRE}`}
                    className={`grid size-13 shrink-0 place-items-center rounded-full ${escuchando ? 'microfono-activo bg-red-500' : 'boton-vidrio'}`}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                      <rect x="9" y="3" width="6" height="11" rx="3" />
                      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                    </svg>
                  </button>
                )}
                <button type="submit" disabled={!pregunta.trim() || pensando} aria-label="Preguntar" className="grid size-13 shrink-0 place-items-center rounded-full bg-amber-300 text-slate-900 disabled:opacity-50">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M3 20l18-8L3 4l2 7 9 1-9 1z" />
                  </svg>
                </button>
              </form>
            </div>
          )}
          {!conversa && (
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => (callar(), setConversa(true))} className="boton-vidrio min-h-12 flex-1 rounded-full text-[15px] font-bold">
                Saltar y preguntarle algo
              </button>
            </div>
          )}
        </div>

        {ajustes && (
          <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top)+4rem)] z-10 space-y-3 rounded-3xl bg-slate-950/90 p-4 shadow-2xl ring-1 ring-white/15 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <PortalZumi tam={64} traje={traje} />
              <p className="text-[14px] text-white/80">
                Hoy {NOMBRE} viste su traje <strong className="text-white">{TRAJES[traje]?.toLowerCase()}</strong>: se cambia solo según el clima.
              </p>
            </div>
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
            <Interruptor etiqueta="Leer en voz alta las alertas oficiales" inicial={leerAlertasEnVoz()} onCambiar={guardarLeerAlertas} />
            <Interruptor etiqueta="Modo narrador" detalle={`${NOMBRE} te cuenta el reporte cada vez que abres la app.`} inicial={modoNarrador()} onCambiar={guardarModoNarrador} />
            <button type="button" onClick={() => setAjustes(false)} className="min-h-11 w-full rounded-full bg-white/15 text-[15px] font-bold">
              Listo
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function Interruptor({ etiqueta, detalle, inicial, onCambiar }) {
  const [v, setV] = useState(inicial)
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 text-[15px]">
      <span>
        {etiqueta}
        {detalle && <span className="block text-[13px] text-white/65">{detalle}</span>}
      </span>
      <input
        type="checkbox"
        checked={v}
        onChange={(ev) => {
          setV(ev.target.checked)
          onCambiar(ev.target.checked)
        }}
        className="size-6"
      />
    </label>
  )
}
