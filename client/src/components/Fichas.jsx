import { direccionViento, nivelUV, nivelViento } from '../services/clima'
import { hhmm } from '../services/formato'

const num = (v, d = 1) => v.toLocaleString('es-CL', { maximumFractionDigits: d })

function Ficha({ titulo, icono, children }) {
  return (
    <section className="tarjeta flex min-h-[176px] flex-col !p-3.5">
      <h3 className="mb-1.5 flex items-center gap-1.5 text-[14px] font-bold text-texto-2">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {icono}
        </svg>
        {titulo}
      </h3>
      {children}
    </section>
  )
}

// ---- Viento: brújula con la flecha hacia donde sopla ----
function Viento({ ahora }) {
  const dir = ahora.direccion
  const desde = dir != null ? direccionViento(dir) : null
  return (
    <Ficha titulo="Viento" icono={<path d="M1.5 5.5h9a2 2 0 1 0-2-2M1.5 10.5h11a2 2 0 1 1-2 2M1.5 8h6" />}>
      <div className="flex flex-1 items-center gap-3">
        <svg width="70" height="70" viewBox="0 0 84 84" role="img" aria-label={desde ? `Viene del ${desde}` : 'Sin dirección'} className="shrink-0">
          <circle cx="42" cy="42" r="37" fill="none" stroke="var(--grilla)" strokeWidth="6" />
          {Array.from({ length: 36 }, (_, i) => (
            <line
              key={i}
              x1="42"
              y1={i % 9 === 0 ? 8 : 6}
              x2="42"
              y2={i % 9 === 0 ? 14 : 10}
              stroke="var(--texto-2)"
              strokeWidth={i % 9 === 0 ? 2 : 1}
              opacity={i % 9 === 0 ? 1 : 0.5}
              transform={`rotate(${i * 10} 42 42)`}
            />
          ))}
          {[
            ['N', 42, 23],
            ['E', 63, 46],
            ['S', 42, 68],
            ['O', 21, 46],
          ].map(([t, x, y]) => (
            <text key={t} x={x} y={y} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--texto-2)">
              {t}
            </text>
          ))}
          {dir != null && (
            <g transform={`rotate(${dir + 180} 42 42)`}>
              <line x1="42" y1="66" x2="42" y2="22" stroke="var(--texto)" strokeWidth="3" strokeLinecap="round" />
              <path d="M42 13l7 12h-14z" fill="var(--texto)" />
              <circle cx="42" cy="66" r="4" fill="var(--superficie)" stroke="var(--texto)" strokeWidth="2.5" />
            </g>
          )}
        </svg>
        <p className="min-w-0 text-[30px] leading-none font-bold tabular-nums">
          {Math.round(ahora.viento)}
          <span className="block text-[14px] font-normal text-texto-2">km/h</span>
        </p>
      </div>
      <p className="mt-2 text-[14px] leading-snug">
        <strong>{nivelViento(ahora.viento)}</strong>
        {desde && <> del {desde}</>}. 
        {ahora.rafagas > ahora.viento + 2 && (
          <>
            Ráfagas de <strong className="tabular-nums">{Math.round(ahora.rafagas)} km/h</strong>.
          </>
        )}
      </p>
    </Ficha>
  )
}

// ---- Índice UV: barra de colores de la OMS con marcador ----
function UV({ ahora, hoy }) {
  const valor = ahora.uv ?? 0
  const nivel = nivelUV(valor)
  const deNoche = !ahora.esDeDia || valor < 0.5
  const max = hoy?.uv
  return (
    <Ficha titulo="Índice UV" icono={<><circle cx="8" cy="8" r="3" /><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1" /></>}>
      <p className="text-[30px] leading-none font-bold tabular-nums">{Math.round(valor)}</p>
      <p className="text-[17px] font-bold">{nivel.texto}</p>
      <div className="relative mt-2 h-2 rounded-full" style={{ background: 'linear-gradient(90deg,#3ea72d 0%,#fff300 27%,#f18b00 50%,#e53210 73%,#b567a4 100%)' }}>
        <span
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-superficie bg-texto"
          style={{ left: `${Math.min(100, (valor / 11) * 100)}%` }}
        />
      </div>
      <p className="mt-auto pt-2 text-[14px] leading-snug text-texto-2">
        {deNoche && max != null ? `Máximo de hoy: ${Math.round(max)} (${nivelUV(max).texto.toLowerCase()}).` : nivel.consejo}
      </p>
    </Ficha>
  )
}

// ---- Sol: arco del día con la posición actual ----
function Sol({ hoy, manana }) {
  if (!hoy?.salida || !hoy?.puesta) return null
  const ahora = new Date()
  const total = hoy.puesta - hoy.salida
  const k = (ahora - hoy.salida) / total
  const deDia = k >= 0 && k <= 1
  const kk = Math.min(1, Math.max(0, k))
  // Arco: semicírculo de (10,62) a (138,62), radio 64
  const ang = Math.PI * (1 - kk)
  const sx = 74 + 64 * Math.cos(ang)
  const sy = 62 - 52 * Math.sin(ang)
  const luz = Math.round(total / 60000)
  let texto
  if (deDia) {
    const quedan = Math.round((hoy.puesta - ahora) / 60000)
    texto = quedan < 60 ? `Quedan ${quedan} min de luz.` : `Quedan ${Math.floor(quedan / 60)} h ${quedan % 60} min de luz.`
  } else if (ahora < hoy.salida) texto = `Amanece a las ${hhmm(hoy.salida)}.`
  else texto = manana?.salida ? `Mañana amanece a las ${hhmm(manana.salida)}.` : `${Math.floor(luz / 60)} h ${luz % 60} min de luz hoy.`
  return (
    <Ficha titulo="Sol" icono={<><path d="M2 12h12" /><path d="M4.5 12a3.5 3.5 0 0 1 7 0" /><path d="M8 3v2M3 6l1.2 1.2M13 6l-1.2 1.2" /></>}>
      <svg viewBox="0 0 148 72" className="block h-auto w-full" role="img" aria-label={texto}>
        <defs>
          <clipPath id="sol-hecho">
            <rect x="0" y="0" width={deDia ? sx : k > 1 ? 148 : 0} height="72" />
          </clipPath>
        </defs>
        <path d="M10 62 A64 52 0 0 1 138 62" fill="none" stroke="var(--grilla)" strokeWidth="3" strokeDasharray="2 5" strokeLinecap="round" />
        <path d="M10 62 A64 52 0 0 1 138 62" fill="none" stroke="var(--sol)" strokeWidth="3" strokeLinecap="round" clipPath="url(#sol-hecho)" />
        <line x1="2" x2="146" y1="62" y2="62" stroke="var(--texto-2)" strokeWidth="1" opacity="0.6" />
        {deDia && (
          <>
            <circle cx={sx} cy={sy} r="11" fill="var(--sol)" opacity="0.25" />
            <circle cx={sx} cy={sy} r="6.5" fill="var(--sol)" />
          </>
        )}
      </svg>
      <div className="mt-1 flex justify-between text-[15px] font-bold tabular-nums">
        <span>
          <span className="block text-[12px] font-normal text-texto-2">Salida</span>
          {hhmm(hoy.salida)}
        </span>
        <span className="text-right">
          <span className="block text-[12px] font-normal text-texto-2">Puesta</span>
          {hhmm(hoy.puesta)}
        </span>
      </div>
      <p className="mt-auto pt-1 text-[14px] leading-snug text-texto-2">{texto}</p>
    </Ficha>
  )
}

// ---- Humedad y punto de rocío ----
function Humedad({ ahora }) {
  const r = ahora.rocio
  let frase = null
  if (r != null) {
    if (r < 5) frase = 'Aire seco.'
    else if (r < 12) frase = 'Aire agradable.'
    else if (r < 16) frase = 'Algo húmedo.'
    else frase = 'Aire pesado y húmedo.'
  }
  return (
    <Ficha titulo="Humedad" icono={<path d="M8 1.5C6 4.5 3.5 7 3.5 9.7a4.5 4.5 0 0 0 9 0C12.5 7 10 4.5 8 1.5z" />}>
      <p className="text-[30px] leading-none font-bold tabular-nums">{Math.round(ahora.humedad)} %</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-grilla">
        <div className="h-full rounded-full bg-lluvia" style={{ width: `${Math.min(100, ahora.humedad)}%` }} />
      </div>
      <p className="mt-auto pt-2 text-[14px] leading-snug text-texto-2">
        {r != null && (
          <>
            Punto de rocío: <strong className="text-texto tabular-nums">{Math.round(r)}°</strong>.{' '}
          </>
        )}
        {frase}
      </p>
    </Ficha>
  )
}

// ---- Presión: indicador y tendencia (una baja rápida anuncia mal tiempo) ----
function Presion({ ahora }) {
  const p = ahora.presion
  if (p == null) return null
  const t = ahora.tendenciaPresion
  let tendencia = 'Estable.'
  let alerta = false
  if (t != null) {
    if (t <= -3) {
      tendencia = 'Bajando rápido: puede venir mal tiempo.'
      alerta = true
    } else if (t <= -1) tendencia = 'Bajando.'
    else if (t >= 3) tendencia = 'Subiendo rápido: tiende a mejorar.'
    else if (t >= 1) tendencia = 'Subiendo.'
  }
  const k = Math.min(1, Math.max(0, (p - 980) / 60))
  const ang = Math.PI * (1.25 - 1.5 * k)
  return (
    <Ficha titulo="Presión" icono={<><circle cx="8" cy="8" r="6.5" /><path d="M8 8l3-3" /></>}>
      <div className="flex items-center gap-2">
        <svg width="62" height="52" viewBox="0 0 62 52" aria-hidden="true" className="shrink-0">
          <path d="M9.8 44.2 A26 26 0 1 1 52.2 44.2" fill="none" stroke="var(--grilla)" strokeWidth="5" strokeLinecap="round" />
          <line x1="31" y1="28" x2={31 + 20 * Math.cos(ang)} y2={28 - 20 * Math.sin(ang)} stroke="var(--texto)" strokeWidth="3" strokeLinecap="round" />
          <circle cx="31" cy="28" r="3.5" fill="var(--texto)" />
          {t != null && Math.abs(t) >= 1 && (
            <path d={t < 0 ? 'M31 45l-4-5h8z' : 'M31 39l-4 5h8z'} fill={t < 0 ? 'var(--peligro)' : 'var(--ok)'} />
          )}
        </svg>
        <p className="text-[26px] leading-none font-bold tabular-nums">
          {Math.round(p)}
          <span className="block text-[13px] font-normal text-texto-2">hPa</span>
        </p>
      </div>
      <p className={`mt-auto pt-2 text-[14px] leading-snug ${alerta ? 'font-bold text-texto' : 'text-texto-2'}`}>
        {tendencia}
        {t != null && ` (${t > 0 ? '+' : ''}${num(t)} hPa en 3 h)`}
      </p>
    </Ficha>
  )
}

// ---- Visibilidad ----
function Visibilidad({ ahora }) {
  const v = ahora.visibilidad
  if (v == null) return null
  const km = v / 1000
  let frase
  if (km < 1) frase = 'Niebla densa: maneja con luces y despacio.'
  else if (km < 4) frase = 'Reducida por neblina o lluvia.'
  else if (km < 10) frase = 'Algo reducida.'
  else frase = 'Buena visibilidad.'
  return (
    <Ficha titulo="Visibilidad" icono={<><path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z" /><circle cx="8" cy="8" r="2" /></>}>
      <p className="text-[30px] leading-none font-bold tabular-nums">
        {km >= 10 ? Math.round(km) : num(km)}
        <span className="text-[14px] font-normal"> km</span>
      </p>
      <p className="mt-auto pt-2 text-[14px] leading-snug text-texto-2">{frase}</p>
    </Ficha>
  )
}

/** Fichas de detalle del momento actual, al estilo de las mejores apps del tiempo. */
export default function Fichas({ ahora, dias }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Viento ahora={ahora} />
      <UV ahora={ahora} hoy={dias[0]} />
      <Sol hoy={dias[0]} manana={dias[1]} />
      <Humedad ahora={ahora} />
      <Presion ahora={ahora} />
      <Visibilidad ahora={ahora} />
    </div>
  )
}
