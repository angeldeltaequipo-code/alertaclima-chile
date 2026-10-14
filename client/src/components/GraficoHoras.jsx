import { useId, useState } from 'react'
import IconoClima from './IconoClima'
import { describir, direccionViento } from '../services/clima'
import { colorLluvia, colorTemp, curvaSuave } from '../services/graficos'
import { hhmm } from '../services/formato'

const COL = 56 // ancho de cada hora (px)
const ALTO_T = 92 // franja de temperatura
const ALTO_LLUVIA = 46 // franja de lluvia (solo si se espera lluvia)
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const num = (v, d = 1) => v.toLocaleString('es-CL', { maximumFractionDigits: d })

function etiquetaHora(h, i) {
  if (i === 0) return 'Ahora'
  return `${hhmm(h.hora).slice(0, 2)} h`
}

/** Frase completa de una hora, para quien toca una columna y para lectores de pantalla. */
function fraseHora(h, i) {
  const partes = [`${i === 0 ? 'Ahora' : `A las ${hhmm(h.hora)}`}: ${Math.round(h.temperatura)}°, ${describir(h.codigo).texto.toLowerCase()}`]
  if (h.lluvia > 0) partes.push(`${num(h.lluvia)} mm de lluvia`)
  if (h.probabilidad != null) partes.push(`${h.probabilidad} % de probabilidad de lluvia`)
  if (h.viento != null)
    partes.push(
      `viento ${Math.round(h.viento)} km/h${h.direccion != null ? ` del ${direccionViento(h.direccion)}` : ''}${
        h.rafagas != null && h.rafagas - h.viento >= 10 ? `, ráfagas de ${Math.round(h.rafagas)}` : ''
      }`,
    )
  return partes.join(' · ')
}

/**
 * Las próximas 24 horas en un solo gráfico desplazable: ícono, curva de temperatura,
 * barras de lluvia, probabilidad y viento, alineados por hora. Las horas de noche llevan
 * un fondo más oscuro y la medianoche marca el cambio de día.
 */
export default function GraficoHoras({ horas }) {
  const id = useId().replace(/:/g, '')
  const [sel, setSel] = useState(0)
  const W = horas.length * COL
  const ALTO_L = horas.some((h) => h.lluvia > 0) ? ALTO_LLUVIA : 0
  const temps = horas.map((h) => h.temperatura)
  const tMin = Math.min(...temps)
  const tMax = Math.max(...temps)
  const span = Math.max(4, tMax - tMin)
  const yT = (t) => 26 + (1 - (t - tMin) / span) * (ALTO_T - 40)
  const pts = horas.map((h, i) => [i * COL + COL / 2, yT(h.temperatura)])
  const linea = curvaSuave(pts)
  const area = `${linea} L${pts[pts.length - 1][0]},${ALTO_T} L${pts[0][0]},${ALTO_T} Z`
  const lMax = Math.max(2, ...horas.map((h) => h.lluvia))
  const hayViento = horas.some((h) => h.viento != null)
  const activa = horas[sel] ?? horas[0]

  return (
    <div>
      <p className="mb-2 rounded-xl bg-superficie-2 px-3 py-2 text-[15px] leading-snug" aria-live="polite">
        {fraseHora(activa, sel)}
      </p>
      <div className="-mx-4 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none]">
        <div className="relative" style={{ width: W }}>
          {/* Fondo: noches y cambio de día */}
          <div className="pointer-events-none absolute inset-0 flex" aria-hidden="true">
            {horas.map((h, i) => (
              <div
                key={i}
                className={`h-full shrink-0 ${h.esDeDia ? '' : 'bg-noche'} ${i === sel ? 'columna-activa' : ''}`}
                style={{ width: COL, borderLeft: i > 0 && h.hora.getHours() === 0 ? '1px dashed var(--borde)' : undefined }}
              />
            ))}
          </div>

          <ol className="relative flex" aria-label="Pronóstico por hora">
            {horas.map((h, i) => {
              const d = describir(h.codigo)
              const medianoche = i > 0 && h.hora.getHours() === 0
              return (
                <li key={i} style={{ width: COL }} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setSel(i)}
                    aria-pressed={sel === i}
                    aria-label={fraseHora(h, i)}
                    className="flex w-full flex-col items-center pt-1"
                  >
                    <span className={`block h-5 text-[14px] leading-5 tabular-nums ${i === 0 || medianoche ? 'font-bold text-texto' : 'text-texto-2'}`}>
                      {medianoche ? DIAS[h.hora.getDay()] : etiquetaHora(h, i)}
                    </span>
                    <span className="my-1">
                      <IconoClima icono={d.icono} esDeDia={h.esDeDia} size={30} />
                    </span>
                    {/* espacio para la curva de temperatura */}
                    <span style={{ height: ALTO_T }} />
                    <span style={{ height: ALTO_L }} />
                    <span className="flex h-5 items-center gap-0.5 text-[13px] text-lluvia-texto tabular-nums">
                      {h.probabilidad >= 10 && (
                        <>
                          <svg width="8" height="11" viewBox="0 0 9 12" aria-hidden="true">
                            <path d="M4.5 0.5C3 3 1 5.2 1 7.6a3.5 3.5 0 0 0 7 0C8 5.2 6 3 4.5 0.5z" fill="currentColor" />
                          </svg>
                          {h.probabilidad}%
                        </>
                      )}
                    </span>
                    {hayViento && h.viento != null && (
                      <span className="mt-1 flex h-9 flex-col items-center text-[13px] leading-tight text-texto-2 tabular-nums">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 14 14"
                          aria-hidden="true"
                          style={{ transform: `rotate(${(h.direccion ?? 0) + 180}deg)` }}
                        >
                          <path d="M7 1l4.5 11L7 9.5 2.5 12z" fill="currentColor" />
                        </svg>
                        <span className={h.rafagas >= 50 ? 'font-bold text-texto' : ''}>{Math.round(h.viento)}</span>
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ol>

          {/* Curva de temperatura y barras de lluvia, superpuestas en su franja */}
          <svg
            className="pointer-events-none absolute left-0"
            style={{ top: 62 }}
            width={W}
            height={ALTO_T + ALTO_L}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={`t${id}`} x1="0" x2={W} y1="0" y2="0" gradientUnits="userSpaceOnUse">
                {horas.map((h, i) => (
                  <stop key={i} offset={(i * COL + COL / 2) / W} stopColor={colorTemp(h.temperatura)} />
                ))}
              </linearGradient>
              <linearGradient id={`a${id}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="white" stopOpacity="0.5" />
                <stop offset="1" stopColor="white" stopOpacity="0" />
              </linearGradient>
              <mask id={`m${id}`}>
                <rect width={W} height={ALTO_T} fill={`url(#a${id})`} />
              </mask>
            </defs>
            <path d={area} fill={`url(#t${id})`} mask={`url(#m${id})`} opacity="0.55" />
            <path d={linea} fill="none" stroke={`url(#t${id})`} strokeWidth="3.5" strokeLinecap="round" />
            {pts.map(([x, y], i) => (
              <g key={i}>
                <circle cx={x} cy={y} r={i === sel ? 5.5 : 3.5} fill={colorTemp(horas[i].temperatura)} stroke="var(--superficie)" strokeWidth="2" />
                <text x={x} y={y - 10} textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--texto)">
                  {Math.round(horas[i].temperatura)}°
                </text>
              </g>
            ))}

            {/* Lluvia: barras desde la base, con los mm encima si hay */}
            <g transform={`translate(0 ${ALTO_T})`}>
              {ALTO_L > 0 && <line x1="0" x2={W} y1={ALTO_L - 1} y2={ALTO_L - 1} stroke="var(--grilla)" />}
              {horas.map((h, i) => {
                if (!(h.lluvia > 0)) return null
                const alto = Math.max(3, (h.lluvia / lMax) * (ALTO_L - 16))
                const x = i * COL + 12
                return (
                  <g key={i}>
                    <rect x={x} y={ALTO_L - 1 - alto} width={COL - 24} height={alto} rx="3" fill={colorLluvia(h.lluvia)} />
                    <text x={i * COL + COL / 2} y={ALTO_L - 4 - alto} textAnchor="middle" fontSize="12" fontWeight="700" fill="var(--lluvia-texto)">
                      {num(h.lluvia)}
                    </text>
                  </g>
                )
              })}
            </g>
          </svg>
        </div>
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-texto-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1 w-4 rounded-full" style={{ background: 'linear-gradient(90deg, rgb(51 167 216), rgb(242 193 78), rgb(226 72 61))' }} />
          Temperatura
        </span>
        {ALTO_L > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-3 rounded-sm bg-lluvia" /> Lluvia (mm)
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <svg width="8" height="11" viewBox="0 0 9 12" aria-hidden="true" className="text-lluvia-texto">
            <path d="M4.5 0.5C3 3 1 5.2 1 7.6a3.5 3.5 0 0 0 7 0C8 5.2 6 3 4.5 0.5z" fill="currentColor" />
          </svg>
          Probabilidad de lluvia
        </span>
        {hayViento && (
          <span className="inline-flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden="true" style={{ transform: 'rotate(45deg)' }}>
              <path d="M7 1l4.5 11L7 9.5 2.5 12z" fill="currentColor" />
            </svg>
            Viento (km/h) y hacia dónde sopla
          </span>
        )}
      </p>
    </div>
  )
}
