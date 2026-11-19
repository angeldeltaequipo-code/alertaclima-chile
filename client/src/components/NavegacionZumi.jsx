// Navegación con ZUMI: indicaciones giro a giro por voz, el mapa te sigue, recalcula si te desvías,
// te avisa del clima que viene en la ruta y te recuerda descansar. Todo dentro de AlertaClima.
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { calcularRuta, distanciaCorta, distanciaDicha, flecha, horaCL, prepararNavegacion, ubicarEnRuta } from '../services/ruta'
import { callar, hablar } from '../services/narrador'
import { NARRADOR } from '../services/viajes'
import { compartirViaje, leerGrupo } from '../services/familiaGPS'

const minus = (t) => t.charAt(0).toLowerCase() + t.slice(1)

export default function NavegacionZumi({ ruta, destino, cond = [], onSeguir, onNuevaRuta, onSalir, simular = false }) {
  const [nav, setNav] = useState(() => prepararNavegacion(ruta))
  const [pos, setPos] = useState(null) // { lat, lng, vel, rumbo, precision }
  const [prog, setProg] = useState({ avance: 0, i: 0, d: 0 })
  const [mudo, setMudo] = useState(false)
  const [aviso, setAviso] = useState(null) // mensaje de ZUMI en pantalla
  const [estado, setEstado] = useState('navegando') // navegando | recalculando | llegaste
  const [familia] = useState(() => Boolean(leerGrupo()?.compartir) && !simular)
  const r = useRef({ dichos: new Set(), fuera: 0, inicio: Date.now(), descanso: Date.now(), ultimo: null, i: 0 })
  const mudoRef = useRef(mudo)
  mudoRef.current = mudo

  const decir = (texto, { mostrar = true } = {}) => {
    if (mostrar) setAviso(texto)
    if (!mudoRef.current) hablar([texto]).catch(() => {})
  }

  // Pantalla siempre encendida y limpia mientras navegas.
  useEffect(() => {
    document.documentElement.classList.add('navegando')
    let lock = null
    const pedir = () => navigator.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {})
    pedir()
    const volver = () => document.visibilityState === 'visible' && pedir()
    document.addEventListener('visibilitychange', volver)
    return () => {
      document.removeEventListener('visibilitychange', volver)
      lock?.release?.().catch(() => {})
      document.documentElement.classList.remove('navegando')
      callar()
      onSeguir(null)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Tu familia ve tu viaje en vivo (cifrado): destino y hora de llegada; al llegar, se le avisa solo.
  useEffect(() => {
    if (!familia) return
    compartirViaje({ d: destino.nombre, eta: Date.now() + nav.segundos * 1000 })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!familia || estado !== 'navegando') return
    const t = setInterval(() => compartirViaje({ d: destino.nombre, eta: Date.now() + ((nav.total - r.current.avance) / nav.total) * nav.segundos * 1000 }), 4 * 60e3)
    return () => clearInterval(t)
  }, [familia, estado, nav]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (estado === 'llegaste' && familia) compartirViaje({ llego: true })
  }, [estado, familia])
  const salir = () => {
    if (familia && estado !== 'llegaste') compartirViaje(null)
    onSalir()
  }

  // Saludo de partida
  useEffect(() => {
    const llegada = new Date(Date.now() + nav.segundos * 1000)
    decir(`¡Vamos a ${destino.nombre}! Son ${distanciaDicha(nav.total)} y llegamos cerca de las ${horaCL(llegada)}.${familia ? ' Tu familia verá tu viaje.' : ''} ${nav.pasos[0]?.texto ?? ''}.`)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Posición: GPS real, o simulada para ver el recorrido antes de salir.
  useEffect(() => {
    if (simular) {
      let avance = 0
      const paso = 16.7 * 6 // ~60 km/h, a 6x
      const t = setInterval(() => {
        avance = Math.min(nav.total, avance + paso)
        const k = nav.acum.findIndex((a) => a >= avance)
        const c = nav.coords[Math.max(0, k)]
        const c0 = nav.coords[Math.max(0, k - 1)]
        const rumbo = (Math.atan2(c[0] - c0[0], c[1] - c0[1]) * 180) / Math.PI
        setPos({ lat: c[1], lng: c[0], vel: 60, rumbo: (rumbo + 360) % 360, precision: 5 })
      }, 1000)
      return () => clearInterval(t)
    }
    if (!('geolocation' in navigator)) {
      setAviso('Este teléfono no entrega su ubicación: activa el GPS para navegar.')
      return
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const anterior = r.current.ultimo
        let rumbo = p.coords.heading
        if ((rumbo == null || Number.isNaN(rumbo)) && anterior) rumbo = (Math.atan2(p.coords.longitude - anterior.lng, p.coords.latitude - anterior.lat) * 180) / Math.PI
        const nuevo = { lat: p.coords.latitude, lng: p.coords.longitude, vel: p.coords.speed != null ? p.coords.speed * 3.6 : null, rumbo: rumbo == null ? null : (rumbo + 360) % 360, precision: p.coords.accuracy }
        r.current.ultimo = nuevo
        setPos(nuevo)
      },
      () => setAviso('Necesito permiso de ubicación para guiarte. Actívalo en los ajustes del teléfono.'),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [simular, nav]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cada nueva posición: avanzar en la ruta, anunciar maniobras, detectar desvíos, clima y descanso.
  useEffect(() => {
    if (!pos || estado !== 'navegando') return
    const u = ubicarEnRuta(nav, pos, r.current.i)
    r.current.i = u.i
    r.current.avance = u.avance
    setProg(u)
    // rumbo del mapa: el del GPS si te mueves; si no, el de la ruta
    const c = nav.coords
    const a = c[u.i]
    const b = c[Math.min(c.length - 1, u.i + 1)]
    const rumboRuta = ((Math.atan2(b[0] - a[0], b[1] - a[1]) * 180) / Math.PI + 360) % 360
    onSeguir({ lat: u.d < 30 ? u.lat : pos.lat, lng: u.d < 30 ? u.lng : pos.lng, rumbo: pos.vel > 5 && pos.rumbo != null ? pos.rumbo : rumboRuta })

    // ¿te saliste?
    const tolerancia = Math.max(45, (pos.precision ?? 20) * 1.5)
    if (u.d > tolerancia) r.current.fuera += 1
    else r.current.fuera = 0
    if (r.current.fuera >= 3 && !simular) {
      r.current.fuera = 0
      setEstado('recalculando')
      decir('Te saliste de la ruta. Tranquilo, recalculo el camino.')
      calcularRuta({ ...pos }, destino)
        .then((nueva) => {
          setNav(prepararNavegacion(nueva))
          r.current = { ...r.current, dichos: new Set(), i: 0 }
          onNuevaRuta?.(nueva)
          setEstado('navegando')
          decir('Listo, tengo una nueva ruta.')
        })
        .catch(() => {
          setEstado('navegando')
          decir('No pude recalcular ahora. Sigo intentando.')
        })
      return
    }

    // llegada
    if (nav.total - u.avance < 35) {
      setEstado('llegaste')
      decir(`¡Llegaste a ${destino.nombre}! Buen viaje.`)
      onSeguir(null)
      return
    }

    // la próxima maniobra
    const k = nav.pasos.findIndex((p, j) => j > 0 && p.metro > u.avance + 3)
    const p = nav.pasos[k]
    if (p) {
      const dist = p.metro - u.avance
      const v = pos.vel ?? 40
      const lejos = v > 70 ? 1000 : v > 40 ? 500 : 300
      const cerca = v > 70 ? 400 : 150
      const ya = v > 70 ? 120 : 45
      const anunciar = (nivel, texto) => {
        const clave = `${k}:${nivel}`
        if (r.current.dichos.has(clave)) return
        r.current.dichos.add(clave)
        // si ya se pasó un nivel más cercano, no repetir el lejano
        decir(texto)
      }
      if (dist <= ya) anunciar('ya', `Ahora, ${minus(p.texto)}.`)
      else if (dist <= cerca) (r.current.dichos.add(`${k}:lejos`), anunciar('cerca', `En ${distanciaDicha(dist)}, ${minus(p.texto)}.`))
      else if (dist <= lejos && dist > cerca + 80) anunciar('lejos', `En ${distanciaDicha(dist)}, ${minus(p.texto)}.`)
    }

    // el clima que viene (hasta 6 km adelante)
    for (const x of cond) {
      if (!x.riesgo?.nivel) continue
      const metro = (x.kmDesde ?? 0) * 1000
      const falta = metro - u.avance
      const clave = `clima:${Math.round(metro / 500)}`
      if (falta > 0 && falta < 6000 && !r.current.dichos.has(clave)) {
        r.current.dichos.add(clave)
        decir(`Ojo: en ${distanciaDicha(falta)} viene ${x.riesgo.motivos[0]}. ${x.riesgo.nivel === 2 ? 'Baja harto la velocidad y aumenta la distancia.' : 'Maneja con cuidado.'}`)
        break
      }
    }

    // descanso cada 2 horas
    if (Date.now() - r.current.descanso > 2 * 3600e3) {
      r.current.descanso = Date.now()
      decir('Llevas dos horas manejando. ¿Paramos un ratito a estirar las piernas y tomar agua?')
    }
  }, [pos]) // eslint-disable-line react-hooks/exhaustive-deps

  // el aviso de ZUMI se va solo
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 7000)
    return () => clearTimeout(t)
  }, [aviso])

  const k = nav.pasos.findIndex((p, j) => j > 0 && p.metro > prog.avance + 3)
  const paso = nav.pasos[k] ?? nav.pasos.at(-1)
  const siguiente = nav.pasos[k + 1]
  const dist = paso ? Math.max(0, paso.metro - prog.avance) : 0
  const resta = Math.max(0, nav.total - prog.avance)
  const segRestantes = useMemo(() => (nav.total ? (resta / nav.total) * nav.segundos : 0), [resta, nav])
  const llegada = new Date(Date.now() + segRestantes * 1000)

  return createPortal(
    <div className="navegacion-zumi pointer-events-none fixed inset-0 z-[1300] flex flex-col justify-between">
      {/* Indicación principal */}
      <div className="pointer-events-auto px-3 pt-[calc(env(safe-area-inset-top)+10px)]">
        <div className="nav-indicacion rounded-[24px] px-4 py-3.5 text-white" aria-live="polite">
          {estado === 'recalculando' ? (
            <p className="titulo-x py-2 text-[22px]">Recalculando la ruta…</p>
          ) : estado === 'llegaste' ? (
            <p className="titulo-x py-2 text-[24px]">◉ Llegaste a {destino.nombre}</p>
          ) : (
            <div className="flex items-center gap-3.5">
              <span className="nav-flecha grid size-16 shrink-0 place-items-center rounded-2xl text-[40px] leading-none" aria-hidden="true">
                {flecha(paso)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="cifra text-[38px]">{distanciaCorta(dist)}</p>
                <p className="mt-1 line-clamp-2 text-[18px] leading-tight font-semibold">{paso?.texto}</p>
              </div>
            </div>
          )}
          {siguiente && estado === 'navegando' && (
            <p className="mt-2.5 flex items-center gap-2 border-t border-white/15 pt-2 text-[14px] text-white/75">
              <span className="rotulo !text-white/50">Luego</span>
              <span aria-hidden="true">{flecha(siguiente)}</span>
              <span className="truncate">{siguiente.texto}</span>
            </p>
          )}
        </div>
      </div>

      {/* ZUMI habla */}
      <div className="pointer-events-auto px-3">
        {aviso && (
          <div className="nav-zumi mb-2 flex items-center gap-2.5 rounded-[22px] bg-white px-3 py-2.5 text-black">
            <img src={NARRADOR.avatar} alt="" className="size-10 shrink-0 rounded-full object-cover" />
            <p className="text-[15px] leading-snug font-medium">{aviso}</p>
          </div>
        )}

        {estado === 'llegaste' ? (
          <div className="vidrio-solido safe-bottom mb-3 space-y-2 rounded-[26px] p-4">
            {familia && <p className="text-center text-[15px] font-semibold text-[#3ddc84]">✓ Tu familia ya sabe que llegaste bien</p>}
            <button type="button" onClick={onSalir} className="boton-primario w-full text-[16px]">
              Terminar
            </button>
          </div>
        ) : (
          <div className="nav-barra vidrio-solido mb-[calc(env(safe-area-inset-bottom)+10px)] flex items-center gap-3 rounded-[26px] px-4 py-3">
            <div className="grid size-14 shrink-0 place-items-center rounded-full border-2 border-white/80" aria-label={`Vas a ${Math.round(pos?.vel ?? 0)} kilómetros por hora`}>
              <span className="mono text-[18px] leading-none font-semibold">{Math.round(pos?.vel ?? 0)}</span>
              <span className="mono -mt-2 text-[8.5px] text-white/60">KM/H</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="mono text-[22px] leading-none font-semibold">{horaCL(llegada)}</p>
              <p className="mono mt-1 text-[12.5px] text-white/60">
                {distanciaCorta(resta)} · {Math.round(segRestantes / 60)} min{simular ? ' · VISTA PREVIA' : familia ? ' · FAMILIA VE TU VIAJE' : ''}
              </p>
            </div>
            <button type="button" onClick={() => (setMudo(!mudo), !mudo && callar())} aria-pressed={mudo} aria-label={mudo ? 'Activar la voz de ZUMI' : 'Silenciar a ZUMI'} className="boton-vidrio grid size-12 place-items-center rounded-full">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                {mudo ? <path d="M22 9l-6 6M16 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />}
              </svg>
            </button>
            <button type="button" onClick={salir} className="grid min-h-12 place-items-center rounded-full bg-[#ff3b30] px-4 text-[15px] font-semibold text-white">
              Salir
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
