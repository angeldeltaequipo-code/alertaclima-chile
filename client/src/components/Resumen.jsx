import { useEffect, useState } from 'react'
import { NIVELES, alertaPrincipal } from '../services/alertas'
import { nombreCategoria } from '../services/reportes'
import { hhmm } from '../services/formato'
import { riesgoAluvion } from '../services/aluvion'

const num = (v, d = 1) => v.toLocaleString('es-CL', { maximumFractionDigits: d })
const sinMovimiento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Cuenta desde 0 hasta el valor al aparecer (se salta con movimiento reducido). */
function useContador(valor, ms = 900) {
  const [v, setV] = useState(() => (sinMovimiento() ? valor : 0))
  useEffect(() => {
    if (sinMovimiento()) return setV(valor)
    let raf
    const t0 = performance.now()
    const paso = (t) => {
      const k = Math.min(1, (t - t0) / ms)
      setV(valor * (1 - (1 - k) ** 3))
      if (k < 1) raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [valor, ms])
  return v
}

const ICONOS = {
  alertas: <path d="M12 3l9.5 17h-19zM12 10v4.5M12 17.5v.01" />,
  lluvia: <path d="M7 14h10a4 4 0 0 0 .4-8 6 6 0 0 0-11.6 1.4A3.3 3.3 0 0 0 7 14zM9 17l-1 3M13 17l-1 3M17 17l-1 3" />,
  vecinos: <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2.5 19a5.5 5.5 0 0 1 11 0M10.5 19a5.5 5.5 0 0 1 11 0" />,
  aluvion: <path d="M3 20l6-12 4 6 2-3 6 9zM14 20c.5-2 2-3 3.5-3" />,
}

function Ficha({ id, tono, titulo, valor, detalle, onClick, retraso }) {
  return (
    <button type="button" onClick={onClick} className={`ficha-resumen ficha-${tono}`} style={{ animationDelay: `${retraso}ms, ${retraso + 150}ms, ${retraso + 150}ms` }}>
      <span className="flex items-center gap-1.5 text-[13px] font-bold text-texto-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="ficha-icono" aria-hidden="true">
          {ICONOS[id]}
        </svg>
        {titulo}
      </span>
      <span className="mt-1 block text-[22px] leading-tight font-bold tabular-nums">{valor}</span>
      <span className="mt-0.5 block text-[13px] leading-snug text-texto-2 first-letter:uppercase">{detalle}</span>
    </button>
  )
}

function datosAlertas(estado) {
  if (!estado || estado.tipo === 'sin_servidor' || estado.tipo === 'sin_conexion') return { tono: 'neutro', valor: 'Revisa', detalle: 'senapred.cl' }
  const p = alertaPrincipal(estado.alertas)
  if (p) {
    const grave = p.nivel === 'roja' || p.nivel === 'evacuacion'
    return { tono: grave ? 'peligro' : 'atento', valor: NIVELES[p.nivel].etiqueta.replace('Alerta ', '').replace('Temprana ', ''), detalle: p.amenaza }
  }
  if (estado.alertas.some((a) => a.sin_confirmar)) return { tono: 'atento', valor: 'Sin confirmar', detalle: 'revisa senapred.cl' }
  return { tono: 'bien', valor: 'Ninguna', detalle: 'alerta oficial vigente' }
}

/** Lo esencial de un vistazo, en fichas que se pueden tocar. */
export default function Resumen({ alertas, horas, reportes = [], reportesDisponibles, comuna, nombre, onVerAlertas, onVerMapa, onIr = () => {} }) {
  const prox = horas?.slice(0, 12) ?? []
  const total12 = prox.reduce((s, h) => s + h.lluvia, 0)
  const primera = prox.find((h) => h.lluvia >= 0.2)
  const maxH = prox.reduce((a, b) => (b.lluvia > (a?.lluvia ?? 0) ? b : a), null)
  const lluviaAnim = useContador(total12)
  const nReportes = useContador(reportes.length)
  const r = riesgoAluvion(horas)
  const a = datosAlertas(alertas)

  const hora = new Date().getHours()
  const saludo = hora < 6 ? 'Buenas noches' : hora < 13 ? 'Buenos días' : hora < 20 ? 'Buenas tardes' : 'Buenas noches'
  const porTipo = {}
  for (const x of reportes) porTipo[x.categoria] = (porTipo[x.categoria] ?? 0) + 1
  const masComun = Object.entries(porTipo).sort((x, y) => y[1] - x[1])[0]

  return (
    <section aria-labelledby="t-resumen">
      <h2 id="t-resumen" className="entrar mb-2.5 px-1 text-[21px] leading-tight font-bold">
        {saludo}
        {nombre ? `, ${nombre.split(' ')[0]}` : ''}
        <span className="mt-0.5 block text-[15px] font-normal text-texto-2">
          Así está {comuna?.nombre ?? 'tu comuna'} este {new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </h2>
      <div className="grid grid-cols-2 gap-2.5">
        <Ficha id="alertas" titulo="Alertas" retraso={60} {...a} onClick={onVerAlertas} />
        <Ficha
          id="lluvia"
          titulo="Lluvia 12 h"
          retraso={140}
          tono={!primera ? 'bien' : maxH.lluvia >= 10 ? 'peligro' : maxH.lluvia >= 2.5 ? 'atento' : 'info'}
          valor={!primera ? 'Sin lluvia' : `${num(lluviaAnim)} mm`}
          detalle={!prox.length ? '—' : !primera ? `hasta las ${hhmm(prox[prox.length - 1].hora)}` : primera === prox[0] ? 'lloviendo desde ahora' : `desde las ${hhmm(primera.hora)}`}
          onClick={() => onIr('t-horas')}
        />
        {reportesDisponibles && (
          <Ficha
            id="vecinos"
            titulo="Vecinos"
            retraso={220}
            tono={reportes.length ? 'atento' : 'bien'}
            valor={`${Math.round(nReportes)} ${reportes.length === 1 ? 'reporte' : 'reportes'}`}
            detalle={masComun ? `${nombreCategoria(masComun[0]).toLowerCase()}${masComun[1] > 1 ? ` (${masComun[1]})` : ''}` : 'nadie reporta problemas'}
            onClick={onVerMapa}
          />
        )}
        {r && (
          <Ficha
            id="aluvion"
            titulo="Aluviones"
            retraso={300}
            tono={r.nivel === 'alto' ? 'peligro' : r.nivel === 'atencion' ? 'atento' : 'bien'}
            valor={r.nivel === 'alto' ? 'Riesgo alto' : r.nivel === 'atencion' ? 'Atención' : 'Riesgo bajo'}
            detalle={r.nivel === 'bajo' ? 'sin lluvia importante' : r.motivos[0]}
            onClick={() => onIr('t-aluvion')}
          />
        )}
      </div>
    </section>
  )
}
