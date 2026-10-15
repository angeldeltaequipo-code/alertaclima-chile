// El cielo sobre tu comuna, en vivo: estrellas, constelaciones, la Luna y los planetas exactamente
// donde están ahora (se mueven en tiempo real con la rotación de la Tierra).
// - Arrastra para girar, o activa «Apuntar con el teléfono» para que el mapa siga hacia dónde miras.
// - Toca un astro para saber qué es y hacia dónde buscarlo.
// - Adelanta las horas para ver cómo cambia el cielo esta noche.
// Posiciones de planetas y Luna: astronomy-engine (Don Cross, MIT). Estrellas: catálogo HYG vía
// d3-celestial (estrellas hasta magnitud 4,6).
import { useEffect, useMemo, useRef, useState } from 'react'
import * as A from 'astronomy-engine'

const BASE = import.meta.env.BASE_URL
const PLANETAS = [
  ['Mercury', 'Mercurio', '#d6d3d1'],
  ['Venus', 'Venus', '#fef3c7'],
  ['Mars', 'Marte', '#f87171'],
  ['Jupiter', 'Júpiter', '#fde68a'],
  ['Saturn', 'Saturno', '#fcd34d'],
]
const RUMBOS = ['norte', 'noreste', 'este', 'sureste', 'sur', 'suroeste', 'oeste', 'noroeste']
const rumbo = (az) => RUMBOS[Math.round((((az % 360) + 360) % 360) / 45) % 8]
const rad = Math.PI / 180

let catalogo = null
const cargarCatalogo = () => (catalogo ??= fetch(`${BASE}datos/cielo.json`).then((r) => r.json()))

/** Altura y acimut (grados) de un punto del cielo (RA en grados, Dec en grados). */
function horizonte(raDeg, dec, lstDeg, lat) {
  const H = (lstDeg - raDeg) * rad
  const d = dec * rad
  const f = lat * rad
  const sinAlt = Math.sin(d) * Math.sin(f) + Math.cos(d) * Math.cos(f) * Math.cos(H)
  const alt = Math.asin(sinAlt)
  const az = Math.atan2(-Math.sin(H) * Math.cos(d), Math.sin(d) * Math.cos(f) - Math.cos(d) * Math.sin(f) * Math.cos(H))
  return [alt / rad, ((az / rad) + 360) % 360]
}

const colorEstrella = (m) => (m < 1 ? '#ffffff' : m < 2.5 ? '#e0ecff' : '#c7d2fe')

export default function CieloEnVivo({ punto, comuna }) {
  const lienzo = useRef(null)
  const [cat, setCat] = useState(null)
  const [ahora, setAhora] = useState(() => Date.now())
  const [desfase, setDesfase] = useState(0) // horas hacia adelante
  const [giro, setGiro] = useState(0) // grados: qué dirección queda arriba
  const [brujula, setBrujula] = useState(false)
  const [elegido, setElegido] = useState(null)
  const arrastre = useRef(null)
  const objetos = useRef([])

  useEffect(() => {
    cargarCatalogo().then(setCat).catch(() => {})
    const t = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Brújula: el mapa del cielo gira según hacia dónde apunta el teléfono.
  useEffect(() => {
    if (!brujula) return
    const f = (e) => {
      const rumbo = e.webkitCompassHeading ?? (e.absolute && e.alpha != null ? 360 - e.alpha : null)
      if (rumbo != null) setGiro(rumbo)
    }
    window.addEventListener('deviceorientationabsolute', f)
    window.addEventListener('deviceorientation', f)
    return () => {
      window.removeEventListener('deviceorientationabsolute', f)
      window.removeEventListener('deviceorientation', f)
    }
  }, [brujula])

  // Redibuja cuando el lienzo cambia de tamaño (por ejemplo, al volver a la pestaña Ahora).
  const [tam, setTam] = useState(0)
  useEffect(() => {
    const cv = lienzo.current
    if (!cv || !('ResizeObserver' in window)) return
    const ro = new ResizeObserver(([e]) => setTam(Math.round(e.contentRect.width)))
    ro.observe(cv)
    return () => ro.disconnect()
  }, [])

  const fecha = useMemo(() => new Date(ahora + desfase * 3600e3), [ahora, desfase])

  // Posiciones del momento
  const cielo = useMemo(() => {
    if (!punto) return null
    const obs = new A.Observer(punto.lat, punto.lng, 0)
    const lst = (A.SiderealTime(fecha) * 15 + punto.lng + 360) % 360
    const astro = (cuerpo) => {
      const eq = A.Equator(cuerpo, fecha, obs, true, true)
      const h = A.Horizon(fecha, obs, eq.ra, eq.dec, 'normal')
      return [h.altitude, h.azimuth]
    }
    const sol = astro(A.Body.Sun)
    const luna = astro(A.Body.Moon)
    const fase = A.MoonPhase(fecha) // 0 nueva, 90 creciente, 180 llena…
    const planetas = PLANETAS.map(([b, nombre, color]) => {
      const [alt, az] = astro(A.Body[b])
      const mag = A.Illumination(A.Body[b], fecha).mag
      return { nombre, color, alt, az, mag }
    })
    return { lst, sol, luna, fase, planetas }
  }, [punto, fecha])

  // Dibujo
  useEffect(() => {
    const cv = lienzo.current
    if (!cv || !cielo) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const lado = cv.clientWidth
    // Pestaña oculta o sin tamaño todavía: se dibuja cuando aparezca (ver el observador de tamaño).
    if (lado < 80) return
    cv.width = cv.height = Math.round(lado * dpr)
    const x = cv.getContext('2d')
    x.setTransform(dpr, 0, 0, dpr, 0, 0)
    const c = lado / 2
    const R = lado / 2 - 18
    const proy = (alt, az) => {
      const r = (R * (90 - alt)) / 90
      const a = (az - giro) * rad
      // mirando hacia arriba con el norte (o el rumbo) arriba: el este queda a la izquierda
      return [c - r * Math.sin(a), c - r * Math.cos(a)]
    }
    const altSol = cielo.sol[0]
    // fondo según la luz del Sol
    const g = x.createRadialGradient(c, c, 0, c, c, R)
    if (altSol > 0) {
      g.addColorStop(0, '#1d4ed8')
      g.addColorStop(1, '#60a5fa')
    } else if (altSol > -12) {
      g.addColorStop(0, '#0b1a45')
      g.addColorStop(1, '#3b2a6b')
    } else {
      g.addColorStop(0, '#030712')
      g.addColorStop(1, '#0b1330')
    }
    x.clearRect(0, 0, lado, lado)
    x.save()
    x.beginPath()
    x.arc(c, c, R, 0, Math.PI * 2)
    x.fillStyle = g
    x.fill()
    x.clip()
    const lista = []
    const brillo = altSol > 0 ? 0.15 : altSol > -12 ? 0.55 : 1
    if (cat) {
      // líneas de constelaciones
      x.strokeStyle = `rgba(147,197,253,${0.35 * brillo})`
      x.lineWidth = 1
      for (const l of cat.lineas) {
        x.beginPath()
        let previo = null
        for (const [ra, dec] of l) {
          const [alt, az] = horizonte((ra + 360) % 360, dec, cielo.lst, punto.lat)
          const p = proy(alt, az)
          if (alt > -5 && previo) x.lineTo(...p)
          else x.moveTo(...p)
          previo = alt > -5
        }
        x.stroke()
      }
      // estrellas
      for (const [ra, dec, mag, nombre] of cat.estrellas) {
        const [alt, az] = horizonte((ra + 360) % 360, dec, cielo.lst, punto.lat)
        if (alt < 0) continue
        const [px, py] = proy(alt, az)
        const r = Math.max(0.5, 2.8 - mag * 0.5)
        x.globalAlpha = Math.min(1, (1.3 - mag * 0.16) * brillo)
        x.fillStyle = colorEstrella(mag)
        x.beginPath()
        x.arc(px, py, r, 0, Math.PI * 2)
        x.fill()
        if (nombre && mag < 1.4) {
          lista.push({ px, py, nombre, tipo: 'Estrella', alt, az })
          x.globalAlpha = 0.85 * brillo
          x.font = '11px system-ui, sans-serif'
          x.fillText(nombre, px + 5, py - 4)
        }
      }
      x.globalAlpha = 0.4 * brillo
      x.fillStyle = '#93c5fd'
      x.font = 'italic 11px system-ui, sans-serif'
      for (const [ra, dec, nombre] of cat.constelaciones) {
        const [alt, az] = horizonte((ra + 360) % 360, dec, cielo.lst, punto.lat)
        if (alt < 15) continue
        const [px, py] = proy(alt, az)
        x.fillText(nombre, px - 18, py + 12)
      }
      x.globalAlpha = 1
    }
    // planetas
    x.font = 'bold 12px system-ui, sans-serif'
    for (const p of cielo.planetas) {
      if (p.alt < 0) continue
      const [px, py] = proy(p.alt, p.az)
      x.fillStyle = p.color
      x.shadowColor = p.color
      x.shadowBlur = 10
      x.beginPath()
      x.arc(px, py, 4.2, 0, Math.PI * 2)
      x.fill()
      x.shadowBlur = 0
      x.fillText(p.nombre, px + 7, py + 4)
      lista.push({ px, py, nombre: p.nombre, tipo: 'Planeta', alt: p.alt, az: p.az, mag: p.mag })
    }
    // Luna con su fase
    if (cielo.luna[0] > -1) {
      const [px, py] = proy(...cielo.luna)
      const r = 11
      x.fillStyle = '#1f2937'
      x.beginPath()
      x.arc(px, py, r, 0, Math.PI * 2)
      x.fill()
      const k = Math.cos(cielo.fase * rad) // 1 nueva, -1 llena
      x.fillStyle = '#f8fafc'
      x.beginPath()
      const creciente = cielo.fase < 180
      // hemisferio sur: la parte iluminada de la Luna creciente está a la izquierda
      const lado1 = creciente ? -1 : 1
      x.arc(px, py, r, -Math.PI / 2, Math.PI / 2, lado1 < 0)
      x.ellipse(px, py, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, (k > 0) === lado1 > 0)
      x.fill()
      x.fillStyle = '#e2e8f0'
      x.font = 'bold 12px system-ui, sans-serif'
      x.fillText('Luna', px + 14, py + 4)
      lista.push({ px, py, nombre: 'la Luna', tipo: 'Luna', alt: cielo.luna[0], az: cielo.luna[1] })
    }
    // Sol
    if (altSol > -1) {
      const [px, py] = proy(...cielo.sol)
      x.fillStyle = '#fde047'
      x.shadowColor = '#fde047'
      x.shadowBlur = 24
      x.beginPath()
      x.arc(px, py, 12, 0, Math.PI * 2)
      x.fill()
      x.shadowBlur = 0
      lista.push({ px, py, nombre: 'el Sol', tipo: 'Sol', alt: altSol, az: cielo.sol[1] })
    }
    x.restore()
    // horizonte y puntos cardinales
    x.strokeStyle = 'rgba(255,255,255,.35)'
    x.lineWidth = 1.5
    x.beginPath()
    x.arc(c, c, R, 0, Math.PI * 2)
    x.stroke()
    x.fillStyle = '#fff'
    x.font = 'bold 13px system-ui, sans-serif'
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    for (const [t, az] of [
      ['N', 0],
      ['E', 90],
      ['S', 180],
      ['O', 270],
    ]) {
      const a = (az - giro) * rad
      x.fillStyle = t === 'N' ? '#f87171' : '#fff'
      x.fillText(t, c - (R + 10) * Math.sin(a), c - (R + 10) * Math.cos(a))
    }
    x.textAlign = 'start'
    x.textBaseline = 'alphabetic'
    objetos.current = lista
  }, [cat, cielo, giro, punto, tam])

  if (!punto) return null

  const tocar = (ev) => {
    const r = lienzo.current.getBoundingClientRect()
    const px = ev.clientX - r.left
    const py = ev.clientY - r.top
    let mejor = null
    let dmin = 26
    for (const o of objetos.current) {
      const d = Math.hypot(o.px - px, o.py - py)
      if (d < dmin) {
        dmin = d
        mejor = o
      }
    }
    setElegido(mejor)
  }

  const visibles = cielo?.planetas.filter((p) => p.alt > 5).map((p) => `${p.nombre} al ${rumbo(p.az)}`) ?? []
  const altSol = cielo?.sol[0] ?? 0

  return (
    <div>
      <div className="relative mx-auto aspect-square w-full max-w-[420px] touch-none select-none">
        <canvas
          ref={lienzo}
          className="h-full w-full cursor-grab active:cursor-grabbing"
          role="img"
          aria-label={`Mapa del cielo sobre ${comuna ?? 'tu comuna'}. ${visibles.length ? `Planetas visibles: ${visibles.join(', ')}.` : ''}`}
          onPointerDown={(e) => {
            arrastre.current = { x: e.clientX, giro, movio: false }
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            const a = arrastre.current
            if (!a) return
            const dx = e.clientX - a.x
            if (Math.abs(dx) > 4) a.movio = true
            if (a.movio && !brujula) setGiro((a.giro - dx * 0.6 + 360) % 360)
          }}
          onPointerUp={(e) => {
            const a = arrastre.current
            arrastre.current = null
            if (a && !a.movio) tocar(e)
          }}
        />
        <span className="absolute top-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white">
          <span className="size-1.5 animate-pulse rounded-full bg-red-500" aria-hidden="true" />
          {desfase ? `+${desfase} h` : 'EN VIVO'} · {fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: desfase ? undefined : '2-digit', hourCycle: 'h23' })}
        </span>
      </div>

      {elegido ? (
        <p className="mt-2 rounded-xl bg-white/10 px-3 py-2 text-[14px] text-white">
          <strong>{elegido.nombre[0].toUpperCase() + elegido.nombre.slice(1)}</strong> ({elegido.tipo.toLowerCase()}): búscalo hacia el <strong>{rumbo(elegido.az)}</strong>, a {Math.round(elegido.alt)}° sobre el horizonte
          {elegido.alt < 15 ? ', bajito' : elegido.alt > 70 ? ', casi sobre tu cabeza' : ''}.
          {elegido.tipo === 'Planeta' && elegido.mag < 1 ? ' Brilla tanto que se ve aunque haya luces de ciudad.' : ''}
        </p>
      ) : (
        <p className="mt-2 text-[14px] text-white/80">
          {altSol > -6
            ? 'Ahora es de día o está oscureciendo: adelanta las horas para ver el cielo de esta noche.'
            : visibles.length
              ? `Ahora puedes ver ${visibles.join(', ')}. Toca un astro para saber más.`
              : 'Toca una estrella para saber cómo se llama.'}
        </p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <label htmlFor="cielo-horas" className="shrink-0 text-[13px] font-bold text-white/80">
          Adelantar
        </label>
        <input id="cielo-horas" type="range" min={0} max={12} step={1} value={desfase} onChange={(e) => setDesfase(Number(e.target.value))} className="flex-1 accent-amber-300" />
        <span className="w-12 text-right text-[13px] font-bold text-white tabular-nums">{desfase ? `+${desfase} h` : 'Ahora'}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={brujula}
          onClick={async () => {
            // iPhone pide permiso para usar la brújula
            if (!brujula && typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
              const r = await DeviceOrientationEvent.requestPermission().catch(() => 'denied')
              if (r !== 'granted') return
            }
            setBrujula(!brujula)
          }}
          className={`min-h-10 rounded-full px-3 text-[13px] font-bold ${brujula ? 'bg-amber-300 text-slate-900' : 'bg-white/12 text-white'}`}
        >
          🧭 {brujula ? 'Siguiendo tu teléfono' : 'Apuntar con el teléfono'}
        </button>
        {(desfase !== 0 || giro !== 0) && (
          <button type="button" onClick={() => (setDesfase(0), setGiro(0), setBrujula(false))} className="min-h-10 rounded-full bg-white/12 px-3 text-[13px] font-bold text-white">
            Volver a ahora
          </button>
        )}
      </div>
      <p className="mt-2 text-[11px] text-white/50">Posiciones calculadas para {comuna ?? 'tu ubicación'} con astronomy-engine. Estrellas: catálogo HYG.</p>
    </div>
  )
}
