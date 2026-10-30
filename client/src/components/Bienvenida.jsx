// Página de entrada de AlertaClima: una landing que presenta el producto (con ZUMI como cara),
// muestra datos reales en vivo y lleva a entrar con Google en un toque. Si la persona ya tiene
// cuenta, el mismo lugar le pide su comuna.
import { configPlanes } from '../services/planes'
import { useEffect, useState } from 'react'
import { alCambiarNarrador, callar, hablar } from '../services/narrador'
import { comunaEnPunto } from '../services/comunas'
import { obtenerRiesgos } from '../services/riesgos'
import BotonGoogle from './BotonGoogle'
import ZumiVideo from './ZumiVideo'

const Icono = ({ d, color, tam = 24 }) => (
  <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
)

const FUNCIONES = [
  {
    titulo: 'ZUMI, tu narrador del clima',
    texto: 'Te cuenta el pronóstico con su voz, te llama por tu nombre y responde tus preguntas. Ideal también para personas ciegas o con baja visión.',
    color: '#fb923c',
    icono: <path d="M12 3a4 4 0 0 1 4 4v4a4 4 0 0 1-8 0V7a4 4 0 0 1 4-4zM5 11a7 7 0 0 0 14 0M12 18v3" />,
  },
  {
    titulo: 'Alertas oficiales al instante',
    texto: 'Cuando SENAPRED publica una alerta para tu comuna, el teléfono vibra y ZUMI te la lee, aunque tengas la app cerrada.',
    color: '#fbbf24',
    icono: <path d="M12 3l9.5 17h-19zM12 10v4.5M12 17.5v.01" />,
  },
  {
    titulo: 'Radar de lluvia en vivo',
    texto: 'Mira dónde está lloviendo ahora mismo y cuántos milímetros caerán en tu calle, hora a hora.',
    color: '#38bdf8',
    icono: <path d="M7 15h10a4 4 0 0 0 .4-8 6 6 0 0 0-11.6 1.4A3.3 3.3 0 0 0 7 15zM9 18l-1 2M13 18l-1 2M17 18l-1 2" />,
  },
  {
    titulo: 'Sismos, tsunamis y volcanes',
    texto: 'Cada sismo de la semana en un mapa de Chile, boletines de tsunami del Pacífico y los volcanes cerca de ti.',
    color: '#f97316',
    icono: <path d="M2 12h4l2-6 3 12 3-9 2 3h6" />,
  },
  {
    titulo: 'Aluviones y ríos cercanos',
    texto: 'Te avisamos cuando la lluvia cae en la cordillera con isoterma alta y te mostramos las quebradas cerca de ti.',
    color: '#a78bfa',
    icono: <path d="M3 20l6-10 4 6 3-4 5 8zM14 6l2-3 2 3" />,
  },
  {
    titulo: 'Tus vecinos en tiempo real',
    texto: 'Reportes con fotos y un chat por comuna con filtros de seguridad: sin enlaces, sin groserías y sin datos personales.',
    color: '#34d399',
    icono: <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 19a5.5 5.5 0 0 1 11 0M10.5 19a5.5 5.5 0 0 1 11 0" />,
  },
  {
    titulo: 'Botón SOS',
    texto: 'Llama al 133, 132 o 131 con un toque y envía tu ubicación exacta a tu familia por SMS o WhatsApp.',
    color: '#f43f5e',
    icono: <path d="M12 21s-7-4.4-7-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7 3.5C19 16.6 12 21 12 21z" />,
  },
  {
    titulo: 'El cielo y el espacio en vivo',
    texto: 'Telescopios de los observatorios de Chile, el cielo de esta noche sobre tu comuna y la Estación Espacial pasando en directo.',
    color: '#818cf8',
    icono: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />,
  },
]

const PASOS = [
  ['Entra con Google', 'Un toque, sin contraseñas ni formularios.'],
  ['Elige tu comuna', 'O usa tu ubicación: funciona en las 346 comunas de Chile.'],
  ['Recibe los avisos', 'ZUMI te cuenta el clima y te avisa si algo cambia.'],
]

const PREGUNTAS = [
  ['¿Qué tan confiable es la información?', 'Usamos solo fuentes oficiales y científicas, y cada dato muestra de dónde viene y a qué hora se actualizó. Los reportes de vecinos se marcan como tales y se ocultan si la comunidad los desmiente.'],
  ['¿De dónde salen los datos?', 'Alertas de SENAPRED, sismos del Servicio Geológico de EE.UU. (USGS), tsunamis del Centro de Alerta del Pacífico (NOAA), pronóstico de Open-Meteo, radar de RainViewer, imágenes de la NASA y telescopios de ESO.'],
  ['¿Reemplaza a SENAPRED?', 'No. AlertaClima te ayuda a enterarte a tiempo, pero ante una emergencia sigue siempre las instrucciones oficiales de SENAPRED, el SHOA y tu municipio.'],
  ['¿Qué hacen con mis datos?', 'Solo guardamos tu nombre con la inicial del apellido y tu foto de Google. No guardamos tu correo ni vendemos datos. Puedes borrar tu cuenta cuando quieras.'],
  ['¿Funciona sin internet?', 'Sí: se instala como app y guarda el último pronóstico para que lo veas aunque se caiga la señal. El botón SOS también puede enviar tu ubicación por SMS.'],
]

/** Datos reales del momento para la franja «en vivo» de la landing. */
function useEnVivo() {
  const [d, setD] = useState(null)
  useEffect(() => {
    const ctrl = new AbortController()
    obtenerRiesgos({ signal: ctrl.signal })
      .then((r) => {
        const mayor = r.sismos.reduce((a, b) => (b.magnitud > (a?.magnitud ?? 0) ? b : a), null)
        setD({ sismos: r.sismos.length, mayor })
      })
      .catch(() => {})
    return () => ctrl.abort()
  }, [])
  return d
}

export default function Bienvenida({ onElegir, onBuscar, cuenta }) {
  const [sinCuenta, setSinCuenta] = useState(false)
  // Paso 1: entrar con Google (si está activo y aún no hay sesión). Paso 2: elegir la comuna.
  const pasoCuenta = cuenta?.estado === 'sin-sesion' && cuenta.clientId && !sinCuenta
  const [buscando, setBuscando] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const [hablandoZumi, setHablandoZumi] = useState(false)
  const [escenaInicio] = useState(() => (new Date().getHours() >= 20 || new Date().getHours() < 7 ? 'noche' : 'sala'))
  const [ancho, setAncho] = useState(() => window.innerWidth)
  const vivo = useEnVivo()
  const [planesWeb, setPlanesWeb] = useState(null)
  useEffect(() => {
    configPlanes().then(setPlanesWeb).catch(() => {})
  }, [])
  const escritorio = ancho >= 900
  const altoZumi = Math.round(escritorio ? Math.min(window.innerHeight * 0.62, 560) : Math.min(window.innerHeight * 0.33, 300))

  useEffect(() => {
    const f = () => setAncho(window.innerWidth)
    window.addEventListener('resize', f)
    return () => {
      window.removeEventListener('resize', f)
    }
  }, [])
  useEffect(() => {
    const quitar = alCambiarNarrador((e) => setHablandoZumi(e.hablando))
    return () => {
      quitar()
      callar()
    }
  }, [])

  const primerNombre = cuenta?.usuario?.nombre?.split(' ')[0]
  const dice = pasoCuenta
    ? ['¡Hola! Soy ZUMI.', 'Vigilo el clima, los sismos y las alertas de tu comuna para avisarte a tiempo.', '¡Entra y yo te cuido!']
    : [primerNombre ? `¡Listo, ${primerNombre}!` : '¡Perfecto!', 'Ahora dime dónde estás para cuidarte en tu comuna.']

  // La voz necesita un toque de la persona (los navegadores no dejan hablar solo al abrir).
  const escuchar = () => {
    if (hablandoZumi) return callar()
    hablar(dice, { silencio: false })
  }

  const ubicarme = () => {
    if (!navigator.geolocation) return onBuscar()
    setBuscando(true)
    setMensaje(null)
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const c = await comunaEnPunto(coords.latitude, coords.longitude)
          if (c) onElegir(c.cut, { lat: coords.latitude, lng: coords.longitude })
          else setMensaje('Tu ubicación no está en Chile. Busca tu comuna por nombre.')
        } catch {
          setMensaje('No pudimos ubicar tu comuna. Búscala por nombre.')
        } finally {
          setBuscando(false)
        }
      },
      () => {
        setBuscando(false)
        setMensaje('No pudimos usar tu ubicación. Busca tu comuna por nombre.')
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60 * 1000 },
    )
  }

  const ir = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  // Llamado a la acción: Google (paso 1) o elegir comuna (paso 2)
  const accion = (segundo = false) =>
    pasoCuenta ? (
      <div className={segundo ? '' : 'entrar'} style={segundo ? undefined : { animationDelay: '450ms' }}>
        {!segundo && <p className="mb-2 text-[15px] font-bold text-white">Activa tus alertas en un toque:</p>}
        <BotonGoogle clientId={cuenta.clientId} />
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-bold text-emerald-300/90">
          <li>✓ Fuentes oficiales</li>
          <li>✓ Avisos al instante</li>
          <li>✓ Datos protegidos</li>
        </ul>
        <p className="mt-3 text-[13px] leading-snug text-white/65">
          Sin contraseñas. Solo mostramos tu nombre, la inicial de tu apellido y tu foto. Al continuar aceptas los{' '}
          <a href="./terminos.html" target="_blank" rel="noopener" className="underline">
            términos
          </a>{' '}
          y la{' '}
          <a href="./privacidad.html" target="_blank" rel="noopener" className="underline">
            política de privacidad
          </a>
          .
        </p>
        {!segundo && (
          <button type="button" onClick={() => setSinCuenta(true)} className="mt-2 min-h-11 text-[14px] font-bold text-white/70 underline underline-offset-2">
            Solo quiero ver el clima por ahora
          </button>
        )}
      </div>
    ) : (
      <div className={segundo ? '' : 'entrar'} style={segundo ? undefined : { animationDelay: '400ms' }}>
        <button
          type="button"
          onClick={ubicarme}
          disabled={buscando}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-senal text-[18px] font-bold text-sobre-senal shadow-lg disabled:opacity-70"
        >
          <Icono
            color="currentColor"
            d={
              <>
                <circle cx="12" cy="12" r="6.5" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </>
            }
          />
          {buscando ? 'Buscando tu comuna…' : 'Usar mi ubicación'}
        </button>
        <button type="button" onClick={onBuscar} className="mt-3 min-h-13 w-full rounded-full bg-white/10 py-3 text-[17px] font-bold text-white ring-1 ring-white/20">
          Elegir mi comuna
        </button>
        {mensaje && (
          <p role="alert" className="mt-3 text-center text-[15px] font-bold text-amber-300">
            {mensaje}
          </p>
        )}
      </div>
    )

  return (
    <div className="bienvenida landing fixed inset-0 z-[1000] overflow-y-auto overflow-x-hidden" role="dialog" aria-modal="true" aria-labelledby="t-bienvenida">
      <div className="bienvenida-estrellas" aria-hidden="true" />

      {/* Barra superior */}
      <header className="safe-top sticky top-0 z-20 landing-barra">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3">
          <span className="flex items-center gap-2 text-[19px] font-bold tracking-tight text-white">
            <span className="grid size-8 place-items-center rounded-xl bienvenida-logo" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 32 32">
                <path d="M9 21h14.5a5.5 5.5 0 0 0 .6-10.97A8 8 0 0 0 8.6 12.2 4.5 4.5 0 0 0 9 21z" fill="#fff" />
              </svg>
            </span>
            AlertaClima
          </span>
          <nav className="ml-auto hidden items-center gap-5 text-[14px] font-bold text-white/75 md:flex" aria-label="Secciones de la página">
            <button type="button" onClick={() => ir('l-funciones')}>
              Funciones
            </button>
            <button type="button" onClick={() => ir('l-como')}>
              Cómo funciona
            </button>
            <button type="button" onClick={() => ir('l-preguntas')}>
              Preguntas
            </button>
          </nav>
          <button
            type="button"
            onClick={escuchar}
            aria-label={hablandoZumi ? 'ZUMI está hablando' : 'Escuchar a ZUMI'}
            className="boton-vidrio ml-auto flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[14px] font-bold md:ml-0"
          >
            {hablandoZumi ? (
              <span className="ondas-voz scale-75" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
            ) : (
              <Icono color="currentColor" tam={18} d={<path d="M4 9v6h4l5 4V5L8 9zM16.5 8.5a5 5 0 0 1 0 7" />} />
            )}
            {hablandoZumi ? 'Hablando' : 'Escuchar a ZUMI'}
          </button>
        </div>
      </header>

      {/* Héroe */}
      <section className="relative mx-auto grid max-w-6xl items-center gap-2 px-5 md:grid-cols-[1.05fr_1fr] md:gap-8 md:pt-6">
        <div className="order-2 md:order-1">
          <p className="entrar inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-1 text-[13px] font-bold text-white/85 ring-1 ring-white/12">
            <span className="size-2 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" /> Vigilancia en tiempo real · Hecho en Chile
          </p>
          <h1 id="t-bienvenida" className="entrar landing-titulo mt-3 text-white" style={{ animationDelay: '80ms' }}>
            Que la próxima emergencia te encuentre <span className="landing-acento">preparado</span>.
          </h1>
          <p className="entrar mt-3 max-w-xl text-[16px] leading-snug text-white/80 md:text-[18px]" style={{ animationDelay: '160ms' }}>
            AlertaClima vigila por ti las alertas oficiales, la lluvia, los sismos y lo que ven tus vecinos, y te avisa a tiempo. ZUMI te lo explica en simple y en voz alta.
          </p>
          <div className="mt-5 max-w-md md:mt-6">{accion()}</div>
        </div>

        <div className="relative order-1 md:order-2">
          <div className="landing-escenario relative mx-auto w-full overflow-hidden" style={{ height: altoZumi + (escritorio ? 40 : 10) }}>
            <ZumiVideo escena={escenaInicio} estado={hablandoZumi ? 'hablando' : 'reposo'} posicion={[0.5, 0.32]} className="rounded-[inherit]" />
            <div className="bienvenida-zumi-velo absolute inset-0" aria-hidden="true" />
          </div>
          <p className="entrar globo-bienvenida relative z-10 mx-2 -mt-10 text-[15px] md:-mt-14 md:text-[17px] leading-snug font-bold md:mx-8" style={{ animationDelay: '250ms' }} aria-live="polite">
            {dice.map((f, i) => (
              <span key={`${pasoCuenta}-${i}`} className="palabra-entra" style={{ animationDelay: `${400 + i * 700}ms` }}>
                {f}{' '}
              </span>
            ))}
          </p>
        </div>
      </section>

      {/* Franja en vivo con datos reales */}
      <section aria-label="Datos en vivo" className="relative mx-auto mt-10 max-w-6xl px-5">
        <div className="landing-vivo grid grid-cols-2 gap-px overflow-hidden rounded-3xl md:grid-cols-4">
          <div className="landing-dato">
            <p className="landing-num">346</p>
            <p>comunas de Chile</p>
          </div>
          <div className="landing-dato">
            <p className="landing-num">{vivo ? vivo.sismos : '—'}</p>
            <p>sismos esta semana en Chile</p>
          </div>
          <div className="landing-dato">
            <p className="landing-num">{vivo?.mayor ? String(vivo.mayor.magnitud).replace('.', ',') : '—'}</p>
            <p>magnitud del mayor sismo</p>
          </div>
          <div className="landing-dato">
            <p className="landing-num">24/7</p>
            <p>radar y alertas vigilados</p>
          </div>
        </div>
        <p className="mt-3 text-center text-[13px] text-white/55">
          Con datos de SENAPRED · USGS · NOAA · Open-Meteo · RainViewer · NASA · ESO
        </p>
      </section>

      {/* Funciones */}
      <section id="l-funciones" className="relative mx-auto mt-16 max-w-6xl scroll-mt-20 px-5">
        <h2 className="landing-h2">Un paso adelante de cada emergencia</h2>
        <p className="mt-2 max-w-2xl text-[17px] text-white/70">Pensada para Chile: temporales en el sur, aluviones en la cordillera, tsunamis en la costa y sismos en todo el país.</p>
        <ul className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FUNCIONES.map((f) => (
            <li key={f.titulo} className="landing-tarjeta" style={{ '--c': f.color }}>
              <span className="grid size-11 place-items-center rounded-2xl" style={{ background: `${f.color}22` }}>
                <Icono color={f.color} d={f.icono} />
              </span>
              <h3 className="mt-3 text-[17px] leading-tight font-bold text-white">{f.titulo}</h3>
              <p className="mt-1.5 text-[15px] leading-snug text-white/70">{f.texto}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Confianza */}
      <section aria-labelledby="l-confianza" className="relative mx-auto mt-16 max-w-6xl px-5">
        <h2 id="l-confianza" className="landing-h2">Información en la que puedes confiar</h2>
        <ul className="mt-7 grid gap-3 md:grid-cols-3">
          {[
            ['Fuentes oficiales y científicas', 'SENAPRED, NOAA, el Servicio Geológico de EE.UU., la NASA y ESO. Cada dato muestra su fuente y su hora.', '#34d399', <path key="a" d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7zM8.5 12l2.5 2.5L15.5 10" />],
            ['Te avisa aunque no la estés mirando', 'Notificaciones con vibración cuando hay una alerta oficial en tus comunas, incluso con la app cerrada.', '#fbbf24', <path key="b" d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0" />],
            ['Tus datos, protegidos', 'Sin contraseñas, no guardamos tu correo y no vendemos tu información. Puedes borrar tu cuenta cuando quieras.', '#818cf8', <path key="c" d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5zM12 15v2" />],
          ].map(([t, d, c, ic]) => (
            <li key={t} className="landing-tarjeta" style={{ '--c': c }}>
              <span className="grid size-11 place-items-center rounded-2xl" style={{ background: `${c}22` }}>
                <Icono color={c} d={ic} />
              </span>
              <h3 className="mt-3 text-[17px] font-bold text-white">{t}</h3>
              <p className="mt-1.5 text-[15px] leading-snug text-white/70">{d}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Cómo funciona */}
      <section id="l-como" className="relative mx-auto mt-16 max-w-6xl scroll-mt-20 px-5">
        <h2 className="landing-h2">Activa tu protección en menos de un minuto</h2>
        <ol className="mt-7 grid gap-3 md:grid-cols-3">
          {PASOS.map(([t, d], i) => (
            <li key={t} className="landing-paso">
              <span className="landing-paso-n">{i + 1}</span>
              <div>
                <h3 className="text-[18px] font-bold text-white">{t}</h3>
                <p className="mt-1 text-[15px] text-white/70">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Por qué */}
      <section className="relative mx-auto mt-16 max-w-6xl px-5">
        <div className="landing-mision">
          <p className="text-[13px] font-bold tracking-widest text-amber-300 uppercase">Por qué existe AlertaClima</p>
          <p className="mt-3 text-[22px] leading-snug font-bold text-white md:text-[28px]">
            En una emergencia, cada minuto cuenta. Juntamos en un solo lugar lo que dicen las fuentes oficiales y lo que ven tus vecinos, explicado en simple y en voz alta.
          </p>
        </div>
      </section>

      {/* Planes: solo cuando el cobro está activo */}
      {planesWeb?.cobroActivo && (
        <section id="l-planes" aria-labelledby="t-l-planes" className="relative mx-auto mt-16 max-w-4xl scroll-mt-20 px-5">
          <h2 id="t-l-planes" className="landing-h2 text-center">Elige cómo cuidar a los tuyos</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="landing-tarjeta" style={{ '--c': '#38bdf8' }}>
              <p className="text-[14px] font-bold tracking-widest text-sky-300 uppercase">Esencial</p>
              <p className="mt-1 text-[28px] font-extrabold text-white">Incluido</p>
              <ul className="mt-3 space-y-1.5 text-[16px] text-white/80">
                <li>✓ Alertas oficiales de tu comuna</li>
                <li>✓ Botón SOS y vías de evacuación</li>
                <li>✓ Clima, radar, sismos y volcanes</li>
                <li>✓ ZUMI: {planesWeb.limites?.gratis?.zumiDia ?? 5} preguntas al día</li>
              </ul>
            </div>
            <div className="landing-tarjeta" style={{ '--c': '#fbbf24', border: '2px solid rgb(252 211 77 / 0.7)' }}>
              <p className="text-[14px] font-bold tracking-widest text-amber-300 uppercase">Familia</p>
              <p className="mt-1 text-[28px] font-extrabold text-white">
                ${(planesWeb.precios?.mensual ?? 1990).toLocaleString('es-CL')}
                <span className="text-[16px] font-bold text-white/70"> al mes</span>
              </p>
              <p className="text-[14px] text-white/70">o ${(planesWeb.precios?.anual ?? 14990).toLocaleString('es-CL')} al año</p>
              <ul className="mt-3 space-y-1.5 text-[16px] text-white/85">
                <li>✓ Todo lo Esencial</li>
                <li>✓ Hasta 5 familiares y 5 comunas con avisos</li>
                <li>✓ ZUMI sin límite, con inteligencia artificial</li>
                {planesWeb.precios?.pruebaDias > 0 && <li>✓ {planesWeb.precios.pruebaDias} días de prueba sin costo</li>}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* Preguntas */}
      <section id="l-preguntas" className="relative mx-auto mt-16 max-w-3xl scroll-mt-20 px-5">
        <h2 className="landing-h2 text-center">Preguntas frecuentes</h2>
        <div className="mt-6 space-y-2">
          {PREGUNTAS.map(([p, r]) => (
            <details key={p} className="landing-pregunta group">
              <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[16px] font-bold text-white">
                {p}
                <span className="text-white/60 transition-transform group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="px-4 pb-4 text-[15px] leading-snug text-white/75">{r}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Llamado final */}
      <section className="relative mx-auto mt-16 max-w-xl px-5 text-center">
        <h2 className="landing-h2">Activa la protección de tu comuna</h2>
        <p className="mt-2 text-[17px] text-white/70">Te toma menos de un minuto. Desde ahí, ZUMI vigila por ti.</p>
        <div className="mx-auto mt-6 max-w-sm text-left">{accion(true)}</div>
      </section>

      <footer className="safe-bottom relative mx-auto mt-16 max-w-6xl border-t border-white/10 px-5 py-6 text-[13px] text-white/55">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span>© {new Date().getFullYear()} AlertaClima Chile</span>
          <a href="./terminos.html" target="_blank" rel="noopener" className="underline">
            Términos
          </a>
          <a href="./privacidad.html" target="_blank" rel="noopener" className="underline">
            Privacidad
          </a>
          <span>Emergencias: 133 · 132 · 131</span>
        </div>
      </footer>
    </div>
  )
}
