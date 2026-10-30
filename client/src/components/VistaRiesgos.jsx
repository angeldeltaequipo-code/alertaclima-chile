import { useEntrada } from '../hooks/useEntrada'
import { useState } from 'react'
import MapaSismos from './MapaSismos'
import LoQueSeComenta from './LoQueSeComenta'
import { picos } from '../services/comunidad'
import { GUIAS, colorMagnitud, descripcionMagnitud, distanciaKm, volcanesCercanos } from '../services/riesgos'
import { hace } from '../services/reportes'

const num = (v, d = 1) => v.toLocaleString('es-CL', { maximumFractionDigits: d })

const ir = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

/** Resumen de un vistazo: cada fila dice si hay algo de qué preocuparse y lleva a su detalle. */
function Resumen({ datos, comuna, amenaza, cercaUltimo, volcanesNoticia, picos }) {
  const filas = [
    {
      id: 't-tsunami',
      ok: !amenaza,
      titulo: 'Tsunami',
      texto: amenaza ? 'Hay un boletín de amenaza. Sigue al SHOA y SENAPRED.' : 'Sin amenaza en el Pacífico (48 h). Oficial: SHOA',
      enlace: amenaza ? null : 'https://www.shoa.cl/',
    },
    {
      id: 't-sismos',
      ok: !cercaUltimo || cercaUltimo.magnitud < 5,
      titulo: 'Sismos cerca',
      texto: cercaUltimo ? `Último: magnitud ${num(cercaUltimo.magnitud)}, ${hace(new Date(cercaUltimo.hora))}` : 'Ninguno a menos de 300 km esta semana',
    },
    {
      id: 't-volcanes',
      ok: !volcanesNoticia.length,
      titulo: 'Volcanes',
      texto: volcanesNoticia.length ? `En las noticias: ${volcanesNoticia.slice(0, 2).join(', ')}` : datos?.volcanesConocidos ? 'Sin actividad destacada' : 'Sin novedades en la prensa',
    },
    {
      id: 't-comunidad',
      ok: !picos,
      titulo: 'Lo que se comenta',
      texto: picos ? `Mucha gente habla de: ${picos}` : 'Nada fuera de lo normal',
    },
  ]
  return (
    <section aria-labelledby="t-resumen-riesgos" className="riesgos-tierra relative overflow-hidden rounded-[28px] px-4 pt-5 pb-4 text-white">
      <div className="cielo-estrellas" aria-hidden="true" />
      <div className="relative">
        <p className="text-[12px] font-bold tracking-[0.2em] text-sky-200/90 uppercase">Planeta en vivo</p>
        <h2 id="t-resumen-riesgos" className="mt-0.5 text-[24px] leading-tight font-bold">
          Riesgos {comuna ? `para ${comuna.nombre}` : 'en Chile'}
        </h2>
        <ul className="mt-3 space-y-1.5">
          {filas.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => (f.enlace ? window.open(f.enlace, '_blank', 'noopener') : ir(f.id))} className="flex min-h-12 w-full items-center gap-3 rounded-2xl bg-white/10 px-3 py-2 text-left backdrop-blur active:bg-white/20">
                <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[15px] font-black ${f.ok ? 'bg-emerald-400 text-emerald-950' : 'bg-amber-400 text-amber-950'}`} aria-hidden="true">
                  {f.ok ? '✓' : '!'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold">{f.titulo}</span>
                  <span className="block truncate text-[13px] text-white/80">{f.texto}</span>
                </span>
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0 opacity-70">
                  <path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Guia({ id }) {
  const [abierta, setAbierta] = useState(false)
  const g = GUIAS[id]
  return (
    <div className="rounded-2xl bg-superficie-2">
      <button type="button" onClick={() => setAbierta(!abierta)} aria-expanded={abierta} className="flex min-h-12 w-full items-center justify-between px-3 text-left text-[16px] font-bold">
        {g.titulo}
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style={{ transform: abierta ? 'rotate(180deg)' : 'none' }}>
          <path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {abierta && (
        <ol className="list-decimal space-y-1 px-3 pb-3 pl-8 text-[15px] leading-snug">
          {g.pasos.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ol>
      )}
    </div>
  )
}

function Sismo({ s, punto }) {
  const d = descripcionMagnitud(s.magnitud)
  const km = punto ? Math.round(distanciaKm(punto, s)) : null
  return (
    <li>
      <a href={s.url} target="_blank" rel="noopener" className="flex items-center gap-3 rounded-2xl px-2 py-2 active:bg-superficie-2">
        <span
          className="grid size-12 shrink-0 place-items-center rounded-2xl text-[17px] font-bold text-white tabular-nums"
          style={{ background: colorMagnitud(s.magnitud), boxShadow: `0 0 18px -4px ${colorMagnitud(s.magnitud)}` }}
          aria-label={`Magnitud ${num(s.magnitud)}`}
        >
          {num(s.magnitud)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-bold first-letter:uppercase">{s.lugar ?? 'Chile'}</span>
          <span className="block text-[13px] text-texto-2">
            {d.texto} · {hace(new Date(s.hora))}
            {s.profundidadKm != null ? ` · ${s.profundidadKm} km de profundidad` : ''}
          </span>
        </span>
        {km != null && <span className="shrink-0 text-[13px] font-bold text-texto-2 tabular-nums">{km < 1000 ? `${km} km` : ''}</span>}
      </a>
    </li>
  )
}

/** Pestaña Riesgos: sismos de los últimos 7 días, tsunamis y volcanes cercanos. */
export default function VistaRiesgos({ riesgos, punto, comuna, onVerMapa, onVerVolcanes, comunidad, comunidadItems, volcanesNivel }) {
  const [todos, setTodos] = useState(false)
  const entrada = useEntrada()
  const datos = riesgos.datos
  const sismos = datos?.sismos ?? []
  const fuertes = sismos.filter((s) => s.magnitud >= 4)
  const cerca = punto ? sismos.filter((s) => distanciaKm(punto, s) <= 300) : []
  const mayor = sismos.reduce((a, b) => (b.magnitud > (a?.magnitud ?? 0) ? b : a), null)
  const lista = todos ? sismos : sismos.slice(0, 8)
  const volcanes = (punto ? volcanesCercanos(punto, datos?.volcanes ?? []) : []).map((v) => {
    const n = volcanesNivel?.find((x) => x.nombre === v.nombre)
    if (n?.origen === 'prensa' && !v.actividad) return { ...v, prensa: n }
    if (n?.noticia && !v.actividad) return { ...v, noticia: n.noticia }
    return v
  })
  const amenaza = (datos?.tsunami ?? []).find((t) => t.nivel !== 'informacion')
  const picosTexto = picos(comunidad?.datos?.tendencias).map((p) => p.etiqueta.toLowerCase()).join(', ')

  return (
    <div className={`${entrada} space-y-3 px-4 pt-4 pb-8`}>
      <Resumen
        datos={datos}
        comuna={comuna}
        amenaza={amenaza}
        cercaUltimo={cerca[0] ?? null}
        volcanesNoticia={(volcanesNivel ?? []).filter((v) => v.noticia || v.origen === 'prensa').map((v) => v.nombre)}
        picos={picosTexto}
      />

      {!datos && (
        <p className="tarjeta text-[16px] text-texto-2" role="status">
          {riesgos.error ?? 'Cargando la actividad sísmica y volcánica…'}
        </p>
      )}

      {datos && (
        <>
          {/* Tsunami: tarjeta propia solo si hay amenaza (si no, basta la fila del resumen) */}
          {amenaza && (
          <section aria-labelledby="t-tsunami" className="tarjeta ring-2 ring-peligro">
            <h2 id="t-tsunami" className="titulo-tarjeta flex items-center gap-2">
              <span className={`size-3 rounded-full ${amenaza ? 'bg-peligro' : 'bg-ok'}`} aria-hidden="true" />
              Tsunami
            </h2>
            {amenaza ? (
              <p className="text-[16px] font-bold">
                Boletín del Centro de Alerta de Tsunamis del Pacífico: sismo de magnitud {amenaza.magnitud ?? '—'} en {amenaza.zona.toLowerCase()}.
                Sigue las instrucciones del SHOA y de SENAPRED.
              </p>
            ) : (
              <p className="text-[16px]">Sin boletines de amenaza de tsunami en el Pacífico en las últimas 48 horas.</p>
            )}
            <p className="mt-2 text-[13px] text-texto-2">
              En Chile, la alerta oficial la dan el{' '}
              <a href="https://www.shoa.cl/" target="_blank" rel="noopener" className="underline">
                SHOA
              </a>{' '}
              y{' '}
              <a href="https://senapred.cl/" target="_blank" rel="noopener" className="underline">
                SENAPRED
              </a>
              .
            </p>
          </section>
          )}

          {/* Sismos */}
          <section aria-labelledby="t-sismos" className="tarjeta">
            <div className="flex items-center justify-between gap-2">
              <h2 id="t-sismos" className="titulo-tarjeta !mb-0">
                Sismos en Chile
              </h2>
              <button type="button" onClick={onVerMapa} className="min-h-10 rounded-full bg-superficie-2 px-3 text-[14px] font-bold">
                Ver en el mapa
              </button>
            </div>
            <div className="mt-3">
              <MapaSismos sismos={sismos} punto={punto} />
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-superficie-2 py-2">
                <dt className="text-[12px] font-bold text-texto-2">7 días</dt>
                <dd className="text-[22px] font-bold tabular-nums">{sismos.length}</dd>
              </div>
              <div className="rounded-2xl bg-superficie-2 py-2">
                <dt className="text-[12px] font-bold text-texto-2">Magnitud 4+</dt>
                <dd className="text-[22px] font-bold tabular-nums">{fuertes.length}</dd>
              </div>
              <div className="rounded-2xl bg-superficie-2 py-2">
                <dt className="text-[12px] font-bold text-texto-2">A 300 km de ti</dt>
                <dd className="text-[22px] font-bold tabular-nums">{cerca.length}</dd>
              </div>
            </dl>
            {mayor && (
              <p className="mt-3 text-[15px] text-texto-2">
                El mayor de la semana: <strong className="text-texto">magnitud {num(mayor.magnitud)}</strong> {mayor.lugar}.
              </p>
            )}
            <ul className="-mx-2 mt-2">
              {lista.map((s) => (
                <Sismo key={s.id} s={s} punto={punto} />
              ))}
            </ul>
            {sismos.length > 8 && (
              <button type="button" onClick={() => setTodos(!todos)} className="mt-1 min-h-11 w-full rounded-xl bg-superficie-2 text-[15px] font-bold">
                {todos ? 'Ver menos' : `Ver los ${sismos.length} sismos`}
              </button>
            )}
            <p className="mt-2 text-[12px] text-texto-2">
              Datos: Servicio Geológico de EE.UU. (USGS), magnitud 2,5 o más. Para el informe oficial chileno, revisa el{' '}
              <a href="https://www.sismologia.cl/" target="_blank" rel="noopener" className="underline">
                Centro Sismológico Nacional
              </a>
              .
            </p>
          </section>

          {/* Volcanes */}
          <section aria-labelledby="t-volcanes" className="tarjeta">
            <h2 id="t-volcanes" className="titulo-tarjeta">
              Volcanes cerca de {comuna?.nombre ?? 'ti'}
            </h2>
            <ul className="space-y-2">
              {volcanes.map((v) => (
                <li key={v.nombre} className="flex items-center gap-3 rounded-2xl bg-superficie-2 px-3 py-2">
                  <span className="volcan-icono" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-bold">{v.nombre}</span>
                    <span className="block text-[13px] text-texto-2">
                      {v.actividad ? `${v.actividad.estado}${v.actividad.nivel ? ` · alerta técnica ${v.actividad.nivel}` : ''}` : v.prensa ? `Alerta ${v.prensa.nivel.toLowerCase()} según la prensa (confirmar en SERNAGEOMIN)` : v.noticia ? `En las noticias: ${v.noticia.texto}` : datos.volcanesConocidos ? 'Sin actividad destacada esta semana' : 'Revisa su nivel en SERNAGEOMIN'}
                    </span>
                  </span>
                  <span className="shrink-0 text-[14px] font-bold tabular-nums">{v.distanciaKm} km</span>
                </li>
              ))}
            </ul>
            {(datos.volcanes ?? []).length > 0 && (
              <p className="mt-3 text-[14px]">
                Con actividad en Chile esta semana:{' '}
                <strong>{datos.volcanes.map((v) => `${v.nombre}${v.nivel ? ` (${v.nivel.toLowerCase()})` : ''}`).join(', ')}</strong>.
              </p>
            )}
            <p className="mt-2 text-[12px] text-texto-2">
              {datos.volcanesConocidos ? 'Fuente: reporte semanal del Smithsonian, que cita a SERNAGEOMIN.' : 'No pudimos consultar el reporte semanal de actividad.'} Niveles oficiales en la{' '}
              <a href="https://rnvv.sernageomin.cl/" target="_blank" rel="noopener" className="underline">
                Red Nacional de Vigilancia Volcánica
              </a>
              .
            </p>
            {onVerVolcanes && (
              <button type="button" onClick={onVerVolcanes} className="mt-3 min-h-11 w-full rounded-xl bg-senal px-3 font-bold text-sobre-senal">
                Ver los 31 volcanes en el mapa
              </button>
            )}
          </section>
        </>
      )}

      {comunidad && <LoQueSeComenta comunidad={comunidad} items={comunidadItems} comuna={comuna} />}

      <section aria-labelledby="t-guias" className="tarjeta">
        <h2 id="t-guias" className="titulo-tarjeta">
          Qué hacer
        </h2>
        <div className="space-y-2">
          <Guia id="terremoto" />
          <Guia id="tsunami" />
          <Guia id="volcan" />
        </div>
      </section>
    </div>
  )
}
