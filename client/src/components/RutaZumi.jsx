// Ruta ZUMI: «¿A dónde vas?». Busca cualquier lugar de Chile, traza el camino en auto y te dice cómo
// estará el clima en cada tramo justo cuando pases, la mejor hora para salir, dónde descansar,
// si cruzas un paso de montaña, y abre la navegación en Waze o Google Maps.
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import IconoClima from './IconoClima'
import {
  buscarDireccion,
  buscarLugares,
  anotarReciente,
  calcularRutas,
  recientes,
  comunaCercana,
  condiciones,
  descansos,
  diaCL,
  duracion,
  horaCL,
  mejorSalida,
  muestrear,
  pasosEnRuta,
  pronosticoPuntos,
  resumenZumi,
} from '../services/ruta'
import { hablar } from '../services/narrador'
import { lazySeguro } from '../services/cargaSegura'
import { Suspense } from 'react'
import { lugaresFamilia } from '../services/familiaGPS'

const NavegacionZumi = lazySeguro(() => import('./NavegacionZumi'))

const NIVEL = [
  { texto: 'Camino tranquilo', color: '#3ddc84' },
  { texto: 'Atención en la ruta', color: '#ffc53d' },
  { texto: 'Peligro en la ruta', color: '#ff5a5f' },
]

function Buscador({ origen, onElegir, onCerrar }) {
  const [q, setQ] = useState('')
  const [extra, setExtra] = useState([])
  const locales = useMemo(() => buscarLugares(q), [q])
  useEffect(() => {
    setExtra([])
    if (q.trim().length < 4) return
    const ac = new AbortController()
    const t = setTimeout(() => buscarDireccion(q, { signal: ac.signal }).then(setExtra).catch(() => {}), 450)
    return () => {
      clearTimeout(t)
      ac.abort()
    }
  }, [q])
  const lista = [...locales, ...extra.filter((e) => !locales.some((l) => Math.abs(l.lat - e.lat) < 0.01 && Math.abs(l.lng - e.lng) < 0.01))]
  const SUGERIDOS = ['Valparaíso', 'La Serena', 'Pucón', 'Valle Nevado', 'Concepción', 'Paso Los Libertadores']
  const mios = useMemo(() => lugaresFamilia().map((l) => ({ id: `f-${l.id}`, nombre: l.n, sub: 'Lugar de tu familia', lat: l.lat, lng: l.lng, tipo: 'mio', e: l.e })), [])
  const antes = useMemo(() => recientes(), [])
  const buscando = q.trim().length >= 2
  return (
    <div className="ruta-buscador fixed inset-0 z-[1200] bg-black/95 px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-4 text-white backdrop-blur-xl">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-2">
          <div className="flex min-h-13 flex-1 items-center gap-2 rounded-full bg-white px-4 text-black">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="¿A dónde vas? Comuna, lugar o dirección"
              aria-label="Destino"
              className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-black/45"
            />
          </div>
          <button type="button" onClick={onCerrar} className="min-h-12 px-2 text-[15px] font-semibold">
            Cancelar
          </button>
        </div>
        <p className="rotulo mt-3 !text-white/55">Desde · {origen?.nombre ?? 'tu ubicación'}</p>
        {!buscando && mios.length > 0 && (
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]" aria-label="Tus lugares">
            {mios.map((l) => (
              <button key={l.id} type="button" onClick={() => onElegir(l)} className="flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-white/10 px-4 text-[15px] font-semibold ring-1 ring-white/10 active:bg-white/20">
                <span aria-hidden="true">{l.e}</span> {l.nombre}
              </button>
            ))}
          </div>
        )}
        {!buscando && antes.length > 0 && <p className="rotulo mt-4 !text-white/45">Recientes</p>}
        {!buscando && antes.length > 0 && (
          <ul className="mt-1 divide-y divide-white/10">
            {antes.map((l) => (
              <li key={`r-${l.id}`}>
                <button type="button" onClick={() => onElegir(l)} className="flex min-h-13 w-full items-center gap-3 py-2 text-left active:bg-white/5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-[14px]" aria-hidden="true">
                    ↺
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] font-semibold">{l.nombre}</span>
                    <span className="block truncate text-[13px] text-white/55">{l.sub}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!buscando && <p className="rotulo mt-4 !text-white/45">Destinos populares</p>}
        <ul className="mt-2 max-h-[60vh] divide-y divide-white/10 overflow-y-auto">
          {(buscando ? lista : SUGERIDOS.flatMap((s) => buscarLugares(s, 1))).map((l) => (
            <li key={l.id}>
              <button type="button" onClick={() => onElegir(l)} className="flex min-h-14 w-full items-center gap-3 py-2 text-left active:bg-white/5">
                <span className="mono w-14 shrink-0 text-[10px] tracking-[0.08em] text-white/45 uppercase">{l.tipo === 'comuna' ? 'Comuna' : l.tipo === 'direccion' ? 'Dirección' : 'Lugar'}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[16px] font-semibold">{l.nombre}</span>
                  <span className="block truncate text-[13px] text-white/55">{l.sub}</span>
                </span>
              </button>
            </li>
          ))}
          {q.trim().length >= 2 && !lista.length && <li className="py-3 text-[15px] text-white/60">Buscando…</li>}
        </ul>
      </div>
    </div>
  )
}

export default function RutaZumi({ origen, onRuta, onCerrar, onSeguir = () => {} }) {
  const [destino, setDestino] = useState(null)
  const [estado, setEstado] = useState('buscar') // buscar → calculando → lista | error
  const [error, setError] = useState(null)
  const [alternativas, setAlternativas] = useState([]) // [{ ruta, muestra, pron, riesgo }]
  const [sel, setSel] = useState(0)
  const [datos, setDatos] = useState(null) // { ruta, muestra, pron }
  const [salidaH, setSalidaH] = useState(0)
  const [abierto, setAbierto] = useState(false)
  const [navegando, setNavegando] = useState(null) // null | 'real' | 'simulada'
  const ac = useRef(null)

  const elegir = async (d) => {
    setDestino(d)
    setEstado('calculando')
    setError(null)
    ac.current?.abort()
    ac.current = new AbortController()
    try {
      anotarReciente(d)
      const rutas = await calcularRutas(origen, d, { signal: ac.current.signal })
      // clima de cada alternativa, en paralelo, para compararlas también por seguridad
      const alts = await Promise.all(
        rutas.map(async (ruta) => {
          const muestra = muestrear(ruta.coords)
          const pron = await pronosticoPuntos(muestra.puntos, { signal: ac.current.signal }).catch(() => null)
          const c = pron ? condiciones(muestra.puntos, pron, new Date(), ruta.segundos) : []
          const riesgo = c.reduce((m, x) => Math.max(m, x.riesgo?.nivel ?? 0), 0)
          const puntos = c.reduce((s2, x) => s2 + (x.riesgo?.nivel ?? 0) ** 2, 0)
          return { ruta, muestra, pron, riesgo, puntos }
        }),
      )
      // recomendada: la más rápida, salvo que otra sea claramente más segura sin tardar mucho más
      const rapida = alts[0]
      let rec = 0
      alts.forEach((a, i) => {
        if (i && a.puntos + 1 < alts[rec].puntos && a.ruta.segundos < rapida.ruta.segundos * 1.25) rec = i
      })
      alts.forEach((a, i) => (a.recomendada = i === rec))
      setAlternativas(alts)
      setSel(rec)
      setDatos(alts[rec])
      setSalidaH(0)
      setEstado('lista')
    } catch (e) {
      if (e.name === 'AbortError') return
      setError(e.message || 'No pude calcular la ruta')
      setEstado('error')
    }
  }
  useEffect(() => () => ac.current?.abort(), [])

  const salida = useMemo(() => {
    const ahora = new Date()
    if (salidaH === 'manana') {
      const m = new Date(ahora.getTime() + 864e5)
      m.setHours(8, 0, 0, 0)
      return m
    }
    return new Date(ahora.getTime() + salidaH * 36e5)
  }, [salidaH])

  const cond = useMemo(() => (datos?.pron ? condiciones(datos.muestra.puntos, datos.pron, salida, datos.ruta.segundos) : datos?.muestra.puntos.map((p) => ({ ...p, eta: new Date(salida.getTime() + p.avance * datos.ruta.segundos * 1000) })) ?? []), [datos, salida])
  const mejor = useMemo(() => (datos?.pron ? mejorSalida(datos.muestra.puntos, datos.pron, datos.ruta.segundos) : null), [datos])
  const paradas = useMemo(() => (datos ? descansos(datos.muestra.puntos, datos.ruta.segundos) : []), [datos])
  const pasos = useMemo(() => (datos ? pasosEnRuta(datos.ruta.coords) : []), [datos])
  const nivel = cond.reduce((m, c) => Math.max(m, c.riesgo?.nivel ?? 0), 0)
  const llegada = datos ? new Date(salida.getTime() + datos.ruta.segundos * 1000) : null
  const frase = datos ? resumenZumi(destino, datos.ruta, cond, salidaH === 0 ? mejor : null) : ''

  // El mapa dibuja la ruta pintada por tramos según el riesgo.
  useEffect(() => {
    if (!datos) return onRuta(null)
    const segmentos = []
    for (let k = 0; k < cond.length - 1; k++) {
      const a = cond[k]
      const b = cond[k + 1]
      segmentos.push({ coords: datos.ruta.coords.slice(a.i, b.i + 1), nivel: Math.max(a.riesgo?.nivel ?? 0, b.riesgo?.nivel ?? 0) })
    }
    onRuta({
      segmentos,
      puntos: cond.map((c) => ({ lat: c.lat, lng: c.lng, temp: c.temp, nivel: c.riesgo?.nivel ?? 0 })),
      destino: { lat: destino.lat, lng: destino.lng, nombre: destino.nombre },
      origen: { lat: origen.lat, lng: origen.lng },
      paradas: paradas.map((p) => ({ lat: p.lat, lng: p.lng, lugar: p.lugar })),
      clave: `${destino.id}`,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos, cond])
  useEffect(() => () => onRuta(null), []) // eslint-disable-line react-hooks/exhaustive-deps

  const compartir = async () => {
    const texto = `Voy camino a ${destino.nombre}: salgo ${diaCL(salida)} a las ${horaCL(salida)} y llego cerca de las ${horaCL(llegada)} (${Math.round(datos.ruta.metros / 1000)} km). Te aviso cuando llegue. — Ruta ZUMI, AlertaClima`
    try {
      if (navigator.share) await navigator.share({ text: texto, title: 'Mi viaje' })
      else window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener')
    } catch {
      /* cancelado */
    }
  }

  // Recalculó en el camino: nueva ruta, nuevos puntos de clima
  const nuevaRuta = (ruta) => {
    const muestra = muestrear(ruta.coords)
    setDatos((d) => ({ ...d, ruta, muestra, pron: null }))
    pronosticoPuntos(muestra.puntos)
      .then((pron) => setDatos((d) => (d.ruta === ruta ? { ...d, pron } : d)))
      .catch(() => {})
  }

  if (navegando && datos)
    return (
      <Suspense fallback={null}>
        <NavegacionZumi
          ruta={datos.ruta}
          destino={destino}
          cond={cond}
          simular={navegando === 'simulada'}
          onSeguir={onSeguir}
          onNuevaRuta={nuevaRuta}
          onSalir={() => {
            onSeguir(null)
            setNavegando(null)
          }}
        />
      </Suspense>
    )

  if (estado === 'buscar') return createPortal(<Buscador origen={origen} onElegir={elegir} onCerrar={onCerrar} />, document.body)

  return createPortal(
    <div className="ruta-panel vidrio-solido fixed inset-x-0 bottom-[calc(3.8rem+env(safe-area-inset-bottom))] z-[1200] mx-auto max-w-xl rounded-[28px] px-4 pt-2 pb-4 shadow-[0_-10px_40px_rgb(0_0_0/0.5)]">
      <button type="button" onClick={() => setAbierto(!abierto)} className="mx-auto mb-1 block h-6 w-16" aria-label={abierto ? 'Achicar el panel' : 'Agrandar el panel'}>
        <span className="mx-auto block h-1.5 w-12 rounded-full bg-white/30" />
      </button>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="rotulo flex items-center gap-2 !text-white/55">
            <span className="punto-vivo" aria-hidden="true" /> Ruta ZUMI · clima en el camino
          </p>
          <h2 className="titulo-x mt-1 truncate text-[24px]">{destino?.nombre}</h2>
        </div>
        <button type="button" onClick={() => setEstado('buscar')} className="boton-vidrio min-h-10 rounded-full px-3 text-[13px] font-semibold">
          Cambiar
        </button>
        <button type="button" onClick={onCerrar} aria-label="Cerrar la ruta" className="boton-vidrio grid size-10 place-items-center rounded-full">
          <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {estado === 'calculando' && <p className="mt-4 mb-2 text-[16px] text-white/70">Trazando la ruta y mirando el cielo en cada tramo…</p>}
      {estado === 'error' && (
        <div className="mt-3 mb-1">
          <p className="text-[15px] text-amber-200">{error}. Revisa tu conexión o prueba otro destino.</p>
          <button type="button" onClick={() => elegir(destino)} className="boton-linea mt-3 w-full text-[15px]">
            Reintentar
          </button>
        </div>
      )}

      {estado === 'lista' && datos && (
        <>
          {alternativas.length > 1 && (
            <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]" role="radiogroup" aria-label="Rutas posibles">
              {alternativas.map((a, i) => (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={sel === i}
                  onClick={() => (setSel(i), setDatos(a))}
                  className={`min-w-[9.5rem] shrink-0 rounded-2xl px-3 py-2 text-left ring-1 ${sel === i ? 'bg-white text-black ring-white' : 'bg-white/5 ring-white/15'}`}
                >
                  <span className="mono flex items-center gap-1.5 text-[10.5px] tracking-[0.06em] uppercase opacity-70">
                    <span className="size-2 rounded-full" style={{ background: NIVEL[a.riesgo].color }} aria-hidden="true" />
                    {a.recomendada ? 'Recomendada' : i === 0 ? 'Más rápida' : 'Alternativa'}
                  </span>
                  <span className="mt-0.5 block text-[17px] font-semibold">{duracion(a.ruta.segundos)}</span>
                  <span className="block truncate text-[12.5px] opacity-70">
                    {Math.round(a.ruta.metros / 1000)} km{a.ruta.via ? ` · por ${a.ruta.via}` : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 grid grid-cols-3 gap-2 border-y border-white/10 py-3">
            <div>
              <p className="rotulo !text-[10px]">Distancia</p>
              <p className="cifra mt-1 text-[30px]">
                {Math.round(datos.ruta.metros / 1000)}
                <span className="ml-1 text-[14px] font-normal tracking-normal text-white/60">km</span>
              </p>
            </div>
            <div>
              <p className="rotulo !text-[10px]">Manejo</p>
              <p className="mono mt-2 text-[17px]">{duracion(datos.ruta.segundos)}</p>
            </div>
            <div>
              <p className="rotulo !text-[10px]">Llegada</p>
              <p className="mono mt-2 text-[17px]">
                {horaCL(llegada)} <span className="text-[12px] text-white/55">{diaCL(llegada)}</span>
              </p>
            </div>
          </div>

          <div className="mt-3 flex items-start gap-2.5">
            <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: NIVEL[nivel].color, boxShadow: `0 0 12px ${NIVEL[nivel].color}` }} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold" style={{ color: NIVEL[nivel].color }}>
                {NIVEL[nivel].texto}
              </p>
              <p className="mt-0.5 text-[15px] leading-snug text-white/85">{frase}</p>
            </div>
            <button type="button" onClick={() => hablar([frase])} aria-label="Que ZUMI lo diga en voz alta" className="boton-vidrio grid size-10 shrink-0 place-items-center rounded-full">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 0 1 0 7" />
              </svg>
            </button>
          </div>

          {/* Hora de salida */}
          <div className="-mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none]" role="radiogroup" aria-label="Hora de salida">
            {[
              [0, 'Salir ahora'],
              [1, 'En 1 h'],
              [2, 'En 2 h'],
              [4, 'En 4 h'],
              ['manana', 'Mañana 08:00'],
            ].map(([v, t]) => (
              <button key={v} type="button" role="radio" aria-checked={salidaH === v} onClick={() => setSalidaH(v)} className={`min-h-9 shrink-0 rounded-full px-3 text-[13px] font-semibold ${salidaH === v ? 'bg-white text-black' : 'boton-vidrio'}`}>
                {t}
                {mejor && typeof v === 'number' && mejor.mejor.horas === v && v > 0 && <span className="ml-1 text-[#3ddc84]">●</span>}
              </button>
            ))}
          </div>

          <button type="button" onClick={() => setAbierto(!abierto)} aria-expanded={abierto} className="rotulo mt-3 flex w-full items-center justify-between border-t border-white/10 pt-3 !text-white/70">
            <span>{abierto ? 'Ocultar' : 'Ver'} el viaje tramo a tramo · {cond.length} puntos</span>
            <span aria-hidden="true">{abierto ? '▾' : '▸'}</span>
          </button>
          {abierto && (
            <div className="mt-2 max-h-[34vh] overflow-y-auto pr-1">
              {/* Línea de tiempo del viaje */}
              <ol className="relative ml-1 border-l border-white/15">
                {cond.map((c, k) => {
                  const lugar = k === 0 ? origen.nombre ?? 'Salida' : k === cond.length - 1 ? destino.nombre : comunaCercana(c)?.nombre
                  const n = c.riesgo?.nivel ?? 0
                  return (
                    <li key={k} className="relative py-1.5 pl-4">
                      <span className="absolute top-3.5 -left-[5px] size-2.5 rounded-full ring-2 ring-black" style={{ background: NIVEL[n].color }} aria-hidden="true" />
                      <div className="flex items-center gap-2">
                        <span className="mono w-11 shrink-0 text-[12.5px] text-white/70">{horaCL(c.eta)}</span>
                        <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{lugar}</span>
                        {c.icono && <IconoClima icono={c.icono} esDeDia={c.eta.getHours() >= 7 && c.eta.getHours() < 20} size={22} />}
                        {c.temp != null && <span className="mono w-9 text-right text-[14px]">{Math.round(c.temp)}°</span>}
                      </div>
                      {n > 0 && <p className="ml-13 text-[12.5px] font-medium" style={{ color: NIVEL[n].color }}>{c.riesgo.motivos.join(' · ')}</p>}
                    </li>
                  )
                })}
              </ol>

              {paradas.length > 0 && (
                <div className="mt-3 rounded-2xl border border-white/10 px-3 py-2.5">
                  <p className="rotulo !text-[10px]">Descansos sugeridos · cada 2 h</p>
                  <p className="mt-1 text-[14px] text-white/85">{paradas.map((p) => `${p.lugar} (${p.horas} h)`).join(' · ')}</p>
                  <p className="mt-0.5 text-[12px] text-white/50">Para, estira las piernas y toma agua: el cansancio causa muchos accidentes.</p>
                </div>
              )}
              {pasos.map((p) => (
                <div key={p.nombre} className="mt-2 rounded-2xl border border-amber-300/30 px-3 py-2.5">
                  <p className="rotulo !text-[10px] !text-amber-200">Paso de alta montaña</p>
                  <p className="mt-1 text-[14px]">
                    Pasas por <strong>{p.nombre}</strong>. Puede cerrarse por nieve o viento: revisa si está abierto y lleva cadenas en invierno.
                  </p>
                  <a href="https://www.pasosfronterizos.gov.cl/" target="_blank" rel="noopener" className="mt-1 inline-block text-[13px] font-semibold text-[#7cc4ff] underline">
                    Estado de los pasos fronterizos ↗
                  </a>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2">
            <button type="button" onClick={() => setNavegando('real')} className="boton-primario min-h-13 text-[16px]">
              <span className="onda-zumi" aria-hidden="true">
                <i /><i /><i /><i />
              </span>
              Ir con ZUMI
            </button>
            <button type="button" onClick={() => setNavegando('simulada')} className="boton-linea min-h-13 px-4 text-[14px]" aria-label="Ver una vista previa del recorrido">
              Vista previa
            </button>
            <button type="button" onClick={compartir} aria-label="Compartir mi viaje con mi familia" className="boton-linea min-h-12 px-4">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-[11px] text-white/40">ZUMI te guía por voz todo el camino. Rutas: OpenStreetMap. Clima: Open-Meteo. Mira el camino, no el teléfono.</p>
        </>
      )}
    </div>,
    document.body,
  )
}
