// «Pasea con ZUMI»: caminar por Chile a nivel de calle, en 3D, como un simulador.
// Foto satelital real + edificios reales de OpenStreetMap + cielo y clima reales de ese lugar ahora.
// ZUMI va contando lo que hay cerca (Wikipedia) y muestra fotos reales tomadas ahí (Wikimedia Commons).
// No es Street View: es una maqueta 3D del lugar real, y lo dice.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as maplibregl from 'maplibre-gl'
import urlTrabajador from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import 'maplibre-gl/dist/maplibre-gl.css'
import { PASEOS, PLAZA_LINARES, lugaresCerca, fotosCerca, climaAqui, avanzar, narracion, ladoDe, rumboHacia } from '../services/paseo'
import { buscarLugares, resolverDestino } from '../services/ruta'
import { distanciaKm } from '../services/familiaGPS'
import { hablar, callar } from '../services/narrador'
import { registrarEsri } from '../services/satelite'
import { abrirCalle } from '../services/calle'

maplibregl.setWorkerUrl(urlTrabajador)
registrarEsri(maplibregl)

const ESTILO = 'https://tiles.openfreemap.org/styles/liberty'
const SATELITE = 'esri://{z}/{y}/{x}' // con respaldo: donde falta la foto de cerca, se amplía la de más arriba
const VEL = { caminar: 2.2, trotar: 7 } // metros por segundo (un poco más rápido que la vida real, para que no aburra)
const GIRO = 70 // grados por segundo
const RADIO_CONTAR = 70 // metros: ZUMI cuenta un lugar al acercarse a esta distancia

const leerVoz = () => {
  try {
    return localStorage.getItem('ac:paseo-voz') !== '0'
  } catch {
    return true
  }
}

export default function PaseoZumi({ lugar = PLAZA_LINARES, onCerrar }) {
  const caja = useRef(null)
  const mapa = useRef(null)
  const teclas = useRef({ adelante: 0, atras: 0, izq: 0, der: 0 })
  const dichos = useRef(new Set())
  const ultimoPedido = useRef(null)
  const [inicio, setInicio] = useState(lugar)
  const [listo, setListo] = useState(false)
  const [yo, setYo] = useState({ lat: lugar.lat, lng: lugar.lng, rumbo: lugar.rumbo ?? 0 })
  const [lugares, setLugares] = useState([])
  const [fotos, setFotos] = useState([])
  const [clima, setClima] = useState(null)
  const [cuenta, setCuenta] = useState(null) // lo que ZUMI está contando
  const [foto, setFoto] = useState(null)
  const [voz, setVoz] = useState(leerVoz)
  const [rapido, setRapido] = useState(false)
  const [buscar, setBuscar] = useState(false)
  const [q, setQ] = useState('')
  const [satelite, setSatelite] = useState(true)
  const [contar, setContar] = useState(false) // tras la bienvenida, ZUMI empieza a contar lugares
  const [turno, setTurno] = useState(0) // un lugar a la vez: el siguiente espera a que termine el anterior
  const vozRef = useRef(voz)
  const rapidoRef = useRef(rapido)
  vozRef.current = voz
  const inicioRef = useRef(inicio.id)
  inicioRef.current = inicio.id
  rapidoRef.current = rapido

  // ---- El mapa a nivel de calle ----
  useEffect(() => {
    const m = new maplibregl.Map({
      container: caja.current,
      style: ESTILO,
      center: [inicio.lng, inicio.lat],
      zoom: 18.6,
      pitch: 78,
      maxPitch: 85,
      bearing: inicio.rumbo ?? 0,
      attributionControl: false, // los créditos van en una línea propia abajo (no tapan las flechas)
      dragRotate: true,
      touchPitch: true,
      fadeDuration: 0,
    })
    mapa.current = m
    m.on('error', (e) => console.warn('paseo:', e?.error?.message ?? e))
    m.on('load', () => {
      const capas = m.getStyle().layers
      const primeraEtiqueta = capas.find((l) => l.type === 'symbol')?.id
      m.addSource('paseo-sat', { type: 'raster', tiles: [SATELITE], tileSize: 256, maxzoom: 20, attribution: 'Foto: Esri, Maxar, Earthstar Geographics' })
      m.addLayer({ id: 'paseo-sat', type: 'raster', source: 'paseo-sat', paint: { 'raster-fade-duration': 0 } }, primeraEtiqueta)
      // edificios reales en 3D (si el estilo no los trae ya)
      if (!capas.some((l) => l.type === 'fill-extrusion')) {
        m.addLayer(
          {
            id: 'paseo-edificios',
            type: 'fill-extrusion',
            source: 'openmaptiles',
            'source-layer': 'building',
            minzoom: 14,
            paint: {
              'fill-extrusion-color': '#e8e1d6',
              'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 7],
              'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
              'fill-extrusion-opacity': 0.92,
            },
          },
          primeraEtiqueta,
        )
      }
      aplicarBase(m, true)
      try {
        m.setSky({ 'sky-color': '#5b9be0', 'horizon-color': '#d9e9f7', 'fog-color': '#e6eef6', 'sky-horizon-blend': 0.7, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.35 })
      } catch {
        /* estilo sin cielo */
      }
      setListo(true)
    })
    const sync = () => {
      const c = m.getCenter()
      setYo({ lat: c.lat, lng: c.lng, rumbo: (m.getBearing() + 360) % 360 })
    }
    m.on('moveend', sync)
    let t = 0
    m.on('move', () => {
      if (Date.now() - t > 250) {
        t = Date.now()
        sync()
      }
    })
    return () => {
      m.remove()
      mapa.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Caminar: flechas en pantalla, teclado (WASD / flechas) ----
  useEffect(() => {
    let raf = 0
    let antes = performance.now()
    const paso = (ahora) => {
      const dt = Math.min(0.25, (ahora - antes) / 1000) // hasta 0,25 s: en celulares lentos se camina igual de rápido
      antes = ahora
      const m = mapa.current
      const k = teclas.current
      if (m && (k.adelante || k.atras || k.izq || k.der)) {
        let rumbo = m.getBearing() + (k.der - k.izq) * GIRO * dt
        const v = (k.adelante - k.atras) * (rapidoRef.current ? VEL.trotar : VEL.caminar)
        const c = m.getCenter()
        const n = v ? avanzar({ lat: c.lat, lng: c.lng }, rumbo, v * dt) : { lat: c.lat, lng: c.lng }
        m.jumpTo({ center: [n.lng, n.lat], bearing: rumbo })
      }
      raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    const MAPA = { ArrowUp: 'adelante', KeyW: 'adelante', ArrowDown: 'atras', KeyS: 'atras', ArrowLeft: 'izq', KeyA: 'izq', ArrowRight: 'der', KeyD: 'der' }
    const abajo = (e) => {
      if (e.target?.tagName === 'INPUT') return
      if (e.key === 'Escape') return onCerrar?.()
      const k = MAPA[e.code]
      if (!k) return
      e.preventDefault()
      teclas.current[k] = 1
    }
    const arriba = (e) => {
      const k = MAPA[e.code]
      if (k) teclas.current[k] = 0
    }
    window.addEventListener('keydown', abajo)
    window.addEventListener('keyup', arriba)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', abajo)
      window.removeEventListener('keyup', arriba)
    }
  }, [onCerrar])

  // ---- Datos reales alrededor (se piden de nuevo al alejarse 250 m) ----
  useEffect(() => {
    const u = ultimoPedido.current
    if (u && distanciaKm(u, yo) < 0.25) return
    ultimoPedido.current = { lat: yo.lat, lng: yo.lng }
    const ctl = new AbortController()
    lugaresCerca(yo, { signal: ctl.signal, id: !u ? inicio.id : undefined })
      .then(setLugares)
      .catch(() => {})
    fotosCerca(yo, { signal: ctl.signal })
      .then(setFotos)
      .catch(() => {})
    if (!u) climaAqui(yo, { signal: ctl.signal }).then(setClima)
  }, [yo.lat, yo.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  // Distancias en vivo
  const cerca = lugares.map((l) => ({ ...l, m: Math.round(distanciaKm(yo, l) * 1000) })).sort((a, b) => a.m - b.m)
  const fotosVivas = fotos.map((f) => ({ ...f, m: Math.round(distanciaKm(yo, f) * 1000) })).sort((a, b) => a.m - b.m)

  // ZUMI cuenta el lugar más cercano que aún no contó (de a uno; el siguiente cuando termina)
  const ocupado = useRef(false)
  useEffect(() => {
    if (!listo || !contar || ocupado.current) return
    const l = cerca.find((x) => x.m <= RADIO_CONTAR && !dichos.current.has(x.id))
    if (!l) return
    dichos.current.add(l.id)
    const texto = narracion(l, yo.rumbo, yo)
    setCuenta({ ...l, texto })
    ocupado.current = true
    const id = inicio.id
    let hecho = false
    const seguir = () => {
      if (hecho) return
      hecho = true
      ocupado.current = false
      if (id === inicioRef.current) setTurno((n) => n + 1)
    }
    setTimeout(seguir, vozRef.current ? 25000 : 9000)
    if (vozRef.current) hablar([texto]).then(() => setTimeout(seguir, 1500), seguir)
  }, [listo, contar, turno, cerca.map((x) => `${x.id}:${x.m <= RADIO_CONTAR}`).join()]) // eslint-disable-line react-hooks/exhaustive-deps

  // Bienvenida
  useEffect(() => {
    if (!listo) return
    const t = `Bienvenido a ${inicio.nombre}. Camina con las flechas o arrastra para mirar alrededor. Te voy contando lo que hay cerca.`
    setCuenta({ id: 'hola', titulo: inicio.nombre, texto: t, fuente: 'ZUMI' })
    setContar(false)
    let vivo = true
    const seguir = () => vivo && setContar(true)
    const reloj = setTimeout(seguir, 9000)
    if (vozRef.current) hablar([t]).then(seguir, seguir)
    else setTimeout(seguir, 2500)
    return () => {
      vivo = false
      clearTimeout(reloj)
    }
  }, [listo, inicio.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => callar(), [])
  // la tarjeta se esconde sola para dejar ver la calle
  useEffect(() => {
    if (!cuenta) return
    const t = setTimeout(() => setCuenta((c) => (c?.id === cuenta.id ? null : c)), 16000)
    return () => clearTimeout(t)
  }, [cuenta?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pines de los lugares en el mapa
  useEffect(() => {
    const m = mapa.current
    if (!m || !listo) return
    const marcas = lugares.slice(0, 15).map((l) => {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'paseo-pin'
      el.textContent = l.titulo
      el.setAttribute('aria-label', `Ir hacia ${l.titulo}`)
      el.onclick = () => mirarA(l)
      return new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([l.lng, l.lat]).addTo(m)
    })
    return () => marcas.forEach((x) => x.remove())
  }, [lugares, listo]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cielo según la hora y el clima real del lugar
  useEffect(() => {
    const m = mapa.current
    if (!m || !listo || !clima) return
    const noche = !clima.dia
    const gris = clima.lluvia || clima.nubes > 75
    try {
      m.setSky(
        noche
          ? { 'sky-color': '#071228', 'horizon-color': '#26365a', 'fog-color': '#1b2640', 'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.4 }
          : gris
            ? { 'sky-color': '#8b97a6', 'horizon-color': '#c7ced6', 'fog-color': '#c9d0d8', 'sky-horizon-blend': 0.7, 'horizon-fog-blend': 0.7, 'fog-ground-blend': 0.45 }
            : { 'sky-color': '#4a8fe0', 'horizon-color': '#d9e9f7', 'fog-color': '#e6eef6', 'sky-horizon-blend': 0.7, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.35 },
      )
    } catch {
      /* sin cielo */
    }
  }, [clima, listo])

  useEffect(() => {
    if (mapa.current && listo) aplicarBase(mapa.current, satelite)
  }, [satelite, listo])

  function mirarA(l) {
    const m = mapa.current
    if (!m) return
    const c = m.getCenter()
    m.easeTo({ bearing: rumboHacia({ lat: c.lat, lng: c.lng }, l), duration: 900 })
  }
  async function irA(p0) {
    const p = await resolverDestino(p0).catch(() => p0)
    const m = mapa.current
    setBuscar(false)
    setQ('')
    dichos.current = new Set()
    ocupado.current = false
    ultimoPedido.current = null
    setLugares([])
    setFotos([])
    setClima(null)
    const nuevo = { id: p.id, nombre: p.nombre, lat: p.lat, lng: p.lng, rumbo: p.rumbo ?? 0 }
    setInicio(nuevo)
    m?.jumpTo({ center: [p.lng, p.lat], bearing: nuevo.rumbo, pitch: 78, zoom: 18.6 })
  }
  const cambiarVoz = () => {
    const v = !voz
    setVoz(v)
    if (!v) callar()
    try {
      localStorage.setItem('ac:paseo-voz', v ? '1' : '0')
    } catch {
      /* sin almacenamiento */
    }
  }

  const sostener = (k) => ({
    onPointerDown: (e) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture?.(e.pointerId)
      teclas.current[k] = 1
    },
    onPointerUp: () => (teclas.current[k] = 0),
    onPointerCancel: () => (teclas.current[k] = 0),
    onLostPointerCapture: () => (teclas.current[k] = 0),
    onContextMenu: (e) => e.preventDefault(),
  })

  const resultados = q.trim().length >= 2 ? buscarLugares(q, 6) : PASEOS
  const proximo = cerca.find((x) => !dichos.current.has(x.id) && x.m > RADIO_CONTAR)

  return createPortal(
    <div className="paseo fixed inset-0 z-[1200] bg-black text-white" role="dialog" aria-label={`Pasea con ZUMI: ${inicio.nombre}`}>
      <div className="absolute inset-0">
        <div ref={caja} className="h-full w-full" />
      </div>
      {clima?.lluvia && <div className="paseo-lluvia pointer-events-none absolute inset-0" aria-hidden="true" />}
      {!listo && (
        <div className="absolute inset-0 grid place-items-center bg-black">
          <p className="rotulo">Armando {inicio.nombre} en 3D…</p>
        </div>
      )}

      {/* Cabecera */}
      <div className="absolute top-0 right-0 left-0 flex items-start gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onCerrar} aria-label="Salir del paseo" className="vidrio-solido grid size-11 shrink-0 place-items-center rounded-full text-[20px]">
          ✕
        </button>
        <button type="button" onClick={() => setBuscar(true)} className="vidrio-solido min-w-0 flex-1 rounded-[18px] px-3 py-2 text-left">
          <span className="rotulo flex items-center gap-1.5 !text-[9.5px]">
            <span className="punto-vivo" aria-hidden="true" /> Pasea con ZUMI{clima ? ` · ${clima.temp}° ahora` : ''}
          </span>
          <span className="block truncate text-[15px] font-semibold">{inicio.nombre}</span>
        </button>
        <button type="button" onClick={() => mapa.current?.easeTo({ bearing: 0, duration: 600 })} aria-label={`Brújula: mirando a ${Math.round(yo.rumbo)} grados. Toca para mirar al norte`} className="vidrio-solido grid size-11 shrink-0 place-items-center rounded-full">
          <span className="mono text-[11px] font-bold" style={{ transform: `rotate(${-yo.rumbo}deg)`, display: 'inline-block' }}>
            ▲N
          </span>
        </button>
      </div>

      {/* Lo que cuenta ZUMI */}
      {cuenta && (
        <div className="paseo-cuenta vidrio-solido absolute top-[4.6rem] right-3 left-3 mx-auto max-w-md rounded-[20px] p-3" aria-live="polite">
          <div className="flex gap-3">
            <img src={`${import.meta.env.BASE_URL}zumi/viajes/avatar.png`} alt="" className="size-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <p className="rotulo !text-[9.5px]">
                ZUMI te cuenta{cuenta.fuente && cuenta.fuente !== 'ZUMI' ? ` · ${cuenta.fuente}` : ''}
              </p>
              <p className="mt-0.5 text-[14.5px] leading-snug">{cuenta.texto}</p>
              {cuenta.url && (
                <a href={cuenta.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[12.5px] text-texto-2 underline">
                  Leer más en Wikipedia
                </a>
              )}
            </div>
            <button type="button" onClick={() => setCuenta(null)} aria-label="Cerrar" className="size-8 shrink-0 text-texto-2">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Fotos reales de aquí */}
      {fotosVivas.length > 0 && (
        <div className="absolute right-0 bottom-[12.6rem] left-0 px-3">
          <p className="rotulo mb-1 !text-[9.5px] [text-shadow:0_1px_4px_#000]">Fotos reales tomadas aquí</p>
          <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            {fotosVivas.slice(0, 10).map((f) => (
              <button key={f.id} type="button" onClick={() => setFoto(f)} className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/30">
                <img src={f.url} alt={f.titulo} loading="lazy" className="size-full object-cover" />
                <span className="mono absolute right-1 bottom-0.5 text-[10px] [text-shadow:0_1px_3px_#000]">{f.m} m</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Controles para caminar */}
      <div className="absolute right-0 bottom-0 left-0 flex items-end justify-between gap-3 p-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-col gap-2">
          <button type="button" onClick={cambiarVoz} aria-pressed={voz} className="vidrio-solido rounded-full px-3 py-2 text-[13px] font-semibold">
            {voz ? '🔊 ZUMI habla' : '🔇 En silencio'}
          </button>
          <button type="button" onClick={() => setRapido(!rapido)} aria-pressed={rapido} className="vidrio-solido rounded-full px-3 py-2 text-[13px] font-semibold">
            {rapido ? '🏃 Trotando' : '🚶 Caminando'}
          </button>
          <button type="button" onClick={() => setSatelite(!satelite)} aria-pressed={satelite} className="vidrio-solido rounded-full px-3 py-2 text-[13px] font-semibold">
            {satelite ? '🛰️ Foto real' : '🗺️ Mapa'}
          </button>
          <button type="button" onClick={() => abrirCalle({ lat: yo.lat, lng: yo.lng, nombre: inicio.nombre })} className="vidrio-solido rounded-full px-3 py-2 text-[13px] font-semibold">
            📷 Calle real
          </button>
        </div>
        <div className="paseo-cruz grid grid-cols-3 grid-rows-2 gap-1.5" aria-label="Flechas para caminar">
          <span />
          <button type="button" aria-label="Caminar hacia adelante" className="paseo-flecha" {...sostener('adelante')}>
            ▲
          </button>
          <span />
          <button type="button" aria-label="Girar a la izquierda" className="paseo-flecha" {...sostener('izq')}>
            ◀
          </button>
          <button type="button" aria-label="Caminar hacia atrás" className="paseo-flecha" {...sostener('atras')}>
            ▼
          </button>
          <button type="button" aria-label="Girar a la derecha" className="paseo-flecha" {...sostener('der')}>
            ▶
          </button>
        </div>
      </div>
      {proximo && (
        <button type="button" onClick={() => mirarA(proximo)} className="vidrio-solido absolute right-3 bottom-[10rem] left-3 mx-auto max-w-md truncate rounded-full px-3 py-2 text-left text-[13px]">
          Cerca: <b>{proximo.titulo}</b> · {proximo.m} m {ladoDe(yo.rumbo, rumboHacia(yo, proximo))}
        </button>
      )}
      <p className="pointer-events-none absolute right-2 bottom-[max(0.3rem,calc(env(safe-area-inset-bottom)-0.9rem))] left-2 truncate text-center text-[9.5px] text-white/65 [text-shadow:0_1px_3px_#000]">
        Maqueta 3D del lugar real, no es Street View · Foto: Esri, Maxar · Mapa: OpenFreeMap © OpenStreetMap
      </p>

      {/* Ver una foto */}
      {foto && (
        <div className="absolute inset-0 z-10 flex flex-col bg-black/92 p-4" onClick={() => setFoto(null)}>
          <img src={foto.url} alt={foto.titulo} className="m-auto max-h-[70vh] max-w-full rounded-2xl object-contain" />
          <p className="mt-3 text-[14px]">{foto.titulo}</p>
          <p className="text-[12px] text-white/70">
            Foto: {foto.autor} · {foto.licencia} · a {foto.m} m de ti
          </p>
          <a href={foto.pagina} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="mt-1 text-[12.5px] text-white/80 underline">
            Ver en Wikimedia Commons
          </a>
        </div>
      )}

      {/* Elegir dónde pasear */}
      {buscar && (
        <div className="absolute inset-0 z-10 bg-black/80 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]" onClick={() => setBuscar(false)}>
          <div className="vidrio-solido mx-auto max-w-md rounded-[22px] p-3" onClick={(e) => e.stopPropagation()}>
            <p className="rotulo mb-2">¿Dónde quieres pasear?</p>
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Escribe una comuna o lugar" className="w-full rounded-xl bg-white/10 px-3 py-2.5 text-[16px] outline-none" />
            <ul className="mt-2 max-h-[55vh] overflow-y-auto">
              {resultados.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => irA(r)} className="w-full rounded-xl px-2 py-2.5 text-left active:bg-white/10">
                    <span className="block text-[15px] font-medium">{r.nombre}</span>
                    {r.sub && <span className="block text-[12px] text-texto-2">{r.sub}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}

// Foto satelital real, o el mapa dibujado (se esconden los rellenos del mapa bajo la foto).
function aplicarBase(m, sat) {
  if (!m.getLayer('paseo-sat')) return
  m.setLayoutProperty('paseo-sat', 'visibility', sat ? 'visible' : 'none')
  for (const l of m.getStyle().layers) {
    if (l.type === 'fill' || l.type === 'background') m.setLayoutProperty(l.id, 'visibility', sat ? 'none' : 'visible')
    if (l.type === 'fill-extrusion') m.setPaintProperty(l.id, 'fill-extrusion-opacity', sat ? 0.85 : 1)
  }
}
