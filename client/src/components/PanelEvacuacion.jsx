import { comoLlegar, zonasCercanas } from '../services/evacuacion'

const km = (x) => (x < 1 ? `${Math.round(x * 1000)} m` : `${x.toLocaleString('es-CL', { maximumFractionDigits: 1 })} km`)

/** Vías de evacuación y zonas de encuentro cercanas, sobre el mapa. */
export default function PanelEvacuacion({ evac, punto, comuna, onCerrar }) {
  const cerca = evac.datos ? zonasCercanas(evac.datos.puntos, punto) : []
  return (
    <section aria-labelledby="t-evac" className="max-h-[46vh] overflow-y-auto rounded-3xl bg-superficie p-3 shadow-xl ring-1 ring-linea">
      <div className="mb-1 flex items-center gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#16a34a] text-white" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="14" cy="4" r="2" />
            <path d="M8 21l3-7 3 3v5M6 12l3-4h5l3 4M11 14l-1-5" />
          </svg>
        </span>
        <h2 id="t-evac" className="flex-1 text-[17px] leading-tight font-bold">
          Evacuación cerca de {comuna ?? 'ti'}
        </h2>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid size-11 shrink-0 place-items-center rounded-full bg-superficie-2">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {evac.estado === 'cargando' && (
        <p role="status" className="py-2 text-[16px] text-texto-2">
          Buscando vías de evacuación y zonas seguras…
        </p>
      )}
      {evac.estado === 'error' && <p className="py-2 text-[16px] font-bold text-peligro">{evac.error}</p>}
      {evac.estado === 'listo' && (
        <>
          {!evac.datos.puntos.length && !evac.datos.rutas.length ? (
            <p className="py-2 text-[16px]">No hay vías de evacuación mapeadas cerca. Consulta el plan de emergencia de tu municipio.</p>
          ) : (
            <>
              <p className="text-[14px] text-texto-2">
                <strong className="text-texto">{evac.datos.puntos.length}</strong> zonas de encuentro y <strong className="text-texto">{evac.datos.rutas.length}</strong> tramos de vías
                de evacuación en la zona (en verde en el mapa).
              </p>
              {cerca.length > 0 && (
                <ul className="mt-2 space-y-1.5">
                  {cerca.map((z, i) => (
                    <li key={z.id} className="flex items-center gap-2 rounded-2xl bg-superficie-2 px-3 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-bold">
                          {i === 0 ? 'La más cercana: ' : ''}
                          {z.nombre ?? (z.tsunami ? 'Zona segura ante tsunami' : 'Zona de encuentro')}
                        </span>
                        <span className="text-[13px] text-texto-2">A {km(z.km)} en línea recta</span>
                      </span>
                      <a href={comoLlegar(z)} target="_blank" rel="noopener" className="min-h-10 shrink-0 rounded-full bg-[#16a34a] px-3 py-2 text-[14px] font-bold text-white">
                        Cómo llegar
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <p className="mt-2 text-[12px] text-texto-2">
            Ante un sismo fuerte en la costa, evacúa a pie hacia la zona alta sin esperar la alerta. Sigue la señalética y las instrucciones de SENAPRED y tu
            municipio. Datos: © colaboradores de OpenStreetMap.
          </p>
        </>
      )}
    </section>
  )
}
