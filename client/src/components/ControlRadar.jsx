import { hhmm } from '../services/formato'

function hace(d) {
  const min = Math.round((Date.now() - d.getTime()) / 60000)
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  return `hace ${h} h ${min % 60} min`
}

/** Control de la animación del radar, pensado para el pulgar. */
export default function ControlRadar({ radar, ahorro, enLinea }) {
  const { cuadros, indice, setIndice, reproduciendo, setReproduciendo, error, recargar } = radar

  if (!enLinea && cuadros.length === 0) {
    return (
      <div className="rounded-xl border-2 border-borde bg-superficie px-4 py-3 text-[15px]" role="status">
        <strong>Sin señal.</strong> El radar se carga apenas vuelva la conexión.
      </div>
    )
  }

  if (error && cuadros.length === 0) {
    return (
      <div className="rounded-xl border-2 border-borde bg-superficie px-4 py-3 text-[15px]">
        <p>
          <strong>Radar no disponible.</strong> {error}.
        </p>
        <button type="button" onClick={recargar} className="mt-2 min-h-11 rounded-lg bg-senal px-4 font-bold text-sobre-senal">
          Reintentar
        </button>
      </div>
    )
  }
  if (cuadros.length === 0) {
    return (
      <div className="rounded-xl border-2 border-borde bg-superficie px-4 py-3 text-[15px]" role="status">
        Cargando radar…
      </div>
    )
  }

  const actual = cuadros[indice]
  const esUltimo = indice === cuadros.length - 1

  return (
    <div className="rounded-xl border-2 border-borde bg-superficie px-3 py-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setReproduciendo(!reproduciendo)}
          aria-label={reproduciendo ? 'Pausar animación del radar' : 'Reproducir animación del radar'}
          className="grid size-11 shrink-0 place-items-center rounded-lg bg-senal text-sobre-senal"
        >
          {reproduciendo ? (
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              <rect x="4" y="3" width="4" height="14" fill="currentColor" />
              <rect x="12" y="3" width="4" height="14" fill="currentColor" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M5 3l12 7-12 7z" fill="currentColor" />
            </svg>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-tight">
            <strong className="text-[19px] tabular-nums">{hhmm(actual.hora)}</strong>{' '}
            <span className="text-texto-2">{esUltimo ? `· último cuadro, ${hace(actual.hora)}` : '· lluvia de las últimas 2 h'}</span>
          </p>
          <label className="sr-only" htmlFor="radar-tiempo">
            Momento del radar
          </label>
          <input
            id="radar-tiempo"
            type="range"
            min={0}
            max={cuadros.length - 1}
            value={indice}
            onChange={(e) => setIndice(Number(e.target.value))}
            className="mt-1 h-8 w-full accent-[var(--senal)]"
          />
        </div>
      </div>
      {ahorro && <p className="mt-1 text-[13px] text-texto-2">Modo ahorro: animación pausada.</p>}
    </div>
  )
}
