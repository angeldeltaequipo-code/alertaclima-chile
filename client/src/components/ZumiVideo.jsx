// ZUMI con calidad de película animada: videos cortos del personaje en su estudio (hechos con
// Higgsfield a partir del mismo cuadro), que empiezan y terminan en la misma pose. Por eso se pueden
// encadenar sin cortes: reposo → hablar → saludar → reposo… como un personaje vivo.
//
// - Dos <video> apilados: mientras uno se ve, el otro prepara el siguiente clip.
// - Al terminar un clip se elige el siguiente según lo que pasa (hablando, pensando, alerta…).
// - Si cambia algo importante a mitad de clip (empieza a hablar), se funde al nuevo en 0,3 s.
import { useEffect, useRef, useState } from 'react'

const BASE = import.meta.env.BASE_URL
const RUTA = `${BASE}zumi/video/`
export const POSTER_ZUMI = `${RUTA}zumi-set.webp`

// Clips disponibles por estado (si hay varios, se alternan para que no se vea repetido).
export const CLIPS = {
  reposo: ['reposo'],
  hablando: ['hablar'],
  pensando: ['pensar'],
  escuchando: ['reposo'],
  alerta: ['alerta'],
  saludo: ['saludo'],
  celebrar: ['celebrar'],
}
// H.264 (iPhone y casi todos) o VP9 si el navegador no trae H.264.
let formato = null
const FORMATO = () => {
  if (formato) return formato
  const v = document.createElement('video')
  formato = v.canPlayType('video/mp4; codecs="avc1.640028"') ? 'mp4' : 'webm'
  return formato
}
// Clips que ya están en public/zumi/video
export const CLIPS_LISTOS = ['reposo', 'hablar']
const UNA_VEZ = new Set(['saludo', 'celebrar'])
// Estados que interrumpen el clip actual (no esperan a que termine).
const URGENTE = new Set(['hablando', 'pensando'])

export default function ZumiVideo({ estado = 'reposo', gesto = null, luz = 'normal', disponibles = CLIPS_LISTOS, className = '', posicion = 'center 35%' }) {
  const a = useRef(null)
  const b = useRef(null)
  const [visible, setVisible] = useState(0) // 0 = a, 1 = b
  const visibleRef = useRef(0)
  const cola = useRef({ gesto: null, estado, luz, ultimo: null, n: 0 })
  const [listo, setListo] = useState(false)

  const tiene = (k) => !disponibles || disponibles.includes(k)
  const clipPara = (k) => {
    const lista = (CLIPS[k] ?? CLIPS.reposo).filter(tiene)
    return lista.length ? lista[cola.current.n++ % lista.length] : 'reposo'
  }
  const elegir = () => {
    const c = cola.current
    if (c.gesto && tiene(c.gesto)) {
      const g = c.gesto
      c.gesto = null
      return g
    }
    const k = c.luz === 'alerta' && c.estado === 'reposo' ? 'alerta' : c.estado
    return clipPara(k)
  }
  const url = (clip) => `${RUTA}${clip}.${FORMATO()}`

  // Reproduce «clip» en el video oculto y lo muestra (fundido corto si se pide).
  const cambiarA = (clip) => {
    const vids = [a.current, b.current]
    const otro = vids[1 - visibleRef.current]
    if (!otro) return
    cola.current.ultimo = clip
    otro.src = url(clip)
    otro.currentTime = 0
    const p = otro.play()
    const mostrar = () => {
      visibleRef.current = 1 - visibleRef.current
      setVisible(visibleRef.current)
      const viejo = vids[1 - visibleRef.current]
      setTimeout(() => viejo.pause(), 350)
    }
    if (p?.then) p.then(mostrar).catch(() => {})
    else mostrar()
  }
  // Cambios de estado
  useEffect(() => {
    const c = cola.current
    const antes = c.estado
    c.estado = estado
    if (!listo || estado === antes) return
    if (URGENTE.has(estado) && c.ultimo !== clipPara(estado)) cambiarA(clipPara(estado))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, listo])
  useEffect(() => {
    if (gesto) cola.current.gesto = gesto
  }, [gesto])
  useEffect(() => {
    cola.current.luz = luz
  }, [luz])

  // Arranque: el primer clip en el video «a».
  useEffect(() => {
    const v = a.current
    if (!v) return
    const primero = elegir()
    cola.current.ultimo = primero
    v.src = url(primero)
    v.play()
      .then(() => setListo(true))
      .catch(() => setListo(true)) // sin reproducción automática: queda el póster
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Al terminar un clip, el siguiente (todos empalman en la misma pose).
  const alTerminar = (i) => () => {
    if (i !== visibleRef.current) return
    const sig = elegir()
    const v = [a.current, b.current][i]
    if (sig === cola.current.ultimo && !UNA_VEZ.has(sig)) {
      v.currentTime = 0
      v.play().catch(() => {})
      return
    }
    cambiarA(sig)
  }

  const estilo = { objectFit: 'cover', objectPosition: posicion }
  return (
    <div className={`zumi-video absolute inset-0 overflow-hidden ${luz === 'alerta' ? 'en-alerta' : ''} ${className}`} aria-hidden="true">
      <img src={POSTER_ZUMI} alt="" className="absolute inset-0 h-full w-full" style={estilo} />
      {[a, b].map((r, i) => (
        <video
          key={i}
          ref={r}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          onEnded={alTerminar(i)}
          className="absolute inset-0 h-full w-full transition-opacity duration-300"
          style={{ ...estilo, opacity: listo && visible === i ? 1 : 0 }}
        />
      ))}
    </div>
  )
}
