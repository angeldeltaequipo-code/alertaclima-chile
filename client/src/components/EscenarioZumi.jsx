// La portada de la app es ZUMI en persona: vive en su escenario (su casa de día, de noche o con lluvia;
// el estudio en rojo si hay alerta), te saluda al llegar, reacciona cuando lo tocas y está a un toque
// de una conversación por voz. El clima de ahora va encima, para leerlo de un vistazo.
import { useEffect, useMemo, useRef, useState } from 'react'
import ZumiMarioneta from './ZumiMarioneta'
import { escenasReporte, nombrePreferido, paraVoz } from '../services/narrador'
import { precargarFrases } from '../services/vozZumi'
import { PELICULAS, consejoDelDia } from '../services/cine'
import { alertaPrincipal, NIVELES } from '../services/alertas'

const grados = (v) => `${Math.round(v)}°`

// Preguntas que se pueden hacer con un toque (ZUMI las responde hablando).
const PREGUNTAS = ['¿Va a llover mañana?', '¿Qué me pongo hoy?', '¿Hay alguna alerta?', '¿Cómo estará el fin de semana?']

// Lo que dice cuando lo tocas (sin gastar voz: solo el globo y el gesto).
const REACCIONES = [
  ['¡Jaja, cosquillas no!', 'celebrar'],
  ['¡Aquí estoy! ¿Conversamos?', 'saludo'],
  ['¡Mira mi pelota!', 'pelota'],
  ['Mmm… ¿qué quieres saber?', 'pensar'],
  ['¡Toca «Hablar con ZUMI» y pregúntame lo que quieras!', 'senalar'],
]

export function escenaDeZumi({ alertas, horas, ahora }, hora = new Date().getHours()) {
  if (alertas?.alertas && alertaPrincipal(alertas.alertas)) return 'alerta'
  const llueve = (horas ?? []).slice(0, 3).some((h) => (h.lluvia ?? 0) >= 0.5) || /lluv|chubas|tormenta|llovizna/i.test(ahora?.texto ?? '')
  if (llueve) return 'lluvia'
  return hora >= 20 || hora < 7 ? 'noche' : 'sala'
}

export default function EscenarioZumi({ datos, hoy, onLlamar, onEscuchar, onPreguntar, onPelicula, puedeLlamar = true }) {
  const escena = escenaDeZumi(datos)
  const principal = datos.alertas?.alertas && alertaPrincipal(datos.alertas.alertas)
  const quien = nombrePreferido() || datos.nombre?.split(' ')[0]

  // Lo que ZUMI cuenta del día, en frases cortas que van pasando en su globo.
  const frases = useMemo(() => {
    const e = escenasReporte({ ...datos, nombre: quien })
    const h = new Date().getHours()
    const hola = h >= 6 && h < 12 ? '¡Buenos días' : h >= 12 && h < 20 ? '¡Buenas tardes' : '¡Buenas noches'
    const cuerpo = e
      .slice(1, -1)
      .filter((x) => x.tarjeta?.tipo !== 'luna' && x.tarjeta?.tipo !== 'vecinos')
      .slice(0, 3)
      .map((x) => x.texto)
    return [`${hola}${quien ? `, ${quien}` : ''}! Soy ZUMI.`, ...cuerpo]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos.ahora?.temperatura, datos.ahora?.texto, datos.horas, datos.alertas, quien])

  const [k, setK] = useState(0)
  const [reaccion, setReaccion] = useState(null) // texto del globo cuando lo tocas
  const [gesto, setGesto] = useState('saludo:inicio')
  const toques = useRef(0)

  // El globo avanza solo; con alerta se queda en lo importante.
  useEffect(() => {
    if (reaccion) return
    const t = setTimeout(() => setK((x) => (x + 1) % frases.length), k === 0 ? 3500 : 6500)
    return () => clearTimeout(t)
  }, [k, frases.length, reaccion])
  useEffect(() => {
    if (!reaccion) return
    const t = setTimeout(() => setReaccion(null), 3200)
    return () => clearTimeout(t)
  }, [reaccion])

  // Al llegar, ZUMI saluda; cada tanto hace algo con el cuerpo para sentirse vivo.
  useEffect(() => {
    const id = setInterval(() => setGesto(`${['pelota', 'senalar', 'saludo'][Math.floor(Math.random() * 3)]}:${Date.now()}`), 26000)
    return () => clearInterval(id)
  }, [])

  // La voz del reporte se prepara en segundo plano: al tocar «Escuchar», habla de inmediato.
  const claveVoz = frases.join('|')
  useEffect(() => {
    const t = setTimeout(() => precargarFrases(escenasReporte({ ...datos, nombre: quien }).map((x) => paraVoz(x.texto)), 2), 4000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveVoz])

  const tocarZumi = () => {
    const [texto, g] = REACCIONES[toques.current % REACCIONES.length]
    toques.current += 1
    setReaccion(texto)
    setGesto(`${g}:${Date.now()}`)
    navigator.vibrate?.(12)
  }

  // Mientras ZUMI está en pantalla, el botón flotante sobra; aparece cuando bajas y él queda atrás.
  const raiz = useRef(null)
  useEffect(() => {
    const el = raiz.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => window.dispatchEvent(new CustomEvent('zumi-escenario', { detail: e.isIntersecting && e.intersectionRatio > 0.25 })), { threshold: [0, 0.25, 0.5] })
    io.observe(el)
    return () => {
      io.disconnect()
      window.dispatchEvent(new CustomEvent('zumi-escenario', { detail: false }))
    }
  }, [])

  const consejo = consejoDelDia(datos)
  const ahora = datos.ahora
  const globo = reaccion ?? (principal ? `${NIVELES[principal.nivel].etiqueta}: ${principal.amenaza}. Tócame y te explico qué hacer.` : frases[k % frases.length])

  return (
    <section ref={raiz} aria-label="ZUMI, tu amigo del clima" className={`portada-zumi relative -mx-4 -mt-3 h-[min(68dvh,580px)] min-h-[440px] overflow-hidden ${principal ? 'con-alerta' : ''}`}>
      <ZumiMarioneta escena={escena} estado="reposo" gesto={gesto} posicion={[0.5, 0.2]} peliculas={false} className="escenario-zumi-lienzo" />
      <div className="escenario-velo pointer-events-none absolute inset-0" aria-hidden="true" />

      {/* Tocar a ZUMI: zona central (no tapa los botones) */}
      <button type="button" onClick={tocarZumi} aria-label="Tocar a ZUMI" className="absolute inset-x-[18%] top-[30%] bottom-[34%] rounded-[40%] focus-visible:outline-4" />

      {/* Clima de ahora */}
      <div className="pointer-events-none absolute top-3 left-4 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.55)]">
        {ahora?.temperatura != null && <p className="text-[64px] leading-none font-black tracking-tight">{grados(ahora.temperatura)}</p>}
        <p className="mt-1 text-[18px] font-bold">{ahora?.texto}</p>
        {hoy && (
          <p className="text-[15px] font-semibold opacity-90">
            Máx. {grados(hoy.max)} · Mín. {grados(hoy.min)}
            {ahora?.sensacion != null && Math.abs(ahora.sensacion - ahora.temperatura) >= 2 ? ` · Se siente ${grados(ahora.sensacion)}` : ''}
          </p>
        )}
      </div>

      {/* Lo que dice ZUMI */}
      <button
        type="button"
        onClick={() => (principal ? onLlamar() : reaccion ? setReaccion(null) : setK((x) => (x + 1) % frases.length))}
        className="globo-escenario absolute top-[7.6rem] right-3 left-[47%] rounded-3xl rounded-bl-md px-3.5 py-2 text-left text-[15px] leading-snug font-bold"
        aria-live="polite"
      >
        <span key={globo} className="globo-texto block">{globo}</span>
      </button>

      {/* Acciones */}
      <div className="absolute inset-x-0 bottom-0 px-4 pb-4">
        <div className="-mx-4 mb-2.5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {consejo && onPelicula && (
            <button type="button" onClick={() => onPelicula(consejo)} className="chip-escenario shrink-0">
              ▶ {PELICULAS[consejo].titulo}
            </button>
          )}
          {PREGUNTAS.map((p) => (
            <button key={p} type="button" onClick={() => onPreguntar(p)} className="chip-escenario shrink-0">
              {p}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {puedeLlamar && (
            <button type="button" onClick={onLlamar} className="flex min-h-15 flex-1 items-center justify-center gap-2 rounded-full bg-emerald-400 px-3 text-[18px] font-black whitespace-nowrap text-slate-950 shadow-[0_8px_24px_rgba(16,185,129,.45)] active:scale-[0.98]">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z" />
              </svg>
              Hablar con ZUMI
            </button>
          )}
          <button
            type="button"
            onClick={onEscuchar}
            aria-label="Escuchar el reporte de ZUMI"
            className={`flex min-h-15 items-center justify-center gap-1.5 rounded-full bg-white/90 px-4 text-[16px] font-bold text-slate-900 shadow-lg active:scale-[0.98] ${puedeLlamar ? '' : 'flex-1'}`}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
            </svg>
            {puedeLlamar ? 'Reporte' : 'Escuchar a ZUMI'}
          </button>
        </div>
      </div>
    </section>
  )
}
