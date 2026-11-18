// Sección plegable de la pestaña Ahora (como «Cielo y espacio en vivo»): una tarjeta-botón con ícono,
// título y un adelanto de lo que hay adentro; al tocarla se abre con animación. Así ZUMI queda como
// protagonista y la página es corta. Los atajos de arriba la abren con irASeccion(id).
import { useEffect, useState } from 'react'
import Plegable, { Flecha } from './Plegable'

export function irASeccion(id) {
  window.dispatchEvent(new CustomEvent('ac:abrir-seccion', { detail: id }))
  setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
}

export default function Desplegable({ id, icono, titulo, adelanto, tono = 'cielo', abiertoInicial = false, children }) {
  const [abierto, setAbierto] = useState(abiertoInicial)
  useEffect(() => {
    const f = (e) => e.detail === id && setAbierto(true)
    window.addEventListener('ac:abrir-seccion', f)
    return () => window.removeEventListener('ac:abrir-seccion', f)
  }, [id])
  return (
    <section aria-labelledby={id} className="scroll-mt-16">
      <button
        type="button"
        id={id}
        aria-expanded={abierto}
        onClick={() => setAbierto(!abierto)}
        className={`desplegable-boton tono-${tono} flex min-h-[4.25rem] w-full items-center gap-3 rounded-[24px] px-4 py-3 text-left text-white`}
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-white/15 text-[24px]" aria-hidden="true">
          {icono}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[18px] leading-tight font-bold">{titulo}</span>
          {adelanto && <span className="mt-0.5 block truncate text-[14px] text-white/85">{adelanto}</span>}
        </span>
        <Flecha abierto={abierto} size={18} />
      </button>
      <Plegable abierto={abierto}>
        <div className="mt-3 space-y-3">{children}</div>
      </Plegable>
    </section>
  )
}
