// La portada de la app es ZUMI en persona: vive en su escenario (su casa de día, de noche o con lluvia;
// el estudio en rojo si hay alerta), te saluda al llegar, reacciona cuando lo tocas y está a un toque
// de una conversación por voz. El clima de ahora va encima, para leerlo de un vistazo.
import { useEffect, useMemo, useRef, useState } from 'react'
import ZumiCine from './ZumiCine'
import ZumiCharm from './ZumiCharm'
import { abrirFuncion } from './Funciones'
import { escenasReporte, nombrePreferido, paraVoz } from '../services/narrador'
import { precargarFrases } from '../services/vozZumi'
import { PELICULAS, consejoDelDia } from '../services/cine'
import { alertaPrincipal, NIVELES } from '../services/alertas'
import { fraseDeReencuentro, registrarVisita } from '../services/zumiMemoria'
import { viajar } from '../services/viajes'
import { compartirClima } from '../services/compartir'
import { activarMusica, alCambiarMusica } from '../services/musica'

// La visita de hoy se anota una sola vez por sesión (para saber si vuelves después de días).
let visitaDeHoy = null
const visita = () => (visitaDeHoy ??= registrarVisita())

const grados = (v) => `${Math.round(v)}°`

// Preguntas que se pueden hacer con un toque (ZUMI las responde hablando).
const PREGUNTAS = ['¿Va a llover mañana?', '¿Qué me pongo hoy?', '¿Hay alguna alerta?', '¿Cómo estará el fin de semana?']

// Franja de la escena que siempre se ve: de sus orejas a sus pies (con un poco de aire)
const ENCUADRE = [0.17, 0.72]

// Lo que dice cuando lo tocas (sin gastar voz: solo el globo y el gesto).
const REACCIONES = [
  ['¡Jaja, cosquillas no!', 'celebrar'],
  ['¡Aquí estoy! ¿Conversamos?', 'saludo'],
  ['¡Mira mi pelota!', 'pelota'],
  ['¡Pa\' la plaza! ¡A bailar cueca!', 'cueca'],
  ['Mmm… ¿qué quieres saber?', 'pensar'],
  ['¡Toca «Hablar con ZUMI» y pregúntame lo que quieras!', 'senalar'],
]

export function escenaDeZumi({ alertas, horas, ahora }, hora = new Date().getHours()) {
  // Escenario de emergencia solo con alerta Amarilla o mayor (la Temprana Preventiva es monitoreo)
  const p = alertas?.alertas && alertaPrincipal(alertas.alertas)
  if (p && NIVELES[p.nivel].gravedad >= 2) return 'alerta'
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
    const reencuentro = fraseDeReencuentro(visita(), { nombre: quien })
    return [`${hola}${quien ? `, ${quien}` : ''}!${visita().total > 1 ? '' : ' Soy ZUMI.'}`, ...(reencuentro ? [reencuentro] : []), ...cuerpo]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos.ahora?.temperatura, datos.ahora?.texto, datos.horas, datos.alertas, quien])

  const [musica, setMusica] = useState(true)
  useEffect(() => alCambiarMusica(setMusica), [])
  const [k, setK] = useState(0)
  const [reaccion, setReaccion] = useState(null) // texto del globo cuando lo tocas
  // Al llegar saluda; si hace mucho calor o frío, se cambia de ropa delante tuyo
  const tempAhora = datos.ahora?.temperatura
  const [gesto, setGesto] = useState(() => (escena === 'sala' && new Date().getMonth() === 8 && new Date().getDate() <= 20 ? 'cueca:inicio' : escena === 'sala' && tempAhora >= 27 ? 'verano:inicio' : escena === 'sala' && tempAhora <= 8 ? 'invierno:inicio' : 'saludo:inicio'))
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

  // Lluvia en minutos: ZUMI lo dice en su globo y señala la ventana (una vez por aviso).
  useEffect(() => {
    let avisado = null
    const f = (e) => {
      const r = e.detail
      const clave = `${r.estado}:${r.minutos}`
      if (avisado === clave) return
      avisado = clave
      setReaccion(r.estado === 'empieza' ? `¡Ojo! Empieza a llover en ${r.minutos} minutos. Lluvia ${r.intensidad}: lleva paraguas.` : `Está lloviendo${r.minutos ? ` y para en unos ${r.minutos} minutos` : ''}. ¡Abrígate!`)
      setGesto(`senalar:${Date.now()}`)
    }
    window.addEventListener('ac:lluvia-pronto', f)
    return () => window.removeEventListener('ac:lluvia-pronto', f)
  }, [])

  // Al llegar, ZUMI saluda; cada tanto hace algo con el cuerpo para sentirse vivo.
  useEffect(() => {
    const id = setInterval(() => setGesto(`${['curioso', 'senalar', 'saludo', 'pensar', 'curioso'][Math.floor(Math.random() * 5)]}:${Date.now()}`), 22000)
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
    // con alerta, ZUMI no festeja: tranquiliza
    setGesto(`${escena === 'alerta' ? 'calma' : g}:${Date.now()}`)
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

  // Alto exacto de la pantalla disponible: ZUMI ocupa todo lo que se ve, y al deslizar aparecen las funciones.
  const [alto, setAlto] = useState(0)
  useEffect(() => {
    const cont = raiz.current?.closest('#vista-ahora')
    if (!cont) return
    // el tamaño de letra «Grande» usa zoom: el alto se divide por ese zoom para calzar exacto
    const zoom = () => {
      let z = 1
      for (let x = raiz.current?.parentElement; x && x !== cont; x = x.parentElement) z *= parseFloat(getComputedStyle(x).zoom) || 1
      return z
    }
    const medir = () => cont.clientHeight && setAlto(Math.floor(cont.clientHeight / zoom()))
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(cont)
    return () => ro.disconnect()
  }, [])
  const bajar = () => raiz.current?.closest('#vista-ahora')?.scrollTo({ top: (alto || 600) - 8, behavior: 'smooth' })

  // Charm (ZUMI vivo, dibujado) o Cine (videos). Charm por defecto; se recuerda la elección.
  const [presencia, setPresencia] = useState(() => {
    try {
      return localStorage.getItem('ac:presencia-ahora') ?? 'charm'
    } catch {
      return 'charm'
    }
  })
  const charm = presencia === 'charm'
  const cambiarPresencia = (v) => {
    setPresencia(v)
    try {
      localStorage.setItem('ac:presencia-ahora', v)
    } catch {
      /* sin almacenamiento */
    }
  }
  const hudRef = useRef(null)
  const [hud, setHud] = useState(0)
  useEffect(() => {
    const el = hudRef.current
    if (!el) return
    const medir = () => setHud(el.offsetHeight)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const tocarCharm = () => {
    if (principal && NIVELES[principal.nivel]?.gravedad >= 2) return 'Estoy atento a la alerta. Toca «Hablar con ZUMI» y te explico qué hacer.'
    const [texto] = REACCIONES[toques.current % REACCIONES.length]
    toques.current += 1
    return texto
  }

  const consejo = consejoDelDia(datos)
  const ahora = datos.ahora
  const globo = reaccion ?? (principal ? `${NIVELES[principal.nivel].etiqueta}: ${principal.amenaza}. Tócame y te explico qué hacer.` : frases[k % frases.length])

  return (
    <section
      ref={raiz}
      aria-label="ZUMI, tu amigo del clima"
      className={`portada-zumi inmersiva relative -mx-4 -mt-3 overflow-hidden ${principal ? 'con-alerta' : ''} ${charm ? 'modo-charm' : ''}`}
      style={{ height: alto ? `${alto}px` : 'calc(100svh - 9rem)' }}
    >
      {charm ? (
        <div className="absolute inset-x-0 top-0 z-[2]" style={{ bottom: hud ? `${hud}px` : '16rem' }}>
          <ZumiCharm
            temperatura={ahora?.temperatura}
            llueve={escena === 'lluvia'}
            alerta={escena === 'alerta'}
            globo={globo}
            onTocar={tocarCharm}
            onPreguntar={onPreguntar}
            onAbrir={(f) => abrirFuncion(f)}
            onLlamar={onLlamar}
          />
        </div>
      ) : (
        <>
          {/* ZUMI a pantalla completa, cara a cara: la cámara se acerca y los controles van sobre el video */}
          <ZumiCine escena={escena} estado="reposo" gesto={gesto} posicion={[0.5, 0.45]} encuadre={ENCUADRE} zoom={1.1} zona={0.66} className="escenario-zumi-lienzo" />
          <div className="escenario-velo pointer-events-none absolute inset-0" aria-hidden="true" />
        </>
      )}

      {/* Cómo ver a ZUMI: Charm (vivo, dibujado en tiempo real) o Cine (videos) */}
      <div role="group" aria-label="Cómo ver a ZUMI" className="vidrio absolute top-3 left-[3.6rem] z-10 flex rounded-full p-1 text-[12.5px] font-semibold">
        {[
          ['charm', 'Charm'],
          ['cine', 'Cine'],
        ].map(([v, t]) => (
          <button key={v} type="button" aria-pressed={presencia === v} onClick={() => cambiarPresencia(v)} className={`min-h-9 rounded-full px-3 ${presencia === v ? 'bg-white text-black' : 'text-white/80'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Música de fondo: encender / apagar */}
      <button
        type="button"
        onClick={() => activarMusica(!musica)}
        aria-pressed={musica}
        aria-label={musica ? 'Apagar la música de fondo' : 'Encender la música de fondo'}
        className="vidrio absolute top-3 left-3 z-10 grid size-11 place-items-center rounded-full active:scale-95"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 18V5l11-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="17" cy="16" r="3" />
          {!musica && <path d="M3 3l18 18" />}
        </svg>
        {musica && <span className="nota-viva absolute -top-0.5 -right-0.5 size-2 rounded-full bg-vivo" aria-hidden="true" />}
      </button>

      {/* Tocar a ZUMI */}
      {!charm && <button type="button" onClick={tocarZumi} aria-label="Tocar a ZUMI" className="absolute inset-x-[20%] top-[14%] bottom-[44%] z-[1] rounded-[40%] focus-visible:outline-4" />}

      {/* Lo que dice ZUMI */}
      {!charm && <button
        type="button"
        onClick={() => (principal ? onLlamar() : reaccion ? setReaccion(null) : setK((x) => (x + 1) % frases.length))}
        className="globo-escenario absolute top-3 right-3 left-[30%] z-[2] rounded-3xl rounded-bl-md px-3.5 py-2 text-left text-[15px] leading-snug"
        aria-live="polite"
      >
        <span key={globo} className="globo-texto block">{globo}</span>
      </button>}

      {/* Telemetría y acciones, sobre el video */}
      <div ref={hudRef} className="portada-acciones hud-zumi absolute inset-x-0 bottom-0 z-[3] px-4 pb-1 text-white">
        <div className="mb-3 flex items-end justify-between gap-3">
          {ahora?.temperatura != null && (
            <p className="cifra text-[84px]" aria-label={`${Math.round(ahora.temperatura)} grados`}>
              {Math.round(ahora.temperatura)}
              <span className="align-top text-[44px] text-white/60">°</span>
            </p>
          )}
          <div className="min-w-0 pb-1.5 text-right">
            <p className="rotulo mb-1.5 flex items-center justify-end gap-2 !text-white/60">
              <span className="punto-vivo" aria-hidden="true" />
              {new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })} · Ahora
            </p>
            <p className="truncate text-[17px] font-semibold tracking-tight">{ahora?.texto}</p>
            {hoy && (
              <p className="mono mt-0.5 text-[12.5px] text-white/65">
                ↑{grados(hoy.max)} ↓{grados(hoy.min)}
                {ahora?.sensacion != null && Math.abs(ahora.sensacion - ahora.temperatura) >= 2 ? ` · ST ${grados(ahora.sensacion)}` : ''}
              </p>
            )}
          </div>
        </div>
        <div className="-mx-4 mb-2.5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <button type="button" onClick={() => viajar()} className="chip-escenario chip-viaje shrink-0">
            Viaja con ZUMI ↗
          </button>
          <button
            type="button"
            onClick={() => compartirClima({ escena, comuna: datos.comuna?.nombre ?? datos.nombreComuna, temperatura: ahora?.temperatura, texto: ahora?.texto, max: hoy?.max, min: hoy?.min, frase: frases[1] ?? frases[0] }).catch(() => {})}
            className="chip-escenario shrink-0"
          >
            Compartir
          </button>
          {escena === 'sala' && (
            <button type="button" onClick={() => (setReaccion('¡Pa\' la plaza! ¡A bailar cueca!'), setGesto(`cueca:${Date.now()}`))} className="chip-escenario shrink-0">
              Baila cueca
            </button>
          )}
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
            <button type="button" onClick={onLlamar} className="boton-primario flex-1 px-3 text-[17px] whitespace-nowrap">
              <span className="onda-zumi" aria-hidden="true">
                <i /><i /><i /><i />
              </span>
              Hablar con ZUMI
            </button>
          )}
          <button
            type="button"
            onClick={onEscuchar}
            aria-label="Escuchar el reporte de ZUMI"
            className={`boton-linea px-5 text-[16px] ${puedeLlamar ? '' : 'flex-1'}`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
            </svg>
            {puedeLlamar ? 'Reporte' : 'Escuchar a ZUMI'}
          </button>
        </div>
        <button type="button" onClick={bajar} className="rotulo mx-auto mt-1 flex min-h-7 items-center gap-1.5 !text-white/45" aria-label="Ver las funciones">
          Funciones
          <svg width="12" height="12" viewBox="0 0 12 12" className="flecha-baja" aria-hidden="true">
            <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </section>
  )
}
