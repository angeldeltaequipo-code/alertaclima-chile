import { useEffect, useState } from 'react'

/**
 * Contenido que se abre y se cierra con una animación de altura (como los desplegables de Android),
 * en vez de aparecer de golpe. Lo de adentro se crea la primera vez que se abre y luego se conserva,
 * para que volver a abrirlo sea instantáneo. Cerrado, no se puede enfocar ni leer con lector de pantalla.
 */
export default function Plegable({ abierto, children, className = '' }) {
  const [visto, setVisto] = useState(abierto)
  useEffect(() => {
    if (abierto) setVisto(true)
  }, [abierto])
  return (
    <div
      className={`plegable grid ${abierto ? 'plegable-abierto' : ''}`}
      style={{ gridTemplateRows: abierto ? '1fr' : '0fr' }}
      inert={!abierto ? true : undefined}
      aria-hidden={!abierto}
    >
      <div className={`min-h-0 overflow-hidden ${className}`}>{visto && children}</div>
    </div>
  )
}

/** Flecha que gira al abrir. */
export function Flecha({ abierto, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true" className="flecha-plegable shrink-0" style={{ transform: abierto ? 'rotate(180deg)' : 'none' }}>
      <path d="M3 5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
