// Mi familia: el GPS familiar de AlertaClima, cifrado de punta a punta (ni AlertaClima puede ver nada).
//
// Diseñado como el panel de un auto eléctrico: el mapa vivo es el protagonista, cada integrante tiene
// su tarjeta con lo esencial (dónde está, desde cuándo, batería, velocidad, clima y alertas), y lo demás
// aparece al tocar. Los lugares seguros (Casa, Colegio, Trabajo) avisan llegadas y salidas, el teléfono
// guarda el recorrido del día y la familia puede avisar «Estoy bien» o pedir ayuda con un toque.
import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import {
  cambiarCompartir,
  cambiarTelefono,
  crearFamilia,
  distanciaKm,
  enlaceInvitacion,
  guardarLugares,
  haceCuanto,
  leerFamilia,
  leerGrupo,
  lugaresFamilia,
  marcarEstado,
  miEstado,
  salirDeFamilia,
  unirseAFamilia,
  vigilarUbicacion,
} from '../services/familiaGPS'
import { ICONOS_LUGAR, aLugar, anotarRastro, desdeCuando, detectarEventos, eventosDeHoy, kmHoy, lugarDe } from '../services/familiaVida'
import { comunaEnPunto } from '../services/comunas'
import { NIVELES, alertaPrincipal, estadoComuna } from '../services/alertas'
import { describir } from '../services/clima'
import IconoClima from './IconoClima'
import { colorDe } from './colorFamilia'
import { avisarEventos } from '../services/familiaAlertas'

const MapaFamilia = lazy(() => import('./MapaFamilia'))
const ROLES = ['Mamá', 'Papá', 'Hijo', 'Hija', 'Abuela', 'Abuelo', 'Pareja', 'Hermano', 'Hermana']
const hora = (t) => new Date(t).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const EN_VIVO_MS = 5 * 60e3

function useGrupo() {
  const [g, setG] = useState(leerGrupo)
  useEffect(() => {
    const f = () => setG(leerGrupo())
    window.addEventListener('ac:familia-gps', f)
    return () => window.removeEventListener('ac:familia-gps', f)
  }, [])
  return g
}
function useAhora(ms = 15e3) {
  const [t, setT] = useState(() => Date.now())
  useEffect(() => {
    const i = setInterval(() => setT(Date.now()), ms)
    return () => clearInterval(i)
  }, [ms])
  return t
}

function Formulario({ titulo, boton, onListo, invitacion }) {
  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState('')
  const listo = nombre.trim().length >= 2 && rol
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (listo) onListo({ nombre, rol })
      }}
      className="space-y-3"
    >
      <p className="text-[17px] font-bold">{titulo}</p>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" aria-label="Tu nombre" maxLength={30} className="min-h-13 w-full rounded-2xl border-2 border-linea bg-superficie px-4 text-[17px]" />
      <div className="flex flex-wrap gap-2" role="group" aria-label="¿Quién eres en la familia?">
        {ROLES.map((r) => (
          <button key={r} type="button" onClick={() => setRol(r)} aria-pressed={rol === r} className={`min-h-11 rounded-full px-4 text-[15px] font-bold ${rol === r ? 'bg-senal text-sobre-senal' : 'bg-superficie-2'}`}>
            {r}
          </button>
        ))}
      </div>
      <p className="text-[13px] text-texto-2">
        {invitacion ? 'Al unirte, tu familia podrá ver tu ubicación mientras uses la app. ' : ''}Tu ubicación viaja cifrada: solo tu familia puede verla. Puedes dejar de compartir o salir cuando quieras.
      </p>
      <button type="submit" disabled={!listo} className="boton-primario w-full text-[17px] disabled:opacity-40">
        {boton}
      </button>
    </form>
  )
}

function Bienvenida({ onCrear }) {
  return (
    <div className="space-y-4">
      <div className="gps-hero overflow-hidden rounded-[26px] p-5 text-white">
        <p className="rotulo !text-[#ff6fb1]">GPS familiar · cifrado E2E</p>
        <h3 className="titulo-x mt-2 text-[28px]">¿Dónde está mi hijo?</h3>
        <p className="mt-2 text-[16px] text-white/70">Tu familia en un mapa vivo. Te avisa cuando llegan al colegio o a la casa, si se les acaba la batería o si hay una emergencia donde están.</p>
        <ul className="mt-4 divide-y divide-white/10 border-y border-white/10 text-[15px]">
          {[
            ['VIVO', 'Mapa en vivo de toda la familia'],
            ['LUGAR', 'Avisos al llegar y salir de Casa, Colegio o Trabajo'],
            ['SOS', '«Estoy bien» o «Necesito ayuda» con un toque'],
            ['ALERTA', 'Clima y alertas oficiales donde está cada uno'],
            ['E2E', 'Cifrado AES-256: ni nosotros podemos verla'],
          ].map(([k, t]) => (
            <li key={k} className="flex items-baseline gap-3 py-2">
              <span className="mono w-14 shrink-0 text-[10.5px] tracking-[0.1em] text-white/45">{k}</span>
              <span className="text-white/90">{t}</span>
            </li>
          ))}
        </ul>
      </div>
      <Formulario titulo="Crea tu familia (toma 10 segundos)" boton="Crear mi familia" onListo={onCrear} />
    </div>
  )
}

/** Lo que la familia ve de alguien, en una línea: dónde está y desde cuándo. */
function dondeEsta(m, lugares, comuna) {
  const l = lugarDe(m, lugares)
  if (l) {
    const d = desdeCuando(m.id)
    return `${l.e} ${aLugar(l.n).replace(/^a la /, 'En la ').replace(/^al /, 'En el ').replace(/^a /, 'En ').replace(/^donde/, 'Donde')}${d ? ` desde las ${hora(d)}` : ''}`
  }
  if (m.vel >= 8) return `En movimiento · ${m.vel} km/h${comuna ? ` · ${comuna}` : ''}`
  return comuna ? `En ${comuna}` : 'Ubicando…'
}

function Integrante({ m, yo, lugares, abierto, onAbrir, onVerMapa, ahora }) {
  const [lugar, setLugar] = useState(null)
  const [clima, setClima] = useState(null)
  const [alerta, setAlerta] = useState(undefined)
  useEffect(() => {
    let vivo = true
    comunaEnPunto(m.lat, m.lng)
      .then((c) => {
        if (!vivo) return
        setLugar(c)
        if (c) estadoComuna(c.cut).then((e) => vivo && setAlerta(e.tipo === 'ok' ? alertaPrincipal(e.alertas) : null)).catch(() => {})
      })
      .catch(() => {})
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${m.lat.toFixed(2)}&longitude=${m.lng.toFixed(2)}&current=temperature_2m,weather_code,is_day&timezone=auto`)
      .then((r) => r.json())
      .then((j) => vivo && setClima({ temp: j.current.temperature_2m, codigo: j.current.weather_code, dia: j.current.is_day === 1 }))
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [m.lat.toFixed(2), m.lng.toFixed(2)]) // eslint-disable-line react-hooks/exhaustive-deps
  const dist = yo && !m.yo ? distanciaKm(yo, m) : null
  const desc = clima ? describir(clima.codigo) : null
  const enVivo = ahora - m.t < EN_VIVO_MS
  const viejo = ahora - m.t > 60 * 60e3
  const sos = m.estado?.v === 'ayuda' && ahora - m.estado.t < 24 * 3600e3
  const ok = m.estado?.v === 'bien' && ahora - m.estado.t < 24 * 3600e3
  const grave = alerta && NIVELES[alerta.nivel].gravedad >= 2
  const km = abierto ? kmHoy(m.id) : 0
  const nombre = m.yo ? 'Tú' : m.nombre
  return (
    <li className={`integrante overflow-hidden rounded-[22px] border ${sos ? 'border-peligro bg-peligro/10' : grave ? 'border-peligro/60' : abierto ? 'border-white/25' : 'border-linea'} bg-superficie`}>
      <button type="button" onClick={onAbrir} aria-expanded={abierto} className="flex w-full items-center gap-3 p-3.5 text-left">
        <span className={`avatar-fam ${enVivo ? 'vivo' : ''}`} style={{ '--c': colorDe(m.id) }} aria-hidden="true">
          {nombre.slice(0, m.yo ? 2 : 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            <span className="titulo-x truncate text-[18px]">{nombre}</span>
            <span className="truncate text-[13px] text-texto-2">{m.rol}</span>
          </span>
          <span className="block truncate text-[14.5px]">{dondeEsta(m, lugares, lugar?.nombre)}</span>
          <span className={`mono mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] ${viejo ? 'text-amber-300' : 'text-texto-2'}`}>
            {enVivo ? (
              <span className="flex items-center gap-1 text-[#3ddc84]">
                <span className="punto-vivo" aria-hidden="true" /> EN VIVO
              </span>
            ) : (
              <span>{haceCuanto(m.t, ahora).toUpperCase()}</span>
            )}
            {m.bateria != null && (
              <span className={m.bateria <= 15 && !m.cargando ? 'text-peligro' : ''}>
                {m.cargando ? '⚡' : '▮'} {m.bateria}%
              </span>
            )}
            {dist != null && <span>{dist < 1 ? `${Math.round(dist * 1000)} M` : `${dist.toFixed(1).replace('.', ',')} KM`}</span>}
          </span>
        </span>
        {clima && (
          <span className="flex shrink-0 flex-col items-center" aria-label={`${Math.round(clima.temp)} grados, ${desc.texto}`}>
            <IconoClima icono={desc.icono} esDeDia={clima.dia} size={26} />
            <span className="mono text-[14px]">{Math.round(clima.temp)}°</span>
          </span>
        )}
      </button>
      {(sos || ok) && (
        <p className={`mx-3.5 mb-3 flex items-center gap-2 rounded-xl px-3 py-1.5 text-[14px] font-semibold ${sos ? 'bg-peligro text-white' : 'bg-[#3ddc84]/15 text-[#3ddc84]'}`}>
          <span className="mono text-[11px] tracking-[0.08em]">{sos ? 'SOS' : 'OK'}</span>
          {sos ? `${m.yo ? 'Pediste' : 'Pidió'} ayuda ${haceCuanto(m.estado.t, ahora)}` : `${m.yo ? 'Avisaste que estás' : 'Está'} bien · ${haceCuanto(m.estado.t, ahora)}`}
        </p>
      )}
      {alerta && <p className="mx-3.5 mb-3 rounded-xl bg-peligro px-3 py-1.5 text-[14px] font-bold text-white">⚠ {NIVELES[alerta.nivel].etiqueta} donde está: {alerta.amenaza}</p>}
      {abierto && (
        <div className="border-t border-linea px-3.5 pt-3 pb-3.5">
          <dl className="mono grid grid-cols-3 gap-2 text-[11px] text-texto-2">
            <div>
              <dt>HOY</dt>
              <dd className="mt-0.5 text-[15px] text-texto">{km >= 0.1 ? `${km.toFixed(1).replace('.', ',')} km` : '—'}</dd>
            </div>
            <div>
              <dt>PRECISIÓN</dt>
              <dd className="mt-0.5 text-[15px] text-texto">{m.precision ? `±${m.precision} m` : '—'}</dd>
            </div>
            <div>
              <dt>ACTUALIZADO</dt>
              <dd className="mt-0.5 text-[15px] text-texto">{hora(m.t)}</dd>
            </div>
          </dl>
          {!m.yo && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              <AccionRedonda etiqueta="Mapa" onClick={() => onVerMapa(m)} icono={<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14" />} />
              <AccionRedonda
                etiqueta="Llegar"
                href={`https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}`}
                icono={<path d="M3 11l18-8-8 18-2-8-8-2z" />}
              />
              <AccionRedonda etiqueta="Llamar" href={m.tel ? `tel:${m.tel}` : null} icono={<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />} />
              <AccionRedonda etiqueta="WhatsApp" href={m.tel ? `https://wa.me/${m.tel.replace(/\D/g, '')}` : null} icono={<path d="M20 12a8 8 0 0 1-11.8 7L4 20l1.1-4A8 8 0 1 1 20 12z" />} />
            </div>
          )}
          {!m.yo && !m.tel && <p className="mt-2 text-[12px] text-texto-2">Para llamar o escribirle con un toque, pídele a {m.nombre} que agregue su teléfono en Ajustes de su familia.</p>}
        </div>
      )}
    </li>
  )
}

function AccionRedonda({ etiqueta, icono, onClick, href }) {
  const cls = `flex flex-col items-center gap-1 text-[12px] font-medium ${href === null ? 'pointer-events-none opacity-35' : ''}`
  const dentro = (
    <>
      <span className="grid size-12 place-items-center rounded-full border border-linea bg-superficie-2">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {icono}
        </svg>
      </span>
      {etiqueta}
    </>
  )
  return onClick ? (
    <button type="button" onClick={onClick} className={cls}>
      {dentro}
    </button>
  ) : (
    <a href={href ?? undefined} target={href?.startsWith('http') ? '_blank' : undefined} rel="noopener" className={cls} aria-disabled={href === null}>
      {dentro}
    </a>
  )
}

/** «Estoy bien» / «Necesito ayuda»: un toque y toda la familia lo sabe (cifrado). */
export function EstoyBien({ compacto = false }) {
  const [estado, setEstado] = useState(miEstado)
  const [enviando, setEnviando] = useState(null)
  const marcar = async (v) => {
    if (v === 'ayuda' && !window.confirm('¿Enviar a tu familia que necesitas ayuda, con tu ubicación?')) return
    setEnviando(v)
    navigator.vibrate?.(30)
    await marcarEstado(v)
    setEstado(miEstado())
    setEnviando(null)
  }
  return (
    <div className={`rounded-[22px] border border-linea ${compacto ? 'px-3.5 py-3' : 'px-4 py-3.5'}`}>
      <p className="rotulo">Avisa a tu familia · cifrado</p>
      {estado && (
        <p className="mt-1 text-[14px] text-texto-2">
          Último aviso: <strong className={estado.v === 'ayuda' ? 'text-peligro' : 'text-[#3ddc84]'}>{estado.v === 'ayuda' ? 'necesito ayuda' : 'estoy bien'}</strong> · {haceCuanto(estado.t)}
        </p>
      )}
      <div className="mt-2.5 grid grid-cols-[1.4fr_1fr] gap-2">
        <button type="button" disabled={Boolean(enviando)} onClick={() => marcar('bien')} className="boton-primario min-h-13 text-[16px] disabled:opacity-60">
          {enviando === 'bien' ? 'Avisando…' : '✓ Estoy bien'}
        </button>
        <button type="button" disabled={Boolean(enviando)} onClick={() => marcar('ayuda')} className="min-h-13 rounded-full border border-peligro text-[15px] font-semibold text-peligro disabled:opacity-60">
          {enviando === 'ayuda' ? 'Enviando…' : 'Necesito ayuda'}
        </button>
      </div>
    </div>
  )
}

/** Lugares seguros de la familia: avisan cuando alguien llega o sale. */
function Lugares({ lugares, yo }) {
  const [nuevo, setNuevo] = useState(null) // { tipo, n }
  const agregar = () => {
    if (!nuevo?.n?.trim() || !yo) return
    guardarLugares([...lugares, { id: Math.random().toString(36).slice(2, 9), n: nuevo.n.trim().slice(0, 24), e: ICONOS_LUGAR[nuevo.tipo], lat: +yo.lat.toFixed(5), lng: +yo.lng.toFixed(5), r: 0.15, c: Date.now() }])
    setNuevo(null)
  }
  return (
    <section aria-labelledby="t-lugares" className="rounded-[22px] border border-linea px-4 py-3.5">
      <div className="flex items-baseline justify-between">
        <h3 id="t-lugares" className="rotulo">
          Lugares seguros · {lugares.length}/8
        </h3>
        {!nuevo && lugares.length < 8 && (
          <button type="button" onClick={() => setNuevo({ tipo: 'casa', n: 'Casa' })} className="text-[14px] font-semibold text-telemetria">
            + Agregar
          </button>
        )}
      </div>
      {lugares.length === 0 && !nuevo && <p className="mt-1.5 text-[14px] text-texto-2">Agrega la casa, el colegio o el trabajo, y te aviso cuando alguien llegue o salga.</p>}
      {lugares.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {lugares.map((l) => (
            <li key={l.id} className="flex min-h-10 items-center gap-1.5 rounded-full border border-linea pr-1 pl-3 text-[14px]">
              <span aria-hidden="true">{l.e}</span> {l.n}
              <button
                type="button"
                onClick={() => window.confirm(`¿Quitar «${l.n}» de los lugares de la familia?`) && guardarLugares(lugares.filter((x) => x.id !== l.id))}
                aria-label={`Quitar ${l.n}`}
                className="grid size-8 place-items-center rounded-full text-texto-2"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {nuevo && (
        <div className="mt-2.5 space-y-2.5">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Tipo de lugar">
            {Object.entries(ICONOS_LUGAR).map(([k, e]) => (
              <button
                key={k}
                type="button"
                aria-pressed={nuevo.tipo === k}
                onClick={() => setNuevo({ tipo: k, n: k === 'otro' ? '' : k[0].toUpperCase() + k.slice(1) })}
                className={`min-h-10 rounded-full px-3 text-[14px] ${nuevo.tipo === k ? 'bg-senal text-sobre-senal' : 'bg-superficie-2'}`}
              >
                {e} {k[0].toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>
          <input value={nuevo.n} onChange={(e) => setNuevo({ ...nuevo, n: e.target.value })} placeholder="Nombre del lugar" aria-label="Nombre del lugar" maxLength={24} className="min-h-12 w-full rounded-2xl border-2 border-linea bg-superficie px-4 text-[16px]" />
          <p className="text-[13px] text-texto-2">Se guarda donde estás ahora, con un radio de 150 metros.{!yo ? ' Activa compartir tu ubicación para poder agregarlo.' : ''}</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setNuevo(null)} className="boton-linea min-h-12 !text-texto">
              Cancelar
            </button>
            <button type="button" disabled={!yo || !nuevo.n.trim()} onClick={agregar} className="boton-primario min-h-12 disabled:opacity-40">
              Guardar aquí
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function Actividad({ eventos, ahora }) {
  if (!eventos.length) return null
  return (
    <section aria-labelledby="t-actividad" className="rounded-[22px] border border-linea px-4 py-3.5">
      <h3 id="t-actividad" className="rotulo">
        Actividad de hoy
      </h3>
      <ol className="mt-2 space-y-1.5">
        {eventos.slice(0, 8).map((e, i) => (
          <li key={`${e.t}-${i}`} className="flex items-center gap-2.5 text-[14.5px]">
            <span className="mono w-11 shrink-0 text-[12px] text-texto-2">{hora(e.t)}</span>
            <span aria-hidden="true">{e.icono}</span>
            <span className={`min-w-0 flex-1 ${e.tipo === 'bateria' ? 'text-amber-300' : ''}`}>{e.texto}</span>
            {ahora - e.t < 10 * 60e3 && <span className="punto-vivo" aria-hidden="true" />}
          </li>
        ))}
      </ol>
    </section>
  )
}

function AvisosFamilia() {
  const [permiso, setPermiso] = useState(() => ('Notification' in window ? Notification.permission : 'no'))
  if (permiso === 'no' || permiso === 'granted') return null
  return (
    <button type="button" onClick={() => Notification.requestPermission().then(setPermiso)} className="flex min-h-14 w-full items-center gap-3 rounded-[22px] border border-amber-300/40 bg-amber-300/10 px-4 text-left text-[15px] font-semibold text-amber-200">
      <span className="mono text-[11px] tracking-[0.1em]">AVISOS</span>
      Activa los avisos: llegadas, salidas, batería baja y alertas de tu familia
    </button>
  )
}

function Ajustes({ g }) {
  const [tel, setTel] = useState(g.yo.tel ?? '')
  const [abierto, setAbierto] = useState(false)
  return (
    <section className="rounded-[22px] border border-linea">
      <button type="button" onClick={() => setAbierto(!abierto)} aria-expanded={abierto} className="flex min-h-14 w-full items-center justify-between px-4 text-left">
        <span className="rotulo !text-texto">Ajustes de mi familia</span>
        <span className="text-texto-2" aria-hidden="true">
          {abierto ? '▾' : '▸'}
        </span>
      </button>
      {abierto && (
        <div className="space-y-3 border-t border-linea px-4 pt-3 pb-4">
          <label className="flex min-h-12 items-center justify-between gap-3">
            <span className="text-[15px]">{g.compartir ? 'Compartiendo mi ubicación' : 'Mi ubicación está oculta'}</span>
            <input type="checkbox" role="switch" checked={g.compartir} onChange={(e) => cambiarCompartir(e.target.checked)} className="size-6 accent-white" aria-label="Compartir mi ubicación con mi familia" />
          </label>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              cambiarTelefono(tel)
            }}
            className="flex gap-2"
          >
            <input
              value={tel}
              onChange={(e) => setTel(e.target.value)}
              inputMode="tel"
              placeholder="+56 9 1234 5678"
              aria-label="Mi teléfono para que mi familia me llame"
              className="min-h-12 min-w-0 flex-1 rounded-2xl border-2 border-linea bg-superficie px-4 text-[16px]"
            />
            <button type="submit" className="boton-linea min-h-12 px-4 !text-texto">
              Guardar
            </button>
          </form>
          <p className="text-[12.5px] text-texto-2">Tu teléfono viaja cifrado y solo lo ve tu familia, para llamarte o escribirte con un toque.</p>
          <button
            type="button"
            onClick={() => window.confirm('¿Salir de la familia? Dejarás de compartir y de ver sus ubicaciones.') && salirDeFamilia()}
            className="min-h-11 w-full text-[15px] font-semibold text-peligro"
          >
            Salir de la familia
          </button>
        </div>
      )}
    </section>
  )
}

export default function GPSFamiliar({ invitacion = null, onInvitacionUsada = () => {}, onVerMapa = () => {} }) {
  const g = useGrupo()
  const ahora = useAhora()
  const [miembros, setMiembros] = useState([])
  const [error, setError] = useState(null)
  const [copiado, setCopiado] = useState(false)
  const [elegido, setElegido] = useState(null)
  const [eventos, setEventos] = useState(eventosDeHoy)
  const [leido, setLeido] = useState(null)
  const lugares = useMemo(() => g?.lugares?.l ?? lugaresFamilia(), [g])

  useEffect(() => {
    if (!g) return
    vigilarUbicacion()
    let vivo = true
    const leer = () =>
      leerFamilia()
        .then((l) => {
          if (!vivo) return
          setMiembros(l)
          setError(null)
          setLeido(Date.now())
          anotarRastro(l)
          avisarEventos(detectarEventos(l, lugaresFamilia()))
          setEventos(eventosDeHoy())
          window.dispatchEvent(new CustomEvent('ac:familia-ubicaciones', { detail: l }))
        })
        .catch((e) => vivo && setError(e.message))
    leer()
    const t = setInterval(leer, 20e3)
    const alVolver = () => !document.hidden && leer()
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      vivo = false
      clearInterval(t)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [g?.grupo, g?.compartir]) // eslint-disable-line react-hooks/exhaustive-deps

  if (invitacion && !g)
    return (
      <div className="space-y-3">
        <div className="gps-hero rounded-[26px] p-5 text-white">
          <p className="rotulo !text-[#ff6fb1]">Invitación</p>
          <h3 className="titulo-x mt-2 text-[24px]">Tu familia te invitó a su GPS familiar</h3>
        </div>
        <Formulario
          invitacion
          titulo="¿Quién eres?"
          boton="Unirme a mi familia"
          onListo={(d) => {
            unirseAFamilia(invitacion, d)
            onInvitacionUsada()
          }}
        />
      </div>
    )
  if (!g) return <Bienvenida onCrear={(d) => crearFamilia(d)} />

  const yo = miembros.find((m) => m.yo)
  const otros = miembros.filter((m) => !m.yo)
  const enVivo = miembros.filter((m) => ahora - m.t < EN_VIVO_MS).length
  const enlace = enlaceInvitacion(g)
  const invitar = async () => {
    const texto = `Únete a nuestra familia en AlertaClima para saber dónde estamos y si hay alertas. Es privado y cifrado: ${enlace}`
    if (navigator.share) return navigator.share({ title: 'GPS familiar · AlertaClima', text: texto }).catch(() => {})
    await navigator.clipboard?.writeText(enlace).catch(() => {})
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2500)
  }

  return (
    <div className="space-y-3">
      {/* Estado del sistema, como el tablero de un auto */}
      <div className="flex items-center justify-between px-0.5">
        <p className="rotulo flex items-center gap-2">
          <span className={enVivo ? 'punto-vivo' : 'size-1.5 rounded-full bg-texto-2'} aria-hidden="true" />
          {enVivo} de {miembros.length || 1} en vivo
        </p>
        <p className="rotulo">{error ? 'Reconectando…' : leido ? `Sincronizado ${haceCuanto(leido, ahora)}` : 'Conectando…'}</p>
      </div>

      <Suspense fallback={<div className="h-[19rem] animate-pulse rounded-[26px] bg-superficie" />}>
        <MapaFamilia miembros={miembros} lugares={lugares} elegido={elegido} onElegir={setElegido} />
      </Suspense>

      <ul className="space-y-2">
        {[...(yo ? [yo] : []), ...otros].map((m) => (
          <Integrante key={m.id} m={m} yo={yo} lugares={lugares} ahora={ahora} abierto={elegido === m.id} onAbrir={() => setElegido(elegido === m.id ? null : m.id)} onVerMapa={onVerMapa} />
        ))}
      </ul>

      {!otros.length && (
        <p className="rounded-[22px] border border-dashed border-linea px-4 py-3 text-[15px]">
          Todavía no hay nadie más. <strong>Invita a tu familia</strong>: cuando abran el enlace en su teléfono y acepten, aparecerán aquí.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={invitar} className="boton-primario text-[16px]">
          {copiado ? '¡Enlace copiado!' : '+ Invitar'}
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(`Únete a nuestra familia en AlertaClima: ${enlace}`)}`} target="_blank" rel="noopener" className="boton-linea text-[16px] !text-texto">
          Por WhatsApp
        </a>
      </div>

      <EstoyBien />
      <Actividad eventos={eventos} ahora={ahora} />
      <Lugares lugares={lugares} yo={yo} />
      <AvisosFamilia />
      <Ajustes g={g} />

      <p className="mono px-1 text-[10.5px] leading-relaxed tracking-[0.04em] text-texto-2">
        AES-256-GCM · CLAVE SOLO EN SUS TELÉFONOS · EL SERVIDOR NO VE NADA · SE BORRA A LAS 48 H · ACTUALIZA CADA 1 MIN CON LA APP ABIERTA
      </p>
    </div>
  )
}
