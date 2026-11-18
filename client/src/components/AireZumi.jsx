// Calidad del aire: material particulado fino (MP2,5) ahora y las próximas 24 horas, con los niveles
// de episodio que usa Chile y qué hacer en cada uno. Estimación del modelo CAMS (Copernicus);
// los episodios oficiales los informa el SINCA y la autoridad regional.
import { useEffect, useState } from 'react'
import { NIVELES_AIRE, aire, nivelAire } from '../services/inteligencia'

export default function AireZumi({ punto, comuna }) {
  const [d, setD] = useState(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    if (!punto) return
    let vivo = true
    aire(punto)
      .then((r) => vivo && setD(r))
      .catch(() => vivo && setError(true))
    return () => {
      vivo = false
    }
  }, [punto?.lat, punto?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <p className="text-[15px] text-texto-2">No pude consultar la calidad del aire ahora. Revisa sinca.mma.gob.cl.</p>
  if (!d) return <p className="text-[15px] text-texto-2">Midiendo el aire de {comuna ?? 'tu comuna'}…</p>
  const n = d.nivel
  const max = Math.max(60, ...d.futuras.map((h) => h.pm25))
  return (
    <section aria-labelledby="t-aire" className="space-y-3">
      <div className="aire-hero rounded-[26px] p-5 text-white" style={{ '--aire': n.color }}>
        <p className="rotulo flex items-center gap-2 !text-white/60">
          <span className="punto-vivo" style={{ background: n.color }} aria-hidden="true" /> Calidad del aire · {comuna}
        </p>
        <div className="mt-3 flex items-end gap-3">
          <p className="cifra text-[72px]">{Math.round(d.prom24 ?? d.pm25)}</p>
          <div className="pb-2">
            <p className="mono text-[12px] text-white/60">µg/m³ MP2,5 · 24 h</p>
            <h3 id="t-aire" className="titulo-x text-[24px]" style={{ color: n.color }}>
              {n.nombre}
            </h3>
          </div>
        </div>
        <p className="mt-2 text-[15px] text-white/85">{n.consejo}</p>
        <p className="mono mt-3 text-[12px] text-white/50">
          Ahora {Math.round(d.pm25)} µg/m³ · MP10 {Math.round(d.pm10)} µg/m³{d.aqi != null ? ` · AQI ${Math.round(d.aqi)}` : ''}
        </p>
      </div>

      {d.futuras.length > 0 && (
        <div className="rounded-2xl border border-linea px-3 pt-3 pb-2">
          <p className="rotulo">Próximas 24 horas</p>
          <div className="mt-2 flex h-20 items-end gap-[3px]" aria-hidden="true">
            {d.futuras.map((h) => (
              <span key={h.hora.toISOString()} className="flex-1 rounded-t-[3px]" style={{ height: `${Math.max(4, (h.pm25 / max) * 100)}%`, background: nivelAire(h.pm25).color, opacity: 0.85 }} />
            ))}
          </div>
          <div className="mono mt-1 flex justify-between text-[10.5px] text-texto-2">
            <span>ahora</span>
            <span>+12 h</span>
            <span>+24 h</span>
          </div>
          {d.peor && (
            <p className="mt-2 text-[14px]">
              Lo peor: <strong>{Math.round(d.peor.pm25)} µg/m³</strong> cerca de las {d.peor.hora.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}, cuando suele bajar el viento.
            </p>
          )}
        </div>
      )}

      <ul className="grid grid-cols-5 gap-1 text-center" aria-label="Niveles de calidad del aire">
        {NIVELES_AIRE.map((x, i) => (
          <li key={x.nombre} className={`rounded-xl px-1 py-1.5 ${x === n ? 'ring-2 ring-texto' : ''}`} style={{ background: `${x.color}26` }}>
            <span className="block text-[10.5px] leading-tight font-semibold">{x.nombre.replace('Nivel ', '')}</span>
            <span className="mono block text-[10px] text-texto-2">{i === 0 ? '<50' : i === NIVELES_AIRE.length - 1 ? '≥170' : `${NIVELES_AIRE[i - 1].hasta}+`}</span>
          </li>
        ))}
      </ul>
      <p className="text-[12px] leading-snug text-texto-2">
        Estimación del modelo CAMS (Copernicus) a unos 40 km de resolución: sirve para ver la tendencia. Los episodios oficiales (alerta, preemergencia, emergencia) los informa la autoridad;
        revisa las estaciones en{' '}
        <a href="https://sinca.mma.gob.cl/" target="_blank" rel="noopener" className="underline">
          sinca.mma.gob.cl
        </a>
        .
      </p>
    </section>
  )
}
