import IconoReporte from './IconoReporte'
import { hace, nombreCategoria } from '../services/reportes'

/** Resumen de los reportes vecinales en la pestaña Ahora. */
export default function ListaReportes({ datos, onVer, onReportar }) {
  const { reportes, error, nPendientes } = datos
  return (
    <section aria-labelledby="t-reportes" className="rounded-2xl border-2 border-borde bg-superficie px-4 py-4">
      <div className="mb-2 flex items-center gap-3">
        <h2 id="t-reportes" className="flex-1 text-[19px] font-bold">
          Reportes de vecinos
        </h2>
        <button type="button" onClick={onReportar} className="min-h-11 rounded-lg bg-senal px-4 text-[15px] font-bold text-sobre-senal">
          Reportar
        </button>
      </div>
      {nPendientes > 0 && (
        <p className="mb-2 text-[15px] font-bold text-senal-texto">
          {nPendientes === 1 ? 'Tienes 1 reporte' : `Tienes ${nPendientes} reportes`} esperando señal para enviarse.
        </p>
      )}
      {reportes.length === 0 ? (
        <p className="text-[16px] text-texto-2">
          {error ? `No se pudieron cargar los reportes: ${error}.` : 'No hay reportes activos en tu comuna. Si ves un problema, avisa a tus vecinos.'}
        </p>
      ) : (
        <ul className="divide-y divide-borde/50">
          {reportes.slice(0, 6).map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => onVer(r)} className="flex min-h-14 w-full items-center gap-3 py-2 text-left">
                <span className="pin-reporte shrink-0" aria-hidden="true">
                  <IconoReporte categoria={r.categoria} size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[16px] font-bold">
                    {r.titulo !== nombreCategoria(r.categoria) ? r.titulo : nombreCategoria(r.categoria)}
                  </span>
                  <span className="block text-[14px] text-texto-2">
                    {nombreCategoria(r.categoria)} · {hace(r.creado)}
                    {r.confirmaciones > 0 && ` · ${r.confirmaciones} confirman`}
                  </span>
                </span>
                <span className="text-[14px] font-bold text-senal-texto">Ver</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {reportes.length > 6 && <p className="mt-2 text-[15px] text-texto-2">Y {reportes.length - 6} más en el mapa.</p>}
    </section>
  )
}
