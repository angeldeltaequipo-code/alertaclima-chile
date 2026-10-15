import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import BotonGoogle from './BotonGoogle'
import { useChat } from '../hooks/useChat'
import { LARGO_MAXIMO } from '../services/chat'
import { hhmm } from '../services/formato'
import { guardar, leer } from '../services/almacen'

const iniciales = (n) =>
  n
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

function Avatar({ autor, tam = 34 }) {
  const [falla, setFalla] = useState(false)
  if (autor.foto && !falla)
    return (
      <img
        src={autor.foto}
        alt=""
        width={tam}
        height={tam}
        referrerPolicy="no-referrer"
        onError={() => setFalla(true)}
        className="shrink-0 rounded-full bg-superficie-2 object-cover"
        style={{ width: tam, height: tam }}
      />
    )
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-senal font-bold text-sobre-senal" style={{ width: tam, height: tam, fontSize: Math.round(tam * 0.42) }} aria-hidden="true">
      {iniciales(autor.nombre)}
    </span>
  )
}

function etiquetaDia(d) {
  const hoy = new Date()
  const ayer = new Date(Date.now() - 864e5)
  if (d.toDateString() === hoy.toDateString()) return 'Hoy'
  if (d.toDateString() === ayer.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })
}

function Reglas({ onCerrar }) {
  return (
    <div className="mx-3 mt-3 rounded-2xl bg-superficie-2 p-3 text-[14px] leading-snug">
      <p className="font-bold">Antes de escribir</p>
      <ul className="mt-1 space-y-0.5 text-texto-2">
        <li>• Cuenta lo que ves tú, con lugar y hora. Nada de rumores ni cadenas.</li>
        <li>• Respeto siempre. Los mensajes con 3 denuncias se ocultan.</li>
        <li>• Solo texto: sin enlaces ni fotos. Las groserías se tapan solas.</li>
        <li>• No publiques teléfonos, RUT ni direcciones exactas: se ocultan para protegerte. Para avisar a tu familia usa el botón SOS.</li>
        <li>
          • Emergencias: <strong className="text-texto">133</strong> Carabineros · <strong className="text-texto">132</strong> Bomberos ·{' '}
          <strong className="text-texto">131</strong> SAMU
        </li>
      </ul>
      <button type="button" onClick={onCerrar} className="mt-2 min-h-10 rounded-full bg-superficie px-4 text-[14px] font-bold">
        Entendido
      </button>
    </div>
  )
}

// Color fijo por persona (como en Kick o YouTube): misma persona, mismo color. La luminosidad
// viene de la variable --l-nombre para que cumpla contraste en tema claro y oscuro.
const TONOS = [4, 24, 145, 200, 220, 265, 290, 320, 340, 175, 160, 245]
function colorNombre(id) {
  let h = 0
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return `hsl(${TONOS[h % TONOS.length]} 75% var(--l-nombre))`
}

const escaparRegex = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function Mensaje({ m, propio, miNombre, onDenunciar, onBorrar }) {
  const [menu, setMenu] = useState(false)
  const [aviso, setAviso] = useState(null)
  const accion = async (fn, texto) => {
    setMenu(false)
    try {
      await fn()
      setAviso(texto)
    } catch (e) {
      setAviso(e.message)
    }
  }
  // Te nombran: la línea se destaca, como una mención.
  const mencion = !propio && miNombre && new RegExp(`(^|[^\\p{L}])@?${escaparRegex(miNombre)}([^\\p{L}]|$)`, 'iu').test(m.texto)
  return (
    <li className={`chat-linea relative px-3 py-1 ${mencion ? 'chat-mencion' : ''}`}>
      <div className="flex items-start gap-1">
        <p className="min-w-0 flex-1 text-[15.5px] leading-[1.45] break-words whitespace-pre-wrap">
          <span className="mr-1.5 text-[11px] text-texto-2 tabular-nums">{hhmm(m.hora)}</span>
          <span className="mr-1 inline-block translate-y-[3px]">
            <Avatar autor={m.autor} tam={18} />
          </span>
          <strong className="font-bold" style={{ color: colorNombre(m.autor.id) }}>
            {m.autor.nombre}
          </strong>
          {propio && <span className="ml-1 rounded bg-superficie-2 px-1 text-[10px] font-bold text-texto-2 uppercase align-middle">tú</span>}
          <span className="text-texto-2">: </span>
          <span>{m.texto}</span>
        </p>
        <button
          type="button"
          onClick={() => setMenu(!menu)}
          aria-label={propio ? 'Opciones de tu mensaje' : `Opciones del mensaje de ${m.autor.nombre}`}
          aria-expanded={menu}
          className="chat-opciones -my-1 grid size-8 shrink-0 place-items-center rounded-full text-texto-2"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="3" cy="8" r="1.5" fill="currentColor" />
            <circle cx="8" cy="8" r="1.5" fill="currentColor" />
            <circle cx="13" cy="8" r="1.5" fill="currentColor" />
          </svg>
        </button>
      </div>
      {menu && (
        <div className="mt-1 flex gap-1 pl-10">
          {propio ? (
            <button type="button" onClick={() => accion(() => onBorrar(m.id), 'Mensaje borrado.')} className="min-h-10 rounded-full bg-superficie-2 px-3 text-[14px] font-bold">
              Borrar mensaje
            </button>
          ) : (
            <button
              type="button"
              onClick={() => accion(() => onDenunciar(m.id), 'Gracias. Lo revisaremos.')}
              className="min-h-10 rounded-full bg-superficie-2 px-3 text-[14px] font-bold text-peligro"
            >
              Denunciar (falso u ofensivo)
            </button>
          )}
        </div>
      )}
      {aviso && <p className="mt-0.5 pl-10 text-[13px] text-texto-2">{aviso}</p>}
    </li>
  )
}

/** Pestaña Chat: conversación en tiempo real con los vecinos de la comuna. */
export default function VistaChat({ cuenta, comuna, enLinea, visible }) {
  const chat = useChat({ cut: comuna?.cut, token: cuenta.token, activo: visible && cuenta.estado === 'con-sesion', enLinea })
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [reglas, setReglas] = useState(() => !leer('chat:reglas-vistas', false))
  const [aviso, setAviso] = useState(null)
  const [espera, setEspera] = useState(0)
  const [nuevos, setNuevos] = useState(0)
  const lista = useRef(null)
  const alFondo = useRef(true)
  const cuantos = useRef(0)

  // Se mantiene abajo mientras la persona no haya subido a leer; si subió, se cuentan los nuevos.
  useLayoutEffect(() => {
    const el = lista.current
    const n = chat.mensajes.length
    if (el && alFondo.current) el.scrollTop = el.scrollHeight
    else if (n > cuantos.current && cuantos.current) setNuevos((x) => x + n - cuantos.current)
    cuantos.current = n
  }, [chat.mensajes])

  // Cuenta regresiva entre mensajes (más larga en modo lento).
  useEffect(() => {
    if (!espera) return
    const t = setTimeout(() => setEspera((x) => Math.max(0, x - 1)), 1000)
    return () => clearTimeout(t)
  }, [espera])

  const bajar = () => {
    const el = lista.current
    alFondo.current = true
    setNuevos(0)
    el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }
  useEffect(() => {
    if (visible && lista.current) lista.current.scrollTop = lista.current.scrollHeight
  }, [visible])

  if (!comuna) return null

  if (cuenta.estado === 'desactivada' || cuenta.estado === 'cargando') {
    return (
      <div className="grid h-full place-items-center p-6 text-center">
        <div>
          <p className="text-[20px] font-bold">El chat de {comuna.nombre} estará disponible muy pronto</p>
          <p className="mt-2 text-[16px] text-texto-2">Podrás conversar en tiempo real con tus vecinos durante una emergencia.</p>
        </div>
      </div>
    )
  }

  if (cuenta.estado === 'sin-sesion') {
    return (
      <div className="grid h-full place-items-center overflow-y-auto p-6">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-full bg-senal text-sobre-senal" aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
              <path d="M4 5h16v11H9l-5 4z" />
            </svg>
          </div>
          <h2 className="text-[22px] leading-tight font-bold">Chat de vecinos de {comuna.nombre}</h2>
          <p className="mt-2 text-[16px] text-texto-2">
            Cuenta lo que pasa en tu calle y entérate en tiempo real de lo que ven tus vecinos. Para participar, entra con tu cuenta de Google.
          </p>
          <div className="mt-5">
            <BotonGoogle clientId={cuenta.clientId} />
          </div>
          <p className="mt-3 text-[13px] text-texto-2">Los demás solo ven tu nombre, la inicial de tu apellido y tu foto.</p>
        </div>
      </div>
    )
  }

  const enviar = async (e) => {
    e.preventDefault()
    const t = texto.trim()
    if (!t || enviando) return
    setEnviando(true)
    setError(null)
    alFondo.current = true
    setAviso(null)
    try {
      const r = await chat.enviar(t)
      setTexto('')
      setEspera(r.lento || 4)
      if (r.aviso.datosOcultos) setAviso('Ocultamos un teléfono, RUT o correo para protegerte. Para avisar a tu familia usa el botón SOS.')
      else if (r.aviso.censurado) setAviso('Tapamos algunas palabras. Mantengamos el chat respetuoso.')
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  const yo = cuenta.usuario?.id
  const miNombre = cuenta.usuario?.nombre?.split(' ')[0]
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-linea px-4 py-2">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[18px] font-bold">Vecinos de {comuna.nombre}</h2>
          <p className="flex items-center gap-1.5 text-[13px] text-texto-2">
            <span className={`size-2 rounded-full ${enLinea ? 'bg-ok' : 'bg-texto-2'}`} aria-hidden="true" />
            {!enLinea ? 'Sin conexión' : chat.presentes ? `${chat.presentes} ${chat.presentes === 1 ? 'persona conectada' : 'personas conectadas'}` : 'En vivo'}
          </p>
        </div>
        <button type="button" onClick={() => setReglas(true)} className="min-h-10 rounded-full px-3 text-[14px] font-bold text-texto-2 underline">
          Reglas
        </button>
      </div>

      <div
        ref={lista}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3"
        onScroll={(e) => {
          const el = e.currentTarget
          alFondo.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
          if (alFondo.current && nuevos) setNuevos(0)
        }}
        aria-live="polite"
      >
        {reglas && (
          <Reglas
            onCerrar={() => {
              guardar('chat:reglas-vistas', true)
              setReglas(false)
            }}
          />
        )}
        {chat.hayMas && (
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={() => {
                alFondo.current = false
                chat.cargarAnteriores()
              }}
              className="min-h-10 rounded-full bg-superficie px-4 text-[14px] font-bold"
            >
              Ver mensajes anteriores
            </button>
          </div>
        )}
        {chat.estado === 'cargando' && <p className="p-4 text-center text-texto-2">Cargando mensajes…</p>}
        {chat.estado === 'error' && <p className="p-4 text-center font-bold text-peligro">{chat.error}</p>}
        {chat.estado === 'listo' && chat.mensajes.length === 0 && (
          <p className="p-6 text-center text-[16px] text-texto-2">Aún no hay mensajes. Sé el primero en contar cómo está tu sector.</p>
        )}
        <ol>
          {chat.mensajes.map((m, i) => {
            const prev = chat.mensajes[i - 1]
            const nuevoDia = !prev || prev.hora.toDateString() !== m.hora.toDateString()
            return [
              nuevoDia && (
                <li key={`d${m.id}`} className="my-3 text-center">
                  <span className="rounded-full bg-superficie px-3 py-1 text-[12px] font-bold text-texto-2 first-letter:uppercase">{etiquetaDia(m.hora)}</span>
                </li>
              ),
              <Mensaje key={m.id} m={m} propio={m.autor.id === yo} miNombre={miNombre} onDenunciar={chat.denunciar} onBorrar={chat.borrar} />,
            ]
          })}
        </ol>
      </div>

      <form onSubmit={enviar} className="relative border-t border-linea bg-fondo px-3 py-2">
        {nuevos > 0 && (
          <button type="button" onClick={bajar} className="absolute -top-12 left-1/2 min-h-10 -translate-x-1/2 rounded-full bg-senal px-4 text-[14px] font-bold text-sobre-senal shadow-lg">
            ↓ {nuevos} {nuevos === 1 ? 'mensaje nuevo' : 'mensajes nuevos'}
          </button>
        )}
        {chat.lento > 0 && (
          <p className="mb-1 flex items-center gap-1.5 px-1 text-[13px] font-bold text-senal-texto">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="13" r="8" />
              <path d="M12 9v4l2.5 2.5M9 2h6" />
            </svg>
            Modo lento: hay mucha gente escribiendo, un mensaje cada {chat.lento} s.
          </p>
        )}
        {aviso && (
          <p role="status" className="mb-1 px-1 text-[13px] text-texto-2">
            {aviso}
          </p>
        )}
        {error && (
          <p role="alert" className="mb-1 px-1 text-[14px] font-bold text-peligro">
            {error}
          </p>
        )}
        <div className="flex items-end gap-2">
          <label htmlFor="chat-texto" className="sr-only">
            Mensaje para los vecinos de {comuna.nombre}
          </label>
          <textarea
            id="chat-texto"
            rows={1}
            value={texto}
            maxLength={LARGO_MAXIMO}
            onChange={(e) => {
              setTexto(e.target.value)
              e.target.style.height = 'auto'
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia('(pointer: fine)').matches) enviar(e)
            }}
            placeholder={enLinea ? '¿Qué está pasando en tu sector?' : 'Sin conexión'}
            disabled={!enLinea}
            className="max-h-[120px] min-h-12 flex-1 resize-none rounded-3xl border-2 border-borde bg-superficie px-4 py-2.5 text-[16px] text-texto placeholder:text-texto-2"
          />
          <button
            type="submit"
            disabled={!texto.trim() || enviando || !enLinea || espera > 0}
            aria-label={espera ? `Podrás enviar en ${espera} segundos` : 'Enviar mensaje'}
            className="grid size-12 shrink-0 place-items-center rounded-full bg-senal text-[17px] font-bold text-sobre-senal tabular-nums disabled:opacity-50"
          >
            {espera > 0 ? espera : <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M3 20l18-8L3 4l2 7 9 1-9 1z" />
            </svg>}
          </button>
        </div>
        {texto.length > LARGO_MAXIMO - 80 && <p className="mt-1 px-2 text-right text-[12px] text-texto-2">{LARGO_MAXIMO - texto.length} caracteres</p>}
      </form>
    </div>
  )
}
