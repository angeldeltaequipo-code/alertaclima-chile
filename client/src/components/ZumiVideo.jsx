// ZUMI, el presentador del clima, con calidad de película animada.
//
// - Escenarios según el momento: su sala con sol, con lluvia, de noche, el estudio de noticias (con una
//   pantalla donde aparecen los datos) y el estudio en alerta. Cada uno tiene clips hechos con
//   Higgsfield que empiezan y terminan en la misma pose, así que se encadenan sin cortes.
// - Boca sincronizada con la voz: la cara de ZUMI se siguió cuadro a cuadro (scripts/zumi-cara.py) y
//   sus bocas reales se recortaron del mismo clip (scripts/zumi-bocas.py). Mientras habla, se dibuja en
//   cada cuadro la boca que corresponde a la sílaba que suena (labios.js), en la posición, tamaño e
//   inclinación exactos de su cara.
// - Se mueve: de vez en cuando camina hasta la ventana o la pantalla y vuelve.
import { useEffect, useRef, useState } from 'react'
import { alCambiarBoca, VISEMAS } from '../services/labios'
import { alDetenerPelicula, registrarPelicula } from '../services/narrador'
import { RUTA_CINE, marcarVista } from '../services/cine'

const BASE = import.meta.env.BASE_URL
const RUTA = `${BASE}zumi/video/`

// Escenarios: clips disponibles y, en el estudio, el rectángulo de la pantalla (fracción del cuadro).
export const ESCENAS = {
  sala: { clips: { reposo: 'sala-reposo', hablar: 'sala-hablar', caminar: 'sala-caminar' } },
  lluvia: { clips: { reposo: 'lluvia-reposo', hablar: 'lluvia-hablar' } },
  noche: { clips: { reposo: 'noche-reposo', hablar: 'noche-hablar' } },
  estudio: { clips: { reposo: 'estudio-reposo', hablar: 'estudio-hablar', caminar: 'estudio-caminar' }, pantalla: [0.46, 0.235, 0.52, 0.26] },
  alerta: { clips: { reposo: 'alerta-reposo', hablar: 'alerta-hablar' }, pantalla: [0.46, 0.235, 0.52, 0.26] },
}
export const posterDe = (escena) => `${RUTA}${ESCENAS[escena] ? escena : 'sala'}.webp`

// Medidas de la boca (deben coincidir con scripts/zumi-bocas.py)
const BOCA = { ancho: 1.4, alto: 0.62, bajo: 0.43 }

let formato = null
const FORMATO = () => {
  if (formato) return formato
  const v = document.createElement('video')
  formato = v.canPlayType('video/mp4; codecs="avc1.640028"') ? 'mp4' : 'webm'
  return formato
}

// Recursos compartidos (se cargan una vez)
const caras = new Map()
const cargarCara = (clip) => {
  if (!caras.has(clip)) caras.set(clip, fetch(`${RUTA}${clip}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null))
  return caras.get(clip)
}
const bocas = new Map()
const cargarBocas = (escena) => {
  if (!bocas.has(escena)) {
    bocas.set(
      escena,
      new Promise((ok) => {
        const img = new Image()
        img.onload = () => ok(img)
        img.onerror = () => ok(null)
        img.src = `${RUTA}${escena}-bocas.webp`
      }),
    )
  }
  return bocas.get(escena)
}

/** Rectángulo visible del video dentro de la caja (object-fit: cover con posición x/y en fracción). */
function encaje(cw, ch, vw, vh, px, py) {
  const k = Math.max(cw / vw, ch / vh)
  return { x: (cw - vw * k) * px, y: (ch - vh * k) * py, k }
}

export default function ZumiVideo({ escena = 'sala', estado = 'reposo', gesto = null, posicion = [0.5, 0.3], pantalla = null, className = '' }) {
  const caja = useRef(null)
  const lienzo = useRef(null)
  const v0 = useRef(null)
  const v1 = useRef(null)
  const [visible, setVisible] = useState(0)
  const [listo, setListo] = useState(false)
  const [rectPantalla, setRectPantalla] = useState(null)
  const s = useRef({ escena, estado, gesto: null, visible: 0, actual: null, boca: 'reposo', vueltas: 0, caras: {}, cambiando: false, pantalla: null })
  const vid = (i) => (i === 0 ? v0 : v1).current

  const esc = () => ESCENAS[s.current.escena] ?? ESCENAS.sala
  const archivo = (clip) => `${RUTA}${clip}.${FORMATO()}`

  // Qué clip toca ahora en el escenario actual
  const elegir = () => {
    const c = s.current
    const clips = esc().clips
    if (c.gesto && clips[c.gesto]) {
      const g = c.gesto
      c.gesto = null
      return clips[g]
    }
    if (c.estado === 'hablando' || c.estado === 'pensando') return clips.hablar ?? clips.reposo
    // En reposo, de vez en cuando camina un poco
    if (clips.caminar && ++c.vueltas % 4 === 0) return clips.caminar
    return clips.reposo
  }

  const reproducir = (clip, fundido = 300, { url = null, sonido = false } = {}) => {
    const c = s.current
    const i = 1 - c.visible
    const v = vid(i)
    if (!v) return Promise.resolve(false)
    c.actual = clip
    c.cambiando = true
    if (!url) cargarCara(clip).then((d) => (c.caras[clip] = d))
    v.muted = !sonido
    v.src = url ?? archivo(clip)
    v.currentTime = 0
    const mostrar = () => {
      c.visible = i
      setVisible(i)
      c.cambiando = false
      const viejo = vid(1 - i)
      setTimeout(() => viejo?.pause(), fundido + 50)
      return true
    }
    return v
      .play()
      .then(mostrar)
      .catch(() => {
        // Sin permiso para sonar: se muestra igual, en silencio
        if (!sonido) return (c.cambiando = false)
        v.muted = true
        return v.play().then(mostrar, () => (c.cambiando = false))
      })
  }

  // Películas: ZUMI actúa la escena con su voz. Al terminar vuelve a su rutina en el escenario.
  useEffect(() => {
    const quitar = registrarPelicula(
      (id, { silencio = false } = {}) =>
        new Promise((ok) => {
          const c = s.current
          if (c.pelicula) c.pelicula.ok(true)
          c.pelicula = { id, ok }
          marcarVista(id)
          reproducir(`cine-${id}`, 400, { url: `${RUTA_CINE}${id}.mp4`, sonido: !silencio }).then((bien) => {
            if (!bien && c.pelicula?.id === id) {
              c.pelicula = null
              ok(false)
            }
          })
        }),
    )
    alDetenerPelicula(() => {
      const c = s.current
      if (!c.pelicula) return
      const p = c.pelicula
      c.pelicula = null
      vid(c.visible)?.pause()
      reproducir(elegir(), 300)
      p.ok(true)
    })
    return () => {
      quitar()
      alDetenerPelicula(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Inicio
  useEffect(() => {
    const c = s.current
    const v = vid(0)
    const clip = elegir()
    c.actual = clip
    cargarCara(clip).then((d) => (c.caras[clip] = d))
    v.src = archivo(clip)
    v.play()
      .then(() => setListo(true))
      .catch(() => setListo(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cambio de escenario: fundido al nuevo
  useEffect(() => {
    const c = s.current
    if (c.escena === escena) return
    c.escena = escena
    if (listo && !c.pelicula) reproducir(elegir(), 500)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escena])

  // Empieza a hablar: cambia de inmediato al clip de hablar
  useEffect(() => {
    const c = s.current
    const antes = c.estado
    c.estado = estado
    if (!listo || antes === estado || c.pelicula) return
    const hablar = esc().clips.hablar
    if ((estado === 'hablando' || estado === 'pensando') && hablar && c.actual !== hablar) reproducir(hablar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, listo])

  useEffect(() => {
    if (gesto) s.current.gesto = gesto
  }, [gesto])
  useEffect(() => alCambiarBoca((v) => (s.current.boca = v)), [])

  const alTerminar = (i) => () => {
    const c = s.current
    if (i !== c.visible || c.cambiando) return
    if (c.pelicula && c.actual === `cine-${c.pelicula.id}`) {
      const p = c.pelicula
      c.pelicula = null
      reproducir(elegir(), 400)
      p.ok(true)
      return
    }
    const sig = elegir()
    if (sig === c.actual) {
      const v = vid(i)
      v.currentTime = 0
      v.play().catch(() => {})
    } else reproducir(sig)
  }

  // Cada cuadro: la boca sobre la cara y la posición de la pantalla del estudio
  useEffect(() => {
    let raf = 0
    const tiras = new Map()
    for (const k of Object.keys(ESCENAS)) cargarBocas(k).then((img) => img && tiras.set(k, img))
    const dibujar = () => {
      raf = requestAnimationFrame(dibujar)
      const c = s.current
      const cv = lienzo.current
      const el = caja.current
      const v = vid(c.visible)
      if (!cv || !el || !v || !v.videoWidth) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const cw = el.clientWidth
      const ch = el.clientHeight
      if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) {
        cv.width = Math.round(cw * dpr)
        cv.height = Math.round(ch * dpr)
      }
      const g = cv.getContext('2d')
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, cw, ch)
      const W = v.videoWidth
      const H = v.videoHeight
      const r = encaje(cw, ch, W, H, posicion[0], posicion[1])

      // Pantalla del estudio (para los datos)
      const p = esc().pantalla
      let nuevo = null
      if (p) {
        // recortado a lo que se ve en pantalla (en teléfonos angostos el borde derecho queda fuera)
        const x0 = Math.max(8, r.x + p[0] * W * r.k)
        const x1 = Math.min(cw - 8, r.x + (p[0] + p[2]) * W * r.k)
        nuevo = [x0, r.y + p[1] * H * r.k, x1 - x0, p[3] * H * r.k].map(Math.round).join(',')
      }
      if (nuevo !== c.pantalla) {
        c.pantalla = nuevo
        setRectPantalla(nuevo ? nuevo.split(',').map(Number) : null)
      }

      // Boca: en clips de hablar (para tapar la boca del video) o mientras suena la voz
      const datos = c.caras[c.actual]
      const tira = tiras.get(c.escena)
      if (!datos || !tira || (!/hablar$/.test(c.actual ?? '') && c.estado !== 'hablando')) return
      const n = Math.min(datos.c.length - 1, Math.max(0, Math.round(v.currentTime * datos.fps)))
      const [nx, ny, d, ang] = datos.c[n]
      const idx = Math.max(0, VISEMAS.indexOf(c.estado === 'hablando' ? c.boca : 'reposo'))
      const sw = tira.width / 6
      const dd = d * W * r.k
      g.save()
      g.translate(r.x + nx * W * r.k - Math.sin(ang) * BOCA.bajo * dd, r.y + ny * W * r.k + Math.cos(ang) * BOCA.bajo * dd)
      g.rotate(ang)
      g.drawImage(tira, idx * sw, 0, sw, tira.height, (-BOCA.ancho * dd) / 2, (-BOCA.alto * dd) / 2, BOCA.ancho * dd, BOCA.alto * dd)
      g.restore()
    }
    dibujar()
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posicion[0], posicion[1]])

  const estilo = { objectFit: 'cover', objectPosition: `${posicion[0] * 100}% ${posicion[1] * 100}%` }
  return (
    <div ref={caja} className={`zumi-video escena-${escena} absolute inset-0 overflow-hidden ${className}`}>
      <img src={posterDe(escena)} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full" style={estilo} />
      {[v0, v1].map((r, i) => (
        <video
          key={i}
          ref={r}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          aria-hidden="true"
          onEnded={alTerminar(i)}
          className="absolute inset-0 h-full w-full transition-opacity duration-500"
          style={{ ...estilo, opacity: listo && visible === i ? 1 : 0 }}
        />
      ))}
      <canvas ref={lienzo} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" />
      {pantalla && rectPantalla && (
        <div className="pantalla-estudio absolute overflow-hidden" style={{ left: rectPantalla[0], top: rectPantalla[1], width: rectPantalla[2], height: rectPantalla[3] }}>
          {pantalla}
        </div>
      )}
    </div>
  )
}
