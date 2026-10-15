// «El espacio ahora»: la Estación Espacial Internacional moviéndose en vivo sobre un globo que se
// puede girar con el dedo, y el Sol filmado por la NASA en las últimas horas.
import { useEffect, useRef, useState } from 'react'
import { SOL, contornosTierra, describirEEI, ortografica, posicionEEI } from '../services/espacio'

function useVisible(ref) {
  const [v, setV] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) return setV(true)
    const io = new IntersectionObserver(([e]) => setV(e.isIntersecting), { rootMargin: '120px' })
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  return v
}

function Globo({ eei, rastro, punto, seguir, onArrastrar }) {
  const ref = useRef(null)
  const vista = useRef({ lng: -70, lat: -20 })
  const objetivo = useRef(null)
  const arrastre = useRef(null)
  const [tierra, setTierra] = useState(null)

  useEffect(() => {
    contornosTierra()
      .then(setTierra)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (seguir && eei) objetivo.current = { lng: eei.lng, lat: Math.max(-60, Math.min(60, eei.lat)) }
    else if (!seguir && punto && !arrastre.current) objetivo.current = { lng: punto.lng, lat: punto.lat }
  }, [eei, seguir, punto])

  useEffect(() => {
    const cv = ref.current
    const ctx = cv.getContext('2d')
    let raf
    const dibujar = () => {
      raf = requestAnimationFrame(dibujar)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const tam = cv.clientWidth
      if (cv.width !== tam * dpr) {
        cv.width = tam * dpr
        cv.height = tam * dpr
      }
      // Se acerca suave a donde tiene que mirar
      const o = objetivo.current
      if (o && !arrastre.current) {
        let dl = o.lng - vista.current.lng
        dl = ((dl + 540) % 360) - 180
        vista.current.lng += dl * 0.05
        vista.current.lat += (o.lat - vista.current.lat) * 0.05
      }
      const { lng: l0, lat: f0 } = vista.current
      const r = tam * dpr * 0.46
      const c = (tam * dpr) / 2
      ctx.clearRect(0, 0, cv.width, cv.height)
      // Atmósfera y océano
      const g = ctx.createRadialGradient(c - r * 0.3, c - r * 0.35, r * 0.1, c, c, r * 1.08)
      g.addColorStop(0, '#1e5aa8')
      g.addColorStop(0.75, '#0b2a5c')
      g.addColorStop(1, '#030b1f')
      ctx.beginPath()
      ctx.arc(c, c, r, 0, Math.PI * 2)
      ctx.fillStyle = g
      ctx.fill()
      ctx.shadowColor = 'rgba(56,189,248,.7)'
      ctx.shadowBlur = 18 * dpr
      ctx.strokeStyle = 'rgba(125,211,252,.55)'
      ctx.lineWidth = 1.5 * dpr
      ctx.stroke()
      ctx.shadowBlur = 0
      const p = (lng, lat) => ortografica(lng, lat, l0, f0, r, c, c)
      // Paralelos y meridianos
      ctx.strokeStyle = 'rgba(148,197,255,.13)'
      ctx.lineWidth = 1 * dpr
      for (let lat = -60; lat <= 60; lat += 30) linea(ctx, Array.from({ length: 73 }, (_, i) => p(i * 5 - 180, lat)))
      for (let lng = -180; lng < 180; lng += 30) linea(ctx, Array.from({ length: 37 }, (_, i) => p(lng, i * 5 - 90)))
      // Continentes
      if (tierra) {
        ctx.fillStyle = 'rgba(74,222,128,.28)'
        ctx.strokeStyle = 'rgba(134,239,172,.75)'
        ctx.lineWidth = 0.9 * dpr
        for (const anillo of tierra) {
          const pts = anillo.map(([x, y]) => p(x, y))
          if (!pts.some((q) => q[2])) continue
          ctx.beginPath()
          let dentro = false
          for (const [x, y, v] of pts) {
            if (!v) {
              dentro = false
              continue
            }
            if (dentro) ctx.lineTo(x, y)
            else ctx.moveTo(x, y)
            dentro = true
          }
          if (pts.every((q) => q[2])) {
            ctx.closePath()
            ctx.fill()
          }
          ctx.stroke()
        }
      }
      // La persona
      if (punto) {
        const [x, y, v] = p(punto.lng, punto.lat)
        if (v) {
          ctx.fillStyle = '#fbbf24'
          ctx.beginPath()
          ctx.arc(x, y, 4 * dpr, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      // Rastro y posición de la EEI
      if (rastro.length > 1) {
        ctx.strokeStyle = 'rgba(244,114,182,.75)'
        ctx.lineWidth = 2 * dpr
        linea(ctx, rastro.map((q) => p(q.lng, q.lat)))
      }
      if (eei) {
        const [x, y, v] = p(eei.lng, eei.lat)
        if (v) {
          const pulso = 1 + 0.35 * Math.sin(performance.now() / 260)
          ctx.fillStyle = 'rgba(244,114,182,.28)'
          ctx.beginPath()
          ctx.arc(x, y, 11 * dpr * pulso, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#fff'
          ctx.beginPath()
          ctx.arc(x, y, 4.5 * dpr, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = '#f472b6'
          ctx.fillRect(x - 9 * dpr, y - 1.5 * dpr, 18 * dpr, 3 * dpr) // paneles solares
        }
      }
      // Brillo del borde (luz del Sol)
      const b = ctx.createRadialGradient(c - r * 0.45, c - r * 0.5, 0, c - r * 0.45, c - r * 0.5, r * 0.9)
      b.addColorStop(0, 'rgba(255,255,255,.16)')
      b.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = b
      ctx.beginPath()
      ctx.arc(c, c, r, 0, Math.PI * 2)
      ctx.fill()
    }
    dibujar()
    return () => cancelAnimationFrame(raf)
  }, [tierra, eei, rastro, punto])

  // Girar el globo con el dedo
  const bajar = (e) => {
    arrastre.current = { x: e.clientX, y: e.clientY, ...vista.current }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    onArrastrar?.()
  }
  const mover = (e) => {
    const a = arrastre.current
    if (!a) return
    const k = 180 / e.currentTarget.clientWidth
    vista.current = { lng: a.lng - (e.clientX - a.x) * k, lat: Math.max(-80, Math.min(80, a.lat + (e.clientY - a.y) * k)) }
  }
  const soltar = () => {
    arrastre.current = null
    objetivo.current = null
  }
  return (
    <canvas
      ref={ref}
      onPointerDown={bajar}
      onPointerMove={mover}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      className="aspect-square w-full max-w-[260px] cursor-grab touch-none active:cursor-grabbing"
      role="img"
      aria-label={eei ? `Globo terrestre: la Estación Espacial está en latitud ${eei.lat.toFixed(1)}, longitud ${eei.lng.toFixed(1)}` : 'Globo terrestre'}
    />
  )
}

function linea(ctx, pts) {
  ctx.beginPath()
  let dentro = false
  for (const [x, y, v] of pts) {
    if (!v) {
      dentro = false
      continue
    }
    if (dentro) ctx.lineTo(x, y)
    else ctx.moveTo(x, y)
    dentro = true
  }
  ctx.stroke()
}

function VisorSol({ s, onCerrar }) {
  useEffect(() => {
    const t = (e) => e.key === 'Escape' && onCerrar()
    document.addEventListener('keydown', t)
    return () => document.removeEventListener('keydown', t)
  }, [onCerrar])
  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/90 p-4" onClick={onCerrar} role="dialog" aria-modal="true" aria-label={s.nombre}>
      <div className="w-full max-w-lg text-white" onClick={(e) => e.stopPropagation()}>
        <video src={s.video} autoPlay muted loop playsInline controls className="aspect-square w-full rounded-3xl bg-black" />
        <p className="mt-3 text-[19px] font-bold">{s.nombre}</p>
        <p className="mt-1 text-[15px] text-white/80">{s.detalle}</p>
        <p className="mt-1 text-[12px] text-white/55">Imagen: {s.credito}</p>
        <button type="button" onClick={onCerrar} className="mt-3 min-h-12 w-full rounded-full bg-white/15 text-[16px] font-bold">
          Cerrar
        </button>
      </div>
    </div>
  )
}

export default function EspacioEnVivo({ punto }) {
  const ref = useRef(null)
  const visible = useVisible(ref)
  const [eei, setEei] = useState(null)
  const [rastro, setRastro] = useState([])
  const [error, setError] = useState(false)
  const [seguir, setSeguir] = useState(true)
  const [sol, setSol] = useState(null)

  useEffect(() => {
    if (!visible) return
    let vivo = true
    const ctrl = new AbortController()
    const cargar = async () => {
      if (document.hidden) return
      try {
        const p = await posicionEEI({ signal: ctrl.signal })
        if (!vivo) return
        setEei(p)
        setError(false)
        setRastro((r) => [...r, p].slice(-60))
      } catch {
        if (vivo) setError(true)
      }
    }
    cargar()
    const id = setInterval(cargar, 4000)
    return () => {
      vivo = false
      ctrl.abort()
      clearInterval(id)
    }
  }, [visible])

  const info = describirEEI(eei, punto)
  return (
    <section ref={ref} aria-labelledby="t-espacio" className="cielo-tarjeta">
      <div className="cielo-estrellas" aria-hidden="true" />
      <div className="relative text-white">
        <h2 id="t-espacio" className="flex items-center gap-2 text-[19px] font-bold">
          El espacio ahora
          <span className="flex items-center gap-1 rounded-full bg-red-500/90 px-2 py-0.5 text-[11px] tracking-wider uppercase">
            <span className="size-1.5 animate-pulse rounded-full bg-white" aria-hidden="true" /> En vivo
          </span>
        </h2>

        <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          <Globo eei={eei} rastro={rastro} punto={punto} seguir={seguir} onArrastrar={() => setSeguir(false)} />
          <div className="w-full min-w-0 flex-1">
            <p className="text-[17px] font-bold">Estación Espacial Internacional</p>
            {error && !eei && <p className="text-[14px] text-amber-300">No pudimos ubicarla ahora. Reintentando…</p>}
            {eei && (
              <>
                <p className={`text-[15px] ${info.sobreChile || (info.km != null && info.km < 2500) ? 'font-bold text-pink-300' : 'text-white/85'}`} aria-live="polite">
                  {info.texto}
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-[13px]">
                  <div className="rounded-xl bg-white/8 px-2.5 py-1.5">
                    <dt className="text-white/60">Velocidad</dt>
                    <dd className="text-[16px] font-bold tabular-nums">{Math.round(eei.velocidad).toLocaleString('es-CL')} km/h</dd>
                  </div>
                  <div className="rounded-xl bg-white/8 px-2.5 py-1.5">
                    <dt className="text-white/60">Altura</dt>
                    <dd className="text-[16px] font-bold tabular-nums">{Math.round(eei.altitud)} km</dd>
                  </div>
                  <div className="rounded-xl bg-white/8 px-2.5 py-1.5">
                    <dt className="text-white/60">Posición</dt>
                    <dd className="font-bold tabular-nums">
                      {Math.abs(eei.lat).toFixed(1)}° {eei.lat < 0 ? 'S' : 'N'} · {Math.abs(eei.lng).toFixed(1)}° {eei.lng < 0 ? 'O' : 'E'}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-white/8 px-2.5 py-1.5">
                    <dt className="text-white/60">Allá es</dt>
                    <dd className="font-bold">{eei.visibilidad === 'daylight' ? 'de día ☀️' : 'de noche 🌙'}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-[12px] text-white/60">Da una vuelta a la Tierra cada 92 minutos. Gira el globo con el dedo.</p>
                {!seguir && (
                  <button type="button" onClick={() => setSeguir(true)} className="mt-2 min-h-10 rounded-full bg-white/12 px-4 text-[14px] font-bold">
                    Seguir a la Estación
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <h3 className="mt-5 text-[16px] font-bold">El Sol, filmado desde el espacio</h3>
        <ul className="mt-2 grid grid-cols-2 gap-3">
          {SOL.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => setSol(s)} className="block w-full text-left" aria-label={`Ver ${s.nombre}`}>
                <span className="relative block aspect-square overflow-hidden rounded-2xl bg-black ring-1 ring-white/15">
                  {visible && <video src={s.video} poster={s.imagen ?? undefined} autoPlay muted loop playsInline preload="metadata" className="h-full w-full object-cover" aria-hidden="true" />}
                  <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-bold">▶ Últimas horas</span>
                </span>
                <span className="mt-1 block text-[14px] leading-tight font-bold">{s.nombre}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12px] text-white/55">Datos: wheretheiss.at · NASA SDO · SOHO (ESA/NASA).</p>
      </div>
      {sol && <VisorSol s={sol} onCerrar={() => setSol(null)} />}
    </section>
  )
}
