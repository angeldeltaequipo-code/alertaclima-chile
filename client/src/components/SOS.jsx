import { useEffect, useRef, useState } from 'react'
import { NUMEROS, anotarRastro, contactos, enlaceSMS, enlaceWhatsApp, guardarContactos, mensajeSOS, rastro, ubicacionPrecisa } from '../services/sos'

/** Botón SOS flotante: abre la pantalla de emergencia (no llama ni envía nada solo). */
export function BotonSOS({ onAbrir, arriba = false }) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label="Emergencia: llamar o enviar mi ubicación"
      className={`boton-sos fixed left-3 z-[900] ${arriba ? 'bottom-[9.5rem]' : 'bottom-[5.6rem]'}`}
    >
      SOS
    </button>
  )
}

function Contactos({ lista, onCambiar }) {
  const [nombre, setNombre] = useState('')
  const [tel, setTel] = useState('')
  const agregar = (e) => {
    e.preventDefault()
    if (!nombre.trim() || !tel.trim()) return
    onCambiar([...lista, { nombre, telefono: tel }])
    setNombre('')
    setTel('')
  }
  return (
    <div className="space-y-2">
      {lista.map((c, i) => (
        <div key={i} className="flex items-center gap-2 rounded-xl bg-white/8 px-3 py-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-bold">{c.nombre}</span>
            <span className="block text-[13px] text-white/70 tabular-nums">{c.telefono}</span>
          </span>
          <button type="button" onClick={() => onCambiar(lista.filter((_, j) => j !== i))} className="min-h-10 px-2 text-[14px] underline">
            Quitar
          </button>
        </div>
      ))}
      {lista.length < 5 && (
        <form onSubmit={agregar} className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" aria-label="Nombre del contacto" className="min-h-12 min-w-0 rounded-xl border-2 border-white/20 bg-black/30 px-3 text-[16px] text-white placeholder:text-white/40" />
          <input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="+56 9 …" inputMode="tel" aria-label="Teléfono del contacto" className="min-h-12 min-w-0 rounded-xl border-2 border-white/20 bg-black/30 px-3 text-[16px] text-white placeholder:text-white/40" />
          <button type="submit" className="min-h-12 rounded-xl bg-white px-3 text-[15px] font-bold text-red-700">
            Agregar
          </button>
        </form>
      )}
      <p className="text-[12px] text-white/60">Tus contactos se guardan solo en este teléfono.</p>
    </div>
  )
}

/** Pantalla de emergencia: llamar, enviar ubicación a contactos y consejos si estás atrapado. */
export function PantallaSOS({ nombre, onCerrar }) {
  const ref = useRef(null)
  const [lista, setLista] = useState(contactos)
  const [ubic, setUbic] = useState(null)
  const [error, setError] = useState(null)
  const [buscando, setBuscando] = useState(false)
  const [editar, setEditar] = useState(() => contactos().length === 0)

  useEffect(() => {
    const previo = document.activeElement
    ref.current?.focus()
    const tecla = (e) => e.key === 'Escape' && onCerrar()
    document.addEventListener('keydown', tecla)
    // Se obtiene la ubicación apenas se abre: en una emergencia cada segundo cuenta.
    obtener()
    return () => {
      document.removeEventListener('keydown', tecla)
      previo?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const obtener = async () => {
    setBuscando(true)
    setError(null)
    try {
      const p = await ubicacionPrecisa()
      anotarRastro(p)
      setUbic(p)
    } catch (e) {
      setError(e.message)
    } finally {
      setBuscando(false)
    }
  }

  const cambiar = (l) => {
    guardarContactos(l)
    setLista(contactos())
  }
  const texto = ubic ? mensajeSOS(ubic, { nombre }) : null
  const compartir = async () => {
    try {
      await navigator.share({ title: 'SOS', text: texto })
    } catch {
      /* cancelado */
    }
  }

  return (
    <div className="fixed inset-0 z-[1250] overflow-x-hidden overflow-y-auto bg-[#450a0a]/95 text-white backdrop-blur" role="dialog" aria-modal="true" aria-labelledby="t-sos" ref={ref} tabIndex={-1}>
      <div className="safe-top safe-bottom mx-auto max-w-md px-5 pt-5 pb-8">
        <div className="flex items-center justify-between">
          <h2 id="t-sos" className="text-[30px] font-bold">
            Emergencia
          </h2>
          <button type="button" onClick={onCerrar} className="min-h-11 rounded-full bg-white/15 px-4 text-[16px] font-bold">
            Cerrar
          </button>
        </div>

        <p className="mt-1 text-[16px] text-white/85">Si tu vida corre peligro, llama primero:</p>
        <div className="mt-3 grid gap-2">
          {NUMEROS.map((n) => (
            <a
              key={n.numero}
              href={`tel:${n.numero}`}
              className="flex min-h-16 items-center gap-4 rounded-2xl px-4 text-[20px] font-bold shadow-lg"
              style={{ background: n.color }}
            >
              <span className="text-[30px] tabular-nums">{n.numero}</span>
              <span>{n.nombre}</span>
              <svg className="ml-auto" width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.6 3.6a1 1 0 0 1-.25 1z" />
              </svg>
            </a>
          ))}
        </div>

        <section className="mt-6 rounded-3xl bg-black/30 p-4 ring-1 ring-white/15">
          <h3 className="text-[19px] font-bold">Avisar a mi familia dónde estoy</h3>
          {buscando && <p className="mt-2 text-[15px]" role="status">Obteniendo tu ubicación exacta…</p>}
          {error && (
            <p className="mt-2 text-[15px] font-bold text-amber-300" role="alert">
              {error}{' '}
              <button type="button" onClick={obtener} className="underline">
                Reintentar
              </button>
            </p>
          )}
          {ubic && (
            <p className="mt-2 text-[14px] text-white/80">
              Ubicación lista (precisión ±{ubic.precision} m).{' '}
              <button type="button" onClick={obtener} className="underline">
                Actualizar
              </button>
            </p>
          )}
          {ubic && lista.length > 0 && (
            <div className="mt-3 grid gap-2">
              <a href={enlaceSMS(lista.map((c) => c.telefono), texto)} className="flex min-h-14 items-center justify-center rounded-2xl bg-white text-[18px] font-bold text-red-700">
                {lista.length === 1 ? `Enviar SMS a ${lista[0].nombre}` : `Enviar SMS a mis ${lista.length} contactos`}
              </a>
              {lista.map((c) => (
                <a key={c.telefono} href={enlaceWhatsApp(c.telefono, texto)} target="_blank" rel="noopener" className="flex min-h-12 items-center justify-center rounded-2xl bg-[#16a34a] text-[16px] font-bold">
                  WhatsApp a {c.nombre}
                </a>
              ))}
            </div>
          )}
          {ubic && 'share' in navigator && (
            <button type="button" onClick={compartir} className="mt-2 min-h-12 w-full rounded-2xl bg-white/15 text-[16px] font-bold">
              Compartir por otra app
            </button>
          )}
          <button type="button" onClick={() => setEditar(!editar)} aria-expanded={editar} className="mt-3 min-h-11 w-full text-[15px] font-bold underline">
            {lista.length ? 'Editar mis contactos de emergencia' : 'Agregar contactos de emergencia'}
          </button>
          {editar && (
            <div className="mt-2">
              <Contactos lista={lista} onCambiar={cambiar} />
            </div>
          )}
          {rastro().length > 1 && <p className="mt-2 text-[12px] text-white/60">El mensaje incluye también tus últimas ubicaciones guardadas en este teléfono.</p>}
        </section>

        <section className="mt-4 rounded-3xl bg-black/20 p-4">
          <h3 className="text-[17px] font-bold">Si estás atrapado</h3>
          <ul className="mt-2 space-y-1.5 text-[15px] leading-snug text-white/90">
            <li>• Cuida la batería: baja el brillo y cierra otras apps.</li>
            <li>• Si no hay señal para llamar, intenta con SMS: a veces pasa igual.</li>
            <li>• Golpea tubos o paredes para que te escuchen; grita solo como último recurso.</li>
            <li>• Cúbrete nariz y boca si hay polvo.</li>
          </ul>
        </section>
      </div>
    </div>
  )
}
