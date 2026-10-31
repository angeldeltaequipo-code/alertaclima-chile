import { useState } from 'react'
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

/** Separador de grupos: ayuda a entender la página como 3 partes (pronóstico, tu zona, explorar). */
function Grupo({ children }) {
  return <h2 className="px-1 pt-4 text-[13px] font-black tracking-[0.14em] text-texto-2 uppercase">{children}</h2>
}

/** Cielo y espacio: contenido para curiosear, plegado para que la página principal sea corta. */
function Explorar({ horas, dias, punto, comuna }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <section aria-labelledby="t-cielo-ancla" className="scroll-mt-16">
      <button
        type="button"
        id="t-cielo-ancla"
        aria-expanded={abierto}
        onClick={() => setAbierto(!abierto)}
        className="explorar-boton flex min-h-16 w-full items-center gap-3 rounded-[24px] px-4 py-3 text-left text-white"
      >
        <span className="text-[30px]" aria-hidden="true">🔭</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[18px] font-bold">Cielo y espacio en vivo</span>
          <span className="block text-[14px] text-white/80">La Luna, los planetas sobre ti, observatorios, la Estación Espacial y el Sol.</span>
        </span>
        <svg width="18" height="18" viewBox="0 0 14 14" aria-hidden="true" style={{ transform: abierto ? 'rotate(180deg)' : 'none' }} className="shrink-0 transition-transform">
          <path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {abierto && (
        <div className="mt-3 space-y-3">
          <Resguardo>
            <MiraElCielo horas={horas} hoy={dias[0]} punto={punto} comuna={comuna} />
          </Resguardo>
          <Resguardo>
            <EspacioEnVivo punto={punto} />
          </Resguardo>
        </div>
      )}
    </section>
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

export default function VistaAhora({ clima, comuna, enLinea, nombre = null, resumen = null, invitacion = null, reportes = null, camaras = null, obs = null, sismos = null, reportesLista = null, onVerRios = () => {}, zumi = null, familia = null, cine = null }) {
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
      <Atajos />
      {zumi}
      <Portada ahora={ahora} hoy={dias[0]} comuna={comuna} nombre={nombre} />
      {resumen}
      {familia}
      {cine}
      <PulsoEnVivo obtenido={datos.obtenido} sismos={sismos} reportes={reportesLista} enLinea={enLinea} />

      {invitacion}

      {(ahora.lloviendoEnEstacion || lluviaAhora) && (
        <p className="rounded-2xl bg-lluvia/15 px-3 py-2 text-[15px] font-bold text-lluvia-texto" role="status">
          {ahora.lloviendoEnEstacion ? `Está lloviendo en la estación: ${ahora.texto.toLowerCase()}.` : `Lloviendo: ${num(ahora.lluvia)} mm en la última hora (lluvia ${intensidad(ahora.lluvia)}).`}
        </p>
      )}

      {urgenteAluvion && aluvion}

      <Grupo>Pronóstico</Grupo>
      <Bloque titulo="Próximas 24 horas" id="t-horas">
        {/* La primera columna ("Ahora") muestra lo mismo que la portada. */}
        <GraficoHoras horas={[{ ...horas[0], temperatura: ahora.temperatura, codigo: datos.ahora.codigo, texto: ahora.texto, esDeDia: ahora.esDeDia, viento: ahora.viento, rafagas: ahora.rafagas, direccion: ahora.direccion }, ...horas.slice(1)]} />
      </Bloque>

      <Bloque titulo="Próximos 7 días" id="t-dias">
        <Semana dias={dias} actual={ahora.temperatura} />
      </Bloque>

      {hayLluvia && (
        <Bloque titulo="Lluvia en las próximas 12 horas" id="t-lluvia">
          <p className="mb-2 text-[16px]">{resumenLluvia(prox12)}</p>
          <GraficoLluvia horas={prox12} />
        </Bloque>
      )}

      {!urgenteAluvion && aluvion}

      <Grupo>Tu zona</Grupo>
      {reportes}

      {camaras}

      <h2 id="t-detalle" className="scroll-mt-16 px-1 pt-2 text-[19px] font-bold">Detalle de ahora</h2>
      <Fichas ahora={ahora} dias={dias} />

      <Grupo>Explorar</Grupo>
      <Explorar horas={horas} dias={dias} punto={datos.punto} comuna={comuna?.nombre} />

      <p className="px-1 text-[13px] text-texto-2">
        Pronóstico de{' '}
        <a href={climaInfo.url} target="_blank" rel="noopener" className="underline">
          {climaInfo.nombre}
        </a>{' '}
        (CC BY 4.0), actualizado a las {hhmm(datos.obtenido)}.{' '}
        {ahora.medido
          ? `Temperatura medida a las ${hhmm(ahora.estacion.hora)} en la estación ${ahora.estacion.nombre}, a ${num(ahora.estacion.distanciaKm, 0)} km (el modelo estimaba ${grados(ahora.temperaturaModelo)})`
          : `Sin estación meteorológica cercana con datos recientes: la temperatura es una estimación del modelo`}
        {datos.punto?.aprox ? `. Punto aproximado dentro de la comuna.` : `, para la localidad de ${comuna.nombre}.`}
      </p>
    </div>
  )
}
