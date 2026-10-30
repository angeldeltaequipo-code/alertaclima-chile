import { useEffect, useState } from 'react'
import { guardar, leer } from '../services/almacen'
import { buscarComunas, comunaPorCut } from '../services/comunas'
import { NIVELES, alertaPrincipal, estadoComuna } from '../services/alertas'
import { describir } from '../services/clima'
import IconoClima from './IconoClima'
import { poseZumi } from './ZumiTeCuenta'

const MAX = 5
const QUIENES = ['Mamá', 'Papá', 'Hijo', 'Hija', 'Abuela', 'Abuelo', 'Hermano', 'Hermana', 'Pareja']

/** Lista de familiares guardada en este teléfono: [{ quien, cut }]. */
function useListaFamilia() {
  const [lista, setLista] = useState(() => (leer('familia', []) ?? []).filter((f) => comunaPorCut(f.cut)))
  const cambiar = (l) => {
    setLista(l)
    guardar('familia', l)
  }
  return [lista, cambiar]
}

// Clima actual liviano para cada familiar (una consulta pequeña, guardada 15 minutos).
const cacheClima = new Map()
async function climaBreve(comuna) {
  const c = cacheClima.get(comuna.cut)
  if (c && Date.now() - c.t < 15 * 60e3) return c.d
  const [lat, lng] = comuna.centro
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}&current=temperature_2m,weather_code,is_day&timezone=auto`)
  if (!r.ok) throw new Error('clima')
  const j = await r.json()
  const d = { temp: j.current.temperature_2m, codigo: j.current.weather_code, dia: j.current.is_day === 1 }
  cacheClima.set(comuna.cut, { t: Date.now(), d })
  return d
}

function Familiar({ f, onQuitar, editando }) {
  const comuna = comunaPorCut(f.cut)
  const [clima, setClima] = useState(null)
  const [alerta, setAlerta] = useState(undefined)
  useEffect(() => {
    let vivo = true
    climaBreve(comuna).then((d) => vivo && setClima(d)).catch(() => {})
    estadoComuna(f.cut)
      .then((e) => vivo && setAlerta(e.tipo === 'ok' ? alertaPrincipal(e.alertas) : e.tipo === 'sin_servidor' ? null : undefined))
      .catch(() => {})
    const id = setInterval(() => estadoComuna(f.cut).then((e) => vivo && e.tipo === 'ok' && setAlerta(alertaPrincipal(e.alertas))), 5 * 60e3)
    return () => {
      vivo = false
      clearInterval(id)
    }
  }, [f.cut]) // eslint-disable-line react-hooks/exhaustive-deps
  const desc = clima ? describir(clima.codigo) : null
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-superficie-2 px-3 py-3">
      <span className={`grid size-12 shrink-0 place-items-center rounded-full text-[20px] font-black ${alerta ? 'bg-peligro text-white' : 'bg-ok/20 text-ok'}`} aria-hidden="true">
        {f.quien.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[19px] leading-tight font-bold">{f.quien}</span>
        <span className="block truncate text-[15px] text-texto-2">{comuna.nombre}</span>
        <span className={`mt-0.5 block text-[15px] font-bold ${alerta ? 'text-peligro' : alerta === null ? 'text-ok' : 'text-texto-2'}`}>
          {alerta ? NIVELES[alerta.nivel].etiqueta : alerta === null ? 'Sin alertas' : 'Revisando alertas…'}
        </span>
      </span>
      {editando ? (
        <button type="button" onClick={onQuitar} className="min-h-12 shrink-0 rounded-xl bg-peligro/15 px-3 text-[15px] font-bold text-peligro">
          Quitar
        </button>
      ) : (
        clima && (
          <span className="flex shrink-0 items-center gap-1" aria-label={`${Math.round(clima.temp)} grados, ${desc.texto}`}>
            <IconoClima icono={desc.icono} esDeDia={clima.dia} size={32} />
            <span className="text-[24px] font-bold tabular-nums">{Math.round(clima.temp)}°</span>
          </span>
        )
      )}
    </li>
  )
}

function Agregar({ onAgregar, onCancelar }) {
  const [quien, setQuien] = useState('')
  const [texto, setTexto] = useState('')
  const resultados = texto.length >= 2 ? buscarComunas(texto, 6) : []
  return (
    <div className="mt-3 space-y-3 rounded-2xl bg-superficie-2 p-3">
      <div>
        <label htmlFor="familia-quien" className="block text-[17px] font-bold">
          1. ¿Quién es?
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {QUIENES.map((q) => (
            <button key={q} type="button" onClick={() => setQuien(q)} className={`min-h-11 rounded-full px-4 text-[16px] font-bold ${quien === q ? 'bg-senal text-sobre-senal' : 'bg-superficie ring-1 ring-linea'}`}>
              {q}
            </button>
          ))}
        </div>
        <input
          id="familia-quien"
          value={quien}
          onChange={(e) => setQuien(e.target.value.slice(0, 20))}
          placeholder="O escribe un nombre"
          className="mt-2 min-h-12 w-full rounded-xl border-2 border-borde bg-superficie px-3 text-[17px]"
        />
      </div>
      <div>
        <label htmlFor="familia-comuna" className="block text-[17px] font-bold">
          2. ¿En qué comuna vive?
        </label>
        <input
          id="familia-comuna"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribe la comuna, por ejemplo Temuco"
          className="mt-2 min-h-12 w-full rounded-xl border-2 border-borde bg-superficie px-3 text-[17px]"
          autoComplete="off"
        />
        {resultados.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {resultados.map((c) => (
              <li key={c.cut}>
                <button
                  type="button"
                  disabled={!quien.trim()}
                  onClick={() => onAgregar({ quien: quien.trim(), cut: c.cut })}
                  className="flex min-h-12 w-full items-center justify-between rounded-xl bg-superficie px-3 text-left text-[17px] ring-1 ring-linea disabled:opacity-50"
                >
                  <span>
                    <strong>{c.nombre}</strong> <span className="text-[14px] text-texto-2">{c.region.nombre}</span>
                  </span>
                  <span className="font-bold text-senal-texto">Agregar</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {!quien.trim() && texto.length >= 2 && <p className="mt-1 text-[14px] text-texto-2">Primero elige quién es.</p>}
      </div>
      <button type="button" onClick={onCancelar} className="min-h-12 w-full rounded-xl text-[16px] font-bold underline underline-offset-2">
        Cancelar
      </button>
    </div>
  )
}

/**
 * «Mi familia»: cómo están las comunas de los seres queridos, de un vistazo.
 * Se guarda solo en este teléfono (no se envía a ningún servidor).
 */
export default function MiFamilia() {
  const [lista, setLista] = useListaFamilia()
  const [agregando, setAgregando] = useState(false)
  const [editando, setEditando] = useState(false)

  return (
    <section aria-labelledby="t-familia" className="tarjeta scroll-mt-16">
      <div className="flex items-center justify-between gap-2">
        <h2 id="t-familia" className="titulo-tarjeta !mb-0">
          Mi familia
        </h2>
        {lista.length > 0 && !agregando && (
          <button type="button" onClick={() => setEditando(!editando)} className="min-h-11 rounded-full px-3 text-[15px] font-bold underline underline-offset-2">
            {editando ? 'Listo' : 'Editar'}
          </button>
        )}
      </div>

      {lista.length === 0 && !agregando && (
        <div className="mt-2 flex items-center gap-3">
          <img src={poseZumi('corazon')} alt="" width="72" height="96" className="zumi-pose h-24 w-auto shrink-0" />
          <p className="text-[17px] leading-snug">Agrega a tus seres queridos y te muestro aquí si hay alertas o mal tiempo donde viven.</p>
        </div>
      )}

      {lista.length > 0 && (
        <ul className="mt-3 space-y-2">
          {lista.map((f, i) => (
            <Familiar key={`${f.cut}-${f.quien}`} f={f} editando={editando} onQuitar={() => setLista(lista.filter((_, j) => j !== i))} />
          ))}
        </ul>
      )}

      {agregando ? (
        <Agregar
          onCancelar={() => setAgregando(false)}
          onAgregar={(f) => {
            setLista([...lista, f].slice(0, MAX))
            setAgregando(false)
          }}
        />
      ) : (
        lista.length < MAX &&
        !editando && (
          <button
            type="button"
            onClick={() => setAgregando(true)}
            className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-senal text-[18px] font-bold text-senal-texto"
          >
            <span className="text-[24px] leading-none" aria-hidden="true">+</span>
            Agregar a un familiar
          </button>
        )
      )}
      <p className="mt-2 text-[13px] text-texto-2">Se guarda solo en este teléfono. Para recibir avisos de sus comunas, actívalos en Ajustes.</p>
    </section>
  )
}
