// Mapa de Chile con los sismos de la semana: cada círculo es un sismo (tamaño y color según la
// magnitud), los de las últimas horas laten, y tu comuna aparece en amarillo. Toca uno para verlo.
import { useEffect, useMemo, useState } from 'react'
import { contornosTierra } from '../services/espacio'
import { colorMagnitud, descripcionMagnitud, VOLCANES } from '../services/riesgos'
import { hace } from '../services/reportes'

const LNG = [-79, -64]
const LAT = [-16.5, -56.5]
const K = Math.cos(36 * (Math.PI / 180)) // corrección de ancho a la latitud media
const W = (LNG[1] - LNG[0]) * K * 10
const H = (LAT[0] - LAT[1]) * 10
const xy = (lng, lat) => [(lng - LNG[0]) * K * 10, (LAT[0] - lat) * 10]

export default function MapaSismos({ sismos, punto, alto = 360 }) {
  const [tierra, setTierra] = useState(null)
  const [elegido, setElegido] = useState(null)
  useEffect(() => {
    contornosTierra()
      .then(setTierra)
      .catch(() => {})
  }, [])
  const caminos = useMemo(
    () =>
      (tierra ?? [])
        .filter((anillo) => anillo.some(([lng, lat]) => lng > -82 && lng < -60 && lat < -10 && lat > -60))
        .map((anillo) => 'M' + anillo.map(([lng, lat]) => xy(lng, lat).map((v) => v.toFixed(1)).join(',')).join('L') + 'Z'),
    [tierra],
  )
  const ahora = Date.now()
  const orden = [...(sismos ?? [])].sort((a, b) => a.magnitud - b.magnitud)
  const ancho = Math.round((alto * W) / H)
  const s = elegido

  return (
    <div className="flex gap-3">
      <svg viewBox={`0 0 ${W} ${H}`} width={ancho} height={alto} className="mapa-sismos shrink-0 rounded-2xl" role="img" aria-label={`Mapa de Chile con ${sismos?.length ?? 0} sismos de los últimos 7 días`}>
        <defs>
          <linearGradient id="ms-mar" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#0b2545" />
            <stop offset="1" stopColor="#13315c" />
          </linearGradient>
        </defs>
        <rect width={W} height={H} fill="url(#ms-mar)" />
        {caminos.map((d, i) => (
          <path key={i} d={d} fill="#1f3a2e" stroke="#4ade80" strokeOpacity=".45" strokeWidth=".6" />
        ))}
        {VOLCANES.map((v) => {
          const [x, y] = xy(v.lng, v.lat)
          return <path key={v.nombre} d={`M${x},${y - 2.2}l2,3.6h-4z`} fill="#fb923c" opacity=".7" />
        })}
        {punto && (() => {
          const [x, y] = xy(punto.lng, punto.lat)
          return (
            <g>
              <circle cx={x} cy={y} r="4" fill="#facc15" stroke="#422006" strokeWidth="1" />
              <circle cx={x} cy={y} r="4" fill="none" stroke="#facc15" className="ms-pulso" />
            </g>
          )
        })()}
        {orden.map((q) => {
          const [x, y] = xy(q.lng, q.lat)
          if (x < 0 || x > W || y < 0 || y > H) return null
          const r = Math.max(1.6, (q.magnitud - 2) * 1.9)
          const reciente = ahora - q.hora < 6 * 3600e3
          return (
            <g key={q.id} onClick={() => setElegido(q)} className="cursor-pointer">
              <circle cx={x} cy={y} r={r + 4} fill="transparent" />
              <circle cx={x} cy={y} r={r} fill={colorMagnitud(q.magnitud)} fillOpacity=".75" stroke={elegido?.id === q.id ? '#fff' : '#000'} strokeOpacity={elegido?.id === q.id ? 1 : 0.35} strokeWidth={elegido?.id === q.id ? 1.4 : 0.6} />
              {reciente && <circle cx={x} cy={y} r={r} fill="none" stroke={colorMagnitud(q.magnitud)} className="ms-pulso" />}
            </g>
          )
        })}
      </svg>
      <div className="min-w-0 flex-1 text-[14px]">
        {s ? (
          <div className="rounded-2xl bg-superficie-2 p-3" aria-live="polite">
            <p className="text-[26px] leading-none font-bold tabular-nums" style={{ color: colorMagnitud(s.magnitud) }}>
              {String(s.magnitud).replace('.', ',')}
            </p>
            <p className="mt-1 font-bold">{descripcionMagnitud(s.magnitud).texto}</p>
            <p className="text-texto-2">{s.lugar}</p>
            <p className="mt-1 text-texto-2">
              {hace(new Date(s.hora))}
              {s.profundidadKm != null ? ` · ${s.profundidadKm} km de profundidad` : ''}
            </p>
            <button type="button" onClick={() => setElegido(null)} className="mt-2 min-h-9 text-[13px] font-bold underline">
              Cerrar
            </button>
          </div>
        ) : (
          <p className="text-texto-2">Toca un círculo para ver ese sismo. Los que laten ocurrieron en las últimas 6 horas.</p>
        )}
        <ul className="mt-3 space-y-1.5 text-[13px] text-texto-2" aria-label="Leyenda">
          {[
            [2.5, 'Menor a 4'],
            [4.5, '4 a 5'],
            [5.5, '5 a 6'],
            [6.5, '6 o más'],
          ].map(([m, t]) => (
            <li key={t} className="flex items-center gap-2">
              <span className="inline-block rounded-full" style={{ width: 6 + (m - 2) * 3, height: 6 + (m - 2) * 3, background: colorMagnitud(m) }} aria-hidden="true" />
              {t}
            </li>
          ))}
          <li className="flex items-center gap-2">
            <span className="inline-block size-3 rounded-full bg-[#facc15]" aria-hidden="true" /> Tu comuna
          </li>
          <li className="flex items-center gap-2">
            <span className="inline-block text-[#fb923c]" aria-hidden="true">▲</span> Volcanes
          </li>
        </ul>
      </div>
    </div>
  )
}
