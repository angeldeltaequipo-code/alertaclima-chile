// Franja «en vivo» de la pestaña Ahora: la hora corriendo, cuánto falta para el próximo dato y
// novedades que van rotando (último sismo, la Estación Espacial, vecinos). Que se note que la app
// está despierta y mirando el cielo por ti.
import { useEffect, useState } from 'react'
import { hace } from '../services/reportes'

const CADA = 15 * 60 * 1000 // mismo ritmo que useClima

export default function PulsoEnVivo({ obtenido, sismos, reportes, enLinea }) {
  const [ahora, setAhora] = useState(() => new Date())
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 1000)
    const r = setInterval(() => setI((x) => x + 1), 5000)
    return () => (clearInterval(t), clearInterval(r))
  }, [])

  const novedades = []
  const s = sismos?.[0]
  if (s) novedades.push(`Último sismo: magnitud ${String(s.magnitud).replace('.', ',')} ${hace(new Date(s.hora))}${s.lugar ? `, ${s.lugar}` : ''}`)
  if (reportes?.length) novedades.push(`${reportes.length} ${reportes.length === 1 ? 'reporte vecinal activo' : 'reportes vecinales activos'} en tu comuna`)
  if (obtenido) novedades.push(`Pronóstico actualizado ${hace(obtenido)}`)
  novedades.push('Radar, alertas y sismos vigilados en tiempo real')
  const texto = novedades[i % novedades.length]
  const progreso = obtenido ? Math.min(1, (ahora - obtenido) / CADA) : 0

  return (
    <div className="pulso-vivo relative overflow-hidden rounded-2xl px-3 py-2" role="status" aria-live="off">
      <div className="flex items-center gap-2 text-[13px]">
        <span className={`flex items-center gap-1.5 font-bold tracking-wider uppercase ${enLinea ? 'text-rose-400' : 'text-texto-2'}`}>
          <span className={`size-2 rounded-full ${enLinea ? 'animate-pulse bg-rose-500' : 'bg-texto-2'}`} aria-hidden="true" />
          {enLinea ? 'En vivo' : 'Sin conexión'}
        </span>
        <span className="font-bold tabular-nums">{ahora.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })}</span>
        <span key={i} className="pulso-texto min-w-0 flex-1 truncate text-texto-2">
          {texto}
        </span>
      </div>
      <span className="absolute inset-x-0 bottom-0 h-[2px] bg-linea" aria-hidden="true">
        <span className="block h-full bg-gradient-to-r from-sky-400 to-violet-400 transition-[width] duration-1000" style={{ width: `${progreso * 100}%` }} />
      </span>
    </div>
  )
}
