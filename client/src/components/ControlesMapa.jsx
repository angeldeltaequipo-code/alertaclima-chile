import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Íconos de cada capa (trazos de 24×24).
const ICONOS = {
  capas: <path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5" />,
  sismos: <path d="M2 12h4l2-6 3 12 3-9 2 3h6" />,
  volcanes: <path d="M3 20l6.5-10h5L21 20zM10 7c.5-1.5 1.5-2 2-4 .5 2 1.5 2.5 2 4" />,
  nubes: <path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 9.1 4.5 4.5 0 0 0 7 18z" />,
  evac: (
    <>
      <circle cx="14" cy="4" r="2" />
      <path d="M8 21l3-7 3 3v5M6 12l3-4h5l3 4M11 14l-1-5" />
    </>
  ),
  camaras: <path d="M3 7h12v10H3zM15 10l6-3v10l-6-3z" />,
  rios: <path d="M2 9c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2M2 15c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2 2-2 4-2" />,
  calle: (
    <>
      <circle cx="12" cy="5" r="3" />
      <path d="M8 10.5Q12 8.5 16 10.5L15.5 15H14l-.6 6h-2.8l-.6-6H8.5z" />
    </>
  ),
  satelite: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </>
  ),
}

function Icono({ id, color, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONOS[id]}
    </svg>
  )
}

function Chip({ activo, onClick, color, etiqueta, texto, icono }) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      aria-label={etiqueta}
      onClick={onClick}
      style={activo ? { background: color } : undefined}
      className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-[14px] font-bold whitespace-nowrap shadow-lg ring-1 ring-linea backdrop-blur ${activo ? 'text-white' : 'bg-superficie/95 text-texto'}`}
    >
      <Icono id={icono} color={activo ? 'currentColor' : color} />
      {texto}
    </button>
  )
}

/** Interruptor accesible (role="switch"). */
function Interruptor({ activo, color }) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors"
      style={{ background: activo ? color : 'color-mix(in srgb, currentColor 22%, transparent)' }}
    >
      <span className={`absolute size-5 rounded-full bg-white shadow transition-transform ${activo ? 'translate-x-6' : 'translate-x-1'}`} />
    </span>
  )
}

/**
 * Controles sobre el mapa.
 * - «Capas»: abre una hoja con todas las capas explicadas en una frase, con interruptores.
 * - Al lado, una fila de accesos rápidos que se desliza sola, despacio (se detiene al tocarla).
 */
export default function ControlesMapa({
  base,
  onBase,
  modoCalle,
  onModoCalle,
  onRios,
  riosActivo,
  onSismos,
  sismosActivo,
  onEvac,
  evacActivo,
  camarasActivo,
  onCamaras,
  volcanesActivo,
  onVolcanes,
  nubesActivo,
  onNubes,
}) {
  const fila = useRef(null)
  const pausa = useRef(0)
  const [hoja, setHoja] = useState(false)

  useEffect(() => {
    const calma = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (calma) return
    let raf
    let dir = 1
    let x = 0
    const paso = () => {
      raf = requestAnimationFrame(paso)
      const el = fila.current
      if (!el || document.hidden || performance.now() < pausa.current) return
      const max = el.scrollWidth - el.clientWidth
      if (max <= 2) return
      x = Math.max(0, Math.min(max, (Math.abs(x - el.scrollLeft) > 3 ? el.scrollLeft : x) + dir * 0.35))
      el.scrollLeft = x
      if (x >= max || x <= 0) {
        dir = -dir
        pausa.current = performance.now() + 1800
      }
    }
    pausa.current = performance.now() + 2500
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [])
  const detener = () => (pausa.current = performance.now() + 6000)

  const capas = [
    { id: 'sismos', texto: 'Sismos', desc: 'Temblores de los últimos 7 días. Más grande y rojo = más fuerte.', color: '#f97316', activo: sismosActivo, accion: onSismos },
    { id: 'volcanes', texto: 'Volcanes', desc: 'Los 31 volcanes vigilados, con su color de alerta.', color: '#b45309', activo: volcanesActivo, accion: onVolcanes },
    { id: 'nubes', texto: 'Nubes', desc: 'Foto del satélite de la NASA, cada 10 minutos.', color: '#64748b', activo: nubesActivo, accion: onNubes },
    { id: 'evac', texto: 'Evacuación', etiqueta: 'Vías de evacuación', desc: 'Zonas seguras y rutas para llegar a pie.', color: '#16a34a', activo: evacActivo, accion: onEvac },
    { id: 'camaras', texto: 'Cámaras', etiqueta: 'Cámaras en vivo', desc: 'Cámaras públicas: mira cómo está el cielo y las calles.', color: '#0369a1', activo: camarasActivo, accion: onCamaras },
    { id: 'rios', texto: 'Ríos', etiqueta: 'Ríos cercanos', desc: 'Ríos y quebradas cerca de ti, por si crecen con la lluvia.', color: '#1a73e8', activo: riosActivo, accion: onRios },
  ]
  const activas = capas.filter((c) => c.activo).length + (base === 'satelite' ? 1 : 0)

  return (
    <>
      <div className="absolute top-3 right-[4.25rem] left-3 z-[500] flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setHoja(true)}
          aria-haspopup="dialog"
          aria-label={`Capas del mapa${activas ? `, ${activas} activas` : ''}`}
          className="relative flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-senal px-3 text-[14px] font-bold text-sobre-senal shadow-lg"
        >
          <Icono id="capas" color="currentColor" />
          Capas
          {activas > 0 && (
            <span className="grid min-w-5 place-items-center rounded-full bg-sobre-senal px-1 text-[12px] leading-5 text-senal tabular-nums" aria-hidden="true">
              {activas}
            </span>
          )}
        </button>
        <div
          ref={fila}
          onPointerDown={detener}
          onWheel={detener}
          onTouchStart={detener}
          className="fila-capas flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1 pr-1 [scrollbar-width:none]"
        >
          {capas.map((c) => (
            <Chip key={c.id} activo={c.activo} onClick={c.accion} color={c.color} etiqueta={c.etiqueta ?? c.texto} texto={c.texto} icono={c.id} />
          ))}
          <Chip activo={base === 'satelite'} onClick={() => onBase(base === 'satelite' ? 'mapa' : 'satelite')} color="#0f766e" etiqueta="Vista satélite" texto="Satélite" icono="satelite" />
          <Chip activo={modoCalle} onClick={() => onModoCalle(!modoCalle)} color="#ca8a04" etiqueta={modoCalle ? 'Cancelar ver la calle' : 'Ver la calle'} texto={modoCalle ? 'Cancelar' : 'Calle'} icono="calle" />
        </div>
      </div>

      {modoCalle && (
        <p role="status" className="absolute top-16 right-3 left-3 z-[500] mx-auto max-w-sm rounded-xl bg-senal px-3 py-2 text-center text-[15px] font-bold text-sobre-senal shadow-lg">
          Toca un lugar del mapa para verlo como si estuvieras en la calle.
        </p>
      )}

      {hoja &&
        createPortal(
        <div className="fixed inset-0 z-[3000] flex items-end justify-center bg-black/45" onClick={() => setHoja(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="t-hoja-capas"
            onClick={(e) => e.stopPropagation()}
            className="hoja-capas safe-bottom max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-t-[28px] px-4 pt-3 pb-5 shadow-2xl"
          >
            <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-current/20" aria-hidden="true" />
            <div className="flex items-center justify-between">
              <h2 id="t-hoja-capas" className="text-[22px] font-bold">
                ¿Qué quieres ver en el mapa?
              </h2>
              <button type="button" onClick={() => setHoja(false)} className="grid size-11 place-items-center rounded-full text-[26px]" aria-label="Cerrar">
                ×
              </button>
            </div>

            <p className="mt-3 mb-1.5 text-[13px] font-black tracking-[0.12em] text-texto-2 uppercase">Tipo de mapa</p>
            <div role="radiogroup" aria-label="Tipo de mapa" className="grid grid-cols-2 gap-2">
              {[
                ['mapa', 'Mapa', 'Calles y nombres'],
                ['satelite', 'Satélite', 'Fotos aéreas'],
              ].map(([k, t, d]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={base === k}
                  onClick={() => onBase(k)}
                  className={`rounded-2xl px-3 py-2.5 text-left ring-2 ${base === k ? 'bg-senal/15 ring-senal' : 'ring-linea'}`}
                >
                  <span className="block text-[16px] font-bold">{t}</span>
                  <span className="block text-[13px] text-texto-2">{d}</span>
                </button>
              ))}
            </div>

            <p className="mt-4 mb-1.5 text-[13px] font-black tracking-[0.12em] text-texto-2 uppercase">Capas</p>
            <ul className="divide-y divide-linea">
              {capas.map((c) => (
                <li key={c.id}>
                  <button type="button" role="switch" aria-checked={c.activo} onClick={c.accion} className="flex min-h-16 w-full items-center gap-3 py-2 text-left">
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl" style={{ background: `color-mix(in srgb, ${c.color} 18%, transparent)` }}>
                      <Icono id={c.id} color={c.color} size={22} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] font-bold">{c.etiqueta ?? c.texto}</span>
                      <span className="block text-[14px] leading-snug text-texto-2">{c.desc}</span>
                    </span>
                    <Interruptor activo={c.activo} color={c.color} />
                  </button>
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => {
                setHoja(false)
                onModoCalle(true)
              }}
              className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-superficie-2 px-3 text-[16px] font-bold"
            >
              <Icono id="calle" color="#ca8a04" />
              Ver un lugar a nivel de calle
            </button>
            <button type="button" onClick={() => setHoja(false)} className="mt-2 min-h-12 w-full rounded-2xl bg-senal text-[17px] font-bold text-sobre-senal">
              Listo
            </button>
          </div>
        </div>,
          document.querySelector('.con-cosmos') ?? document.body,
        )}
    </>
  )
}
