// ZUMI en video, sin marioneta: liviano y al instante. Muestra su foto de reposo mientras carga (es el
// mismo primer cuadro del video), luego el video vivo; los gestos y las tomas hablando se cargan solo
// cuando se necesitan. Nada de WebGL ni dibujos: el teléfono solo reproduce un video a la vez.
//
// Mismo encuadre que la marioneta: «posicion» decide qué parte de la escena se ve cuando sobra, y
// «encuadre» [y0, y1] garantiza que esa franja de la escena (orejas a pies) siempre quede visible.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ESCENA, ESPECIALES, POSTER, RUTA_VIDEOS, VIDEOS, ahorroDatos } from '../services/zumiVideos'
import { alDetenerPelicula, registrarPelicula } from '../services/narrador'
import { RUTA_CINE, marcarVista } from '../services/cine'

// Pantalla del estudio (donde aparecen los datos), en fracciones de la escena.
const PANTALLA = { estudio: [0.46, 0.235, 0.52, 0.26], alerta: [0.46, 0.235, 0.52, 0.26] }

function caja(cw, ch, posicion, encuadre) {
  const { ancho, alto } = ESCENA
  let k = Math.max(cw / ancho, ch / alto)
  let ox = (cw - ancho * k) * posicion[0]
  let oy = (ch - alto * k) * posicion[1]
  let relleno = false
  if (encuadre) {
    const y0 = encuadre[0] * alto
    const y1 = encuadre[1] * alto
    if ((y1 - y0) * k > ch) {
      k = ch / (y1 - y0)
      ox = (cw - ancho * k) / 2
      oy = -y0 * k
      relleno = true
    } else oy = Math.min(0, Math.max(ch - alto * k, -y0 * k + (ch - (y1 - y0) * k) / 2))
  }
  return { left: ox, top: oy, width: ancho * k, height: alto * k, relleno }
}

export default function ZumiCine({ escena = 'sala', estado = 'reposo', gesto = null, posicion = [0.5, 0.3], encuadre = null, className = '', peliculas = false, pantalla = null }) {
  const peli = useRef(null)
  const [enPelicula, setEnPelicula] = useState(false)
  const actual = useRef(null)

  // Películas de ZUMI (con su voz): se reproducen encima; al terminar vuelve el video vivo.
  useEffect(() => {
    if (!peliculas) return
    const terminar = (ok) => {
      const p = actual.current
      actual.current = null
      setEnPelicula(false)
      const v = peli.current
      if (v) {
        v.pause()
        v.onended = null
      }
      p?.ok(ok)
    }
    const quitar = registrarPelicula(
      (id, { silencio = false } = {}) =>
        new Promise((ok) => {
          const v = peli.current
          if (!v) return ok(false)
          actual.current?.ok(true)
          actual.current = { id, ok }
          marcarVista(id)
          v.src = `${RUTA_CINE}${id}.mp4`
          v.muted = silencio
          v.currentTime = 0
          v.onended = () => terminar(true)
          v.onerror = () => terminar(false)
          v.play()
            .then(() => setEnPelicula(true))
            .catch(() => terminar(false))
        }),
    )
    alDetenerPelicula(() => actual.current && terminar(true))
    return () => {
      quitar()
      alDetenerPelicula(null)
    }
  }, [peliculas])

  const raiz = useRef(null)
  const capas = useRef({})
  const [medida, setMedida] = useState(null)
  const [listo, setListo] = useState(false) // el video de reposo ya se ve
  const [activo, setActivo] = useState(null) // gesto o toma hablando que se ve encima
  const visible = useRef(true)
  const lista = VIDEOS[escena] ?? []
  const ahorro = ahorroDatos()

  useLayoutEffect(() => {
    const el = raiz.current
    if (!el) return
    const medir = () => setMedida({ w: el.clientWidth, h: el.clientHeight })
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => setListo(false), [escena])

  // Ya con ZUMI vivo en pantalla, se deja lista una toma hablando y su saludo (para responder al tiro).
  useEffect(() => {
    if (!listo) return
    const t = setTimeout(() => {
      for (const n of [lista.find((x) => x.startsWith('habla')), 'saludo', 'pensar']) {
        const v = n && capas.current[n]
        if (v && v.readyState === 0 && v.networkState !== 2) {
          v.preload = 'auto'
          v.load()
        }
      }
    }, 1200)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, escena])

  // Fuera de pantalla, el video se pausa (batería).
  useEffect(() => {
    const el = raiz.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => {
      visible.current = e.isIntersecting
      const v = capas.current.reposo
      if (!v) return
      if (e.isIntersecting && !activo) v.play().catch(() => {})
      else v.pause()
    })
    io.observe(el)
    return () => io.disconnect()
  }, [activo])

  // Reproduce un video encima (gesto u hablar). Si aún no está cargado, lo carga y parte apenas puede.
  const reproducir = (nombre, { desde = 0 } = {}) => {
    const v = capas.current[nombre]
    if (!v) return false
    const partir = () => {
      try {
        v.currentTime = desde
      } catch {
        /* sin cargar aún */
      }
      v.play().catch(() => {})
      setActivo(nombre)
    }
    if (v.readyState >= 2) partir()
    else {
      v.preload = 'auto'
      v.addEventListener('canplay', partir, { once: true })
      if (v.networkState !== 2) v.load()
    }
    return true
  }

  // Gestos pedidos desde afuera («saludo:123»). Si esta escena no tiene ese gesto filmado, hace otro.
  useEffect(() => {
    if (!gesto || estado === 'hablando') return
    let g = String(gesto).split(':')[0]
    const gestos = lista.filter((n) => n !== 'reposo' && !n.startsWith('habla') && !ESPECIALES.includes(n) && !/\d$/.test(n))
    if (!lista.includes(g)) g = gestos.includes('saludo') && Math.random() < 0.5 ? 'saludo' : gestos[Math.floor(Math.random() * gestos.length)]
    // variantes filmadas del mismo gesto (saludo, saludo2…): una al azar
    const variantes = lista.filter((n) => n === g || (n.startsWith(g) && /^\d+$/.test(n.slice(g.length))))
    if (variantes.length > 1) g = variantes[Math.floor(Math.random() * variantes.length)]
    if (g) reproducir(g)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gesto])

  // Hablando: tomas de él conversando, encadenadas al azar mientras dure la voz.
  const hablando = estado === 'hablando'
  const tomas = lista.filter((n) => n.startsWith('habla'))
  useEffect(() => {
    if (hablando && tomas.length) {
      const n = tomas[Math.floor(Math.random() * tomas.length)]
      reproducir(n, { desde: 0.2 })
    } else if (!hablando && activo?.startsWith('habla')) setActivo(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hablando])

  // Pensando: se toca la barbilla (al instante, mientras llega la respuesta).
  const piensa = estado === 'pensando'
  useEffect(() => {
    if (piensa && lista.includes('pensar')) reproducir('pensar', { desde: 0.3 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [piensa])

  const alTerminar = (nombre) => {
    if (activo !== nombre) return
    if (nombre === 'pensar' && estado === 'pensando') return reproducir('pensar', { desde: 0.3 })
    if (hablando && nombre.startsWith('habla') && tomas.length) {
      const otras = tomas.filter((t) => t !== nombre)
      const n = (otras.length ? otras : tomas)[Math.floor(Math.random() * (otras.length || tomas.length))]
      if (!reproducir(n, { desde: 0.2 })) setActivo(null)
    } else setActivo(null)
  }

  // El reposo descansa (pausado) mientras otro video lo tapa: un solo video decodificando a la vez.
  useEffect(() => {
    const v = capas.current.reposo
    if (!v) return
    if (activo) {
      const t = setTimeout(() => v.pause(), 250)
      return () => clearTimeout(t)
    }
    if (visible.current) v.play().catch(() => {})
  }, [activo])

  // La toma hablando que quedó cargando ya no se ve: se pausa.
  useEffect(() => {
    for (const [n, v] of Object.entries(capas.current)) if (v && n !== 'reposo' && n !== activo && !v.paused) setTimeout(() => n !== activo && v.pause(), 250)
  }, [activo])

  const c = medida ? caja(medida.w, medida.h, posicion, encuadre) : null
  const pr = c && PANTALLA[escena]
  const rect = pr ? [Math.max(8, c.left + pr[0] * c.width), c.top + pr[1] * c.height, Math.min(medida.w - 8, c.left + (pr[0] + pr[2]) * c.width) - Math.max(8, c.left + pr[0] * c.width), pr[3] * c.height] : null
  const estilo = c ? { left: c.left, top: c.top, width: c.width, height: c.height } : { inset: 0, width: '100%', height: '100%' }

  return (
    <div ref={raiz} className={`zumi-cine absolute inset-0 overflow-hidden bg-[#1b1410] ${className}`}>
      {/* Franjas laterales (pantallas anchas): la misma habitación, desenfocada y oscura */}
      {c?.relleno && (
        <img src={POSTER(escena)} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl brightness-50" />
      )}
      <img src={POSTER(escena)} alt="" className="absolute max-w-none" style={estilo} decoding="async" fetchPriority="high" />
      {!ahorro &&
        lista.map((nombre) => {
          const esReposo = nombre === 'reposo'
          const ver = esReposo ? listo : activo === nombre
          return (
            <video
              key={`${escena}-${nombre}`}
              ref={(el) => {
                if (el) capas.current[nombre] = el
                else delete capas.current[nombre]
              }}
              muted
              playsInline
              loop={esReposo}
              autoPlay={esReposo}
              preload={esReposo ? 'auto' : 'none'}
              disablePictureInPicture
              onPlaying={esReposo ? () => setListo(true) : undefined}
              onEnded={esReposo ? undefined : () => alTerminar(nombre)}
              className="absolute max-w-none"
              style={{ ...estilo, opacity: ver ? 1 : 0, transition: `opacity ${esReposo ? 300 : ESPECIALES.includes(nombre) ? 700 : 140}ms ease` }}
            >
              <source src={`${RUTA_VIDEOS}${escena}/${nombre}.webm`} type="video/webm" />
              <source src={`${RUTA_VIDEOS}${escena}/${nombre}.mp4`} type="video/mp4" />
            </video>
          )
        })}
      {peliculas && (
        <video
          ref={peli}
          playsInline
          disablePictureInPicture
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
          style={{ objectPosition: `${posicion[0] * 100}% ${posicion[1] * 100}%`, opacity: enPelicula ? 1 : 0, pointerEvents: 'none' }}
        />
      )}
      {pantalla && rect && !enPelicula && (
        <div className="pantalla-estudio absolute overflow-hidden" style={{ left: rect[0], top: rect[1], width: rect[2], height: rect[3] }}>
          {pantalla}
        </div>
      )}
    </div>
  )
}
