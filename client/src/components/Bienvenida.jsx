// Primer ingreso: tres pasos cortos, una sola pregunta por pantalla (al estilo de las mejores apps).
// 1) ZUMI te saluda. 2) ¿Dónde vives? (ubicación o búsqueda instantánea). 3) ¿Cómo te llamo?
// La cuenta de Google es opcional: se ofrece al final y cuando hace falta (chat, reportes).
import { useEffect, useMemo, useRef, useState } from 'react'
import { alCambiarNarrador, callar, guardarNombre, hablar, nombrePreferido } from '../services/narrador'
import { buscarComunas, comunaEnPunto, comunaPorCut } from '../services/comunas'
import BotonGoogle from './BotonGoogle'
import ZumiCine from './ZumiCine'
import Hoja from './Hoja'

// Comunas más pobladas, para elegir con un toque
const RAPIDAS = ['13101', '13119', '13110', '05101', '08101', '09101', '13114', '02101']

const FUNCIONES = [
  ['🗣️', 'ZUMI te cuenta el clima', 'Con su voz, te llama por tu nombre y responde tus preguntas.'],
  ['⚠️', 'Alertas oficiales al instante', 'Si SENAPRED publica una alerta para tu comuna, te avisamos.'],
  ['🌧️', 'Radar de lluvia en vivo', 'Dónde llueve ahora y cuánto caerá, hora a hora.'],
  ['🌋', 'Sismos, tsunamis y volcanes', 'Cada sismo en el mapa, con su ficha completa.'],
  ['🆘', 'Botón SOS', 'Llama al 133, 132 o 131 y comparte tu ubicación con tu familia.'],
  ['👥', 'Tus vecinos', 'Reportes y chat de tu comuna, con filtros de seguridad.'],
]
// Las historias del primer paso: cada una muestra (no explica) lo que ZUMI hace por ti.
const HISTORIAS = [
  {
    rotulo: 'Alertas · en tiempo real',
    titulo: 'Te aviso antes\nque nadie.',
    sub: 'Alertas oficiales de SENAPRED, sismos y tsunamis al instante. Y la lluvia, minutos antes de que caiga.',
    gesto: 'saludo',
    demo: 'alerta',
  },
  {
    rotulo: 'Familia · cifrado de punta a punta',
    titulo: '¿Dónde está\nmi hijo?',
    sub: 'Tu familia en un mapa vivo. Te aviso cuando llegan al colegio o a la casa. Ni nosotros podemos ver dónde están.',
    gesto: 'senalar',
    demo: 'familia',
  },
  {
    rotulo: 'Viajes · ZUMI te guía',
    titulo: 'Viaja seguro\npor Chile.',
    sub: 'Te guío por voz todo el camino y te aviso del clima en cada tramo, antes de llegar a él.',
    gesto: 'celebrar',
    demo: 'ruta',
  },
  {
    rotulo: 'ZUMI · tu amigo',
    titulo: 'Pregúntame\nlo que quieras.',
    sub: 'Clima, emergencias, primeros auxilios o tu comuna. Te respondo con mi voz, al tiro.',
    gesto: 'curioso',
    demo: 'chat',
  },
]

function Demo({ tipo }) {
  if (tipo === 'alerta')
    return (
      <div className="demo-card space-y-2">
        <div className="demo-noti">
          <span className="demo-app">AlertaClima · ahora</span>
          <p>
            <b>⚠ Alerta Amarilla · Calor extremo</b>
            <br />
            34° en tu comuna desde las 14:00. Hidrátate.
          </p>
        </div>
        <div className="demo-noti">
          <span className="demo-app">ZUMI · hace 2 min</span>
          <p>
            <b>☂ Empieza a llover en 12 minutos</b>
          </p>
        </div>
      </div>
    )
  if (tipo === 'familia')
    return (
      <div className="demo-card demo-panel space-y-2.5">
        {[
          ['S', 'Sofía', '🏫 Llegó al colegio · 08:02', '#ff6fb1'],
          ['T', 'Tomás', '🚗 Camino a casa · llega 18:40', '#7cc4ff'],
          ['A', 'Abuela', '🏠 En la casa · 21°', '#3ddc84'],
        ].map(([i, n, t, c]) => (
          <div key={n} className="flex items-center gap-2.5">
            <span className="demo-avatar" style={{ '--c': c }}>
              {i}
            </span>
            <span className="min-w-0">
              <b className="block text-[14px]">{n}</b>
              <span className="block truncate text-[12.5px] text-white/70">{t}</span>
            </span>
          </div>
        ))}
      </div>
    )
  if (tipo === 'ruta')
    return (
      <div className="demo-card demo-panel">
        <p className="mono text-[10.5px] tracking-[0.08em] text-white/55">SANTIAGO → PUCÓN · 8 H 36</p>
        <div className="mt-2 flex h-2 overflow-hidden rounded-full">
          <span className="flex-[5] bg-[#3ddc84]" />
          <span className="flex-[2] bg-[#ffc53d]" />
          <span className="flex-[1] bg-[#ff5a5f]" />
          <span className="flex-[2] bg-[#3ddc84]" />
        </div>
        <p className="mt-2.5 flex items-center gap-2 text-[14px]">
          <span className="grid size-9 place-items-center rounded-xl bg-[#3ddc84] text-[20px] text-black">↱</span>
          <span>
            <b className="block">En 400 m, gira a la derecha</b>
            <span className="text-[12.5px] text-white/70">⚠ Lluvia intensa en Curacautín a las 15:00</span>
          </span>
        </p>
      </div>
    )
  return (
    <div className="demo-card space-y-2">
      <p className="ml-auto w-fit rounded-2xl rounded-br-md bg-white/90 px-3 py-2 text-[14px] font-medium text-black">¿Va a llover mañana?</p>
      <p className="w-fit max-w-[88%] rounded-2xl rounded-bl-md bg-black/70 px-3 py-2 text-[14px] ring-1 ring-white/15 backdrop-blur">Sí, desde las 15:00 y unos 8 milímetros. ¡Lleva paraguas!</p>
    </div>
  )
}

const PREGUNTAS = [
  ['¿De dónde salen los datos?', 'SENAPRED, Servicio Geológico de EE.UU. (sismos), NOAA (tsunamis), Open-Meteo (pronóstico), RainViewer (radar), NASA y ESO. Cada dato muestra su fuente y hora.'],
  ['¿Reemplaza a SENAPRED?', 'No. Te ayuda a enterarte a tiempo, pero ante una emergencia sigue siempre las instrucciones oficiales.'],
  ['¿Necesito crear una cuenta?', 'No. El clima, las alertas, ZUMI y el SOS funcionan sin cuenta. La cuenta solo sirve para el chat de vecinos y para reportar.'],
  ['¿Qué hacen con mis datos?', 'Tu comuna y tu nombre quedan en tu teléfono. Si creas cuenta, guardamos tu nombre con la inicial del apellido y tu foto; nunca vendemos datos.'],
]

export default function Bienvenida({ onElegir, onBuscar, cuenta }) {
  const [paso, setPaso] = useState(0) // 0 hola · 1 comuna · 2 nombre
  const [elegida, setElegida] = useState(null) // { cut, punto }
  const [texto, setTexto] = useState('')
  const [nombre, setNombre] = useState(() => nombrePreferido() || cuenta?.usuario?.nombre?.split(' ')[0] || '')
  const [buscando, setBuscando] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const [conocer, setConocer] = useState(false)
  const [hablando, setHablando] = useState(false)
  const [historia, setHistoria] = useState(0)
  const gesto = paso === 0 ? `${HISTORIAS[historia].gesto}:h${historia}` : `${['saludo', 'senalar', 'celebrar'][paso]}:${paso}`
  // Las historias avanzan solas (y se pueden tocar a la izquierda o a la derecha)
  useEffect(() => {
    if (paso !== 0) return
    const t = setTimeout(() => setHistoria((h) => (h + 1) % HISTORIAS.length), 5200)
    return () => clearTimeout(t)
  }, [paso, historia])
  const campo = useRef(null)
  const [escena] = useState(() => (new Date().getHours() >= 20 || new Date().getHours() < 7 ? 'noche' : 'sala'))
  const resultados = useMemo(() => buscarComunas(texto, 6), [texto])
  const comuna = elegida && comunaPorCut(elegida.cut)
  const googleDisponible = cuenta?.estado === 'sin-sesion' && cuenta.clientId

  useEffect(() => {
    const quitar = alCambiarNarrador((e) => setHablando(e.hablando))
    return () => {
      quitar()
      callar()
    }
  }, [])
  // En el paso de la comuna, el teclado queda listo para escribir
  useEffect(() => {
    if (paso !== 1) return
    const t = setTimeout(() => campo.current?.focus({ preventScroll: true }), 350)
    return () => clearTimeout(t)
  }, [paso])

  const escuchar = () => {
    if (hablando) return callar()
    hablar(['¡Hola! Soy ZUMI.', 'Vigilo el clima, los sismos y las alertas de tu comuna, y te lo cuento con mi voz.', '¿Empezamos?'], { silencio: false })
  }

  const elegir = (cut, punto = null) => {
    setElegida({ cut, punto })
    setTexto('')
    setMensaje(null)
    setPaso(2)
  }

  const ubicarme = () => {
    if (!navigator.geolocation) return setMensaje('Tu teléfono no permite ubicarte. Escribe tu comuna.')
    setBuscando(true)
    setMensaje(null)
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const c = await comunaEnPunto(coords.latitude, coords.longitude)
          if (c) elegir(c.cut, { lat: coords.latitude, lng: coords.longitude })
          else setMensaje('Tu ubicación no está en Chile. Escribe tu comuna.')
        } catch {
          setMensaje('No pudimos ubicar tu comuna. Escríbela aquí arriba.')
        } finally {
          setBuscando(false)
        }
      },
      () => {
        setBuscando(false)
        setMensaje('No pudimos usar tu ubicación. Escribe tu comuna aquí arriba.')
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 5 * 60 * 1000 },
    )
  }

  const terminar = () => {
    if (nombre.trim()) guardarNombre(nombre.trim())
    onElegir(elegida.cut, elegida.punto ?? undefined)
  }

  const globo = [
    null,
    '¿Dónde vives? Así te cuido en tu comuna.',
    comuna ? `¡${comuna.nombre}! Me encanta. ¿Cómo te llamo?` : '¿Cómo te llamo?',
  ][paso]

  return (
    <div className="bienvenida fixed inset-0 z-[1000] flex flex-col overflow-hidden bg-black text-white" role="dialog" aria-modal="true" aria-labelledby="t-bienvenida">
      {/* ZUMI en su casa */}
      <div className="relative min-h-0 flex-1">
        <ZumiCine escena={escena} estado={hablando ? 'hablando' : 'reposo'} gesto={gesto} posicion={[0.5, 0.22]} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black" aria-hidden="true" />
        <div className="safe-top absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-3">
          <span className="flex items-center gap-2 text-[17px] font-black tracking-tight">
            <img src={`${import.meta.env.BASE_URL}icono-192.png`} alt="" width="28" height="28" className="rounded-lg" />
            AlertaClima
          </span>
          {paso > 0 ? (
            <button type="button" onClick={() => setPaso(paso - 1)} className="min-h-11 rounded-full bg-black/35 px-4 text-[15px] font-bold backdrop-blur" aria-label="Volver al paso anterior">
              Atrás
            </button>
          ) : (
            <button type="button" onClick={escuchar} className="min-h-11 rounded-full bg-black/35 px-4 text-[15px] font-bold backdrop-blur">
              {hablando ? 'Callar a ZUMI' : '🔊 Escuchar a ZUMI'}
            </button>
          )}
        </div>
        {paso === 0 ? (
          <>
            {/* barras de las historias */}
            <div className="safe-top absolute inset-x-3 top-14 flex gap-1" aria-hidden="true">
              {HISTORIAS.map((_, i) => (
                <span key={i} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/25">
                  <span key={`${i}-${historia}`} className={`block h-full bg-white ${i < historia ? 'w-full' : i === historia ? 'barra-historia' : 'w-0'}`} />
                </span>
              ))}
            </div>
            <button type="button" aria-label="Historia anterior" onClick={() => setHistoria((h) => Math.max(0, h - 1))} className="absolute top-20 bottom-24 left-0 w-1/3" />
            <button type="button" aria-label="Historia siguiente" onClick={() => setHistoria((h) => (h + 1) % HISTORIAS.length)} className="absolute top-20 right-0 bottom-24 w-1/3" />
            <div key={historia} className="pointer-events-none absolute inset-x-4 bottom-5 paso-entra">
              <p className="mono mx-auto mb-1.5 w-fit rounded-full bg-black/50 px-2 py-0.5 text-[9.5px] tracking-[0.12em] text-white/60">EJEMPLO</p>
              <Demo tipo={HISTORIAS[historia].demo} />
            </div>
          </>
        ) : (
          <p key={globo} className="globo-escenario globo-texto absolute right-4 bottom-6 left-[42%] rounded-3xl rounded-bl-md px-4 py-2.5 text-[16px] leading-snug font-bold" aria-live="polite">
            {globo}
          </p>
        )}
      </div>

      {/* Tarjeta del paso */}
      <div className="safe-bottom relative rounded-t-[28px] border-t border-white/10 bg-black px-5 pt-4 pb-5">
        <div className={`mb-3 flex justify-center gap-1.5 ${paso === 0 ? 'hidden' : ''}`} aria-label={`Paso ${paso + 1} de 3`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-1.5 rounded-full transition-all ${i === paso ? 'w-6 bg-white' : 'w-1.5 bg-white/25'}`} />
          ))}
        </div>

        <div key={paso} className="paso-entra">
          {paso === 0 && (
            <>
              <div key={historia} className="paso-entra" aria-live="polite">
                <p className="rotulo !text-white/55">{HISTORIAS[historia].rotulo}</p>
                <h1 id="t-bienvenida" className="titulo-x mt-2 text-[32px] whitespace-pre-line">
                  {HISTORIAS[historia].titulo}
                </h1>
                <p className="mt-2 min-h-[4.2em] text-[16px] leading-snug text-white/70">{HISTORIAS[historia].sub}</p>
              </div>
              <button type="button" onClick={() => setPaso(1)} className="boton-primario mt-4 w-full text-[18px]">
                Empezar gratis
              </button>
              <p className="mono mt-2.5 text-center text-[10.5px] tracking-[0.1em] text-white/65">SIN TARJETA · SIN CREAR CUENTA · 30 SEGUNDOS</p>
              <div className="mt-3 flex items-center justify-between text-[14px] font-bold text-white/65">
                <button type="button" onClick={() => setConocer(true)} className="min-h-11 underline underline-offset-2">
                  ¿Qué hace AlertaClima?
                </button>
                <span>
                  <a href="./terminos.html" target="_blank" rel="noopener" className="underline underline-offset-2">
                    Términos
                  </a>
                  {' · '}
                  <a href="./privacidad.html" target="_blank" rel="noopener" className="underline underline-offset-2">
                    Privacidad
                  </a>
                </span>
              </div>
            </>
          )}

          {paso === 1 && (
            <>
              <h1 id="t-bienvenida" className="text-[26px] leading-tight font-black tracking-tight">
                ¿Dónde vives?
              </h1>
              <button
                type="button"
                onClick={ubicarme}
                disabled={buscando}
                className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-white text-[18px] font-semibold text-black disabled:opacity-70"
              >
                <span aria-hidden="true">📍</span>
                {buscando ? 'Buscando tu comuna…' : 'Usar mi ubicación'}
              </button>
              <div className="relative mt-3">
                <input
                  ref={campo}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="O escribe tu comuna"
                  aria-label="Escribe tu comuna"
                  autoComplete="off"
                  enterKeyHint="search"
                  onKeyDown={(e) => e.key === 'Enter' && resultados[0] && elegir(resultados[0].cut)}
                  className="min-h-14 w-full rounded-2xl bg-white/10 px-4 text-[18px] font-bold text-white ring-1 ring-white/15 outline-none placeholder:text-white/45 focus:ring-2 focus:ring-white"
                />
              </div>
              {texto ? (
                <ul className="mt-2 max-h-[30dvh] overflow-y-auto rounded-2xl bg-white/5" aria-label="Comunas encontradas">
                  {resultados.map((c) => (
                    <li key={c.cut}>
                      <button type="button" onClick={() => elegir(c.cut)} className="flex min-h-13 w-full items-center justify-between gap-3 px-4 py-2.5 text-left active:bg-white/10">
                        <span className="text-[17px] font-bold">{c.nombre}</span>
                        <span className="text-[13px] text-white/55">{c.region.nombre}</span>
                      </button>
                    </li>
                  ))}
                  {!resultados.length && <li className="px-4 py-3 text-[15px] text-white/65">No encontramos esa comuna. Revisa cómo se escribe.</li>}
                </ul>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2" aria-label="Comunas frecuentes">
                  {RAPIDAS.map((cut) => comunaPorCut(cut)).filter(Boolean).map((c) => (
                    <button key={c.cut} type="button" onClick={() => elegir(c.cut)} className="min-h-10 rounded-full bg-white/10 px-3.5 text-[15px] font-bold ring-1 ring-white/10 active:bg-white/20">
                      {c.nombre}
                    </button>
                  ))}
                  <button type="button" onClick={onBuscar} className="min-h-10 rounded-full px-3 text-[15px] font-bold text-white/70 underline underline-offset-2">
                    Ver por región
                  </button>
                </div>
              )}
              {mensaje && (
                <p role="alert" className="mt-3 text-[15px] font-bold text-amber-200">
                  {mensaje}
                </p>
              )}
            </>
          )}

          {paso === 2 && (
            <>
              <h1 id="t-bienvenida" className="text-[26px] leading-tight font-black tracking-tight">
                ¿Cómo te llamo?
              </h1>
              <p className="mt-1 text-[15px] text-white/65">Así ZUMI te saluda por tu nombre. Queda solo en tu teléfono.</p>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value.slice(0, 30))}
                placeholder="Tu nombre o apodo"
                aria-label="Tu nombre o apodo"
                autoComplete="given-name"
                enterKeyHint="done"
                onKeyDown={(e) => e.key === 'Enter' && terminar()}
                className="mt-3 min-h-14 w-full rounded-2xl bg-white/10 px-4 text-[18px] font-bold text-white ring-1 ring-white/15 outline-none placeholder:text-white/45 focus:ring-2 focus:ring-white"
              />
              <button type="button" onClick={terminar} className="mt-4 min-h-14 w-full rounded-full bg-white text-[18px] font-semibold text-black active:scale-[0.98]">
                {nombre.trim() ? `¡Listo, soy ${nombre.trim().split(' ')[0]}!` : 'Entrar'}
              </button>
              {googleDisponible && (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <p className="mb-1 text-[15px] font-semibold">Crea tu cuenta gratis con Google</p>
                  <p className="mb-2.5 text-[13.5px] leading-snug text-white/60">Conversa con ZUMI con inteligencia artificial, guarda tu familia y tus lugares en todos tus teléfonos y habla con tus vecinos. Es opcional.</p>
                  <BotonGoogle clientId={cuenta.clientId} />
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {conocer && (
        <Hoja titulo="¿Qué hace AlertaClima?" onCerrar={() => setConocer(false)}>
          <div className="px-5 pb-6">
            <ul className="space-y-3">
              {FUNCIONES.map(([i, t, d]) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-superficie-2 text-[22px]" aria-hidden="true">
                    {i}
                  </span>
                  <span>
                    <span className="block text-[17px] font-bold">{t}</span>
                    <span className="block text-[15px] text-texto-2">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
            <h3 className="mt-6 text-[18px] font-bold">Preguntas frecuentes</h3>
            <div className="mt-2 space-y-2">
              {PREGUNTAS.map(([p, r]) => (
                <details key={p} className="rounded-2xl bg-superficie-2 px-4 py-3">
                  <summary className="cursor-pointer text-[16px] font-bold">{p}</summary>
                  <p className="mt-2 text-[15px] leading-snug text-texto-2">{r}</p>
                </details>
              ))}
            </div>
          </div>
        </Hoja>
      )}
    </div>
  )
}
