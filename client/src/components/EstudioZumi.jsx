// El estudio de ZUMI a pantalla completa: ZUMI presenta el reporte en su estudio (el video cambia
// según lo que cuenta: saludo, pronóstico o alerta), aparecen paneles holográficos con los datos
// de cada frase, subtítulos grandes, y al final se puede conversar con él (escribiendo o hablando).
import { useEffect, useMemo, useRef, useState } from 'react'
import IconoClima from './IconoClima'
import PortalZumi from './PortalZumi'
import ZumiCine from './ZumiCine'
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
import { PELICULAS, consejoDelDia, frasePelicula, peliculaPara, vistaHoy, yaVista } from '../services/cine'
import { NIVELES, alertaPrincipal } from '../services/alertas'
import { NARRADOR } from '../services/viajes'
import { emocionDe } from '../services/zumiEmocion'


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

export default function EstudioZumi({ datos, nombreCuenta, conCuenta, traje = 'presentador', escenasIniciales, peliculaInicial = null, inicio = null, onCerrar }) {
  const e = useNarrador()
  const ref = useRef(null)
  const [nombre, setNombre] = useState(nombrePreferido)
  const quien = nombre || nombreCuenta
  // El reporte de ZUMI, con sus películas donde corresponde: la primera vez se presenta actuando, y si
  // hoy llueve o hace calor, actúa el consejo (una vez al día). Así todo es el mismo personaje.
  const escenas = useMemo(() => {
    if (peliculaInicial && PELICULAS[peliculaInicial]) return [{ ...frasePelicula(peliculaInicial), tarjeta: null, clip: 'estudio' }]
    const base = escenasIniciales ?? escenasReporte({ ...datos, nombre: quien })
    if (escenasIniciales) return base
    const lista = [...base]
    if (!yaVista('hola') && lista[0]?.tarjeta?.tipo === 'saludo') lista[0] = { ...lista[0], ...frasePelicula('hola') }
    const consejo = consejoDelDia(datos)
    if (consejo && !vistaHoy(consejo)) {
      const k = lista.findIndex((x) => ['lluvia', 'minmax', 'temp'].includes(x.tarjeta?.tipo))
      lista.splice(k >= 0 ? k + 1 : lista.length - 1, 0, { ...frasePelicula(consejo), tarjeta: null, clip: 'estudio' })
    }
    return lista
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const textos = useMemo(() => escenas.map((x) => (x.pelicula ? { texto: x.texto, pelicula: x.pelicula } : x.texto)), [escenas])
  const [silencio, setSilencio] = useState(() => vozSilenciada() || !vozDisponible())
  const [conversa, setConversa] = useState(false)
  const [pregunta, setPregunta] = useState('')
  const [ultima, setUltima] = useState(null) // { pregunta, texto, fuente }
  const [pensando, setPensando] = useState(false)
  const [escuchando, setEscuchando] = useState(false)
  const [ajustes, setAjustes] = useState(false)
  // Modo llamada: como una llamada de voz con un asistente. ZUMI habla, te escucha solo y vuelve a responder.
  const [llamada, setLlamada] = useState(false)
  const [inicioLlamada, setInicioLlamada] = useState(0)
  const silenciosLlamada = useRef(0)
  // Como en Muse: eliges cuánto se ve ZUMI (cara a cara o solo voz), lo puedes interrumpir hablando
  // y reacciona mientras le hablas.
  const [presencia, setPresencia] = useState(() => {
    try {
      return localStorage.getItem('ac:zumi:presencia') === 'voz' ? 'voz' : 'cara'
    } catch {
      return 'cara'
    }
  })
  const cambiarPresencia = () => {
    const v = presencia === 'cara' ? 'voz' : 'cara'
    setPresencia(v)
    try {
      localStorage.setItem('ac:zumi:presencia', v)
    } catch {
      /* sin almacenamiento */
    }
  }
  const [oido, setOido] = useState('') // lo que vas diciendo, en vivo
  const [gestoOido, setGestoOido] = useState(null)
  const ultimoAsentir = useRef(0)
  const vigia = useRef(false) // escucha mientras ZUMI habla, para poder interrumpirlo
  const historial = useRef([])
  const reconocedor = useRef(null)

  const enReporte = e.frases === textos
  const i = enReporte ? e.frase : -1
  const escena = i >= 0 ? escenas[i] : null
  const respondiendo = ultima && e.hablando && e.frases.length > 0 && e.frases !== textos && e.frases.map((x) => (typeof x === 'string' ? x : x?.texto)).join(' ') === ultima.texto
  const terminado = !e.hablando

  useEffect(() => {
    const previo = document.activeElement
    ref.current?.focus()
    // Desde la portada: llamada directa o una pregunta ya hecha; si no, el reporte.
    if (inicio?.modo === 'llamada') {
      if (SR) llamar()
      else {
        setConversa(true)
        hablar(enTrozos('¡Hola! ¡Aquí ZUMI! Escríbeme lo que quieras saber.'), { silencio })
      }
    } else if (inicio?.pregunta) preguntar(inicio.pregunta)
    else hablar(textos, { silencio })
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
    // Temas que ZUMI explica actuando (sismo, mochila, calor, lluvia, quién es): responde con su película.
    const peli = peliculaPara(q)
    if (peli) {
      const f = frasePelicula(peli)
      historial.current = [...historial.current, { rol: 'persona', texto: q }, { rol: 'zumi', texto: f.texto }].slice(-6)
      setPensando(false)
      setUltima({ pregunta: q, texto: f.texto, fuente: 'zumi' })
      hablar([f], { silencio })
      return
    }
    const r = await preguntarZumi(q, { ...datos, nombre: quien }, historial.current, { conCuenta })
    historial.current = [...historial.current, { rol: 'persona', texto: q }, { rol: 'zumi', texto: r.texto }].slice(-6)
    setPensando(false)
    setUltima({ pregunta: q, ...r, texto: enTrozos(r.texto).join(' ') })
    hablar(enTrozos(r.texto), { silencio })
  }

  const SR = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null
  // En iPhone, abrir el micrófono mientras suena la voz la baja de volumen: ahí se interrumpe tocando a ZUMI.
  const IOS = typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent)
  const escuchar = ({ interrumpir = false } = {}) => {
    if (!SR) return
    if (escuchando) {
      reconocedor.current?.stop()
      return
    }
    if (!interrumpir) callar()
    vigia.current = interrumpir
    const r = new SR()
    r.lang = 'es-CL'
    r.interimResults = true
    r.maxAlternatives = 1
    let oyo = false
    let corto = !interrumpir
    r.onresult = (ev) => {
      const t = Array.from(ev.results)
        .map((x) => x[0].transcript)
        .join(' ')
        .trim()
      if (!t) return
      // Mientras ZUMI habla, el micrófono también lo oye a él: solo cuenta si son palabras tuyas.
      if (!corto) {
        if (t.split(/\s+/).length < 2 || esEco(t, e.frases)) return
        corto = true
        vigia.current = false
        callar()
      }
      setOido(t)
      setPregunta(t)
      // ZUMI asiente mientras te escucha
      if (Date.now() - ultimoAsentir.current > 2600) {
        ultimoAsentir.current = Date.now()
        setGestoOido(`curioso:${Date.now()}`)
      }
      if (ev.results[ev.results.length - 1].isFinal) {
        oyo = true
        silenciosLlamada.current = 0
        setOido('')
        preguntar(t)
      }
    }
    const fin = (ev) => {
      setEscuchando(false)
      vigia.current = false
      setOido('')
      if (oyo || !corto) return
      if (ev?.error === 'not-allowed' || ev?.error === 'service-not-allowed') return colgar('Necesito permiso para usar el micrófono. Puedes escribirme cuando quieras.')
      silenciosLlamada.current += 1
    }
    r.onend = fin
    r.onerror = fin
    reconocedor.current = r
    setEscuchando(true)
    try {
      r.start()
    } catch {
      setEscuchando(false)
    }
  }
  // Tocar a ZUMI mientras habla: se calla y te escucha (como interrumpir a alguien en una llamada).
  const interrumpir = () => {
    if (!llamada) return
    reconocedor.current?.abort?.()
    callar()
    setTimeout(() => escuchar(), 120)
  }

  const llamar = () => {
    reconocedor.current?.stop()
    silenciosLlamada.current = 0
    setConversa(true)
    const saludo = `¡Hola${quien ? `, ${quien}` : ''}! ¡Aquí ZUMI, listo y con las orejas paradas! Cuéntame, ¿qué quieres saber?`
    setUltima({ pregunta: null, texto: saludo, fuente: 'zumi' })
    setLlamada(true)
    setInicioLlamada(Date.now())
    hablar(enTrozos(saludo), { silencio })
  }
  const colgar = (despedida = '¡Fue genial hablar contigo! Aquí estaré cuando me necesites. ¡Chao, chao!') => {
    setLlamada(false)
    reconocedor.current?.stop()
    setUltima({ pregunta: null, texto: despedida, fuente: 'zumi' })
    hablar(enTrozos(despedida), { silencio })
  }
  // Turnos de la llamada: cuando ZUMI termina de hablar, vuelve a escuchar solo.
  useEffect(() => {
    // Mientras ZUMI habla, el oído queda abierto para que lo puedas interrumpir hablando.
    if (llamada && SR && !IOS && e.hablando && !pensando && !escuchando) {
      const t = setTimeout(() => escuchar({ interrumpir: true }), 700)
      return () => clearTimeout(t)
    }
    if (!llamada || !SR || e.hablando || pensando || escuchando) return
    if (silenciosLlamada.current >= 3) {
      silenciosLlamada.current = 0
      colgar('¿Hola? Parece que te fuiste. ¡Te dejo tranquilo! Llámame cuando quieras.')
      return
    }
    const t = setTimeout(() => escuchar(), silenciosLlamada.current ? 300 : 650)
    return () => clearTimeout(t)
  })

  const cambiarSilencio = () => {
    const v = !silencio
    setSilencio(v)
    guardarVozSilenciada(v)
    if (e.hablando) hablar(e.frases.slice(Math.max(0, e.frase)), { silencio: v })
  }

  // Director de escena: dónde está ZUMI según la hora, el clima, las alertas y el tema de la frase.
  const hora = new Date().getHours()
  const llueve = (datos.horas ?? []).slice(0, 3).some((h) => (h.lluvia ?? 0) >= 0.5) || /lluv|chubas|tormenta|llovizna/i.test(datos.ahora?.texto ?? '')
  const base = hora >= 20 || hora < 7 ? 'noche' : llueve ? 'lluvia' : 'sala'
  const hayAlerta = escena?.clip === 'alerta' || (NIVELES[(datos.alertas?.alertas && alertaPrincipal(datos.alertas.alertas))?.nivel]?.gravedad ?? 0) >= 2
  // Un solo lugar durante todo el reporte (cambiar de set a mitad de frase rompía la continuidad):
  // su casa según la hora y el clima, o el estudio en rojo si hay una alerta oficial.
  const escenario = hayAlerta ? 'alerta' : base
  const enPantalla = escenario === 'estudio' || escenario === 'alerta'
  // Lo que hace con el cuerpo según lo que cuenta (la clave cambia en cada frase para repetir el gesto)
  const GESTO_DE = { saludo: 'saludo', ok: 'celebrar', lluvia: 'senalar', temp: 'senalar', minmax: 'caminar', viento: 'senalar', alerta: 'calma', sismo: 'calma', aluvion: 'calma', vecinos: 'caminar', luna: 'senalar' }
  // Al responder, ZUMI reacciona con la emoción que corresponde (se alegra, advierte, piensa, se pone serio…)
  const reaccion = respondiendo && ultima ? emocionDe(ultima.pregunta, ultima.texto, escenario) : null
  const gestoEscena = escuchando && !vigia.current && gestoOido ? gestoOido : respondiendo ? (reaccion?.toma ? `${reaccion.toma}:${ultima?.pregunta}` : null) : escena?.tarjeta?.tipo && GESTO_DE[escena.tarjeta.tipo] ? `${GESTO_DE[escena.tarjeta.tipo]}:${i}` : i === -1 && conversa && !e.hablando ? 'reposo' : null

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
      <div className="absolute inset-0 bg-black" aria-hidden="true" />

      <div className="relative h-full w-full max-w-[min(100vw,calc(100dvh*0.62))] overflow-hidden">
        {/* ZUMI en su estudio: video con calidad de película animada, que cambia según lo que pasa */}
        {/* ZUMI presentador: el escenario cambia según el clima, la hora, las alertas y lo que cuenta */}
        {presencia === 'cara' ? (
          <ZumiCine
            peliculas
            escena={escenario}
            estado={pensando ? 'pensando' : e.sonando ? 'hablando' : escuchando && !vigia.current ? 'escuchando' : 'reposo'}
            gesto={gestoEscena}
            posicion={[0.5, 0.3]}
            pantalla={enPantalla ? <div className="holo-en-pantalla">{!conversa && <Holograma t={escena?.tarjeta} />}</div> : null}
          />
        ) : (
          <Orbe estado={pensando ? 'pensando' : e.hablando ? 'hablando' : escuchando && !vigia.current ? 'escuchando' : 'reposo'} />
        )}
        {/* En llamada, tocar a ZUMI mientras habla lo interrumpe */}
        {llamada && e.hablando && (
          <button type="button" onClick={interrumpir} aria-label="Interrumpir a ZUMI y hablar" className="absolute inset-x-0 top-[18%] bottom-[38%] z-[1]" />
        )}
        <div className="estudio-velo absolute inset-0" aria-hidden="true" />

        {/* Barra superior */}
        <div className="safe-top absolute inset-x-0 top-0 flex items-center gap-2 px-4 pt-3">
          <span className="en-vivo rotulo flex min-h-9 items-center gap-2 rounded-full px-3 whitespace-nowrap !text-white">
            <span className="punto-vivo" aria-hidden="true" /> {NOMBRE} · en vivo
            {llamada && <Cronometro desde={inicioLlamada} />}
          </span>
          <span className="flex-1" />
          <button type="button" onClick={cambiarPresencia} aria-label={presencia === 'cara' ? 'Pasar a solo voz' : 'Ver a ZUMI cara a cara'} className="boton-vidrio grid size-11 place-items-center rounded-full">
            {presencia === 'cara' ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <circle cx="12" cy="12" r="8.5" opacity=".5" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="6" width="13" height="12" rx="2.5" />
                <path d="M16 10.5l5-3v9l-5-3" />
              </svg>
            )}
          </button>
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
          {!conversa && !enPantalla && <Holograma t={escena?.tarjeta} />}
        </div>

        {/* Subtítulos y conversación */}
        <div className="safe-bottom absolute inset-x-0 bottom-0 px-4 pb-4">
          {conversa && ultima?.pregunta && (
            <p className="mb-2 ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-white/90 px-3 py-2 text-[15px] font-medium text-black">{ultima.pregunta}</p>
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

          {llamada && oido && (
            <p className="oido-vivo mt-2 text-right text-[17px] leading-snug font-medium text-white/80" aria-live="polite">
              <span className="rotulo mr-2 !text-white/65">Tú</span>
              {oido}
            </p>
          )}
          {llamada && (
            <div className="llamada-zumi mt-4">
              <p className="rotulo mb-3 flex items-center justify-center gap-2 !text-white/70" aria-live="polite">
                <span className={`ondas-estado ${pensando ? 'pensando' : e.hablando ? 'hablando' : escuchando && !vigia.current ? 'escuchando' : ''}`} aria-hidden="true">
                  <i /><i /><i /><i /><i />
                </span>
                {pensando ? 'Pensando' : e.hablando ? (IOS ? 'Hablando · toca para interrumpir' : 'Hablando · interrúmpelo cuando quieras') : escuchando ? 'Te escucho' : 'En llamada'}
              </p>
              <div className="flex items-center justify-center gap-5">
                <button
                  type="button"
                  onClick={() => (e.hablando ? interrumpir() : escuchar())}
                  aria-label={escuchando && !vigia.current ? 'Dejar de escuchar' : 'Hablar ahora'}
                  className={`grid size-15 place-items-center rounded-full ${escuchando && !vigia.current ? 'bg-white text-black' : 'boton-vidrio'}`}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                    <rect x="9" y="3" width="6" height="11" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                  </svg>
                </button>
                <button type="button" onClick={() => colgar()} aria-label="Colgar la llamada" className="grid size-17 place-items-center rounded-full bg-[#ff3b30] shadow-[0_8px_30px_rgb(255_59_48/0.45)] active:scale-95">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 9c-2.5 0-4.9.5-7.1 1.4-.7.3-1 1-1 1.7v2.4c0 .7.6 1.2 1.3 1.1l3-.6c.6-.1 1-.6 1-1.2v-1.7a12 12 0 0 1 5.6 0v1.7c0 .6.4 1.1 1 1.2l3 .6c.7.1 1.3-.4 1.3-1.1v-2.4c0-.7-.3-1.4-1-1.7C16.9 9.5 14.5 9 12 9z" />
                  </svg>
                </button>
                <button type="button" onClick={cambiarPresencia} aria-label={presencia === 'cara' ? 'Pasar a solo voz' : 'Ver a ZUMI cara a cara'} className="boton-vidrio grid size-15 place-items-center rounded-full">
                  <span className="mono text-[10px] tracking-[0.08em]">{presencia === 'cara' ? 'VOZ' : 'CARA'}</span>
                </button>
              </div>
            </div>
          )}
          {conversa && !llamada && (
            <div className="mt-3">
              {SR && !pensando && !e.hablando && (
                <button type="button" onClick={llamar} className="boton-primario mb-2 w-full text-[16px]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z" />
                  </svg>
                  Llamar a ZUMI
                </button>
              )}
              {!pensando && !e.hablando && (
                <div className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1">
                  {!ultima && (
                    <button type="button" onClick={() => hablar(textos, { silencio })} className="boton-vidrio min-h-10 shrink-0 rounded-full px-3 text-[14px] font-bold">
                      ↻ Repetir el reporte
                    </button>
                  )}
                  {[...SUGERENCIAS.slice(0, 2), '¿Qué hago si tiembla?', '¿Qué llevo en la mochila de emergencia?', ...SUGERENCIAS.slice(2)].map((s) => (
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
                    onClick={() => escuchar()}
                    aria-pressed={escuchando}
                    aria-label={escuchando ? 'Dejar de escuchar' : `Hablarle a ${NOMBRE}`}
                    className={`grid size-13 shrink-0 place-items-center rounded-full ${escuchando ? 'microfono-activo bg-white text-black' : 'boton-vidrio'}`}
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                      <rect x="9" y="3" width="6" height="11" rx="3" />
                      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                    </svg>
                  </button>
                )}
                <button type="submit" disabled={!pregunta.trim() || pensando} aria-label="Preguntar" className="grid size-13 shrink-0 place-items-center rounded-full bg-white text-black disabled:opacity-40">
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
              {SR && (
                <button type="button" onClick={llamar} className="boton-primario min-h-12 flex-1 text-[15px]">
                  Llamar a ZUMI
                </button>
              )}
            </div>
          )}
        </div>

        {ajustes && (
          <div className="vidrio absolute inset-x-4 top-[calc(env(safe-area-inset-top)+4rem)] z-10 space-y-3 rounded-3xl p-4">
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

/**
 * Corta una respuesta en frases cortas: la voz de cada una se pide aparte (y en paralelo con la que
 * suena), así ZUMI empieza a hablar mucho antes, como en una llamada real.
 */
export function enTrozos(texto) {
  const partes = String(texto ?? '').match(/[^.!?¡¿]*[¡¿]?[^.!?]*[.!?]+["»)]?|[^.!?]+$/g)?.map((x) => x.trim()).filter(Boolean) ?? []
  const out = []
  for (const p of partes) {
    const ult = out.at(-1)
    if (ult && (ult.length < 28 || p.length < 14)) out[out.length - 1] = `${ult} ${p}`
    else out.push(p)
  }
  return out.length ? out : [String(texto ?? '')]
}

/** Tiempo de llamada (mm:ss), como en el teléfono. */
function Cronometro({ desde }) {
  const [, setT] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setT((x) => x + 1), 1000)
    return () => clearInterval(id)
  }, [])
  const s = Math.max(0, Math.floor((Date.now() - desde) / 1000))
  return <span className="ml-1 text-white/60 tabular-nums">{`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`}</span>
}

/** ¿Lo que oyó el micrófono es la propia voz de ZUMI? (la mayoría de las palabras están en lo que dice) */
function esEco(oido, frases) {
  const norma = (x) =>
    String(x ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9ñ\s]/g, ' ')
  const dice = new Set(norma((frases ?? []).map((f) => (typeof f === 'string' ? f : f?.texto)).join(' ')).split(/\s+/).filter(Boolean))
  const palabras = norma(oido).split(/\s+/).filter((w) => w.length > 2)
  if (!palabras.length) return true
  return palabras.filter((w) => dice.has(w)).length / palabras.length > 0.5
}

/** Modo «solo voz»: un orbe que respira con la conversación (ZUMI al centro). */
function Orbe({ estado }) {
  return (
    <div className={`orbe-zumi orbe-${estado} absolute inset-0 grid place-items-center`} aria-hidden="true">
      <div className="orbe-halo" />
      <div className="orbe-anillo" />
      <div className="orbe-anillo orbe-anillo-2" />
      <div className="orbe-nucleo">
        <img src={NARRADOR.avatar} alt="" width="120" height="120" className="size-full rounded-full object-cover" />
      </div>
    </div>
  )
}
