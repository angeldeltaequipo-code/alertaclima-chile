import { useMemo, useState } from 'react'
import { regiones } from '../../services/comunas'
import { NIVELES } from '../../services/alertas'

const AMENAZAS = [
  'Sistema frontal',
  'Precipitaciones intensas',
  'Desborde de cauces',
  'Remoción en masa',
  'Viento intenso',
  'Tormenta eléctrica',
  'Marejadas',
  'Nevadas',
]

const campo =
  'min-h-12 w-full rounded-lg border-2 border-borde bg-superficie px-3 text-[16px] text-texto placeholder:text-texto-2'
const etiqueta = 'mb-1 block text-[15px] font-bold'

// "2026-10-14T18:30" en la hora del navegador, para <input type="datetime-local">
const aLocal = (d) => {
  if (!d) return ''
  const x = new Date(d)
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset())
  return x.toISOString().slice(0, 16)
}

/** Formulario para cargar o corregir una alerta oficial copiada de su fuente. */
export default function FormAlerta({ inicial, onGuardar, onCancelar }) {
  const [d, setD] = useState(() => ({
    nivel: inicial?.nivel ?? '',
    amenaza: inicial?.amenaza ?? '',
    titulo: inicial?.titulo ?? '',
    descripcion: inicial?.descripcion ?? '',
    instrucciones: inicial?.instrucciones ?? '',
    fuente_nombre: inicial?.fuente_nombre ?? 'SENAPRED',
    fuente_url: inicial?.fuente_url ?? '',
    vigente_hasta: aLocal(inicial?.vigente_hasta),
  }))
  const [seleccion, setSeleccion] = useState(() => new Set(inicial?.comunas ?? []))
  const [regionAbierta, setRegionAbierta] = useState(() => inicial?.comunas?.[0]?.slice(0, 2) ?? '')
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value })

  const region = regiones.find((r) => r.cut === regionAbierta)
  const resumen = useMemo(() => {
    const porRegion = regiones
      .map((r) => ({ r, n: r.comunas.filter((c) => seleccion.has(c.cut)).length }))
      .filter((x) => x.n > 0)
    return porRegion.map(({ r, n }) => (n === r.comunas.length ? `${r.nombre} (toda)` : `${r.nombre}: ${n}`)).join(' · ')
  }, [seleccion])

  const alternar = (cut) => {
    const s = new Set(seleccion)
    if (s.has(cut)) s.delete(cut)
    else s.add(cut)
    setSeleccion(s)
  }
  const regionCompleta = region && region.comunas.every((c) => seleccion.has(c.cut))
  const alternarRegion = () => {
    const s = new Set(seleccion)
    for (const c of region.comunas) {
      if (regionCompleta) s.delete(c.cut)
      else s.add(c.cut)
    }
    setSeleccion(s)
  }

  const enviar = async (e) => {
    e.preventDefault()
    setError(null)
    if (!d.nivel) return setError('Elige el nivel.')
    if (!seleccion.size) return setError('Elige al menos una comuna.')
    setGuardando(true)
    try {
      await onGuardar({
        ...d,
        vigente_hasta: d.vigente_hasta ? new Date(d.vigente_hasta).toISOString() : null,
        comunas: [...seleccion],
      })
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <fieldset>
        <legend className={etiqueta}>Nivel</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Object.entries(NIVELES).map(([k, n]) => (
            <button
              key={k}
              type="button"
              aria-pressed={d.nivel === k}
              onClick={() => setD({ ...d, nivel: k })}
              className="min-h-12 rounded-lg border-2 px-2 text-[15px] font-bold"
              style={
                d.nivel === k
                  ? { background: `var(--nivel-${n.clave}-fondo)`, color: `var(--nivel-${n.clave}-texto)`, borderColor: 'var(--texto)' }
                  : { borderColor: 'var(--borde)' }
              }
            >
              {n.etiqueta}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="al-amenaza" className={etiqueta}>
            Amenaza
          </label>
          <input id="al-amenaza" list="al-amenazas" value={d.amenaza} onChange={set('amenaza')} className={campo} />
          <datalist id="al-amenazas">
            {AMENAZAS.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </div>
        <div>
          <label htmlFor="al-hasta" className={etiqueta}>
            Vigente hasta <span className="font-normal text-texto-2">(vacío = hasta nuevo aviso)</span>
          </label>
          <input id="al-hasta" type="datetime-local" value={d.vigente_hasta} onChange={set('vigente_hasta')} className={campo} />
        </div>
      </div>

      <div>
        <label htmlFor="al-titulo" className={etiqueta}>
          Título, tal como lo publica la fuente
        </label>
        <input id="al-titulo" value={d.titulo} maxLength={160} onChange={set('titulo')} className={campo} />
      </div>
      <div>
        <label htmlFor="al-desc" className={etiqueta}>
          Descripción <span className="font-normal text-texto-2">(opcional)</span>
        </label>
        <textarea id="al-desc" rows={3} maxLength={1500} value={d.descripcion} onChange={set('descripcion')} className={`${campo} py-2`} />
      </div>
      <div>
        <label htmlFor="al-instr" className={etiqueta}>
          Qué hacer, según la fuente <span className="font-normal text-texto-2">(opcional)</span>
        </label>
        <textarea id="al-instr" rows={3} maxLength={1000} value={d.instrucciones} onChange={set('instrucciones')} className={`${campo} py-2`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <div>
          <label htmlFor="al-fnombre" className={etiqueta}>
            Fuente
          </label>
          <input id="al-fnombre" value={d.fuente_nombre} onChange={set('fuente_nombre')} className={campo} />
        </div>
        <div>
          <label htmlFor="al-furl" className={etiqueta}>
            Enlace a la publicación oficial
          </label>
          <input
            id="al-furl"
            type="url"
            inputMode="url"
            placeholder="https://senapred.cl/…"
            value={d.fuente_url}
            onChange={set('fuente_url')}
            className={campo}
          />
          <p className="mt-1 text-[13px] text-texto-2">Obligatorio. Solo sitios oficiales: gob.cl o senapred.cl.</p>
        </div>
      </div>

      <fieldset className="rounded-xl border-2 border-borde p-3">
        <legend className="px-1 text-[15px] font-bold">Comunas afectadas</legend>
        <label htmlFor="al-region" className="mb-1 block text-[14px] text-texto-2">
          Región
        </label>
        <select id="al-region" value={regionAbierta} onChange={(e) => setRegionAbierta(e.target.value)} className={campo}>
          <option value="">Elige una región…</option>
          {regiones.map((r) => (
            <option key={r.cut} value={r.cut}>
              {r.nombre}
            </option>
          ))}
        </select>
        {region && (
          <div className="mt-3">
            <label className="flex min-h-11 items-center gap-2 text-[16px] font-bold">
              <input type="checkbox" checked={regionCompleta} onChange={alternarRegion} className="size-5" />
              Toda la región ({region.comunas.length} comunas)
            </label>
            <div className="mt-1 grid max-h-56 grid-cols-2 gap-x-3 overflow-y-auto sm:grid-cols-3">
              {region.comunas.map((c) => (
                <label key={c.cut} className="flex min-h-10 items-center gap-2 text-[15px]">
                  <input type="checkbox" checked={seleccion.has(c.cut)} onChange={() => alternar(c.cut)} className="size-5" />
                  {c.nombre}
                </label>
              ))}
            </div>
          </div>
        )}
        <p className="mt-2 text-[14px] text-texto-2">
          {seleccion.size ? `Seleccionadas: ${seleccion.size} — ${resumen}` : 'Ninguna comuna seleccionada.'}
        </p>
      </fieldset>

      {error && (
        <p role="alert" className="text-[16px] font-bold text-peligro">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={guardando} className="min-h-12 rounded-lg bg-senal px-5 text-[16px] font-bold text-sobre-senal disabled:opacity-70">
          {guardando ? 'Guardando…' : inicial ? 'Guardar cambios' : 'Publicar alerta'}
        </button>
        <button type="button" onClick={onCancelar} className="min-h-12 rounded-lg border-2 border-borde px-5 text-[16px] font-bold">
          Cancelar
        </button>
      </div>
    </form>
  )
}
