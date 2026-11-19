import Desplegable from './Desplegable'
import { useEntrada } from '../hooks/useEntrada'
import GraficoLluvia from './GraficoLluvia'
import GraficoHoras from './GraficoHoras'
import Portada from './Portada'
import Semana from './Semana'
import Fichas from './Fichas'
import RiesgoAluvion from './RiesgoAluvion'
const MiraElCielo = lazySeguro(() => import('./MiraElCielo'))
import Resguardo from './Resguardo'
const EspacioEnVivo = lazySeguro(() => import('./EspacioEnVivo'))
import PulsoEnVivo from './PulsoEnVivo'
import Funciones from './Funciones'
import { lazySeguro } from '../services/cargaSegura'
import HoyEnDiez from './HoyEnDiez'
import AireZumi from './AireZumi'
import EstoyBien from './EstoyBien'
import { leerGrupo } from '../services/familiaGPS'
const EspacioSpaceX = lazySeguro(() => import('./EspacioSpaceX'))
import { riesgoAluvion } from '../services/aluvion'
import { climaInfo, condicionesActuales, intensidad } from '../services/clima'
import { hhmm } from '../services/formato'

const grados = (v) => `${Math.round(v)}°`
const num = (v, d = 1) => v.toLocaleString('es-CL', { maximumFractionDigits: d })
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

/** Separador de grupos: ayuda a entender la página como 3 partes (pronóstico, tu zona, explorar). */
function Grupo({ children }) {
  return <h2 className="px-1 pt-4 text-[13px] font-black tracking-[0.14em] text-texto-2 uppercase">{children}</h2>
}

/** Pronóstico y detalle del clima (en la pestaña Riesgos), como secciones desplegables. */
export function InformesClima({ clima, obs, sismos, reportesLista, enLinea, onVerRios = () => {}, comuna }) {
  const datos = clima?.datos
  if (!datos) return null
  const { horas, dias } = datos
  const ahora = condicionesActuales(datos.ahora, obs)
  const prox12 = horas.slice(0, 12)
  const hayLluvia = prox12.some((h) => h.lluvia > 0)
  const urgenteAluvion = riesgoAluvion(horas)?.nivel !== 'bajo'
  return (
    <div className="space-y-3">
      <Grupo>Clima y pronóstico</Grupo>
      <Desplegable id="a-horas" icono="🕐" titulo="Próximas 24 horas" adelanto={`Ahora ${grados(ahora.temperatura)} · ${ahora.texto}`} tono="sol">
        <div className="tarjeta">
          <GraficoHoras horas={[{ ...horas[0], temperatura: ahora.temperatura, codigo: datos.ahora.codigo, texto: ahora.texto, esDeDia: ahora.esDeDia, viento: ahora.viento, rafagas: ahora.rafagas, direccion: ahora.direccion }, ...horas.slice(1)]} />
        </div>
      </Desplegable>
      <Desplegable id="a-dias" icono="📅" titulo="Próximos 7 días" adelanto={`Hoy máx. ${grados(dias[0].max)}, mín. ${grados(dias[0].min)} · mañana ${grados(dias[1]?.max ?? dias[0].max)}`} tono="cielo">
        <div className="tarjeta">
          <Semana dias={dias} actual={ahora.temperatura} />
        </div>
      </Desplegable>
      {hayLluvia && (
        <Desplegable id="a-lluvia" icono="🌧️" titulo="Lluvia en las próximas 12 horas" adelanto={resumenLluvia(prox12)} tono="lluvia">
          <div className="tarjeta">
            <p className="mb-2 text-[16px]">{resumenLluvia(prox12)}</p>
            <GraficoLluvia horas={prox12} />
          </div>
        </Desplegable>
      )}
      <Desplegable id="a-detalle" icono="🌡️" titulo="Detalle de ahora" adelanto={`Viento ${Math.round(ahora.viento ?? 0)} km/h · humedad ${Math.round(ahora.humedad ?? 0)} % · UV ${Math.round(dias[0].uv ?? 0)}`} tono="detalle">
        <Fichas ahora={ahora} dias={dias} />
      </Desplegable>
      {!urgenteAluvion && (
        <Desplegable id="a-aluvion" icono="⛰️" titulo="Aluviones y desbordes" adelanto="Riesgo bajo por ahora · ríos y quebradas cerca de ti" tono="vecinos">
          <RiesgoAluvion horas={horas} onVerRios={onVerRios} />
        </Desplegable>
      )}
      <Desplegable id="a-pulso" icono="📡" titulo="Pulso en vivo" adelanto="Lo último: sismos, avisos de vecinos y datos al minuto" tono="pulso">
        <PulsoEnVivo obtenido={datos.obtenido} sismos={sismos} reportes={reportesLista} enLinea={enLinea} />
      </Desplegable>
      <p className="px-1 text-[13px] text-texto-2">
        Pronóstico de{' '}
        <a href={climaInfo.url} target="_blank" rel="noopener" className="underline">
          {climaInfo.nombre}
        </a>{' '}
        (CC BY 4.0), actualizado a las {hhmm(datos.obtenido)}.{' '}
        {ahora.medido
          ? `Temperatura medida a las ${hhmm(ahora.estacion.hora)} en la estación ${ahora.estacion.nombre}, a ${num(ahora.estacion.distanciaKm, 0)} km.`
          : 'Sin estación meteorológica cercana con datos recientes: la temperatura es una estimación del modelo.'}
        {datos.punto?.aprox ? ' Punto aproximado dentro de la comuna.' : comuna ? ` Para la localidad de ${comuna.nombre}.` : ''}
      </p>
    </div>
  )
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

export default function VistaAhora({ clima, comuna, enLinea, nombre = null, resumen = null, invitacion = null, reportes = null, camaras = null, obs = null, sismos = null, reportesLista = null, onVerRios = () => {}, zumi = null, familia = null, emergencia = false }) {
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
        {camaras}
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
      {/* ZUMI es la portada: él te cuenta el clima y conversa contigo */}
      {zumi ? zumi({ hoy: dias[0] }) : <Portada ahora={ahora} hoy={dias[0]} comuna={comuna} nombre={nombre} />}
      {/* Después de un sismo fuerte o con alerta grave: un toque para que tu familia sepa que estás bien */}
      {emergencia && leerGrupo() && (
        <Resguardo>
          <EstoyBien compacto />
        </Resguardo>
      )}
      <Resguardo>
        <HoyEnDiez punto={datos.punto} horas={horas} dias={dias} ahora={ahora} />
      </Resguardo>
      {invitacion}

      {(ahora.lloviendoEnEstacion || lluviaAhora) && (
        <p className="rounded-2xl bg-lluvia/15 px-3 py-2 text-[15px] font-bold text-lluvia-texto" role="status">
          {ahora.lloviendoEnEstacion ? `Está lloviendo en la estación: ${ahora.texto.toLowerCase()}.` : `Lloviendo: ${num(ahora.lluvia)} mm en la última hora (lluvia ${intensidad(ahora.lluvia)}).`}
        </p>
      )}
      {urgenteAluvion && aluvion}

      {/* Las 4 funciones de ZUMI (el pronóstico, el detalle y los riesgos viven en la pestaña Riesgos) */}
      <Funciones
        familia={familia}
        reportes={reportes}
        nReportes={reportesLista?.length ?? 0}
        aire={
          <Resguardo>
            <AireZumi punto={datos.punto} comuna={comuna?.nombre} />
          </Resguardo>
        }
        cielo={
          <>
            <Resguardo>
              <EspacioSpaceX />
            </Resguardo>
            <Resguardo>
              <MiraElCielo horas={horas} hoy={dias[0]} punto={datos.punto} comuna={comuna?.nombre} />
            </Resguardo>
            <Resguardo>
              <EspacioEnVivo punto={datos.punto} />
            </Resguardo>
          </>
        }
      />
    </div>
  )
}
