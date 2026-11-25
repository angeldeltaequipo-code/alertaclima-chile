// «Pasea con ZUMI»: Chile convertido en videojuego 3D. Calles, casas, plazas y ríos reales de
// OpenStreetMap (y casas generadas donde el mapa no las tiene), con cielo y clima reales de ahora.
// ZUMI va contando lo que hay cerca (Wikipedia) y muestra fotos reales tomadas ahí (Wikimedia Commons).
// No es Street View: es una maqueta 3D del lugar real, y lo dice.
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PASEOS, CIUDADES_3D, paseoParaComuna, lugaresCerca, fotosCerca, climaAqui, avanzar, narracion, ladoDe, rumboHacia } from '../services/paseo'
import { buscarLugares, resolverDestino } from '../services/ruta'
import { distanciaKm } from '../services/familiaGPS'
import { hablar, callar } from '../services/narrador'
import { Mundo } from '../services/mundo/motor'
import { API_URL } from '../services/reportes'
import { ALCANCE, objetivos as armarObjetivos, progreso, guardarProgreso, sonidoLogro, sonidoTurbo } from '../services/paseoJuego'
import { abrirCalle } from '../services/calle'

// Modos de recorrido, como en un juego de mundo abierto: cada uno con su cámara, velocidad y aceleración.
// vmax en m/s (un poco más rápido que la vida real para que no aburra); zoom/pitch = la cámara.
export const MODOS = {
  pie: { nombre: 'A pie', icono: '🚶', vmax: 2.6, acel: 4, giro: 75, zoom: 18.6, pitch: 78 },
  bici: { nombre: 'Bici', icono: '🚲', vmax: 8, acel: 4, giro: 62, zoom: 18.1, pitch: 77 },
  auto: { nombre: 'Auto', icono: '🚗', vmax: 28, acel: 7, giro: 48, zoom: 17.2, pitch: 74 },
  dron: { nombre: 'Dron', icono: '🛸', vmax: 85, acel: 18, giro: 45, zoom: 15.2, pitch: 70 },
}
const RADIO_CONTAR = 70 // metros: ZUMI cuenta un lugar al acercarse a esta distancia

const leerVoz = () => {
  try {
    return localStorage.getItem('ac:paseo-voz') !== '0'
  } catch {
    return true
  }
}

export default function PaseoZumi({ lugar: lugarPedido, comuna, onCerrar }) {
  const lugar = lugarPedido ?? paseoParaComuna(comuna)
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
  const [fotorreal, setFotorreal] = useState(false)
  const creditos = useRef(null)
  const tokenFoto = useRef(null)
  const [soloAire, setSoloAire] = useState(false) // ciudad sin 3D: se recorre desde el aire
  // Mientras llega la maqueta 3D real se muestra una pantalla de carga limpia (sin fichas encima)
  const [esperaFoto, setEsperaFoto] = useState(true)
  // No llegó la foto real de Google: en vez de mostrar una ciudad inventada, ZUMI lo dice y ofrece otra
  const [sinFoto, setSinFoto] = useState(false)
  useEffect(() => {
    if (fotorreal || soloAire) setEsperaFoto(false)
  }, [fotorreal, soloAire])
  useEffect(() => {
    const t = setTimeout(() => setEsperaFoto(false), 30000)
    return () => clearTimeout(t)
  }, [inicio.id])
  const cargandoMundo = !listo || esperaFoto
  const [foto, setFoto] = useState(null)
  const [voz, setVoz] = useState(leerVoz)
  const [modo, setModo] = useState('pie')
  const [tablero, setTablero] = useState({ kmh: 0, alt: null })
  const vel = useRef(0) // velocidad actual (m/s), con aceleración y freno suaves
  const [juego, setJuego] = useState(() => {
    const p = progreso()
    return { puntos: p.puntos, recogidos: new Set(p.recogidos) }
  })
  const juegoRef = useRef(juego)
  juegoRef.current = juego
  // Mirar moviendo el teléfono (giroscopio): el primer paso hacia lentes de realidad virtual.
  const [mirarConTelefono, setMirarConTelefono] = useState(false)
  const hayGiroscopio = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window
  const [logro, setLogro] = useState(null) // aviso «+150 ¡Descubriste…!»
  const modoElegido = useRef(false) // si la persona eligió un modo, no se cambia solo
  const [buscar, setBuscar] = useState(false)
  const [q, setQ] = useState('')
  const [contar, setContar] = useState(false) // tras la bienvenida, ZUMI empieza a contar lugares
  const [turno, setTurno] = useState(0) // un lugar a la vez: el siguiente espera a que termine el anterior
  const vozRef = useRef(voz)
  const modoRef = useRef(modo)
  modoRef.current = modo
  vozRef.current = voz
  const inicioRef = useRef(inicio.id)
  inicioRef.current = inicio.id

  // ---- El mundo 3D ----
  useEffect(() => {
    const m = new Mundo(caja.current, { lat: inicio.lat, lng: inicio.lng, rumbo: inicio.rumbo ?? 0, modo: modoRef.current })
    mapa.current = m
    // Si está configurada, la maqueta fotorrealista de Google (vía Cesium ion) reemplaza al mundo dibujado
    fetch(`${API_URL}/api/calle/mundo`, { cache: 'no-store', signal: AbortSignal.timeout(20000) })
      .then((r) => r.json())
      .then((c) => {
        tokenFoto.current = c.cesium
        if (!c.fotorreal) {
          setEsperaFoto(false)
          setSinFoto(true)
        }
        return c.fotorreal && m.activarFotorreal(c.cesium)
      })
      .catch(() => {
        setEsperaFoto(false)
        setSinFoto(true)
      })
    m.alFotorreal = setFotorreal
    m.alSinFoto = () => {
      setEsperaFoto(false)
      setSinFoto(true)
    }
    m.alSoloAire = (si) => {
      setSoloAire(si)
      if (si) setModo('dron')
    }
    m.alListo = () => {
      setListo(true)
      // En la naturaleza (sin casas cerca) se parte en Dron: a pie solo se vería pasto.
      if (!modoElegido.current && !m.foto && m.edificiosCerca(300) < 4) cambiarModo('dron', false)
    }
    return () => {
      m.remove()
      mapa.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Caminar: flechas en pantalla, teclado (WASD / flechas) ----
  useEffect(() => {
    let raf = 0
    let ultimoTablero = 0
    let ultimoYo = 0
    let antes = performance.now()
    const paso = (ahora) => {
      const dt = Math.min(0.25, (ahora - antes) / 1000) // hasta 0,25 s: en celulares lentos se camina igual de rápido
      antes = ahora
      const m = mapa.current
      const k = teclas.current
      const md = MODOS[modoRef.current]
      // aceleración y freno suaves (inercia), como un vehículo de verdad
      const j = joy.current
      // Con el dedo: arrastra hacia donde quieres ir; más lejos = más rápido, al borde = corre
      const turbo = (k.turbo || (j.activo && j.fuerza > 1)) ? (modoRef.current === 'pie' ? 2.3 : 1.7) : 1
      const meta = j.activo ? Math.min(1, j.fuerza) * md.vmax * turbo : (k.adelante - k.atras) * md.vmax * turbo * (k.adelante ? 1 : 0.4)
      const cambio = md.acel * dt * (meta === 0 ? 1.6 : 1)
      vel.current += Math.max(-cambio, Math.min(cambio, meta - vel.current))
      if (Math.abs(vel.current) < 0.05 && meta === 0) vel.current = 0
      if (m && (vel.current || k.izq || k.der || j.activo)) {
        let giro = (k.der - k.izq) * md.giro * dt * (modoRef.current === 'auto' ? Math.min(1, 0.35 + Math.abs(vel.current) / 10) : 1)
        if (j.activo && j.fuerza > 0.15) {
          // gira hacia donde apunta el dedo (relativo a como mirabas al tocar)
          const dif = ((j.ref + j.ang - m.getBearing() + 540) % 360) - 180
          const max = (modoRef.current === 'pie' ? 260 : modoRef.current === 'bici' ? 150 : 110) * dt
          giro = Math.max(-max, Math.min(max, dif * Math.min(1, dt * 8)))
        }
        const rumbo = m.getBearing() + giro
        const c = m.getCenter()
        let n = vel.current ? avanzar({ lat: c.lat, lng: c.lng }, rumbo, vel.current * dt) : { lat: c.lat, lng: c.lng }
        // las casas son sólidas: chocas y rebotas un poco (en dron vuelas por encima)
        if (vel.current && !m.libre(n.lat, n.lng)) {
          vel.current = -vel.current * 0.25
          n = { lat: c.lat, lng: c.lng }
          navigator.vibrate?.(15)
        }
        m.jumpTo({ center: [n.lng, n.lat], bearing: rumbo })
      }
      m?.setMarcha(vel.current, k.der - k.izq)
      if (m && ahora - ultimoYo > 250) {
        ultimoYo = ahora
        const c = m.getCenter()
        setYo({ lat: c.lat, lng: c.lng, rumbo: m.getBearing() })
      }
      if (ahora - ultimoTablero > 200) {
        ultimoTablero = ahora
        const c = m?.getCenter()
        if (c) revisarObjetivos.current?.(c)
        setTablero({ kmh: Math.round(Math.abs(vel.current) * 3.6), alt: null })
      }
      raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    const MAPA = { ArrowUp: 'adelante', KeyW: 'adelante', ArrowDown: 'atras', KeyS: 'atras', ArrowLeft: 'izq', KeyA: 'izq', ArrowRight: 'der', KeyD: 'der', ShiftLeft: 'turbo', ShiftRight: 'turbo', Space: 'turbo' }
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

  useEffect(() => {
    if (!mirarConTelefono) return
    let suave = null
    const f = (e) => {
      const m = mapa.current
      if (!m || e.beta == null) return
      // rumbo: brújula del teléfono (iOS la da directo; Android vía alpha)
      const rumbo = e.webkitCompassHeading ?? (e.absolute || e.alpha != null ? (360 - e.alpha) % 360 : null)
      suave = suave ? { r: suave.r + (((rumbo - suave.r + 540) % 360) - 180) * 0.25 } : { r: rumbo ?? m.getBearing() }
      m.jumpTo({ bearing: rumbo == null ? m.getBearing() : suave.r })
    }
    window.addEventListener('deviceorientation', f, true)
    return () => window.removeEventListener('deviceorientation', f, true)
  }, [mirarConTelefono])
  const alternarMirar = async () => {
    if (mirarConTelefono) return setMirarConTelefono(false)
    try {
      // iPhone pide permiso para usar el giroscopio (debe ser al tocar un botón)
      if (typeof DeviceOrientationEvent?.requestPermission === 'function' && (await DeviceOrientationEvent.requestPermission()) !== 'granted') return
      setMirarConTelefono(true)
    } catch {
      /* sin permiso */
    }
  }

  // ---- El juego: faros en lugares y fotos reales; al alcanzarlos sumas puntos y ZUMI cuenta ----
  const objs = useMemo(() => armarObjetivos(cerca, fotosVivas), [lugares, fotos]) // eslint-disable-line react-hooks/exhaustive-deps
  const objsRef = useRef(objs)
  objsRef.current = objs
  useEffect(() => {
    if (mapa.current && listo) mapa.current.setFaros(objs, juego.recogidos, modo)
  }, [objs, juego, modo, listo, fotorreal])
  const revisarObjetivos = useRef(null)
  revisarObjetivos.current = (c) => {
    const alcance = ALCANCE[modoRef.current] ?? 30
    const o = objsRef.current.find((x) => !juegoRef.current.recogidos.has(x.id) && distanciaKm({ lat: c.lat, lng: c.lng }, x) * 1000 <= alcance)
    if (!o) return
    const recogidos = new Set(juegoRef.current.recogidos).add(o.id)
    const bono = Math.round(Math.abs(vel.current) * 3.6) > 60 ? 50 : 0
    const nuevo = { puntos: juegoRef.current.puntos + o.valor + bono, recogidos }
    juegoRef.current = nuevo
    setJuego(nuevo)
    guardarProgreso({ puntos: nuevo.puntos, recogidos: [...recogidos] })
    const todos = objsRef.current.every((x) => recogidos.has(x.id))
    setLogro({ id: o.id, puntos: o.valor + bono, nombre: o.nombre, foto: o.tipo === 'foto' ? o.dato.url : null, autor: o.tipo === 'foto' ? o.dato.autor : null, licencia: o.dato.licencia, todos })
    if (vozRef.current) sonidoLogro(todos)
    navigator.vibrate?.(todos ? [30, 60, 30, 60, 60] : 25)
    if (o.tipo === 'lugar' && !dichos.current.has(o.dato.id)) {
      dichos.current.add(o.dato.id)
      const texto = `¡Lo descubriste! ${narracion({ ...o.dato, m: 10 }, yo.rumbo, yo)}`
      setCuenta({ ...o.dato, texto })
      if (vozRef.current) hablar([texto]).catch(() => {})
    }
  }
  useEffect(() => {
    if (!logro) return
    const t = setTimeout(() => setLogro(null), logro.todos ? 5000 : 2600)
    return () => clearTimeout(t)
  }, [logro])
  const pendientes = objs.filter((o) => !juego.recogidos.has(o.id)).map((o) => ({ ...o, m: Math.round(distanciaKm(yo, o) * 1000), rumbo: rumboHacia(yo, o) })).sort((a, b) => a.m - b.m)
  const siguiente = pendientes[0]
  const hechosAqui = objs.length - pendientes.length

  // ZUMI cuenta el lugar más cercano que aún no contó (de a uno; el siguiente cuando termina)
  const ocupado = useRef(false)
  useEffect(() => {
    if (cargandoMundo || !contar || ocupado.current) return
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
    if (cargandoMundo) return
    const t = `Bienvenido a ${inicio.nombre}. Pon el dedo en cualquier parte y arrastra hacia donde quieres ir; si lo llevas lejos, corres. Te voy contando lo que hay cerca.`
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
  }, [cargandoMundo, inicio.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => callar(), [])
  // Créditos de la maqueta real (Google y fuentes de las imágenes): obligatorios y siempre visibles
  useEffect(() => {
    if (!fotorreal) return
    const t = setInterval(() => {
      const el = creditos.current
      const f = mapa.current?.foto
      if (!el || !f) return
      el.replaceChildren(f.creditos(), 'Maqueta 3D: Google · Cesium')
    }, 3000)
    return () => clearInterval(t)
  }, [fotorreal])
  // la tarjeta se esconde sola para dejar ver la calle
  useEffect(() => {
    if (!cuenta) return
    const t = setTimeout(() => setCuenta((c) => (c?.id === cuenta.id ? null : c)), 16000)
    return () => clearTimeout(t)
  }, [cuenta?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Nombres de los lugares flotando sobre el mundo
  useEffect(() => {
    if (mapa.current && listo) mapa.current.setPines(lugares.slice(0, 15), mirarA)
  }, [lugares, listo]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cielo, sol, noche y lluvia según el clima real del lugar
  useEffect(() => {
    if (mapa.current && listo && clima) mapa.current.setClima(clima)
  }, [clima, listo])

  function cambiarModo(id, elegido = true) {
    if (elegido) modoElegido.current = true
    setModo(id)
    const md = MODOS[id]
    vel.current = Math.min(vel.current, md.vmax)
    mapa.current?.setModo(id)
  }

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
    setSinFoto(false)
    if (m && !m.foto && tokenFoto.current) setEsperaFoto(true)
    m?.jumpTo({ center: [p.lng, p.lat], bearing: nuevo.rumbo })
    // en otra ciudad puede haber maqueta 3D real aunque aquí no hubiera
    if (m && !m.foto && tokenFoto.current) m.activarFotorreal(tokenFoto.current)
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

  // Joystick libre: tocas en cualquier parte del mundo y arrastras
  const joy = useRef({ activo: false, ang: 0, fuerza: 0, ref: 0 })
  const [palanca, setPalanca] = useState(null) // { x, y, dx, dy } para dibujarla
  const tocar = {
    onPointerDown: (e) => {
      if (e.target.closest('button, a, input')) return
      e.currentTarget.setPointerCapture?.(e.pointerId)
      joy.current = { activo: true, ang: 0, fuerza: 0, ref: mapa.current?.getBearing() ?? 0, x: e.clientX, y: e.clientY, id: e.pointerId }
      setPalanca({ x: e.clientX, y: e.clientY, dx: 0, dy: 0 })
    },
    onPointerMove: (e) => {
      const j = joy.current
      if (!j.activo || e.pointerId !== j.id) return
      const dx = e.clientX - j.x
      const dy = e.clientY - j.y
      const d = Math.hypot(dx, dy)
      j.ang = (Math.atan2(dx, -dy) * 180) / Math.PI
      j.fuerza = d < 12 ? 0 : d / 70 // >1 (más de 70 px) = correr
      // si va hacia atrás, retrocede sin darse vuelta de golpe
      setPalanca({ x: j.x, y: j.y, dx: (dx / Math.max(d, 1)) * Math.min(d, 90), dy: (dy / Math.max(d, 1)) * Math.min(d, 90), corre: j.fuerza > 1 })
    },
    onPointerUp: () => {
      joy.current = { activo: false, ang: 0, fuerza: 0, ref: 0 }
      setPalanca(null)
    },
  }
  tocar.onPointerCancel = tocar.onPointerUp

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

  const resultados = q.trim().length >= 2 ? buscarLugares(q, 6) : [...CIUDADES_3D, ...PASEOS.filter((p) => !CIUDADES_3D.some((c) => c.nombre === p.nombre))]

  return createPortal(
    <div className="paseo fixed inset-0 z-[1200] bg-black text-white" role="dialog" aria-label={`Pasea con ZUMI: ${inicio.nombre}`}>
      <div className="absolute inset-0 touch-none" {...tocar}>
        <div ref={caja} className="h-full w-full" />
      </div>
      {palanca && (
        <div className="pointer-events-none absolute z-[5]" style={{ left: palanca.x, top: palanca.y }} aria-hidden="true">
          <div className="absolute size-[150px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/40 bg-black/20" />
          <div className={`absolute size-16 rounded-full shadow-[0_4px_14px_rgba(0,0,0,.4)] ${palanca.corre ? 'bg-[#ffc23d]' : 'bg-white/85'}`} style={{ transform: `translate(calc(-50% + ${palanca.dx}px), calc(-50% + ${palanca.dy}px))` }} />
          {palanca.corre && <span className="absolute top-[86px] -translate-x-1/2 rounded-full bg-black/60 px-2 py-0.5 text-[12px] font-bold whitespace-nowrap text-[#ffc23d]">¡Corriendo!</span>}
        </div>
      )}
      {clima?.lluvia && <div className="paseo-lluvia pointer-events-none absolute inset-0" aria-hidden="true" />}
      {sinFoto && !cargandoMundo && !buscar && (
        <div className="absolute inset-0 z-[40] grid place-items-center bg-[radial-gradient(80%_60%_at_50%_40%,#1d4170_0%,#0f1d2e_60%,#000_100%)] px-8 text-center" role="alert">
          <div className="max-w-xs">
            <img src={`${import.meta.env.BASE_URL}zumi/poses/explicando.webp`} alt="" width="140" height="182" className="mx-auto h-[182px] w-auto" />
            <p className="mt-4 text-[21px] leading-tight font-bold">No me llegó la foto real de {inicio.nombre}</p>
            <p className="mt-2 text-[15px] leading-snug text-white/70">Puede ser la señal. No te voy a mostrar una ciudad inventada: elige una de las ciudades de Chile en 3D o vuelve a intentarlo después.</p>
            <button type="button" onClick={() => { setSinFoto(false); setBuscar(true) }} className="mt-5 min-h-12 w-full rounded-full bg-white px-5 text-[16px] font-bold text-black">
              Ver ciudades en 3D
            </button>
            <button type="button" onClick={onCerrar} className="mt-2 min-h-12 w-full rounded-full px-5 text-[16px] font-semibold text-white/85">
              Salir del paseo
            </button>
          </div>
        </div>
      )}
      {cargandoMundo && (
        <div className="absolute inset-0 z-[40] grid place-items-center bg-[radial-gradient(80%_60%_at_50%_40%,#1d4170_0%,#0f1d2e_60%,#000_100%)] px-8 text-center" role="status">
          <div>
            <img src={`${import.meta.env.BASE_URL}zumi/poses/celebrando.webp`} alt="" width="150" height="196" className="paseo-carga-zumi mx-auto h-[196px] w-auto" />
            <p className="mt-4 text-[22px] leading-tight font-bold">{inicio.nombre}</p>
            <p className="mt-2 text-[15px] leading-snug text-white/70">Estoy bajando las calles reales escaneadas en 3D. Toma unos segundos.</p>
            <div className="mx-auto mt-5 h-1 w-40 overflow-hidden rounded-full bg-white/15"><div className="paseo-carga-barra h-full w-1/3 rounded-full bg-white/80" /></div>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Salir del paseo" className="vidrio-solido absolute top-[max(.75rem,env(safe-area-inset-top))] left-3 grid size-11 place-items-center rounded-full text-[20px]">
            ×
          </button>
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
        <div className="paseo-cuenta vidrio-solido absolute top-[7.4rem] right-3 left-3 mx-auto max-w-md rounded-[20px] p-3" aria-live="polite">
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

      {/* ---- Capa de juego ---- */}
      {/* líneas de velocidad */}
      <div className="paseo-velocidad pointer-events-none absolute inset-0" style={{ opacity: Math.min(0.85, Math.max(0, (tablero.kmh / 3.6 / MODOS[modo].vmax - 0.35) * 1.3)) }} aria-hidden="true" />
      {/* puntaje */}
      <div className="paseo-puntaje pointer-events-none absolute top-[max(8.2rem,calc(env(safe-area-inset-top)+7.7rem))] right-3 text-right">
        <p className="cifra text-[26px] leading-none font-bold text-[#ffc23d] [text-shadow:0_2px_8px_rgba(0,0,0,.6)]">★ {juego.puntos.toLocaleString('es-CL')}</p>
        {objs.length > 0 && <p className="mt-0.5 text-[11.5px] font-semibold text-white [text-shadow:0_1px_4px_#000]">{hechosAqui} de {objs.length} lugares</p>}
      </div>

      {/* hacia el siguiente faro */}
      {siguiente && (
        <button type="button" onClick={() => mirarA(siguiente)} className="paseo-siguiente vidrio-solido absolute top-[max(7.6rem,calc(env(safe-area-inset-top)+7.1rem))] left-3 flex max-w-[60%] items-center gap-2 rounded-full py-1.5 pr-3 pl-1.5 text-left">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#ffc23d] text-[16px] font-black text-black" style={{ transform: `rotate(${siguiente.rumbo - yo.rumbo}deg)` }} aria-hidden="true">
            ↑
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] leading-tight font-semibold">{siguiente.nombre}</span>
            <span className="mono block text-[11px] text-white/75">{siguiente.m >= 1000 ? `${(siguiente.m / 1000).toFixed(1).replace('.', ',')} km` : `${siguiente.m} m`} · {siguiente.tipo === 'lugar' ? '+150' : '+75'}</span>
          </span>
        </button>
      )}

      {/* minimapa (arriba es hacia donde miras) */}
      <svg viewBox="-60 -60 120 120" className="paseo-radar pointer-events-none absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-[4.2rem] size-[104px]" aria-hidden="true">
        <circle r="58" fill="rgba(8,10,14,.62)" stroke="rgba(255,255,255,.25)" />
        <circle r="29" fill="none" stroke="rgba(255,255,255,.12)" />
        {objs.map((o) => {
          const d = Math.min(54, (distanciaKm(yo, o) * 1000 * 54) / ({ pie: 400, bici: 700, auto: 1500, dron: 4000 }[modo] ?? 600))
          const a = ((rumboHacia(yo, o) - yo.rumbo) * Math.PI) / 180
          const hecho = juego.recogidos.has(o.id)
          return <circle key={o.id} cx={Math.sin(a) * d} cy={-Math.cos(a) * d} r={hecho ? 2.5 : 4} fill={hecho ? '#3ddc84' : o.tipo === 'lugar' ? '#ffc23d' : '#7cc4ff'} />
        })}
        <path d="M0 -7 L5 5 L0 2 L-5 5 Z" fill="#fff" />
      </svg>

      {/* ¡logro! */}
      {logro && (
        <div key={logro.id} className="paseo-logro pointer-events-none absolute top-[38%] left-1/2 -translate-x-1/2 text-center" role="status">
          {logro.foto && <img src={logro.foto} alt="" className="mx-auto mb-2 h-20 w-28 rounded-xl object-cover ring-2 ring-white" />}
          <p className="cifra text-[44px] leading-none font-black text-[#ffc23d] [text-shadow:0_3px_14px_rgba(0,0,0,.7)]">+{logro.puntos}</p>
          <p className="mt-1 text-[16px] font-bold [text-shadow:0_2px_8px_#000]">{logro.todos ? '¡Descubriste todo este lugar!' : `¡Descubriste ${logro.nombre}!`}</p>
          {logro.autor && <p className="mt-0.5 text-[11px] text-white/80 [text-shadow:0_1px_4px_#000]">Foto real: {logro.autor} · {logro.licencia}</p>}
        </div>
      )}

      {/* Tablero, como en un juego: velocidad, altura y modo */}
      <div className="paseo-tablero pointer-events-none absolute right-4 bottom-[max(10.4rem,calc(env(safe-area-inset-bottom)+9.9rem))] text-right" aria-live="off">
        <p className="cifra text-[38px] leading-none font-semibold tabular-nums [text-shadow:0_2px_10px_rgba(0,0,0,.6)]">{tablero.kmh}</p>
        <p className="rotulo !text-[9.5px] [text-shadow:0_1px_4px_#000]">km/h · {MODOS[modo].nombre}</p>
        {tablero.alt != null && <p className="mono mt-1 text-[11px] text-white/85 [text-shadow:0_1px_4px_#000]">{tablero.alt.toLocaleString('es-CL')} msnm</p>}
      </div>

      {/* Modo de recorrido */}
      <div role="group" aria-label="Cómo recorrer" className="vidrio-solido absolute top-[max(4.3rem,calc(env(safe-area-inset-top)+3.8rem))] left-1/2 flex -translate-x-1/2 gap-0.5 rounded-full p-1 whitespace-nowrap">
        {Object.entries(MODOS).map(([id, md]) => (
          <button key={id} type="button" aria-pressed={modo === id} aria-label={md.nombre} disabled={soloAire && id !== 'dron'} onClick={() => cambiarModo(id)} className={`min-h-10 rounded-full px-3 text-[13px] font-semibold disabled:opacity-35 ${modo === id ? 'bg-white text-black' : 'text-white/85'}`}>
            {md.icono}<span className="ml-1 max-[380px]:hidden">{md.nombre}</span>
          </button>
        ))}
      </div>

      {soloAire && (
        <p className="vidrio-solido pointer-events-none absolute top-[max(7.3rem,calc(env(safe-area-inset-top)+6.8rem))] left-1/2 max-w-[88%] -translate-x-1/2 rounded-full px-3 py-1.5 text-center text-[12px] leading-snug">
          Foto real de Google. Aquí no hay ciudad en 3D, así que se recorre desde el aire.
        </p>
      )}

      {/* Controles para caminar */}
      <div className="absolute right-0 bottom-0 left-0 flex items-end justify-between gap-3 p-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex flex-col gap-2">
          <button type="button" onClick={cambiarVoz} aria-pressed={voz} aria-label={voz ? 'ZUMI habla (toca para silenciar)' : 'En silencio (toca para que ZUMI hable)'} className="paseo-icono">
            {voz ? '🔊' : '🔇'}
          </button>
          {hayGiroscopio && (
            <button type="button" onClick={alternarMirar} aria-pressed={mirarConTelefono} aria-label={mirarConTelefono ? 'Dejar de mirar con el teléfono' : 'Mirar moviendo el teléfono'} className={`paseo-icono ${mirarConTelefono ? '!bg-white' : ''}`}>
              📱
            </button>
          )}
          <button type="button" onClick={() => abrirCalle({ lat: yo.lat, lng: yo.lng, nombre: inicio.nombre })} aria-label="Ver la calle real (fotos)" className="paseo-icono">
            📷
          </button>
        </div>
        <div className="flex flex-col items-end gap-2">
        {modo !== 'pie' && (
          <button type="button" aria-label="Turbo (mantener)" className="paseo-turbo" {...sostener('turbo')} onPointerDown={(e) => (sostener('turbo').onPointerDown(e), vozRef.current && sonidoTurbo())}>
            ⚡ Turbo
          </button>
        )}
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
      </div>
      <p className="pointer-events-none absolute right-2 bottom-[max(0.3rem,calc(env(safe-area-inset-bottom)-0.9rem))] left-2 truncate text-center text-[9.5px] text-white/65 [text-shadow:0_1px_3px_#000]">
        {fotorreal ? <span ref={creditos} /> : 'Mundo 3D hecho con el mapa real, no es Street View · Calles y lugares: OpenFreeMap © OpenStreetMap'}
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
