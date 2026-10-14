import { NIVELES } from '../services/alertas'
import { describir } from '../services/clima'
import { hhmm } from '../services/formato'
import IconoClima from './IconoClima'

/**
 * Banda superior: dónde estás mirando, el tiempo de un vistazo y el estado oficial.
 * El color de la banda depende SOLO de una alerta oficial con fuente.
 */
export default function BandaEstado({ comuna, estado, ahora, onCambiar }) {
  const nivel = NIVELES[estado?.nivel ?? 'sin_fuente']
  const clave = nivel.clave
  const sinFuente = estado?.nivel === 'sin_fuente'
  const cond = ahora ? describir(ahora.codigo) : null

  return (
    <header
      className="safe-top border-b-2 border-borde"
      style={{ background: `var(--nivel-${clave}-fondo)`, color: `var(--nivel-${clave}-texto)` }}
    >
      <div className="mx-auto flex max-w-xl items-center gap-3 px-4 pt-3 pb-3">
        <button
          type="button"
          onClick={onCambiar}
          className="group min-w-0 flex-1 rounded-lg text-left"
          aria-label={comuna ? `Comuna: ${comuna.nombre}. Cambiar comuna` : 'Elegir comuna'}
        >
          <span className="flex items-center gap-2">
            <span className="truncate text-[28px] leading-tight font-bold tracking-tight">
              {comuna ? comuna.nombre : 'Elige tu comuna'}
            </span>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" className="shrink-0 opacity-80">
              <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="block text-[15px] opacity-90">
            {comuna ? comuna.region.etiqueta : 'Para ver el clima y el radar de tu zona'}
          </span>
        </button>
        {ahora && (
          <div className="flex shrink-0 items-center gap-1" aria-label={`${Math.round(ahora.temperatura)} grados, ${cond.texto}`}>
            <IconoClima icono={cond.icono} esDeDia={ahora.esDeDia} size={36} />
            <span className="text-[26px] font-bold tabular-nums">{Math.round(ahora.temperatura)}°</span>
          </div>
        )}
      </div>

      {comuna && (
        <div className="border-t border-current/25">
          <div className="mx-auto max-w-xl px-4 py-2 text-[15px]">
            {sinFuente ? (
              <p>
                <strong>Alertas oficiales:</strong> todavía no están conectadas a esta app. Revisa{' '}
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
        </div>
      )}
    </header>
  )
}
