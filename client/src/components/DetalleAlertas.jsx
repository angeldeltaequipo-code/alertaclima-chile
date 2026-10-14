import Hoja from './Hoja'
import { FUENTE_OFICIAL, NIVELES } from '../services/alertas'
import { hhmm } from '../services/formato'

const fecha = (d) =>
  `${d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })}, ${hhmm(d)}`

/** Todas las alertas oficiales de la comuna, con su fuente y qué hacer. */
export default function DetalleAlertas({ comuna, estado, onCerrar }) {
  const alertas = [...(estado?.alertas ?? [])].sort(
    (a, b) => a.sin_confirmar - b.sin_confirmar || NIVELES[b.nivel].gravedad - NIVELES[a.nivel].gravedad,
  )
  return (
    <Hoja titulo={`Alertas oficiales en ${comuna.nombre}`} onCerrar={onCerrar}>
      <div className="space-y-3 px-4 py-4">
        {alertas.map((a) => {
          const n = NIVELES[a.nivel]
          return (
            <article key={a.id} className="overflow-hidden rounded-xl border-2 border-borde bg-superficie">
              <header
                className="px-4 py-3"
                style={
                  a.sin_confirmar
                    ? undefined
                    : { background: `var(--nivel-${n.clave}-fondo)`, color: `var(--nivel-${n.clave}-texto)` }
                }
              >
                <p className="text-[19px] leading-tight font-bold">{n.etiqueta}</p>
                <p className="text-[16px]">{a.amenaza}</p>
              </header>
              <div className="space-y-2 px-4 py-3 text-[16px]">
                {a.sin_confirmar && (
                  <p className="font-bold text-senal-texto">
                    Sin confirmar desde {fecha(a.confirmada_en)}. Puede que ya no esté vigente: revisa la fuente antes de
                    actuar.
                  </p>
                )}
                <h3 className="text-[18px] font-bold">{a.titulo}</h3>
                {a.descripcion && <p className="whitespace-pre-line">{a.descripcion}</p>}
                {a.instrucciones && (
                  <div>
                    <p className="font-bold">Qué hacer</p>
                    <p className="whitespace-pre-line">{a.instrucciones}</p>
                  </div>
                )}
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[15px] text-texto-2">
                  <dt>Vigente desde</dt>
                  <dd>{fecha(a.vigente_desde)}</dd>
                  <dt>Hasta</dt>
                  <dd>{a.vigente_hasta ? fecha(a.vigente_hasta) : 'nuevo aviso'}</dd>
                  <dt>Verificada</dt>
                  <dd>{fecha(a.confirmada_en)}</dd>
                </dl>
                <a
                  href={a.fuente_url}
                  target="_blank"
                  rel="noopener"
                  className="flex min-h-12 items-center justify-center rounded-lg border-2 border-borde text-[16px] font-bold"
                >
                  Ver en {a.fuente_nombre}
                </a>
              </div>
            </article>
          )
        })}
        <p className="text-[14px] text-texto-2">
          AlertaClima muestra alertas copiadas de fuentes oficiales por su equipo. Ante cualquier duda, manda lo que diga{' '}
          <a href={FUENTE_OFICIAL.url} target="_blank" rel="noopener" className="underline">
            SENAPRED
          </a>{' '}
          y tu municipalidad. En una emergencia, llama al 133 (Carabineros), 132 (Bomberos) o 131 (SAMU).
        </p>
      </div>
    </Hoja>
  )
}
