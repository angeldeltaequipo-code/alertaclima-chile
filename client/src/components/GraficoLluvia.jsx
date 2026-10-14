import { useState } from 'react'
import { hhmm } from '../services/formato'

const mm = (v) => `${v.toLocaleString('es-CL', { maximumFractionDigits: 1 })} mm`

/**
 * Lluvia esperada hora a hora (mm). Una sola serie, barras finas con punta
 * redondeada, grilla tenue y etiqueta solo en la hora más lluviosa.
 * Tocar una barra muestra su valor.
 */
export default function GraficoLluvia({ horas }) {
  const [sel, setSel] = useState(null)
  const W = 340
  const H = 150
  const m = { t: 22, r: 8, b: 26, l: 34 }
  const iw = W - m.l - m.r
  const ih = H - m.t - m.b
  const maximo = Math.max(...horas.map((h) => h.lluvia))
  // Escala con tope "redondo" y mínimo de 4 mm, para que 0,2 mm no parezca un diluvio.
  const tope = Math.max(4, Math.ceil(maximo / 2) * 2)
  const marcas = [0, tope / 2, tope]
  const paso = iw / horas.length
  const ancho = Math.max(6, paso - 6)
  const y = (v) => m.t + ih - (v / tope) * ih
  const iMax = maximo > 0 ? horas.findIndex((h) => h.lluvia === maximo) : -1
  const activa = sel ?? iMax

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-labelledby="graf-lluvia-desc">
        <desc id="graf-lluvia-desc">
          Lluvia esperada por hora: {horas.map((h) => `${hhmm(h.hora)} ${mm(h.lluvia)}`).join(', ')}
        </desc>
        {marcas.map((v) => (
          <g key={v}>
            <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke="var(--grilla)" strokeWidth="1" />
            <text x={m.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--texto-2)">
              {v.toLocaleString('es-CL')}
            </text>
          </g>
        ))}
        <text x={m.l - 6} y={m.t - 10} textAnchor="end" fontSize="11" fill="var(--texto-2)">
          mm
        </text>
        {horas.map((h, i) => {
          const x = m.l + i * paso + (paso - ancho) / 2
          const alto = Math.max(0, y(0) - y(h.lluvia))
          const r = Math.min(4, ancho / 2, alto)
          return (
            <g key={i}>
              {alto > 0.5 && (
                <path
                  d={`M${x},${y(0)} V${y(0) - alto + r} Q${x},${y(0) - alto} ${x + r},${y(0) - alto} H${x + ancho - r} Q${x + ancho},${y(0) - alto} ${x + ancho},${y(0) - alto + r} V${y(0)} Z`}
                  fill="var(--lluvia)"
                  opacity={activa === -1 || activa === i ? 1 : 0.55}
                />
              )}
              {h.lluvia > 0 && alto <= 0.5 && (
                <rect x={x} y={y(0) - 2} width={ancho} height="2" fill="var(--lluvia)" />
              )}
              {i % 3 === 0 && (
                <text x={x + ancho / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--texto-2)">
                  {i === 0 ? 'Ahora' : hhmm(h.hora).slice(0, 2) + ' h'}
                </text>
              )}
              {/* Zona táctil más grande que la barra */}
              <rect
                x={m.l + i * paso}
                y={m.t}
                width={paso}
                height={ih}
                fill="transparent"
                onClick={() => setSel(sel === i ? null : i)}
              >
                <title>{`${hhmm(h.hora)}: ${mm(h.lluvia)}`}</title>
              </rect>
            </g>
          )
        })}
        <line x1={m.l} x2={W - m.r} y1={y(0)} y2={y(0)} stroke="var(--texto-2)" strokeWidth="1" />
        {activa >= 0 && horas[activa].lluvia > 0 && (
          <text
            x={Math.min(W - m.r - 4, Math.max(m.l + 4, m.l + activa * paso + paso / 2))}
            y={y(horas[activa].lluvia) - 6}
            textAnchor={activa > horas.length - 3 ? 'end' : activa < 2 ? 'start' : 'middle'}
            fontSize="12"
            fontWeight="700"
            fill="var(--texto)"
          >
            {sel !== null ? `${hhmm(horas[activa].hora)} · ` : ''}
            {mm(horas[activa].lluvia)}
          </text>
        )}
      </svg>
    </figure>
  )
}
