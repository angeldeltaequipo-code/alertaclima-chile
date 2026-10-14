import { useEffect, useRef } from 'react'

/** Panel de pantalla completa (en móvil) para selector y ajustes. */
export default function Hoja({ titulo, onCerrar, puedeCerrar = true, children }) {
  const ref = useRef(null)

  useEffect(() => {
    const previo = document.activeElement
    const inicial = ref.current?.querySelector('[data-autofocus]') ?? ref.current
    inicial?.focus()
    const tecla = (e) => {
      if (e.key === 'Escape' && puedeCerrar) onCerrar()
    }
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('keydown', tecla)
      previo?.focus?.()
    }
  }, [onCerrar, puedeCerrar])

  return (
    <div className="fixed inset-0 z-[1000] flex justify-center bg-black/60">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="hoja-titulo"
        tabIndex={-1}
        className="safe-top safe-bottom flex h-full w-full max-w-xl flex-col bg-fondo"
      >
        <div className="flex items-center gap-3 border-b-2 border-borde px-4 py-3">
          <h2 id="hoja-titulo" className="flex-1 text-[22px] font-bold">
            {titulo}
          </h2>
          {puedeCerrar && (
            <button
              type="button"
              onClick={onCerrar}
              className="min-h-11 rounded-lg border-2 border-borde px-4 text-[15px] font-bold"
            >
              Cerrar
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </div>
  )
}
