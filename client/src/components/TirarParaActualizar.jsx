// «Tira hacia abajo para actualizar» en la pestaña Ahora (como en las apps nativas):
// estando arriba del todo, arrastra hacia abajo y suelta para traer el clima, las alertas y los
// reportes recién salidos.
import { useEffect, useRef, useState } from 'react'

const UMBRAL = 72

export default function TirarParaActualizar({ idContenedor, onActualizar }) {
  const [tiro, setTiro] = useState(0)
  const [cargando, setCargando] = useState(false)
  const inicio = useRef(null)
  const actual = useRef(0)

  useEffect(() => {
    const el = document.getElementById(idContenedor)
    if (!el) return
    const empezar = (e) => {
      inicio.current = el.scrollTop <= 0 && !cargando ? e.touches[0].clientY : null
    }
    const mover = (e) => {
      if (inicio.current == null) return
      const d = e.touches[0].clientY - inicio.current
      if (d <= 0 || el.scrollTop > 0) {
        actual.current = 0
        setTiro(0)
        return
      }
      actual.current = Math.min(120, d * 0.5)
      setTiro(actual.current)
    }
    const soltar = async () => {
      if (inicio.current == null) return
      inicio.current = null
      const listo = actual.current >= UMBRAL * 0.5 + 20
      actual.current = 0
      setTiro(0)
      if (!listo) return
      setCargando(true)
      navigator.vibrate?.(12)
      try {
        await onActualizar()
      } finally {
        setTimeout(() => setCargando(false), 500)
      }
    }
    el.addEventListener('touchstart', empezar, { passive: true })
    el.addEventListener('touchmove', mover, { passive: true })
    el.addEventListener('touchend', soltar)
    el.addEventListener('touchcancel', soltar)
    return () => {
      el.removeEventListener('touchstart', empezar)
      el.removeEventListener('touchmove', mover)
      el.removeEventListener('touchend', soltar)
      el.removeEventListener('touchcancel', soltar)
    }
  }, [idContenedor, onActualizar, cargando])

  const visible = tiro > 6 || cargando
  const progreso = Math.min(1, tiro / (UMBRAL * 0.5 + 20))
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center transition-transform duration-200"
      style={{ transform: `translateY(${cargando ? 14 : Math.max(-48, tiro - 40)}px)`, opacity: visible ? 1 : 0 }}
      role="status"
      aria-live="polite"
    >
      <span className="flex items-center gap-2 rounded-full bg-superficie px-3 py-1.5 text-[13px] font-bold shadow-lg ring-1 ring-linea">
        <svg width="18" height="18" viewBox="0 0 24 24" className={cargando ? 'animate-spin' : ''} style={{ transform: cargando ? undefined : `rotate(${progreso * 270}deg)` }} aria-hidden="true">
          <path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {cargando ? 'Actualizando…' : progreso >= 1 ? 'Suelta para actualizar' : 'Tira para actualizar'}
      </span>
    </div>
  )
}
