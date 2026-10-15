import { distanciaTexto } from '../services/rios'

/** Lista de ríos y quebradas cercanos, sobre el mapa. Tocar uno lo muestra completo. */
export default function PanelRios({ rios, enfocado, onEnfocar, onOrigen, onCerrar }) {
  return (
    <section aria-labelledby="t-rios" className="max-h-[46vh] overflow-y-auto rounded-3xl bg-superficie p-3 shadow-xl ring-1 ring-linea">
      <div className="mb-1 flex items-center gap-2">
        <h2 id="t-rios" className="flex-1 text-[17px] font-bold">
          Ríos y quebradas cercanos
        </h2>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid size-11 shrink-0 place-items-center rounded-full bg-superficie-2">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {rios.estado === 'buscando' && (
        <p role="status" className="py-2 text-[16px] text-texto-2">
          Buscando cauces cerca de ti…
        </p>
      )}
      {rios.estado === 'vacio' && <p className="py-2 text-[16px]">No encontramos ríos ni quebradas con nombre cerca de este punto.</p>}
      {rios.estado === 'listo' && (
        <>
          {rios.hayUbicacion ? (
            <div role="radiogroup" aria-label="Buscar cerca de" className="mb-2 grid grid-cols-2 rounded-xl bg-superficie-2 p-1">
              {[
                ['comuna', rios.comuna ?? 'Mi comuna'],
                ['ubicacion', 'Donde estoy'],
              ].map(([k, t]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={rios.origen === k}
                  onClick={() => rios.origen !== k && onOrigen(k)}
                  className={`min-h-10 truncate rounded-lg px-2 text-[14px] font-bold ${rios.origen === k ? 'bg-superficie text-texto shadow' : 'text-texto-2'}`}
                >
                  Cerca de {k === 'comuna' ? t : 'mí'}
                </button>
              ))}
            </div>
          ) : (
            <p className="mb-2 text-[14px] text-texto-2">Cerca de {rios.comuna ?? 'tu comuna'}.</p>
          )}
          <ul className="space-y-1.5">
            {rios.lista.map((r) => (
              <li key={r.nombre}>
                <button
                  type="button"
                  onClick={() => onEnfocar(enfocado?.nombre === r.nombre ? null : r)}
                  aria-pressed={enfocado?.nombre === r.nombre}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${
                    enfocado?.nombre === r.nombre ? 'bg-[#1a73e8] text-white' : 'bg-superficie-2'
                  }`}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="shrink-0">
                    <path d="M2 9c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2M2 15c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2" />
                  </svg>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-bold">{r.nombre}</span>
                    <span className={`block text-[13px] ${enfocado?.nombre === r.nombre ? 'text-white/85' : 'text-texto-2'}`}>{r.tipo}</span>
                  </span>
                  <span className="shrink-0 text-[15px] font-bold tabular-nums">{distanciaTexto(r.distanciaM)}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[13px] text-texto-2">
            Con lluvia fuerte, aléjate de las orillas y no cruces cauces, ni a pie ni en auto. Cauces según OpenStreetMap; puede faltar alguno.
          </p>
        </>
      )}
    </section>
  )
}
