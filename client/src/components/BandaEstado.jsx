import { NIVELES } from '../services/alertas'
import { hhmm } from '../services/formato'

/**
 * Banda superior: dice dónde estás mirando y cuál es el estado oficial.
 * El color de la banda depende SOLO de una alerta oficial con fuente.
 */
export default function BandaEstado({ comuna, estado, onCambiar }) {
  const nivel = NIVELES[estado?.nivel ?? 'sin_fuente']
  const clave = nivel.clave
  const sinFuente = estado?.nivel === 'sin_fuente'

  return (
    <header
      className="safe-top border-b-2 border-borde"
      style={{ background: `var(--nivel-${clave}-fondo)`, color: `var(--nivel-${clave}-texto)` }}
    >
      <div className="flex items-start gap-3 px-4 pt-3 pb-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[28px] leading-tight font-bold tracking-tight">
            {comuna ? comuna.nombre : 'Elige tu comuna'}
          </h1>
          <p className="text-[15px] opacity-90">{comuna ? comuna.region.etiqueta :'Para ver el radar y el estado de tu zona'}</p>
        </div>
        <button
          type="button"
          onClick={onCambiar}
          className="mt-1 min-h-11 shrink-0 rounded-lg border-2 border-current px-3 text-[15px] font-bold"
        >
          {comuna ? 'Cambiar' : 'Elegir'}
        </button>
      </div>

      {comuna && (
        <div className="border-t border-current/25 px-4 py-2 text-[15px]">
          {sinFuente ? (
            <p>
              <strong>Alertas oficiales:</strong> todavía no están conectadas a esta app.{' '}
              Revisa{' '}
              <a href={estado.fuente.url} target="_blank" rel="noopener" className="font-bold underline underline-offset-2">
                senapred.cl
              </a>
              .
            </p>
          ) : (
            <p>
              <strong>{nivel.etiqueta}</strong>
              {estado?.fuente && (
                <>
                  {' '}
                  · Fuente: {estado.fuente.nombre}
                  {estado.actualizado && `, ${hhmm(estado.actualizado)}`}
                </>
              )}
            </p>
          )}
        </div>
      )}
    </header>
  )
}
