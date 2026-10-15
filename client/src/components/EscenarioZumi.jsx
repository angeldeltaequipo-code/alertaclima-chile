// El estudio de ZUMI, dibujado en vivo (sin video): ventanal al espacio con la Tierra, pantallas
// holográficas con datos reales que se actualizan solos (hora, temperatura, lluvia, radar) y la
// plataforma de luz donde se para ZUMI. En una alerta todo se tiñe de rojo.
import { useEffect, useState } from 'react'
import IconoClima from './IconoClima'

function useReloj() {
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return ahora
}

export default function EscenarioZumi({ comuna, ahora: clima, horas, alerta = false, className = '' }) {
  const reloj = useReloj()
  const barras = (horas ?? []).slice(0, 12).map((h) => h.lluvia ?? 0)
  const max = Math.max(1, ...barras)
  return (
    <div className={`escenario-zumi ${alerta ? 'en-alerta' : ''} ${className}`} aria-hidden="true">
      <div className="escenario-espacio">
        <div className="cosmos-estrellas" />
        <div className="cosmos-estrellas cosmos-estrellas-lejos" />
        <div className="escenario-tierra" />
      </div>
      <div className="escenario-marco" />

      {/* Pantalla izquierda: hora y tiempo actual */}
      <div className="escenario-pantalla izquierda">
        <p className="escenario-etiqueta">
          <span className="escenario-punto" /> En vivo
        </p>
        <p className="text-[22px] leading-none font-bold tabular-nums">{reloj.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })}</p>
        {clima ? (
          <div className="mt-2 flex items-center gap-1.5">
            <IconoClima icono={clima.icono} size={30} />
            <span className="text-[24px] leading-none font-bold tabular-nums">{Math.round(clima.temperatura)}°</span>
          </div>
        ) : (
          <p className="mt-2 text-[12px] opacity-80">AlertaClima</p>
        )}
        {comuna && <p className="mt-1 truncate text-[11px] opacity-80">{comuna.nombre}</p>}
      </div>

      {/* Pantalla derecha: lluvia o radar barriendo */}
      <div className="escenario-pantalla derecha">
        <p className="escenario-etiqueta">{alerta ? '⚠ Alerta' : barras.length ? 'Lluvia 12 h' : 'Radar'}</p>
        {barras.length && !alerta ? (
          <div className="mt-1 flex h-12 items-end gap-[2px]">
            {barras.map((v, i) => (
              <span key={i} className="escenario-barra flex-1 rounded-t-[2px]" style={{ height: `${Math.max(8, (v / max) * 100)}%`, opacity: v > 0 ? 1 : 0.3, animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
        ) : (
          <div className="escenario-radar mt-1" />
        )}
      </div>

      {/* Plataforma */}
      <div className="escenario-piso">
        <div className="escenario-anillo" />
        <div className="escenario-anillo dos" />
      </div>
    </div>
  )
}
