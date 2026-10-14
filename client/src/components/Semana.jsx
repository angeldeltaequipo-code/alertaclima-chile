import { useState } from 'react'
import IconoClima from './IconoClima'
import { describir, direccionViento, nivelUV } from '../services/clima'
import { colorTemp } from '../services/graficos'
import { hhmm } from '../services/formato'

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const grados = (v) => `${Math.round(v)}°`
const num = (v, d = 1) => v.toLocaleString('es-CL', { maximumFractionDigits: d })

function nombreDia(f, i) {
  if (i === 0) return 'Hoy'
  if (i === 1) return 'Mañana'
  return DIAS[f.getDay()].slice(0, 3).replace(/^./, (c) => c.toUpperCase())
}

/**
 * Próximos 7 días. Cada barra va del mínimo al máximo del día sobre la escala de la semana,
 * pintada con los colores de esas temperaturas. Hoy marca la temperatura actual con un punto.
 * Tocar un día abre su detalle.
 */
export default function Semana({ dias, actual }) {
  const [abierto, setAbierto] = useState(null)
  const semMin = Math.min(...dias.map((d) => d.min))
  const semMax = Math.max(...dias.map((d) => d.max))
  const rango = Math.max(1, semMax - semMin)
  const pos = (t) => ((t - semMin) / rango) * 100

  return (
    <ul className="-mx-2">
      {dias.map((d, i) => {
        const desc = describir(d.codigo)
        const iz = pos(d.min)
        const der = pos(d.max)
        const abiertoAqui = abierto === i
        const nombreLargo = i < 2 ? nombreDia(d.fecha, i) : DIAS[d.fecha.getDay()]
        return (
          <li key={i} className={i > 0 ? 'border-t border-linea' : ''}>
            <button
              type="button"
              onClick={() => setAbierto(abiertoAqui ? null : i)}
              aria-expanded={abiertoAqui}
              aria-label={`${nombreLargo}: ${desc.texto.toLowerCase()}, mínima ${grados(d.min)}, máxima ${grados(d.max)}${
                d.probabilidad >= 20 ? `, ${d.probabilidad} % de probabilidad de lluvia` : ''
              }. ${abiertoAqui ? 'Ocultar' : 'Ver'} detalle`}
              className="grid w-full grid-cols-[4.3rem_32px_2.8rem_2rem_1fr_2.1rem] items-center gap-x-1.5 rounded-xl px-2 py-2.5 text-left active:bg-superficie-2"
            >
              <span className="text-[17px] font-bold">{nombreDia(d.fecha, i)}</span>
              <IconoClima icono={desc.icono} size={32} />
              <span className="flex items-center gap-0.5 text-[14px] font-bold text-lluvia-texto tabular-nums">
                {d.probabilidad >= 20 && (
                  <>
                    <svg width="8" height="11" viewBox="0 0 9 12" aria-hidden="true">
                      <path d="M4.5 0.5C3 3 1 5.2 1 7.6a3.5 3.5 0 0 0 7 0C8 5.2 6 3 4.5 0.5z" fill="currentColor" />
                    </svg>
                    {d.probabilidad}%
                  </>
                )}
              </span>
              <span className="text-right text-[17px] text-texto-2 tabular-nums">{grados(d.min)}</span>
              <span className="relative mx-1 h-2 rounded-full bg-grilla" aria-hidden="true">
                <span
                  className="absolute inset-y-0 rounded-full"
                  style={{
                    left: `${iz}%`,
                    width: `${Math.max(4, der - iz)}%`,
                    background: `linear-gradient(90deg, ${colorTemp(d.min)}, ${colorTemp(d.max)})`,
                  }}
                />
                {i === 0 && actual != null && actual >= d.min - 3 && actual <= d.max + 3 && (
                  <span
                    className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-superficie bg-texto"
                    style={{ left: `${Math.min(100, Math.max(0, pos(actual)))}%` }}
                  />
                )}
              </span>
              <span className="text-[17px] font-bold tabular-nums">{grados(d.max)}</span>
            </button>
            {abiertoAqui && <DetalleDia dia={d} />}
          </li>
        )
      })}
    </ul>
  )
}

function DetalleDia({ dia }) {
  const uv = nivelUV(dia.uv)
  const items = [
    ['Lluvia', dia.lluvia >= 0.1 ? `${num(dia.lluvia)} mm` : 'Sin lluvia', dia.probabilidad != null ? `${dia.probabilidad} % de probabilidad` : null],
    dia.viento != null && [
      'Viento máximo',
      `${Math.round(dia.viento)} km/h`,
      `${dia.direccion != null ? `del ${direccionViento(dia.direccion)}` : ''}${dia.rafagas != null ? `${dia.direccion != null ? ', ' : ''}ráfagas ${Math.round(dia.rafagas)}` : ''}`,
    ],
    uv && ['Índice UV', `${Math.round(dia.uv)} · ${uv.texto}`, null],
    dia.salida && ['Sol', `${hhmm(dia.salida)} – ${hhmm(dia.puesta)}`, 'salida y puesta'],
  ].filter(Boolean)
  return (
    <dl className="mx-2 mb-3 grid grid-cols-2 gap-2">
      {items.map(([t, v, e]) => (
        <div key={t} className="rounded-xl bg-superficie-2 px-3 py-2">
          <dt className="text-[13px] font-bold text-texto-2">{t}</dt>
          <dd className="text-[17px] font-bold tabular-nums">{v}</dd>
          {e && <dd className="text-[13px] text-texto-2">{e}</dd>}
        </div>
      ))}
    </dl>
  )
}
