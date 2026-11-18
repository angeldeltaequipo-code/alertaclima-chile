// GPS familiar: «¿Dónde está mi hijo?». Cada integrante comparte su ubicación con su familia, cifrada
// de punta a punta (ni AlertaClima puede verla). Para cada uno se ve dónde está, hace cuánto, a qué
// distancia, su batería, el clima y si hay alerta oficial justo ahí, con «Cómo llegar» y «Ver en el mapa».
import { useEffect, useState } from 'react'
import { cambiarCompartir, crearFamilia, marcarEstado, miEstado, distanciaKm, enlaceInvitacion, haceCuanto, leerFamilia, leerGrupo, salirDeFamilia, unirseAFamilia, vigilarUbicacion } from '../services/familiaGPS'
import { comunaEnPunto } from '../services/comunas'
import { NIVELES, alertaPrincipal, estadoComuna } from '../services/alertas'
import { describir } from '../services/clima'
import IconoClima from './IconoClima'

const ROLES = ['Mamá', 'Papá', 'Hijo', 'Hija', 'Abuela', 'Abuelo', 'Pareja', 'Hermano', 'Hermana']

function useGrupo() {
  const [g, setG] = useState(leerGrupo)
  useEffect(() => {
    const f = () => setG(leerGrupo())
    window.addEventListener('ac:familia-gps', f)
    return () => window.removeEventListener('ac:familia-gps', f)
  }, [])
  return g
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
        <p className="mt-2 text-[16px] text-white/70">Mira dónde está cada uno de los tuyos, en un toque. Y si hay una emergencia donde están, ZUMI te avisa.</p>
        <ul className="mt-4 divide-y divide-white/10 border-y border-white/10 text-[15px]">
          {[
            ['MAPA', 'Toda tu familia en el mapa'],
            ['E2E', 'Cifrada: ni nosotros podemos verla'],
            ['CLIMA', 'Clima y alertas donde está cada uno'],
            ['BAT', 'Su batería y hace cuánto se actualizó'],
            ['RUTA', '«Cómo llegar» con un toque'],
          ].map(([k, t]) => (
            <li key={k} className="flex items-baseline gap-3 py-2">
              <span className="mono w-12 shrink-0 text-[10.5px] tracking-[0.1em] text-white/45">{k}</span>
              <span className="text-white/90">{t}</span>
            </li>
          ))}
        </ul>
      </div>
      <Formulario titulo="Crea tu familia (toma 10 segundos)" boton="Crear mi familia" onListo={onCrear} />
    </div>
  )
}

function Integrante({ m, yo, onVerMapa }) {
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
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${m.lat.toFixed(3)}&longitude=${m.lng.toFixed(3)}&current=temperature_2m,weather_code,is_day&timezone=auto`)
      .then((r) => r.json())
      .then((j) => vivo && setClima({ temp: j.current.temperature_2m, codigo: j.current.weather_code, dia: j.current.is_day === 1 }))
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [m.lat.toFixed(3), m.lng.toFixed(3)]) // eslint-disable-line react-hooks/exhaustive-deps
  const dist = yo && !m.yo ? distanciaKm(yo, m) : null
  const desc = clima ? describir(clima.codigo) : null
  const viejo = Date.now() - m.t > 60 * 60e3
  return (
    <li className={`rounded-[22px] p-3.5 ${alerta && NIVELES[alerta.nivel].gravedad >= 2 ? 'bg-peligro/12 ring-2 ring-peligro' : 'bg-superficie-2'}`}>
      <div className="flex items-center gap-3">
        <span className={`grid size-13 shrink-0 place-items-center rounded-full text-[22px] font-black text-white ${m.yo ? 'bg-sky-500' : 'bg-fuchsia-500'}`} aria-hidden="true">
          {m.nombre.slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[19px] leading-tight font-black">
            {m.yo ? 'Tú' : m.nombre} <span className="text-[15px] font-bold text-texto-2">· {m.rol}</span>
          </span>
          <span className="block truncate text-[15px]">{lugar ? `En ${lugar.nombre}` : 'Ubicando…'}{dist != null ? ` · a ${dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1).replace('.', ',')} km`}` : ''}</span>
          <span className={`block text-[13px] ${viejo ? 'font-bold text-amber-600' : 'text-texto-2'}`}>
            {haceCuanto(m.t)}
            {m.bateria != null ? ` · 🔋 ${m.bateria} %` : ''}
            {m.precision ? ` · ±${m.precision} m` : ''}
          </span>
        </span>
        {clima && (
          <span className="flex shrink-0 items-center gap-1" aria-label={`${Math.round(clima.temp)} grados, ${desc.texto}`}>
            <IconoClima icono={desc.icono} esDeDia={clima.dia} size={30} />
            <span className="text-[22px] font-bold tabular-nums">{Math.round(clima.temp)}°</span>
          </span>
        )}
      </div>
      {m.estado && Date.now() - m.estado.t < 24 * 3600e3 && (
        <p className={`mt-2 flex items-center gap-2 rounded-xl px-3 py-1.5 text-[14px] font-semibold ${m.estado.v === 'ayuda' ? 'bg-peligro text-white' : 'bg-[#3ddc84]/15 text-[#3ddc84]'}`}>
          <span className="mono text-[11px] tracking-[0.08em]">{m.estado.v === 'ayuda' ? 'SOS' : 'OK'}</span>
          {m.estado.v === 'ayuda' ? `${m.yo ? 'Pediste' : 'Pidió'} ayuda ${haceCuanto(m.estado.t)}` : `${m.yo ? 'Avisaste que estás' : 'Está'} bien · ${haceCuanto(m.estado.t)}`}
        </p>
      )}
      {alerta && <p className="mt-2 rounded-xl bg-peligro px-3 py-1.5 text-[14px] font-bold text-white">⚠ {NIVELES[alerta.nivel].etiqueta} donde está: {alerta.amenaza}</p>}
      {!m.yo && (
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onVerMapa(m)} className="min-h-12 rounded-full bg-senal text-[15px] font-bold text-sobre-senal">
            Ver en el mapa
          </button>
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lng}`} target="_blank" rel="noopener" className="grid min-h-12 place-items-center rounded-full bg-superficie text-[15px] font-bold ring-1 ring-linea">
            Cómo llegar
          </a>
        </div>
      )}
    </li>
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

function AvisosFamilia() {
  const [permiso, setPermiso] = useState(() => ('Notification' in window ? Notification.permission : 'no'))
  if (permiso === 'no') return null
  return permiso === 'granted' ? (
    <p className="rounded-2xl bg-emerald-500/12 px-4 py-3 text-[15px] font-bold text-emerald-800 dark:text-emerald-300">
      🔔 Te avisamos si alguien de tu familia está en una zona con Alerta Amarilla o Roja.
    </p>
  ) : (
    <button type="button" onClick={() => Notification.requestPermission().then(setPermiso)} className="min-h-14 w-full rounded-2xl bg-amber-400 px-4 text-left text-[16px] font-black text-slate-950">
      🔔 Avísame si alguien de mi familia entra a una zona con alerta
    </button>
  )
}

export default function GPSFamiliar({ invitacion = null, onInvitacionUsada = () => {}, onVerMapa = () => {} }) {
  const g = useGrupo()
  const [miembros, setMiembros] = useState([])
  const [error, setError] = useState(null)
  const [copiado, setCopiado] = useState(false)

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
          window.dispatchEvent(new CustomEvent('ac:familia-ubicaciones', { detail: l }))
        })
        .catch((e) => vivo && setError(e.message))
    leer()
    const t = setInterval(leer, 30e3)
    return () => {
      vivo = false
      clearInterval(t)
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
      <label className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-superficie-2 px-4">
        <span className="text-[16px] font-bold">{g.compartir ? '📍 Compartiendo mi ubicación' : 'Mi ubicación está oculta'}</span>
        <input type="checkbox" role="switch" checked={g.compartir} onChange={(e) => cambiarCompartir(e.target.checked)} className="size-6 accent-white" aria-label="Compartir mi ubicación con mi familia" />
      </label>

      <EstoyBien />

      {error && (
        <p className="rounded-2xl bg-amber-100 px-3 py-2 text-[15px] text-amber-900" role="alert">
          No pudimos actualizar las ubicaciones ({error}). Reintentamos solos en 30 segundos.
        </p>
      )}

      <ul className="space-y-2.5">
        {[...(yo ? [yo] : []), ...otros].map((m) => (
          <Integrante key={m.id} m={m} yo={yo} onVerMapa={onVerMapa} />
        ))}
      </ul>

      {!otros.length && (
        <p className="rounded-2xl bg-superficie-2 px-4 py-3 text-[16px]">
          Todavía no hay nadie más. <strong>Invita a tu familia</strong>: cuando abran el enlace en su teléfono y acepten, aparecerán aquí.
        </p>
      )}

      <AvisosFamilia />

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={invitar} className="boton-primario text-[16px]">
          {copiado ? '¡Enlace copiado!' : '➕ Invitar'}
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(`Únete a nuestra familia en AlertaClima: ${enlace}`)}`} target="_blank" rel="noopener" className="grid min-h-14 place-items-center rounded-full bg-[#25D366] text-[17px] font-black text-white">
          WhatsApp
        </a>
      </div>

      <p className="text-[13px] leading-snug text-texto-2">
        🔐 Cifrado de punta a punta: la clave de tu familia vive solo en sus teléfonos. Las ubicaciones se actualizan cada 2 minutos mientras cada uno tiene la app abierta, y se borran solas después de 48 horas.
      </p>
      <button
        type="button"
        onClick={() => {
          if (window.confirm('¿Salir de la familia? Dejarás de compartir y de ver sus ubicaciones.')) salirDeFamilia()
        }}
        className="min-h-11 w-full text-[15px] font-bold text-peligro underline"
      >
        Salir de la familia
      </button>
    </div>
  )
}
