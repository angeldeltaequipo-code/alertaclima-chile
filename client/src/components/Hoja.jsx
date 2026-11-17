import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Hoja inferior (como en Android): sube desde abajo, se cierra tocando fuera, con «Cerrar», con la tecla
 * Escape o arrastrándola hacia abajo desde el asa o el título (también desde el contenido si ya está
 * arriba del todo). En pantallas anchas se ve como un panel centrado.
 */
export default function Hoja({ titulo, onCerrar, puedeCerrar = true, children }) {
  const ref = useRef(null)
  const cuerpo = useRef(null)
  const [fase, setFase] = useState('entrando') // entrando → abierta → saliendo
  const [arrastre, setArrastre] = useState(0)
  const gesto = useRef(null)
  const reducido = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const id = requestAnimationFrame(() => setFase('abierta'))
    return () => cancelAnimationFrame(id)
  }, [])

  const cerrar = useCallback(() => {
    if (!puedeCerrar) return
    if (reducido) return onCerrar()
    setFase('saliendo')
    setTimeout(onCerrar, 220)
  }, [onCerrar, puedeCerrar, reducido])

  useEffect(() => {
    const previo = document.activeElement
    const inicial = ref.current?.querySelector('[data-autofocus]') ?? ref.current
    inicial?.focus()
    const tecla = (e) => {
      if (e.key === 'Escape') cerrar()
    }
    document.addEventListener('keydown', tecla)
    const desborde = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', tecla)
      document.body.style.overflow = desborde
      previo?.focus?.()
    }
  }, [cerrar])

  // Arrastrar hacia abajo para cerrar
  const empezar = (e, desdeContenido = false) => {
    if (!puedeCerrar) return
    if (desdeContenido && (cuerpo.current?.scrollTop ?? 0) > 0) return
    gesto.current = { y: e.clientY, t: performance.now(), desdeContenido, id: e.pointerId }
  }
  const mover = (e) => {
    const g = gesto.current
    if (!g || g.id !== e.pointerId) return
    const dy = Math.max(0, e.clientY - g.y)
    if (g.desdeContenido && dy < 8) return
    setArrastre(dy)
  }
  const soltar = (e) => {
    const g = gesto.current
    if (!g || g.id !== e.pointerId) return
    gesto.current = null
    const dy = Math.max(0, e.clientY - g.y)
    const vel = dy / Math.max(1, performance.now() - g.t) // px/ms
    if (dy > 120 || vel > 0.6) cerrar()
    setArrastre(0)
  }

  const visible = fase === 'abierta'
  const desplazamiento = fase === 'abierta' ? arrastre : '100%'

  return createPortal(
    <div
      className="hoja-fondo fixed inset-0 z-[1000] flex items-end justify-center sm:items-center"
      style={{ backgroundColor: `rgb(0 0 0 / ${visible ? 0.55 * (1 - Math.min(1, arrastre / 500)) : 0})` }}
      onClick={(e) => e.target === e.currentTarget && cerrar()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hoja-titulo"
        tabIndex={-1}
        className="hoja safe-bottom flex max-h-[94dvh] w-full max-w-xl flex-col rounded-t-[28px] bg-fondo shadow-[0_-8px_40px_rgb(0_0_0/0.35)] sm:max-h-[86dvh] sm:rounded-[28px]"
        style={{
          transform: `translateY(${typeof desplazamiento === 'number' ? `${desplazamiento}px` : desplazamiento})`,
          transition: arrastre ? 'none' : reducido ? 'none' : 'transform 260ms cubic-bezier(.2,.9,.25,1)',
        }}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={() => {
          gesto.current = null
          setArrastre(0)
        }}
      >
        <div className="cursor-grab touch-none select-none" onPointerDown={(e) => empezar(e)}>
          <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-texto-2/40" aria-hidden="true" />
          <div className="flex items-center gap-3 px-5 pt-2 pb-3">
            <h2 id="hoja-titulo" className="flex-1 text-[21px] font-bold">
              {titulo}
            </h2>
            {puedeCerrar && (
              <button
                type="button"
                onClick={cerrar}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="Cerrar"
                className="grid size-11 place-items-center rounded-full bg-superficie-2 active:scale-95"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <div ref={cuerpo} className="min-h-0 flex-1 overflow-y-auto overscroll-contain" onPointerDown={(e) => e.pointerType === 'touch' && empezar(e, true)}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
