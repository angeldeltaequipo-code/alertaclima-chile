import { COLOR_VOLCAN, distanciaKm } from '../services/riesgos'

/** Ficha de un volcán tocado en el mapa: nivel, de dónde viene el dato y a cuánto está. */
export default function FichaVolcan({ volcan: v, punto, onCerrar }) {
  const km = punto ? Math.round(distanciaKm(punto, v)) : null
  const nivel = v.nivel
  return (
    <div className="rounded-2xl border-2 border-borde bg-superficie p-3 shadow-xl" role="dialog" aria-label={`Volcán ${v.nombre}`}>
      <div className="flex items-start gap-3">
        <span className="mt-1 size-4 shrink-0 rotate-0" aria-hidden="true" style={{ background: COLOR_VOLCAN[nivel ?? (v.noticia ? 'noticia' : 'sin')], clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }} />
        <div className="min-w-0 flex-1">
          <p className="text-[19px] leading-tight font-bold">Volcán {v.nombre}</p>
          <p className="mt-0.5 text-[15px]">
            {nivel ? (
              <>
                Alerta técnica <strong>{nivel.toLowerCase()}</strong>
                {v.origen === 'prensa' ? ' según la prensa (no confirmado)' : ' (reporte semanal oficial)'}
              </>
            ) : v.noticia ? (
              'Aparece en las noticias de hoy (lee abajo)'
            ) : (
              'Sin nivel informado esta semana'
            )}
            {km != null && ` · a ${km} km de ti`}
          </p>
          {v.estado && <p className="mt-1 text-[14px] text-texto-2">{v.estado}</p>}
          {v.noticia?.url && (
            <a href={v.noticia.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 block text-[14px] underline underline-offset-2">
              {v.noticia.texto}
            </a>
          )}
          <a href="https://rnvv.sernageomin.cl/" target="_blank" rel="noopener" className="mt-2 inline-flex min-h-10 items-center font-bold underline underline-offset-2">
            Nivel oficial en SERNAGEOMIN
          </a>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid size-10 shrink-0 place-items-center rounded-full text-[22px]">
          ×
        </button>
      </div>
    </div>
  )
}
