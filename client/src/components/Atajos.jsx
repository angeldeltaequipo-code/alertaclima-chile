// Atajos de la pestaña Ahora: chips fijos arriba para saltar a cada sección de una página larga,
// marcando en cuál estás.
import { useEffect, useState } from 'react'

const SECCIONES = [
  ['t-familia', 'Familia'],
  ['t-horas', '24 horas'],
  ['t-dias', '7 días'],
  ['t-lluvia', 'Lluvia'],
  ['t-reportes', 'Vecinos'],
  ['t-camaras', 'Cámaras'],
  ['t-detalle', 'Detalle'],
  ['t-cielo-ancla', 'Cielo y espacio'],
]

export default function Atajos() {
  const [hay, setHay] = useState(SECCIONES)
  const [activa, setActiva] = useState(null)

  useEffect(() => {
    const raiz = document.getElementById('vista-ahora')
    const t = setTimeout(() => {
      const presentes = SECCIONES.filter(([id]) => document.getElementById(id))
      setHay(presentes)
      const io = new IntersectionObserver(
        (entradas) => {
          for (const e of entradas) if (e.isIntersecting) setActiva(e.target.id)
        },
        { root: raiz, rootMargin: '-15% 0px -70% 0px' },
      )
      presentes.forEach(([id]) => io.observe(document.getElementById(id)))
      raiz?._atajos?.disconnect()
      if (raiz) raiz._atajos = io
    }, 600)
    return () => {
      clearTimeout(t)
      raiz?._atajos?.disconnect()
    }
  }, [])

  if (!hay.length) return null
  return (
    <nav aria-label="Ir a una sección" className="atajos sticky top-0 z-20 -mx-4 -mt-3 px-4 py-2">
      <ul className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {hay.map(([id, nombre]) => (
          <li key={id}>
            <button
              type="button"
              aria-current={activa === id ? 'true' : undefined}
              onClick={() => {
                const el = document.getElementById(id)
                ;(el?.closest('section') ?? el)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className={`min-h-9 shrink-0 rounded-full px-3.5 text-[14px] font-bold whitespace-nowrap transition-colors ${activa === id ? 'bg-senal text-sobre-senal' : 'bg-superficie/90 text-texto ring-1 ring-linea'}`}
            >
              {nombre}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
