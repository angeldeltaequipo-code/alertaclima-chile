// ZUMI Charm: ZUMI vivo en tiempo real, como un compañero de bolsillo.
// Dibujado (no es video): parpadea, te sigue con la mirada, se ríe si lo acaricias, duerme de noche,
// tirita con frío, saca el paraguas si llueve donde vives y se pone serio ante una alerta de verdad.
// Participativo: le pones nombre, cada día propone una mini-misión real de preparación (1 minuto),
// y las misiones cumplidas le desbloquean cosas chilenas (bufanda, chupalla, copihue).
// Nunca castiga: no se pone triste si no vienes (nada de culpa); solo celebra lo que haces.
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { leerGrupo, marcarEstado } from '../services/familiaGPS'

const K = 'ac:charm'
const leer = () => {
  try {
    return { nombre: '', hechas: {}, total: 0, viste: { bufanda: true, chupalla: true, copihue: true }, ...JSON.parse(localStorage.getItem(K) ?? '{}') }
  } catch {
    return { nombre: '', hechas: {}, total: 0, viste: { bufanda: true, chupalla: true, copihue: true } }
  }
}
const guardar = (v) => {
  try {
    localStorage.setItem(K, JSON.stringify(v))
  } catch {
    /* sin almacenamiento */
  }
}
const hoyClave = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' })

// Misiones reales de 1 minuto. `accion` abre lo que ayuda a cumplirla (opcional).
export const MISIONES = [
  { id: 'linterna', texto: 'Prueba que tu linterna funcione', gracias: '¡Luz lista para un corte!' },
  { id: 'encuentro', texto: 'Acuerda un punto de encuentro con tu familia', accion: 'familia', gracias: 'Si pasa algo, ya saben dónde juntarse.' },
  { id: 'bien', texto: 'Cuéntale a tu familia que estás bien', accion: 'familia', gracias: '¡Qué lindo! Seguro les alegraste el día.' },
  { id: 'agua', texto: 'Revisa que tengas agua guardada en casa', gracias: 'El agua es lo primero en una emergencia.' },
  { id: 'bateria', texto: 'Carga tu batería externa o power bank', gracias: '¡Celular con energía, familia conectada!' },
  { id: 'gas', texto: 'Ubica la llave de paso del gas y del agua', gracias: 'Saber cerrarlas evita accidentes después de un sismo.' },
  { id: 'botiquin', texto: 'Revisa que tu botiquín tenga lo básico', gracias: '¡Botiquín al día!' },
  { id: 'tiembla', texto: 'Pregúntame qué hacer si tiembla', pregunta: '¿Qué hago si tiembla?', gracias: 'Agáchate, cúbrete y afírmate. ¡Ya lo sabes!' },
  { id: 'vecino', texto: 'Pregúntale a un vecino mayor si necesita algo', gracias: 'Cuidarnos entre vecinos es lo más chileno que hay.' },
  { id: 'documentos', texto: 'Guarda tus documentos importantes en una bolsa plástica', gracias: 'Así no se mojan ni se pierden.' },
  { id: 'cama', texto: 'Deja zapatos y linterna junto a tu cama', gracias: 'Si tiembla de noche, estarás listo.' },
  { id: 'manana', texto: 'Pregúntame cómo estará mañana', pregunta: '¿Cómo estará mañana?', gracias: '¡Mañana te despierto con el pronóstico!' },
  { id: 'mochila', texto: 'Revisa tu mochila de emergencia', pregunta: '¿Qué llevo en la mochila de emergencia?', gracias: '¡Mochila revisada!' },
  { id: 'numeros', texto: 'Enséñale a alguien los números 131, 132 y 133', gracias: 'Ambulancia, Bomberos y Carabineros. ¡Bien!' },
]
export const misionDeHoy = (dia = hoyClave()) => {
  let h = 0
  for (const c of dia) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return MISIONES[h % MISIONES.length]
}

// Cosas que se ganan con misiones cumplidas (en total, no en racha: no se pierde nada por faltar).
export const PREMIOS = [
  { id: 'bufanda', nombre: 'Bufanda', desde: 2 },
  { id: 'chupalla', nombre: 'Chupalla', desde: 5 },
  { id: 'copihue', nombre: 'Copihue', desde: 10 },
]

/** El ánimo de ZUMI según lo que pasa de verdad donde vives. */
export function animoDe({ temperatura, llueve, alerta, hora = new Date().getHours() }) {
  if (alerta) return 'alerta'
  if (llueve) return 'lluvia'
  if (hora >= 23 || hora < 6) return 'sueno'
  if (temperatura != null && temperatura <= 8) return 'frio'
  if (temperatura != null && temperatura >= 28) return 'calor'
  return 'feliz'
}

const calma = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export default function ZumiCharm({ temperatura, llueve, alerta, globo, onTocar, onPreguntar, onAbrir, onLlamar }) {
  const [estado, setEstado] = useState(leer)
  const [mirada, setMirada] = useState({ x: 0, y: 0 })
  const [parpadeo, setParpadeo] = useState(false)
  const [mimos, setMimos] = useState(0) // corazones activos
  const [saltando, setSaltando] = useState(false)
  const [despierto, setDespierto] = useState(false) // se despierta un rato si lo tocas de noche
  const [dice, setDice] = useState(null)
  const [nombrando, setNombrando] = useState(false)
  const svg = useRef(null)
  const caricia = useRef({ activo: false, x: 0, y: 0, recorrido: 0 })

  const animoBase = animoDe({ temperatura, llueve, alerta })
  const animo = animoBase === 'sueno' && despierto ? 'feliz' : animoBase
  const contento = mimos > 0 || saltando
  const mision = misionDeHoy()
  const hecha = estado.hechas[hoyClave()] === mision.id
  const ganados = PREMIOS.filter((p) => estado.total >= p.desde)
  const lleva = (id) => ganados.some((p) => p.id === id) && estado.viste[id] !== false
  const nombre = estado.nombre?.trim() || 'ZUMI'

  // Parpadeo natural (cada 2,5–6 s, a veces doble)
  useEffect(() => {
    if (calma()) return
    let t
    const ciclo = () => {
      t = setTimeout(() => {
        setParpadeo(true)
        setTimeout(() => setParpadeo(false), 130)
        if (Math.random() < 0.25) setTimeout(() => (setParpadeo(true), setTimeout(() => setParpadeo(false), 120)), 260)
        ciclo()
      }, 2500 + Math.random() * 3500)
    }
    ciclo()
    return () => clearTimeout(t)
  }, [])

  // Te sigue con la mirada (dedo o mouse); si no te mueves, mira alrededor solo.
  useEffect(() => {
    let ultimo = 0
    const mover = (e) => {
      const r = svg.current?.getBoundingClientRect()
      if (!r) return
      ultimo = Date.now()
      const dx = (e.clientX - (r.left + r.width / 2)) / (r.width * 1.2)
      const dy = (e.clientY - (r.top + r.height * 0.45)) / (r.height * 1.2)
      setMirada({ x: Math.max(-1, Math.min(1, dx)), y: Math.max(-1, Math.min(1, dy)) })
    }
    window.addEventListener('pointermove', mover, { passive: true })
    window.addEventListener('pointerdown', mover, { passive: true })
    const vagar = setInterval(() => {
      if (Date.now() - ultimo > 3500 && !calma()) setMirada({ x: Math.random() * 1.6 - 0.8, y: Math.random() * 0.8 - 0.3 })
    }, 2600)
    return () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerdown', mover)
      clearInterval(vagar)
    }
  }, [])

  useEffect(() => {
    if (!dice) return
    const t = setTimeout(() => setDice(null), 4200)
    return () => clearTimeout(t)
  }, [dice])
  useEffect(() => {
    if (!mimos) return
    const t = setTimeout(() => setMimos(0), 1600)
    return () => clearTimeout(t)
  }, [mimos])

  const saltar = () => {
    setSaltando(true)
    setTimeout(() => setSaltando(false), 900)
  }
  useEffect(() => {
    if (!despierto) return
    const t = setTimeout(() => setDespierto(false), 25000)
    return () => clearTimeout(t)
  }, [despierto])

  const actualizar = (f) =>
    setEstado((e) => {
      const n = f(e)
      guardar(n)
      return n
    })

  // Acariciar: pasar el dedo por encima. Tocar: salta y dice algo.
  const abajo = (e) => {
    caricia.current = { activo: true, x: e.clientX, y: e.clientY, recorrido: 0, t: Date.now() }
  }
  const moverCaricia = (e) => {
    const c = caricia.current
    if (!c.activo) return
    c.recorrido += Math.hypot(e.clientX - c.x, e.clientY - c.y)
    c.x = e.clientX
    c.y = e.clientY
    if (c.recorrido > 90) {
      c.recorrido = 0
      setMimos((m) => m + 1)
      setDice(animo === 'alerta' ? 'Gracias. Estoy contigo, vamos paso a paso.' : ['¡Jiji, qué rico!', '¡Más, más!', 'Me encantan los mimos', '¡Ronroneo de panda rojo!'][Math.floor(Math.random() * 4)])
      navigator.vibrate?.(8)
    }
  }
  const arriba = () => {
    const c = caricia.current
    const fueToque = c.activo && Date.now() - c.t < 260 && c.recorrido < 12
    caricia.current.activo = false
    if (!fueToque) return
    if (animoBase === 'sueno') {
      setDespierto(true)
      setDice('¿Mmm? ¡Ah, hola! Estaba soñando con la cordillera.')
      return
    }
    saltar()
    const r = onTocar?.()
    if (typeof r === 'string') setDice(r)
  }

  const cumplir = () => {
    if (hecha) return
    actualizar((e) => ({ ...e, hechas: { ...e.hechas, [hoyClave()]: mision.id }, total: (e.total ?? 0) + 1 }))
    saltar()
    setMimos(3)
    const nuevo = PREMIOS.find((p) => p.desde === (estado.total ?? 0) + 1)
    setDice(nuevo ? `${mision.gracias} ¡Y me gané una ${nuevo.nombre.toLowerCase()}!` : mision.gracias)
    navigator.vibrate?.([10, 40, 10])
  }
  const [avisado, setAvisado] = useState(false)
  const avisarBien = async () => {
    if (!leerGrupo()) return onAbrir?.('familia')
    await marcarEstado('bien').catch(() => {})
    setAvisado(true)
    setDice('Listo, tu familia ya sabe que estás bien. Sigue las indicaciones oficiales.')
    navigator.vibrate?.(20)
  }
  const hacerMision = () => {
    if (mision.pregunta) return onPreguntar?.(mision.pregunta)
    if (mision.accion) return onAbrir?.(mision.accion)
  }

  const texto = dice ?? globo
  const etiqueta = useMemo(
    () =>
      ({
        feliz: `${nombre} está contento`,
        sueno: `${nombre} está durmiendo`,
        frio: `${nombre} tiene frío`,
        calor: `${nombre} tiene calor`,
        lluvia: `${nombre} tiene su paraguas: llueve donde vives`,
        alerta: `${nombre} está atento: hay una alerta`,
      })[animo],
    [animo, nombre],
  )

  return (
    <div className={`charm charm-${animo}`}>
      {/* Lo que dice */}
      <p className="charm-globo" aria-live="polite">
        <span key={texto} className="globo-texto block">
          {texto}
        </span>
      </p>

      {/* La pantallita */}
      <div className="charm-pantalla">
        <div className="charm-cielo" aria-hidden="true">
          {animo === 'lluvia' && <span className="charm-gotas" />}
          {animo === 'sueno' && <span className="charm-estrellas" />}
        </div>
        <svg
          ref={svg}
          viewBox="0 0 200 200"
          role="img"
          aria-label={`${etiqueta}. Tócalo o acarícialo pasando el dedo.`}
          className={`charm-zumi ${contento ? 'contento' : ''} ${saltando ? 'salta' : ''}`}
          onPointerDown={abajo}
          onPointerMove={moverCaricia}
          onPointerUp={arriba}
          onPointerCancel={() => (caricia.current.activo = false)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), saltar(), setMimos(1), setDice(onTocar?.() ?? '¡Hola!'))}
          tabIndex={0}
        >
          <Zumi animo={animo} mirada={mirada} parpadeo={parpadeo} contento={contento} bufanda={lleva('bufanda') || animo === 'frio'} chupalla={lleva('chupalla') && animo !== 'lluvia'} copihue={lleva('copihue')} />
        </svg>
        {mimos > 0 && (
          <span className="charm-corazones" aria-hidden="true">
            {Array.from({ length: Math.min(mimos + 2, 6) }, (_, i) => (
              <i key={`${mimos}-${i}`} style={{ '--i': i }}>♥</i>
            ))}
          </span>
        )}

      </div>
      <button type="button" onClick={() => setNombrando(true)} className="charm-nombre" aria-label={`Se llama ${nombre}. Toca para cambiarle el nombre`}>
          {nombre}
          {ganados.length > 0 && <span className="charm-nivel"> · {estado.total} ★</span>}
        </button>

      {/* Con alerta, la misión del día cede su lugar a lo que importa: avisar a la familia */}
      {animo === 'alerta' ? (
        <div className={`charm-mision ${avisado ? 'hecha' : ''}`}>
          <span className="min-w-0 flex-1 text-left">
            <span className="rotulo !text-[9.5px]">Hay una alerta · un toque</span>
            <span className="line-clamp-2 block text-[14.5px] leading-snug font-semibold">{avisado ? 'Tu familia ya sabe que estás bien' : 'Avísale a tu familia que estás bien'}</span>
          </span>
          <button type="button" onClick={avisarBien} disabled={avisado} className="charm-hecho">
            {avisado ? '✓' : 'Estoy bien'}
          </button>
        </div>
      ) : (
      <div className={`charm-mision ${hecha ? 'hecha' : ''}`}>
        <button type="button" onClick={hacerMision} disabled={!mision.pregunta && !mision.accion} className="min-w-0 flex-1 text-left">
          <span className="rotulo !text-[9.5px]">{hecha ? 'Misión de hoy · cumplida' : 'Misión de hoy · 1 minuto'}</span>
          <span className="line-clamp-2 block text-[14.5px] leading-snug font-semibold">{mision.texto}</span>
        </button>
        <button type="button" onClick={cumplir} disabled={hecha} className="charm-hecho" aria-label={hecha ? 'Misión cumplida' : `Marcar como hecha: ${mision.texto}`}>
          {hecha ? '✓' : 'Hecho'}
        </button>
      </div>
      )}

      {nombrando && (
        <Nombrar
          actual={estado.nombre}
          ganados={ganados}
          viste={estado.viste}
          total={estado.total}
          onVestir={(id) => actualizar((e) => ({ ...e, viste: { ...e.viste, [id]: e.viste?.[id] === false } }))}
          onGuardar={(n) => {
            actualizar((e) => ({ ...e, nombre: n.slice(0, 16) }))
            setNombrando(false)
            setDice(n.trim() ? `¡Me encanta! Desde ahora soy ${n.trim()}.` : '¡Sigo siendo ZUMI!')
            saltar()
          }}
          onLlamar={onLlamar}
          onCerrar={() => setNombrando(false)}
        />
      )}
    </div>
  )
}

function Nombrar({ actual, ganados, viste, total, onVestir, onGuardar, onCerrar }) {
  const [n, setN] = useState(actual ?? '')
  return createPortal(
    <div className="fixed inset-0 z-[1300] grid place-items-end bg-black/70 p-3 sm:place-items-center" onClick={onCerrar}>
      <form
        className="vidrio-solido w-full max-w-md rounded-[26px] p-4 text-white"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          onGuardar(n)
        }}
      >
        <p className="rotulo">Tu ZUMI</p>
        <label className="mt-2 block text-[15px]" htmlFor="charm-nombre">
          ¿Cómo quieres llamarlo?
        </label>
        <input id="charm-nombre" autoFocus value={n} maxLength={16} onChange={(e) => setN(e.target.value)} placeholder="ZUMI" className="mt-1.5 w-full rounded-xl bg-white/10 px-3 py-3 text-[17px] outline-none" />
        <p className="rotulo mt-4">Su ropero · {total} misiones cumplidas</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {PREMIOS.map((p) => {
            const tiene = ganados.some((g) => g.id === p.id)
            return (
              <button key={p.id} type="button" disabled={!tiene} onClick={() => onVestir(p.id)} aria-pressed={tiene && viste?.[p.id] !== false} className={`min-h-16 rounded-2xl border px-2 text-[13.5px] ${tiene ? (viste?.[p.id] !== false ? 'border-vivo bg-vivo/15' : 'border-white/25') : 'border-white/10 text-white/40'}`}>
                <span className="block font-semibold">{p.nombre}</span>
                <span className="block text-[11.5px] text-white/60">{tiene ? (viste?.[p.id] !== false ? 'puesta' : 'guardada') : `con ${p.desde} misiones`}</span>
              </button>
            )
          })}
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onCerrar} className="boton-linea flex-1">
            Cerrar
          </button>
          <button type="submit" className="boton-primario flex-1">
            Guardar
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}

// ---- El dibujo de ZUMI (panda rojo). Todo en vectores: nítido en cualquier pantalla. ----
const NARANJA = '#d8662a'
const NARANJA_OSC = '#b4471b'
const CAFE = '#4a1c0e'
const CREMA = '#fff6ec'

function Zumi({ animo, mirada, parpadeo, contento, bufanda, chupalla, copihue }) {
  const px = mirada.x * 3.6
  const py = mirada.y * 2.6
  const ojosCerrados = animo === 'sueno'
  return (
    <g className="charm-cuerpo">
      {/* cola rayada */}
      <g className="charm-cola">
        <path d="M140 168 C178 160 190 128 176 104 C170 120 158 136 136 146 Z" fill={NARANJA} />
        <path d="M160 156 C172 150 178 140 180 128" stroke={NARANJA_OSC} strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M150 162 C160 160 168 156 172 150" stroke={NARANJA_OSC} strokeWidth="6" fill="none" strokeLinecap="round" opacity=".8" />
      </g>
      {/* cuerpo */}
      <ellipse cx="100" cy="164" rx="44" ry="30" fill={NARANJA} />
      <ellipse cx="100" cy="174" rx="32" ry="20" fill={CAFE} />
      <ellipse cx="78" cy="186" rx="11" ry="8" fill={CAFE} />
      <ellipse cx="122" cy="186" rx="11" ry="8" fill={CAFE} />

      {/* cabeza */}
      <g className="charm-cabeza">
        {/* orejas */}
        <g className="charm-oreja izq">
          <path d="M44 66 C40 36 58 22 76 36 C70 46 58 56 44 66 Z" fill={CREMA} />
          <path d="M50 60 C48 42 58 32 70 40 C64 47 57 54 50 60 Z" fill={CAFE} />
        </g>
        <g className="charm-oreja der">
          <path d="M156 66 C160 36 142 22 124 36 C130 46 142 56 156 66 Z" fill={CREMA} />
          <path d="M150 60 C152 42 142 32 130 40 C136 47 143 54 150 60 Z" fill={CAFE} />
        </g>
        <ellipse cx="100" cy="94" rx="62" ry="52" fill={NARANJA} />
        {/* máscara blanca */}
        <ellipse cx="76" cy="72" rx="12" ry="6.5" fill={CREMA} />
        <ellipse cx="124" cy="72" rx="12" ry="6.5" fill={CREMA} />
        <ellipse cx="62" cy="110" rx="20" ry="16" fill={CREMA} />
        <ellipse cx="138" cy="110" rx="20" ry="16" fill={CREMA} />
        <ellipse cx="100" cy="114" rx="24" ry="17" fill={CREMA} />
        {/* «lágrimas» del panda rojo */}
        <path d="M74 100 C70 112 72 124 80 132" stroke={NARANJA_OSC} strokeWidth="7" fill="none" strokeLinecap="round" />
        <path d="M126 100 C130 112 128 124 120 132" stroke={NARANJA_OSC} strokeWidth="7" fill="none" strokeLinecap="round" />

        {/* cejas (serio en alerta) */}
        {animo === 'alerta' && (
          <g stroke={CAFE} strokeWidth="3.5" strokeLinecap="round">
            <path d="M66 74 L86 79" />
            <path d="M134 74 L114 79" />
          </g>
        )}

        {/* ojos */}
        {ojosCerrados ? (
          <g stroke={CAFE} strokeWidth="3.5" fill="none" strokeLinecap="round">
            <path d="M70 94 Q78 100 86 94" />
            <path d="M114 94 Q122 100 130 94" />
          </g>
        ) : contento ? (
          <g stroke={CAFE} strokeWidth="4" fill="none" strokeLinecap="round">
            <path d="M70 96 Q78 86 86 96" />
            <path d="M114 96 Q122 86 130 96" />
          </g>
        ) : (
          <g className="charm-ojos" style={{ transform: `scaleY(${parpadeo ? 0.08 : 1})`, transformOrigin: '100px 93px' }}>
            <ellipse cx="78" cy="93" rx={animo === 'alerta' ? 8.5 : 9.5} ry={animo === 'alerta' ? 9.5 : 11} fill="#1a0b06" />
            <ellipse cx="122" cy="93" rx={animo === 'alerta' ? 8.5 : 9.5} ry={animo === 'alerta' ? 9.5 : 11} fill="#1a0b06" />
            <g style={{ transform: `translate(${px}px, ${py}px)`, transition: 'transform .25s ease-out' }}>
              <circle cx="81" cy="89" r="3.6" fill="#fff" />
              <circle cx="125" cy="89" r="3.6" fill="#fff" />
              <circle cx="76" cy="97" r="1.6" fill="#fff" opacity=".8" />
              <circle cx="120" cy="97" r="1.6" fill="#fff" opacity=".8" />
            </g>
          </g>
        )}

        {/* mejillas */}
        <ellipse cx="60" cy="116" rx="9" ry="5.5" fill={animo === 'frio' ? '#9cc7ff' : '#ff8fa3'} opacity={animo === 'calor' || contento ? 0.75 : 0.45} />
        <ellipse cx="140" cy="116" rx="9" ry="5.5" fill={animo === 'frio' ? '#9cc7ff' : '#ff8fa3'} opacity={animo === 'calor' || contento ? 0.75 : 0.45} />

        {/* nariz y boca */}
        <path d="M94 104 Q100 100 106 104 Q103 110 100 110 Q97 110 94 104 Z" fill="#1a0b06" />
        {animo === 'alerta' ? (
          <path d="M94 119 L106 119" stroke={CAFE} strokeWidth="3" strokeLinecap="round" />
        ) : contento ? (
          <path d="M90 115 Q100 128 110 115 Z" fill="#7a2a1a" />
        ) : animo === 'sueno' ? (
          <ellipse cx="100" cy="118" rx="3.5" ry="2.5" fill="#7a2a1a" />
        ) : (
          <path d="M92 114 Q96 119 100 114 Q104 119 108 114" stroke={CAFE} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        )}

        {/* gota de sudor */}
        {animo === 'calor' && <path className="charm-sudor" d="M150 70 C146 78 146 84 150 86 C154 84 154 78 150 70 Z" fill="#8fd3ff" />}

        {/* copihue en la oreja (flor nacional de Chile) */}
        {copihue && (
          <g transform="translate(54 48) rotate(-25)">
            <path d="M0 0 C-7 6 -8 18 -2 24 L6 24 C10 18 8 6 0 0 Z" fill="#d9102b" />
            <path d="M-2 24 L0 28 L6 24" fill="#a10b20" />
            <path d="M0 0 C4 -6 10 -8 14 -6" stroke="#2f7a3a" strokeWidth="2.5" fill="none" />
          </g>
        )}

        {/* chupalla (sombrero huaso) */}
        {chupalla && (
          <g>
            <ellipse cx="100" cy="50" rx="66" ry="11" fill="#e8c77a" />
            <path d="M64 50 C64 22 136 22 136 50 Z" fill="#f0d48d" />
            <rect x="64" y="40" width="72" height="8" rx="3" fill="#1d1d1d" />
          </g>
        )}
      </g>

      {/* bufanda */}
      {bufanda && (
        <g>
          <path d="M58 138 C80 150 120 150 142 138 L144 150 C120 162 80 162 56 150 Z" fill="#d42e3a" />
          <path d="M120 150 L128 178 L116 180 L110 152 Z" fill="#b51f2b" />
          <path d="M64 142 L64 152 M80 146 L80 156 M96 148 L96 158 M112 148 L112 157 M128 145 L128 154" stroke="#fff" strokeWidth="2" opacity=".5" />
        </g>
      )}

      {/* paraguas */}
      {animo === 'lluvia' && (
        <g className="charm-paraguas">
          <path d="M150 128 L150 24" stroke="#2b2b2b" strokeWidth="3" />
          <path d="M150 128 q0 8 -8 8" stroke="#2b2b2b" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M86 40 Q150 -14 214 40 Q198 32 182 40 Q166 32 150 40 Q134 32 118 40 Q102 32 86 40 Z" fill="#2f8cff" />
        </g>
      )}

      {/* Zzz */}
      {animo === 'sueno' && (
        <g className="charm-zzz" fill="#cfe0ff" fontFamily="Inter, system-ui" fontWeight="800">
          <text x="150" y="58" fontSize="16">z</text>
          <text x="162" y="42" fontSize="20">z</text>
          <text x="176" y="24" fontSize="24">Z</text>
        </g>
      )}

      {/* alerta */}
      {animo === 'alerta' && (
        <g className="charm-aviso">
          <circle cx="166" cy="34" r="15" fill="#ffd23f" />
          <text x="166" y="41" textAnchor="middle" fontSize="20" fontWeight="900" fill="#1a1a1a" fontFamily="Inter, system-ui">!</text>
        </g>
      )}
    </g>
  )
}
