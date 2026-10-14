import { useCallback, useEffect, useState } from 'react'
import FormAlerta from './FormAlerta'
import { actualizar, bitacora, claveGuardada, crear, guardarClave, listar, verificar } from '../../services/admin'
import { NIVELES } from '../../services/alertas'
import { comunaPorCut } from '../../services/comunas'
import { reportesDisponibles } from '../../services/reportes'
import { hhmm } from '../../services/formato'

const fecha = (s) => {
  const d = new Date(s)
  return `${d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })} ${hhmm(d)}`
}

function cobertura(cuts) {
  if (cuts.length <= 3) return cuts.map((c) => comunaPorCut(c)?.nombre ?? c).join(', ')
  const regionesN = new Set(cuts.map((c) => comunaPorCut(c)?.region.nombre))
  return `${cuts.length} comunas (${[...regionesN].join(', ')})`
}

const ACCIONES = { confirmar: 'Confirmar que sigue vigente', cancelar: 'Cancelar alerta' }

function Ingreso({ onEntrar }) {
  const [clave, setClave] = useState('')
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(false)
  const entrar = async (e) => {
    e.preventDefault()
    setCargando(true)
    setError(null)
    try {
      await verificar(clave.trim())
      guardarClave(clave.trim())
      onEntrar(clave.trim())
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }
  return (
    <form onSubmit={entrar} className="mx-auto mt-10 max-w-md space-y-4 rounded-2xl border-2 border-borde bg-superficie p-5">
      <h1 className="text-[24px] font-bold">Panel de alertas oficiales</h1>
      <p className="text-[16px] text-texto-2">
        Solo para el equipo de AlertaClima. Aquí se cargan las alertas copiadas de SENAPRED u otra fuente oficial.
      </p>
      <div>
        <label htmlFor="adm-clave" className="mb-1 block text-[15px] font-bold">
          Clave de administración
        </label>
        <input
          id="adm-clave"
          type="password"
          autoComplete="current-password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          className="min-h-12 w-full rounded-lg border-2 border-borde bg-fondo px-3 text-[16px] text-texto"
        />
      </div>
      {error && (
        <p role="alert" className="font-bold text-peligro">
          {error}
        </p>
      )}
      <button type="submit" disabled={cargando || !clave} className="min-h-12 w-full rounded-lg bg-senal font-bold text-sobre-senal disabled:opacity-60">
        {cargando ? 'Verificando…' : 'Entrar'}
      </button>
      <a href="#" className="block text-center text-[15px] underline">
        Volver a la app
      </a>
    </form>
  )
}

export default function PanelAdmin() {
  const [clave, setClave] = useState(claveGuardada)
  const [alertas, setAlertas] = useState(null)
  const [horas, setHoras] = useState(12)
  const [registros, setRegistros] = useState([])
  const [editando, setEditando] = useState(null) // null | 'nueva' | alerta
  const [pendiente, setPendiente] = useState(null) // { alerta, accion } esperando confirmación
  const [mensaje, setMensaje] = useState(null)
  const [error, setError] = useState(null)

  const salir = useCallback(() => {
    guardarClave(null)
    setClave(null)
  }, [])

  const cargar = useCallback(async () => {
    if (!clave) return
    try {
      const [a, b] = await Promise.all([listar(clave), bitacora(clave)])
      setAlertas(a.alertas)
      setHoras(a.horasSinConfirmar)
      setRegistros(b.registros)
      setError(null)
    } catch (e) {
      if (e.estado === 401) salir()
      else setError(e.message)
    }
  }, [clave, salir])

  useEffect(() => {
    cargar()
  }, [cargar])

  if (!reportesDisponibles)
    return <p className="p-6 text-[17px]">Esta versión de la app no está conectada a un servidor.</p>
  if (!clave) return <Ingreso onEntrar={setClave} />

  const avisar = (m) => {
    setMensaje(m)
    setTimeout(() => setMensaje(null), 5000)
  }

  const guardar = async (datos) => {
    if (editando === 'nueva') {
      await crear(clave, datos)
      avisar('Alerta publicada. Ya la ven los vecinos de esas comunas.')
    } else {
      await actualizar(clave, editando.id, { accion: 'editar', ...datos })
      avisar('Cambios guardados.')
    }
    setEditando(null)
    cargar()
  }

  const ejecutar = async () => {
    const { alerta, accion } = pendiente
    try {
      await actualizar(clave, alerta.id, { accion })
      avisar(accion === 'confirmar' ? 'Alerta confirmada.' : 'Alerta cancelada.')
      setPendiente(null)
      cargar()
    } catch (e) {
      setError(e.message)
      setPendiente(null)
    }
  }

  const vigentes = (alertas ?? []).filter((a) => a.estado === 'vigente')
  const recientes = (alertas ?? []).filter((a) => a.estado !== 'vigente')

  return (
    <div className="min-h-full bg-fondo">
      <header className="safe-top border-b-2 border-borde bg-superficie">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3 px-4 py-3">
          <h1 className="flex-1 text-[22px] font-bold">Alertas oficiales — panel</h1>
          <a href="#" className="min-h-11 content-center rounded-lg border-2 border-borde px-4 text-[15px] font-bold">
            Ver la app
          </a>
          <button type="button" onClick={salir} className="min-h-11 rounded-lg border-2 border-borde px-4 text-[15px] font-bold">
            Salir
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-5">
        {mensaje && (
          <p role="status" className="rounded-lg bg-senal px-4 py-3 font-bold text-sobre-senal">
            {mensaje}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg border-2 border-peligro px-4 py-3 font-bold text-peligro">
            {error}
          </p>
        )}

        {editando ? (
          <section className="rounded-2xl border-2 border-borde bg-superficie p-4">
            <h2 className="mb-3 text-[20px] font-bold">{editando === 'nueva' ? 'Nueva alerta' : 'Corregir alerta'}</h2>
            <FormAlerta inicial={editando === 'nueva' ? null : editando} onGuardar={guardar} onCancelar={() => setEditando(null)} />
          </section>
        ) : (
          <button type="button" onClick={() => setEditando('nueva')} className="min-h-12 rounded-lg bg-senal px-5 text-[17px] font-bold text-sobre-senal">
            Cargar alerta oficial
          </button>
        )}

        <section>
          <h2 className="mb-1 text-[20px] font-bold">Vigentes</h2>
          <p className="mb-3 text-[15px] text-texto-2">
            Confirma cada alerta al menos cada {horas} horas revisando la fuente. Si no, la app la muestra como «sin
            confirmar».
          </p>
          {alertas === null ? (
            <p>Cargando…</p>
          ) : vigentes.length === 0 ? (
            <p className="text-texto-2">No hay alertas vigentes cargadas.</p>
          ) : (
            <ul className="space-y-3">
              {vigentes.map((a) => {
                const n = NIVELES[a.nivel]
                return (
                  <li key={a.id} className="overflow-hidden rounded-xl border-2 border-borde bg-superficie">
                    <div className="flex flex-wrap items-center gap-2 px-4 py-2" style={{ background: `var(--nivel-${n.clave}-fondo)`, color: `var(--nivel-${n.clave}-texto)` }}>
                      <strong className="text-[17px]">{n.etiqueta}</strong>
                      <span>· {a.amenaza}</span>
                    </div>
                    <div className="space-y-1 px-4 py-3 text-[15px]">
                      <p className="text-[17px] font-bold">{a.titulo}</p>
                      <p className="text-texto-2">{cobertura(a.comunas)}</p>
                      <p className={a.sin_confirmar ? 'font-bold text-senal-texto' : 'text-texto-2'}>
                        {a.sin_confirmar ? 'Sin confirmar desde ' : 'Confirmada '}
                        {fecha(a.confirmada_en)} · {a.vigente_hasta ? `hasta ${fecha(a.vigente_hasta)}` : 'hasta nuevo aviso'}
                      </p>
                      <a href={a.fuente_url} target="_blank" rel="noopener" className="underline">
                        Fuente: {a.fuente_nombre}
                      </a>
                      {pendiente?.alerta.id === a.id ? (
                        <div className="mt-2 rounded-lg border-2 border-senal p-3">
                          <p className="font-bold">
                            {pendiente.accion === 'cancelar'
                              ? '¿Cancelar esta alerta? Dejará de mostrarse a los vecinos.'
                              : '¿Revisaste la fuente y la alerta sigue vigente?'}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button type="button" onClick={ejecutar} className="min-h-11 rounded-lg bg-senal px-4 font-bold text-sobre-senal">
                              Sí, {pendiente.accion === 'cancelar' ? 'cancelar' : 'confirmar'}
                            </button>
                            <button type="button" onClick={() => setPendiente(null)} className="min-h-11 rounded-lg border-2 border-borde px-4 font-bold">
                              No
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {Object.entries(ACCIONES).map(([acc, txt]) => (
                            <button
                              key={acc}
                              type="button"
                              onClick={() => setPendiente({ alerta: a, accion: acc })}
                              className="min-h-11 rounded-lg border-2 border-borde px-3 font-bold"
                            >
                              {txt}
                            </button>
                          ))}
                          <button type="button" onClick={() => setEditando(a)} className="min-h-11 rounded-lg border-2 border-borde px-3 font-bold">
                            Corregir
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {recientes.length > 0 && (
          <section>
            <h2 className="mb-2 text-[20px] font-bold">Canceladas (últimos 7 días)</h2>
            <ul className="space-y-1 text-[15px] text-texto-2">
              {recientes.map((a) => (
                <li key={a.id}>
                  {NIVELES[a.nivel].etiqueta} · {a.titulo} · {cobertura(a.comunas)} · cancelada {fecha(a.actualizada_en)}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2 className="mb-2 text-[20px] font-bold">Bitácora</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <thead className="text-texto-2">
                <tr>
                  <th className="py-1 pr-3 font-normal">Hora</th>
                  <th className="py-1 pr-3 font-normal">Acción</th>
                  <th className="py-1 font-normal">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r, i) => (
                  <tr key={i} className="border-t border-borde/50">
                    <td className="py-1 pr-3 whitespace-nowrap tabular-nums">{fecha(r.creado_en)}</td>
                    <td className="py-1 pr-3 whitespace-nowrap">{r.accion.replace('alerta:', '')}</td>
                    <td className="py-1">{r.detalle?.titulo ?? `alerta ${r.detalle?.id}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}
