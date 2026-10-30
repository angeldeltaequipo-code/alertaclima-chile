import { useState } from 'react'
import { FUENTES, TIPOS, ordenarParaMi, picos } from '../services/comunidad'
import { hace } from '../services/reportes'

const FILTROS = [['todo', 'Todo'], ...Object.entries(TIPOS).map(([k, v]) => [k, v.etiqueta])]

/**
 * Prensa y redes sociales sobre emergencias en Chile. Siempre marcado como NO oficial:
 * ayuda a enterarse rápido, pero las decisiones se toman con SENAPRED, SHOA y CSN.
 */
export default function LoQueSeComenta({ comunidad, items, comuna, max = 8 }) {
  const [filtro, setFiltro] = useState('todo')
  const [todos, setTodos] = useState(false)
  if (!comunidad?.datos && !comunidad?.error) {
    return (
      <section aria-labelledby="t-comunidad" className="tarjeta">
        <h2 id="t-comunidad" className="titulo-tarjeta">Lo que se comenta</h2>
        <p className="mt-2 text-texto-2">Revisando prensa y redes…</p>
      </section>
    )
  }
  const lista = ordenarParaMi(items ?? []).filter((i) => filtro === 'todo' || i.tipo === filtro)
  const presentes = new Set((items ?? []).map((i) => i.tipo))
  const ps = picos(comunidad.datos?.tendencias)
  const fuentesOk = Object.entries(comunidad.datos?.fuentes ?? {})
    .filter(([, f]) => f.ok)
    .map(([k]) => ({ google: 'Google Noticias', gdelt: 'GDELT', reddit: 'Reddit', bluesky: 'Bluesky', mastodon: 'Mastodon', x: 'X' })[k] ?? k)

  return (
    <section aria-labelledby="t-comunidad" className="tarjeta">
      <div className="flex items-start justify-between gap-2">
        <h2 id="t-comunidad" className="titulo-tarjeta">Lo que se comenta</h2>
        <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[12px] font-black tracking-wide text-amber-600 dark:text-amber-300 uppercase">No oficial</span>
      </div>
      <p className="mt-1 text-[14px] text-texto-2">
        Prensa y redes sociales de las últimas horas{comuna ? `, primero lo de tu zona` : ''}. Puede haber errores o rumores: confirma en{' '}
        <a href="https://senapred.cl" target="_blank" rel="noopener" className="font-bold underline underline-offset-2">senapred.cl</a>.
      </p>

      {ps.length > 0 && (
        <div role="status" className="mt-3 rounded-xl border-2 border-amber-500 bg-amber-500/10 px-3 py-2 text-[15px]">
          <strong>Mucha gente está hablando de: {ps.map((p) => p.etiqueta.toLowerCase()).join(', ')}.</strong> {ps[0].ultimaHora} menciones en la última hora. Mira las fuentes oficiales.
        </div>
      )}

      {presentes.size > 1 && (
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" role="radiogroup" aria-label="Filtrar por tema">
          {FILTROS.filter(([k]) => k === 'todo' || presentes.has(k)).map(([k, t]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={filtro === k}
              onClick={() => setFiltro(k)}
              className={`min-h-9 shrink-0 rounded-full px-3 text-[13px] font-bold ${filtro === k ? 'bg-senal text-sobre-senal' : 'bg-current/5 ring-1 ring-linea'}`}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {lista.length === 0 ? (
        <p className="mt-3 text-texto-2">{comunidad.error ? 'No pudimos revisar prensa y redes ahora.' : 'No hay comentarios de emergencias en las últimas horas. ¡Buena señal!'}</p>
      ) : (
        <ul className="mt-3 divide-y divide-linea">
          {lista.slice(0, todos ? 40 : max).map((it, i) => (
            <li key={`${it.url ?? it.texto}-${i}`} className="py-2.5">
              <div className="flex flex-wrap items-center gap-1.5 text-[12px] font-bold">
                <span className="rounded-full px-2 py-0.5 text-white" style={{ background: TIPOS[it.tipo]?.color ?? '#64748b' }}>
                  {TIPOS[it.tipo]?.etiqueta ?? it.tipo}
                </span>
                <span className="text-texto-2">
                  {FUENTES[it.fuente] ?? it.fuente}
                  {it.medio && it.fuente === 'noticias' ? ` · ${it.medio}` : it.fuente === 'reddit' ? ` · ${it.medio}` : ''}
                  {it.hora ? ` · ${hace(new Date(it.hora))}` : ''}
                </span>
                {(it.enMiComuna || it.enMiRegion) && <span className="rounded-full bg-senal px-2 py-0.5 text-sobre-senal">{it.enMiComuna ? 'Tu comuna' : 'Tu región'}</span>}
              </div>
              {it.url ? (
                <a href={it.url} target="_blank" rel="noopener noreferrer nofollow" className="mt-1 block text-[15px] leading-snug hover:underline">
                  {it.texto}
                </a>
              ) : (
                <p className="mt-1 text-[15px] leading-snug">{it.texto}</p>
              )}
              {it.lugares?.length > 0 && <p className="mt-0.5 text-[12px] text-texto-2">📍 {it.lugares.join(', ')}</p>}
            </li>
          ))}
        </ul>
      )}
      {lista.length > max && (
        <button type="button" onClick={() => setTodos(!todos)} className="mt-1 min-h-10 font-bold underline underline-offset-2">
          {todos ? 'Ver menos' : `Ver ${Math.min(lista.length, 40) - max} más`}
        </button>
      )}
      <p className="mt-2 text-[12px] text-texto-2">
        Fuentes revisadas: {fuentesOk.length ? fuentesOk.join(', ') : '—'}. No guardamos nombres de usuarios.
        {!comunidad.datos?.x && ' X (Twitter) se suma cuando se conecte su API.'}
      </p>
    </section>
  )
}
