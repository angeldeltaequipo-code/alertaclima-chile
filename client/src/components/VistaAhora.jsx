import IconoClima from './IconoClima'
import GraficoLluvia from './GraficoLluvia'
import { climaInfo, condicionesActuales, describir, direccionViento, intensidad } from '../services/clima'
import { hhmm } from '../services/formato'

const grados = (v) => `${Math.round(v)}°`
const num = (v, d = 1) => v.toLocaleString('es-CL', { maximumFractionDigits: d })
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

function nombreDia(f, i) {
  if (i === 0) return 'Hoy'
  if (i === 1) return 'Mañana'
  return `${DIAS[f.getDay()]} ${f.getDate()}`
}

function Bloque({ titulo, children, id }) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border-2 border-borde bg-superficie px-4 py-4">
      <h2 id={id} className="mb-3 text-[19px] font-bold text-balance">
        {titulo}
      </h2>
      {children}
    </section>
  )
}

/** Resumen en palabras de la lluvia de las próximas 12 horas. */
function resumenLluvia(horas) {
  const total = horas.reduce((s, h) => s + h.lluvia, 0)
  if (total < 0.2) {
    const prob = Math.max(...horas.map((h) => h.probabilidad ?? 0))
    return prob >= 30
      ? `No se espera lluvia importante, aunque hay hasta ${prob} % de probabilidad de chubascos.`
      : 'No se espera lluvia en las próximas 12 horas.'
  }
  const max = horas.reduce((a, b) => (b.lluvia > a.lluvia ? b : a))
  const fin = horas[horas.length - 1].hora
  return `Se esperan ${num(total)} mm hasta las ${hhmm(fin)}. Lo más intenso, cerca de las ${hhmm(max.hora)}: ${num(max.lluvia)} mm en esa hora (lluvia ${intensidad(max.lluvia)}).`
}

function Cargando() {
  return (
    <div className="space-y-3" role="status" aria-label="Cargando el clima">
      {[140, 220, 120].map((h) => (
        <div key={h} className="animate-pulse rounded-2xl bg-superficie" style={{ height: h }} />
      ))}
    </div>
  )
}

export default function VistaAhora({ clima, comuna, enLinea, reportes = null, obs = null }) {
  const { datos, error, recargar } = clima

  // Sin datos del clima, los reportes vecinales se muestran igual: no dependen de este servicio.
  if (!datos) {
    let estado
    if (error)
      estado = (
        <div className="py-2">
          <p className="text-[17px]">
            <strong>No se pudo cargar el clima.</strong> {error}.
          </p>
          <button type="button" onClick={recargar} className="mt-3 min-h-12 rounded-lg bg-senal px-5 font-bold text-sobre-senal">
            Reintentar
          </button>
        </div>
      )
    else if (!enLinea)
      estado = <p className="py-2 text-[17px]">Sin señal. El clima de {comuna.nombre} se carga apenas vuelva la conexión.</p>
    else estado = <Cargando />
    return (
      <div className="space-y-3 px-4 py-4">
        {estado}
        {reportes}
      </div>
    )
  }

  const { horas, dias } = datos
  const ahora = condicionesActuales(datos.ahora, obs)
  const { texto, icono } = ahora
  const prox12 = horas.slice(0, 12)
  const semMin = Math.min(...dias.map((d) => d.min))
  const semMax = Math.max(...dias.map((d) => d.max))
  const rango = Math.max(1, semMax - semMin)
  const lluviaAhora = !ahora.medido && ahora.lluvia > 0
  const hayLluvia = prox12.some((h) => h.lluvia > 0)

  return (
    <div className="space-y-3 px-4 pt-4 pb-6">
      {/* Ahora */}
      <section aria-label="Condiciones actuales" className="px-1 pb-1">
        <div className="flex items-center gap-4">
          <IconoClima icono={icono} esDeDia={ahora.esDeDia} size={84} />
          <div className="min-w-0">
            <p className="text-[76px] leading-[0.9] font-bold tracking-tight tabular-nums">{grados(ahora.temperatura)}</p>
            <p className="mt-1 text-[20px] font-bold">{texto}</p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-[15px]">
          <div>
            <dt className="text-texto-2">Sensación</dt>
            <dd className="text-[19px] font-bold tabular-nums">{grados(ahora.sensacion)}</dd>
          </div>
          <div>
            <dt className="text-texto-2">Viento</dt>
            <dd className="text-[19px] font-bold tabular-nums">
              {Math.round(ahora.viento)} <span className="text-[14px] font-normal">km/h</span>
            </dd>
          </div>
          <div>
            <dt className="text-texto-2">Ráfagas</dt>
            <dd className="text-[19px] font-bold tabular-nums">
              {Math.round(ahora.rafagas)} <span className="text-[14px] font-normal">km/h</span>
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-[15px] text-texto-2">
          {ahora.medido ? (
            <span className="block">
              <strong className="text-texto">Medido a las {hhmm(ahora.estacion.hora)}</strong> en la estación{' '}
              {ahora.estacion.nombre}, a {num(ahora.estacion.distanciaKm, 0)} km. El modelo estimaba{' '}
              {grados(ahora.temperaturaModelo)}.
            </span>
          ) : (
            <span className="block">
              <strong className="text-texto">Estimación del modelo</strong>: no hay una estación meteorológica con datos
              recientes cerca de {comuna.nombre}.
            </span>
          )}
          {ahora.lloviendoEnEstacion && (
            <strong className="block text-lluvia-texto">Está lloviendo en la estación: {ahora.texto.toLowerCase()}.</strong>
          )}
          {lluviaAhora ? (
            <>
              <strong className="text-lluvia-texto">
                Lloviendo: {num(ahora.lluvia)} mm en la última hora
              </strong>{' '}
              (lluvia {intensidad(ahora.lluvia)}).{' '}
            </>
          ) : null}
          {!ahora.medido && `Viento del ${direccionViento(ahora.direccion)}. `}Humedad {ahora.humedad} %.
        </p>
      </section>

      {reportes}

      <Bloque titulo="Lluvia en las próximas 12 horas" id="t-lluvia">
        <p className={hayLluvia ? 'mb-2 text-[16px]' : 'text-[16px]'}>{resumenLluvia(prox12)}</p>
        {hayLluvia && <GraficoLluvia horas={prox12} />}
      </Bloque>

      <Bloque titulo="Hora a hora" id="t-horas">
        <ol className="-mx-4 flex snap-x gap-1 overflow-x-auto px-4 pb-1">
          {horas.map((h, i) => {
            const d = describir(h.codigo)
            return (
              <li key={i} className="flex w-[58px] shrink-0 snap-start flex-col items-center gap-1 py-1 text-center">
                <span className="text-[14px] text-texto-2 tabular-nums">{i === 0 ? 'Ahora' : hhmm(h.hora).slice(0, 2) + ' h'}</span>
                <IconoClima icono={d.icono} esDeDia={h.esDeDia} size={32} titulo={d.texto} />
                <span className="text-[17px] font-bold tabular-nums">{grados(h.temperatura)}</span>
                <span className="text-[13px] text-lluvia-texto tabular-nums">
                  {h.lluvia > 0 ? `${num(h.lluvia)} mm` : h.probabilidad ? `${h.probabilidad} %` : ' '}
                </span>
              </li>
            )
          })}
        </ol>
      </Bloque>

      <Bloque titulo="Próximos 7 días" id="t-dias">
        <ul className="divide-y divide-borde/50">
          {dias.map((d, i) => {
            const desc = describir(d.codigo)
            const iz = ((d.min - semMin) / rango) * 100
            const an = Math.max(6, ((d.max - d.min) / rango) * 100)
            return (
              <li key={i} className="grid grid-cols-[4.6rem_32px_4.2rem_1fr] items-center gap-2 py-2">
                <span className="text-[16px] font-bold">{nombreDia(d.fecha, i)}</span>
                <IconoClima icono={desc.icono} size={30} titulo={desc.texto} />
                <span className="text-[14px] text-lluvia-texto tabular-nums">{d.lluvia >= 0.1 ? `${num(d.lluvia)} mm` : ''}</span>
                <span className="flex items-center gap-2 text-[16px] tabular-nums">
                  <span className="w-8 text-right text-texto-2">{grados(d.min)}</span>
                  <span className="relative h-1.5 flex-1 rounded-full bg-grilla" aria-hidden="true">
                    <span
                      className="absolute inset-y-0 rounded-full bg-texto-2"
                      style={{ left: `${iz}%`, width: `${Math.min(an, 100 - iz)}%` }}
                    />
                  </span>
                  <span className="w-8 font-bold">{grados(d.max)}</span>
                </span>
              </li>
            )
          })}
        </ul>
      </Bloque>

      <p className="px-1 text-[13px] text-texto-2">
        Pronóstico de{' '}
        <a href={climaInfo.url} target="_blank" rel="noopener" className="underline">
          {climaInfo.nombre}
        </a>{' '}
        (CC BY 4.0), actualizado a las {hhmm(datos.obtenido)}
        {datos.punto?.aprox ? `. Punto aproximado dentro de la comuna.` : `, para la localidad de ${comuna.nombre}.`}
      </p>
    </div>
  )
}
