import { useEntrada } from '../hooks/useEntrada'
import GraficoLluvia from './GraficoLluvia'
import GraficoHoras from './GraficoHoras'
import Portada from './Portada'
import Semana from './Semana'
import Fichas from './Fichas'
import RiesgoAluvion from './RiesgoAluvion'
import MiraElCielo from './MiraElCielo'
import Resguardo from './Resguardo'
import EspacioEnVivo from './EspacioEnVivo'
import PulsoEnVivo from './PulsoEnVivo'
import Atajos from './Atajos'
import { riesgoAluvion } from '../services/aluvion'
import { climaInfo, condicionesActuales, intensidad } from '../services/clima'
import { hhmm } from '../services/formato'

const grados = (v) => `${Math.round(v)}°`
const num = (v, d = 1) => v.toLocaleString('es-CL', { maximumFractionDigits: d })
function Bloque({ titulo, children, id }) {
  return (
    <section aria-labelledby={id} className="tarjeta">
      <h2 id={id} className="titulo-tarjeta text-balance">
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

export default function VistaAhora({ clima, comuna, enLinea, nombre = null, resumen = null, invitacion = null, reportes = null, camaras = null, obs = null, sismos = null, reportesLista = null, onVerRios = () => {} }) {
  const { datos, error, recargar } = clima
  const entrada = useEntrada()

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
        {resumen}
        {invitacion}
        {reportes}
        <div id="t-camaras" className="scroll-mt-16">{camaras}</div>
      </div>
    )
  }

  const { horas, dias } = datos
  const ahora = condicionesActuales(datos.ahora, obs)
  const prox12 = horas.slice(0, 12)
  const lluviaAhora = !ahora.medido && ahora.lluvia > 0
  const hayLluvia = prox12.some((h) => h.lluvia > 0)
  // Con riesgo, la tarjeta de aluviones sube arriba; sin riesgo, queda más abajo.
  const urgenteAluvion = riesgoAluvion(horas)?.nivel !== 'bajo'
  const aluvion = <RiesgoAluvion horas={horas} onVerRios={onVerRios} />

  return (
    <div className={`${entrada} space-y-3 px-4 pt-3 pb-24`}>
      <Atajos />
      <Portada ahora={ahora} hoy={dias[0]} comuna={comuna} nombre={nombre} />
      {resumen}
      <PulsoEnVivo obtenido={datos.obtenido} sismos={sismos} reportes={reportesLista} enLinea={enLinea} />

      {invitacion}

      <p className="px-1 text-[14px] leading-snug text-texto-2">
        {ahora.medido ? (
          <>
            <strong className="text-texto">Medido a las {hhmm(ahora.estacion.hora)}</strong> en la estación {ahora.estacion.nombre}, a{' '}
            {num(ahora.estacion.distanciaKm, 0)} km. El modelo estimaba {grados(ahora.temperaturaModelo)}.
          </>
        ) : (
          <>
            <strong className="text-texto">Estimación del modelo</strong>: no hay una estación meteorológica con datos recientes cerca de{' '}
            {comuna.nombre}.
          </>
        )}
        {ahora.lloviendoEnEstacion && (
          <strong className="block text-lluvia-texto">Está lloviendo en la estación: {ahora.texto.toLowerCase()}.</strong>
        )}
        {lluviaAhora && (
          <strong className="block text-lluvia-texto">
            Lloviendo: {num(ahora.lluvia)} mm en la última hora (lluvia {intensidad(ahora.lluvia)}).
          </strong>
        )}
      </p>

      {urgenteAluvion && aluvion}

      <Bloque titulo="Próximas 24 horas" id="t-horas">
        {/* La primera columna ("Ahora") muestra lo mismo que la portada. */}
        <GraficoHoras horas={[{ ...horas[0], temperatura: ahora.temperatura, codigo: datos.ahora.codigo, texto: ahora.texto, esDeDia: ahora.esDeDia, viento: ahora.viento, rafagas: ahora.rafagas, direccion: ahora.direccion }, ...horas.slice(1)]} />
      </Bloque>

      {hayLluvia && (
        <Bloque titulo="Lluvia en las próximas 12 horas" id="t-lluvia">
          <p className="mb-2 text-[16px]">{resumenLluvia(prox12)}</p>
          <GraficoLluvia horas={prox12} />
        </Bloque>
      )}

      {reportes}

      <div id="t-camaras" className="scroll-mt-16">{camaras}</div>

      <Bloque titulo="Próximos 7 días" id="t-dias">
        <Semana dias={dias} actual={ahora.temperatura} />
      </Bloque>

      {!urgenteAluvion && aluvion}

      <Resguardo>
        <span id="t-cielo-ancla" className="block scroll-mt-16" />
        <MiraElCielo horas={horas} hoy={dias[0]} punto={datos.punto} comuna={comuna?.nombre} />
      </Resguardo>
      <Resguardo>
        <EspacioEnVivo punto={datos.punto} />
      </Resguardo>

      <h2 id="t-detalle" className="scroll-mt-16 px-1 pt-2 text-[19px] font-bold">Detalle de ahora</h2>
      <Fichas ahora={ahora} dias={dias} />

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
