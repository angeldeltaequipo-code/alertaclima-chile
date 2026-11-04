// ZUMI vivo: una «marioneta» armada por capas a partir de su propio render (cuerpo, cabeza, mandíbula,
// ojos cerrados de un parpadeo real y sus bocas reales), animada en vivo en un canvas.
//
// Por qué así: la boca es parte de su cara, no un video aparte. Se abre con la energía real de su voz
// y toma la forma de la sílaba que suena (labios.js), la mandíbula baja con ella y la cabeza se mueve con
// lo que dice. Coincide siempre, con cualquier frase, sin esperas y sin costo por uso.
//
// Además: respira, se mece, parpadea (a veces doble), mira a los lados, ladea la cabeza cuando piensa,
// se inclina hacia ti cuando escucha y se pone serio en una alerta. Sus películas (con su voz y la boca
// perfecta) se reproducen encima cuando el narrador las pide.
import { useEffect, useRef, useState } from 'react'
import { VISEMAS, alCambiarBoca, energiaVoz } from '../services/labios'
import { alDetenerPelicula, registrarPelicula } from '../services/narrador'
import { RUTA_CINE, marcarVista } from '../services/cine'

const BASE = import.meta.env.BASE_URL
const RUTA = `${BASE}zumi/marioneta/`
export const ESCENAS_MARIONETA = ['sala', 'lluvia', 'noche', 'estudio', 'alerta']
// Rectángulo de la pantalla del estudio (fracción de la imagen)
const PANTALLA = { estudio: [0.46, 0.235, 0.52, 0.26], alerta: [0.46, 0.235, 0.52, 0.26] }
// Cuánto abre la boca cada forma
const ABRE = { reposo: 0, m: 0.25, i: 0.45, e: 0.62, o: 0.72, a: 1 }
const PIEZAS = ['fondo', 'sombra', 'cuerpo', 'cabeza', 'mandibula', 'ojos', 'bocas', 'brazo_izq', 'brazo_der']
const OPCIONALES = new Set(['brazo_izq', 'brazo_der'])
// Lugares a los que camina en cada escenario: [desplazamiento x (fracción del ancho), escala, alto (fracción)]
const LUGARES = {
  sala: [[0, 1, 0], [-0.09, 0.98, 0], [0.09, 0.98, 0], [0.03, 0.86, -0.045]],
  lluvia: [[0, 1, 0], [-0.08, 0.98, 0], [0.08, 0.98, 0], [0.03, 0.86, -0.045]],
  noche: [[0, 1, 0], [-0.08, 0.98, 0], [0.08, 0.98, 0]],
  estudio: [[0, 1, 0], [0.1, 0.97, 0], [0.2, 0.94, -0.01]],
  alerta: [[0, 1, 0], [0.08, 0.98, 0]],
}
// Gestos: ángulos de los brazos (grados; + = hacia afuera) y cuánto oscilan
const GESTOS = {
  reposo: { izq: 4, der: 4, osc: 0 },
  saludo: { izq: 132, der: 6, osc: 18, rapido: 3.2, dur: 2600 },
  celebrar: { izq: 140, der: 140, osc: 10, rapido: 4, dur: 1800 },
  senalar: { izq: 4, der: 98, osc: 4, rapido: 1.5, dur: 2200 },
  explicar: { izq: 34, der: 12, osc: 8, rapido: 1.2, dur: 1600 },
  explicar2: { izq: 10, der: 38, osc: 8, rapido: 1.2, dur: 1600 },
  calma: { izq: 26, der: 26, osc: 3, rapido: 0.8, dur: 2600 },
  pensar: { izq: 100, der: 6, osc: 2, rapido: 0.6, dur: 3000 },
  encoger: { izq: 48, der: 48, osc: 0, dur: 1100 },
}

const cache = new Map()
function cargarEscena(escena) {
  if (!cache.has(escena)) {
    const dir = `${RUTA}${escena}/`
    cache.set(
      escena,
      Promise.all([
        fetch(`${dir}pieza.json`).then((r) => r.json()),
        ...PIEZAS.map(
          (n) =>
            new Promise((ok, mal) => {
              const img = new Image()
              img.decoding = 'async'
              img.onload = () => ok([n, img])
              img.onerror = () => (OPCIONALES.has(n) ? ok([n, null]) : mal())
              img.src = `${dir}${n}.webp`
            }),
        ),
      ]).then(([pieza, ...imgs]) => ({ pieza, img: Object.fromEntries(imgs) })),
    )
  }
  return cache.get(escena)
}

const suave = (a, b, k) => a + (b - a) * k

/** Pelota de playa con luz y sombra (se dibuja, no es una imagen). */
function dibujarPelota(g, { x, y, r, giro }) {
  g.save()
  g.translate(x, y)
  g.beginPath()
  g.arc(0, 0, r, 0, Math.PI * 2)
  g.clip()
  const colores = ['#ef4444', '#ffffff', '#3b82f6', '#ffffff', '#facc15', '#ffffff']
  for (let i = 0; i < 6; i++) {
    g.fillStyle = colores[i]
    g.beginPath()
    g.moveTo(0, 0)
    g.arc(0, 0, r, giro + (i * Math.PI) / 3, giro + ((i + 1) * Math.PI) / 3)
    g.fill()
  }
  const luz = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.05, 0, 0, r)
  luz.addColorStop(0, 'rgba(255,255,255,0.55)')
  luz.addColorStop(0.45, 'rgba(255,255,255,0.05)')
  luz.addColorStop(1, 'rgba(40,20,10,0.45)')
  g.fillStyle = luz
  g.fillRect(-r, -r, r * 2, r * 2)
  g.restore()
}

export default function ZumiMarioneta({ escena = 'sala', estado = 'reposo', gesto = null, posicion = [0.5, 0.3], pantalla = null, className = '' }) {
  const caja = useRef(null)
  const lienzo = useRef(null)
  const peli = useRef(null)
  const [rect, setRect] = useState(null)
  const [enPelicula, setEnPelicula] = useState(false)
  const s = useRef({ escena, estado, actual: null, anterior: null, mezcla: 1, boca: 'reposo', pelicula: null, rect: '' })

  useEffect(() => {
    s.current.estado = estado
  }, [estado])
  // gesto: 'saludo', 'celebrar', 'senalar', 'calma', 'pensar', 'encoger', 'caminar' o 'pelota' (con «:clave» para repetirlo)
  useEffect(() => {
    if (gesto) s.current.gestoPedido = String(gesto).split(':')[0]
  }, [gesto])
  useEffect(() => alCambiarBoca((v) => (s.current.boca = v)), [])

  // Escenario: carga las piezas y funde del anterior al nuevo
  useEffect(() => {
    let vivo = true
    s.current.escena = escena
    cargarEscena(escena)
      .then((e) => {
        if (!vivo) return
        const c = s.current
        if (c.actual && c.actual !== e) {
          c.anterior = c.actual
          c.mezcla = 0
        }
        c.actual = e
      })
      .catch(() => {})
    // precarga el resto en segundo plano
    setTimeout(() => ESCENAS_MARIONETA.forEach((x) => x !== escena && cargarEscena(x).catch(() => {})), 2500)
    return () => {
      vivo = false
    }
  }, [escena])

  // Películas: se reproducen encima, con su voz; al terminar vuelve la marioneta.
  useEffect(() => {
    const terminar = (ok) => {
      const c = s.current
      const p = c.pelicula
      c.pelicula = null
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
          const c = s.current
          const v = peli.current
          if (!v) return ok(false)
          if (c.pelicula) c.pelicula.ok(true)
          c.pelicula = { id, ok }
          marcarVista(id)
          v.src = `${RUTA_CINE}${id}.mp4`
          v.muted = silencio
          v.currentTime = 0
          v.onended = () => terminar(true)
          v.onerror = () => terminar(false)
          v.play()
            .then(() => setEnPelicula(true))
            .catch(() => terminar(false)) // sin permiso para sonar: lo dice la marioneta
        }),
    )
    alDetenerPelicula(() => s.current.pelicula && terminar(true))
    return () => {
      quitar()
      alDetenerPelicula(null)
    }
  }, [])

  // Animación
  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    let ultimo = t0
    const a = {
      abre: 0,
      inclina: 0,
      cabezaX: 0,
      cabezaY: 0,
      giro: 0,
      parpado: 0,
      proximoParpadeo: 1800,
      parpadeoDesde: -1,
      doble: false,
      mirar: 0,
      proximaMirada: 4000,
      formaPrev: 'reposo',
      formaMezcla: 1,
      formaVis: 'reposo',
      energiaSuave: 0,
      // brazos y gestos
      bIzq: 4,
      bDer: 4,
      gesto: 'reposo',
      gestoHasta: 0,
      proximoGesto: 3000,
      // caminar
      x: 0,
      esc: 1,
      y: 0,
      lugar: 0,
      destino: null,
      paso: 0,
      proximaCaminata: 7000,
      // pelota
      pelotaDesde: -1,
      proximaPelota: 16000,
    }
    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    const dibujarEscena = (g, e, alfa, cw, ch, t, dt) => {
      const p = e.pieza
      const { img } = e
      const k = Math.max(cw / p.ancho, ch / p.alto)
      const ox = (cw - p.ancho * k) * posicion[0]
      const oy = (ch - p.alto * k) * posicion[1]
      g.save()
      g.globalAlpha = alfa
      g.translate(ox, oy)
      g.scale(k, k)
      g.drawImage(img.fondo, 0, 0, p.ancho, p.alto)

      const c = s.current
      const habla = c.estado === 'hablando'
      const piensa = c.estado === 'pensando'
      const escucha = c.estado === 'escuchando'
      const serio = c.escena === 'alerta'
      const en = energiaVoz()
      a.energiaSuave = suave(a.energiaSuave, habla ? en : 0, Math.min(1, dt * 0.08))

      // Respiración y vaivén (más vivo cuando habla)
      const resp = Math.sin((t / 3600) * Math.PI * 2)
      const vaiven = Math.sin((t / 5200) * Math.PI * 2) * (reducido ? 0.2 : 1)
      const brinco = habla ? a.energiaSuave * 0.012 : 0
      const [px, py] = p.pivotePies
      const pos = (n) => p.pos[n]

      // ---------- caminar por el escenario ----------
      const lugares = LUGARES[c.escena] ?? [[0, 1, 0]]
      const pedido = c.gestoPedido
      if (pedido) {
        c.gestoPedido = null
        if (pedido === 'caminar') a.proximaCaminata = t
        else if (pedido === 'pelota') a.proximaPelota = t
        else if (GESTOS[pedido]) {
          a.gesto = pedido
          a.gestoHasta = t + (GESTOS[pedido].dur ?? 2000)
        }
      }
      if (!a.destino && t > a.proximaCaminata && !piensa && !escucha && lugares.length > 1 && a.pelotaDesde < 0) {
        let n = a.lugar
        while (n === a.lugar) n = Math.floor(Math.random() * lugares.length)
        a.destino = n
      }
      let andando = 0
      if (a.destino != null) {
        const [dx, de, dy] = lugares[a.destino]
        const tx = dx * p.ancho
        const ty = dy * p.alto
        const dist = Math.hypot(tx - a.x, (de - a.esc) * 400, ty - a.y)
        const vel = 0.085 * dt // px de imagen por ms
        if (dist < 2) {
          a.x = tx
          a.esc = de
          a.y = ty
          a.lugar = a.destino
          a.destino = null
          a.proximaCaminata = t + (habla ? 6000 : 9000) + Math.random() * 9000
        } else {
          const f = Math.min(1, vel / dist)
          a.x += (tx - a.x) * f
          a.esc += (de - a.esc) * f
          a.y += (ty - a.y) * f
          andando = Math.sign(tx - a.x || 1)
          a.paso += dt * 0.0105
        }
      }
      // pasito: sube y baja, se balancea de lado a lado (andar de panda)
      const pasoS = andando ? Math.sin(a.paso) : 0
      const saltito = andando ? Math.abs(Math.sin(a.paso)) * 0.045 * p.d : 0
      g.translate(px + a.x, py + a.y - saltito)
      g.scale(a.esc, a.esc)
      g.translate(-px, -py)

      // sombra (no salta)
      g.save()
      g.translate(px, py + saltito / a.esc)
      g.scale(1 + resp * 0.01 - saltito * 0.002, 1)
      g.translate(-px, -py)
      const so = pos('sombra')
      g.drawImage(img.sombra, so[0], so[1], so[2], so[3])
      g.restore()

      // cuerpo
      g.save()
      g.translate(px, py)
      g.rotate(((vaiven * 0.8 + pasoS * 4.5 + andando * 2) * Math.PI) / 180)
      g.scale(1 - resp * 0.003, 1 + resp * 0.007 + brinco)
      g.translate(-px, -py)
      const cu = pos('cuerpo')
      g.drawImage(img.cuerpo, cu[0], cu[1], cu[2], cu[3])

      // ---------- brazos ----------
      // Gesto automático: al hablar acompaña con las manos; quieto, a veces juega con su pelota.
      if (t > a.gestoHasta) {
        a.gesto = 'reposo'
        if (habla && t > a.proximoGesto && a.energiaSuave > 0.15) {
          a.gesto = Math.random() < 0.5 ? 'explicar' : 'explicar2'
          a.gestoHasta = t + 1400 + Math.random() * 900
          a.proximoGesto = a.gestoHasta + 600 + Math.random() * 1800
        }
      }
      if (serio && a.gesto === 'reposo' && habla) a.gesto = 'calma'
      if (piensa) a.gesto = 'pensar'
      const G = GESTOS[a.gesto] ?? GESTOS.reposo
      const osc = Math.sin((t / 1000) * Math.PI * 2 * (G.rapido ?? 1)) * (G.osc ?? 0)
      let objIzq = G.izq + osc + (andando ? -pasoS * 14 : 0) + vaiven * 1.5
      let objDer = G.der - (G.osc ? osc * 0.4 : 0) + (andando ? pasoS * 14 : 0) - vaiven * 1.5

      // pelota: la lanza hacia arriba y la atrapa
      let pelota = null
      if (a.pelotaDesde < 0 && !habla && !piensa && !andando && t > a.proximaPelota && a.gesto === 'reposo') a.pelotaDesde = t
      if (a.pelotaDesde >= 0) {
        const u = (t - a.pelotaDesde) / 2600
        if (u >= 1 || habla) {
          a.pelotaDesde = -1
          a.proximaPelota = t + 18000 + Math.random() * 16000
        } else {
          // brazos: sostiene adelante, lanza (sube), espera, atrapa
          const lanzar = Math.sin(Math.min(1, u / 0.25) * Math.PI)
          objIzq = 30 + lanzar * 40
          objDer = 30 + lanzar * 40
          const [nx0, ny0] = p.nariz
          const manoY = ny0 + 2.55 * p.d
          const vuelo = u < 0.18 ? 0 : u > 0.82 ? 0 : Math.sin(((u - 0.18) / 0.64) * Math.PI)
          pelota = { x: nx0 + Math.sin(u * Math.PI * 2) * 0.12 * p.d, y: manoY - vuelo * 2.6 * p.d, r: 0.32 * p.d, giro: u * 9 }
        }
      }
      a.bIzq = suave(a.bIzq, objIzq, Math.min(1, dt * 0.012))
      a.bDer = suave(a.bDer, objDer, Math.min(1, dt * 0.012))
      const brazo = (lado, ang) => {
        const im = img[`brazo_${lado}`]
        const ps = p.pos[`brazo_${lado}`]
        const hb = p.hombros?.[lado]
        if (!im || !ps || !hb) return
        g.save()
        g.translate(hb[0], hb[1])
        g.rotate(((lado === 'izq' ? ang : -ang) * Math.PI) / 180)
        g.translate(-hb[0], -hb[1])
        g.drawImage(im, ps[0], ps[1], ps[2], ps[3])
        g.restore()
      }
      brazo('izq', a.bIzq)
      brazo('der', a.bDer)

      // cabeza (gira sobre el cuello)
      const d = p.d
      const [hx, hy] = p.pivoteCabeza
      // mirada a los lados de vez en cuando
      if (t > a.proximaMirada) {
        a.mirar = habla ? 0 : (Math.random() - 0.5) * 2
        a.proximaMirada = t + 2500 + Math.random() * 4000
      }
      const objInclina = (piensa ? 7 : escucha ? -4 : serio ? -1.5 : 0) + vaiven * 1.6 + a.mirar * 2.5
      const asiente = habla ? a.energiaSuave * 3.2 : 0
      a.inclina = suave(a.inclina, objInclina, Math.min(1, dt * 0.004))
      a.cabezaY = suave(a.cabezaY, (escucha ? 0.04 : 0) * d + asiente * 0.006 * d, Math.min(1, dt * 0.01))
      g.translate(hx, hy + a.cabezaY)
      g.rotate(((a.inclina + asiente * 0.4) * Math.PI) / 180)
      g.scale(1 + (escucha ? 0.015 : 0), 1 + (escucha ? 0.015 : 0))
      g.translate(-hx, -hy)
      const ca = pos('cabeza')
      g.drawImage(img.cabeza, ca[0], ca[1], ca[2], ca[3])

      // boca: forma de la sílaba + abertura por la energía real del audio
      let forma = habla ? c.boca : 'reposo'
      if (forma !== a.formaVis) {
        a.formaPrev = a.formaVis
        a.formaVis = forma
        a.formaMezcla = 0
      }
      a.formaMezcla = Math.min(1, a.formaMezcla + dt / 70)
      const objAbre = habla ? Math.max(ABRE[forma] ?? 0, a.energiaSuave * 0.9) * (forma === 'reposo' && a.energiaSuave < 0.12 ? 0 : 1) : 0
      a.abre = suave(a.abre, objAbre, Math.min(1, dt * 0.06))
      window.__zumiAbre = a.abre // para medir la sincronía en pruebas

      // mandíbula: baja un poco con la boca (se estira hacia abajo, sin costuras)
      const ma = pos('mandibula')
      if (a.abre > 0.02) g.drawImage(img.mandibula, ma[0], ma[1], ma[2], ma[3] * (1 + a.abre * 0.16))

      // sprite de boca real del mismo escenario
      const [nx, ny] = p.nariz
      const B = p.boca
      const bw = B.ancho * d
      const bh = B.alto * d
      const by = ny + B.bajo * d + a.abre * 0.03 * d
      const sw = img.bocas.width / 6
      const dibujaBoca = (f, alfaB) => {
        const idx = Math.max(0, VISEMAS.indexOf(f))
        if (idx === 0 && !habla) return
        g.globalAlpha = alfa * alfaB
        g.drawImage(img.bocas, idx * sw, 0, sw, img.bocas.height, nx - bw / 2, by - bh / 2, bw, bh)
      }
      if (habla || a.abre > 0.02) {
        if (a.formaMezcla < 1) dibujaBoca(a.formaPrev, 1 - a.formaMezcla)
        dibujaBoca(a.formaVis === 'reposo' && a.abre < 0.08 ? 'reposo' : a.formaVis === 'reposo' ? 'm' : a.formaVis, a.formaMezcla)
        g.globalAlpha = alfa
      }

      // parpadeo (a veces doble), más lento si está cansado de noche
      if (a.parpadeoDesde < 0 && t > a.proximoParpadeo) {
        a.parpadeoDesde = t
      }
      let cierre = 0
      if (a.parpadeoDesde >= 0) {
        const dur = c.escena === 'noche' ? 260 : 170
        const x = (t - a.parpadeoDesde) / dur
        cierre = x < 0.45 ? x / 0.45 : x < 1 ? 1 - (x - 0.45) / 0.55 : 0
        if (x >= 1) {
          a.parpadeoDesde = -1
          const doble = !a.doble && Math.random() < 0.22
          a.doble = doble
          a.proximoParpadeo = t + (doble ? 120 : 2200 + Math.random() * 3500)
        }
      }
      if (piensa) cierre = Math.max(cierre, 0.25)
      if (cierre > 0.02) {
        const O = p.ojos
        const ow = O.ancho * d
        const oh = O.alto * d
        g.globalAlpha = alfa * Math.min(1, cierre * 1.15)
        g.drawImage(img.ojos, nx - ow / 2, ny + O.bajo * d - oh / 2, ow, oh)
        g.globalAlpha = alfa
      }
      g.restore() // cuerpo + cabeza
      if (pelota) dibujarPelota(g, pelota)
      g.restore() // escena

      // Pantalla del estudio (para los datos), en coordenadas de la caja
      const pr = PANTALLA[c.escena]
      const nuevo = pr ? [ox + pr[0] * p.ancho * k, oy + pr[1] * p.alto * k, pr[2] * p.ancho * k, pr[3] * p.alto * k] : null
      const clave = nuevo ? nuevo.map(Math.round).join(',') : ''
      if (clave !== c.rect) {
        c.rect = clave
        setRect(nuevo ? [Math.max(8, nuevo[0]), nuevo[1], Math.min(cw - 8, nuevo[0] + nuevo[2]) - Math.max(8, nuevo[0]), nuevo[3]] : null)
      }
    }

    const cuadro = (ahora) => {
      raf = requestAnimationFrame(cuadro)
      const dt = Math.min(80, ahora - ultimo)
      ultimo = ahora
      const t = ahora - t0
      const cv = lienzo.current
      const el = caja.current
      const c = s.current
      if (!cv || !el || !c.actual || document.hidden) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const cw = el.clientWidth
      const ch = el.clientHeight
      if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) {
        cv.width = Math.round(cw * dpr)
        cv.height = Math.round(ch * dpr)
      }
      const g = cv.getContext('2d')
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.imageSmoothingQuality = 'high'
      if (c.anterior && c.mezcla < 1) {
        // Corte de cámara: funde a oscuro y vuelve (nunca dos ZUMI a la vez)
        c.mezcla = Math.min(1, c.mezcla + dt / 500)
        g.fillStyle = '#0b0806'
        g.fillRect(0, 0, cw, ch)
        if (c.mezcla < 0.5) dibujarEscena(g, c.anterior, 1 - c.mezcla * 2, cw, ch, t, dt)
        else dibujarEscena(g, c.actual, c.mezcla * 2 - 1, cw, ch, t, dt)
        if (c.mezcla >= 1) c.anterior = null
      } else dibujarEscena(g, c.actual, 1, cw, ch, t, dt)
    }
    raf = requestAnimationFrame(cuadro)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posicion[0], posicion[1]])

  return (
    <div ref={caja} className={`zumi-marioneta escena-${escena} absolute inset-0 overflow-hidden bg-[#1b1410] ${className}`}>
      <canvas ref={lienzo} aria-hidden="true" className="absolute inset-0 h-full w-full" />
      <video
        ref={peli}
        playsInline
        preload="none"
        disablePictureInPicture
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
        style={{ objectPosition: `${posicion[0] * 100}% ${posicion[1] * 100}%`, opacity: enPelicula ? 1 : 0, pointerEvents: 'none' }}
      />
      {pantalla && rect && !enPelicula && (
        <div className="pantalla-estudio absolute overflow-hidden" style={{ left: rect[0], top: rect[1], width: rect[2], height: rect[3] }}>
          {pantalla}
        </div>
      )}
    </div>
  )
}
