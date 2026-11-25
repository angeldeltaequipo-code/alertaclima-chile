// «Looks» de ZUMI: sus estilos (creados con Google Flow / Gemini). Desliza o toca las flechas para
// cambiarle la ropa; el que elijas queda guardado y ZUMI te saluda con él.
import { useRef, useState } from 'react'

export const LOOKS = [
  { id: 'invierno', nombre: 'Invierno' },
  { id: 'casual', nombre: 'Casual' },
  { id: 'lector', nombre: 'Lector' },
  { id: 'elegante', nombre: 'Elegante' },
  { id: 'urbano', nombre: 'Urbano' },
  { id: 'campamento', nombre: 'Campamento' },
  { id: 'explorador', nombre: 'Explorador' },
  { id: 'montana', nombre: 'Montaña' },
]
const RUTA = `${import.meta.env.BASE_URL}zumi/looks/`
const K = 'ac:zumi-look'

export default function ZumiLooks({ onTocar }) {
  const [i, setI] = useState(() => {
    try {
      const v = localStorage.getItem(K)
      return Math.max(0, LOOKS.findIndex((l) => l.id === v))
    } catch {
      return 0
    }
  })
  const [dicho, setDicho] = useState(null)
  const inicio = useRef(null)
  const ir = (d) => {
    const n = (i + d + LOOKS.length) % LOOKS.length
    setI(n)
    setDicho(`¿Te gusta mi look ${LOOKS[n].nombre.toLowerCase()}?`)
    try {
      localStorage.setItem(K, LOOKS[n].id)
    } catch {
      /* sin almacenamiento */
    }
  }
  const l = LOOKS[i]
  return (
    <div
      className="zumi-looks absolute inset-0 overflow-hidden bg-[#1b1410]"
      onPointerDown={(e) => (inicio.current = e.clientX)}
      onPointerUp={(e) => {
        const dx = e.clientX - (inicio.current ?? e.clientX)
        if (Math.abs(dx) > 40) ir(dx < 0 ? 1 : -1)
        else if (!e.target.closest('button')) setDicho(onTocar?.() ?? null)
        inicio.current = null
      }}
    >
      {LOOKS.map((x, k) => (
        <img
          key={x.id}
          src={`${RUTA}${x.id}.webp`}
          alt={k === i ? `ZUMI con su look ${x.nombre}` : ''}
          loading={k === i ? 'eager' : 'lazy'}
          className={`zumi-look-img absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${k === i ? 'opacity-100' : 'opacity-0'}`}
          style={{ objectPosition: '50% 38%' }}
          draggable={false}
        />
      ))}
      <div className="escenario-velo pointer-events-none absolute inset-0" aria-hidden="true" />
      {dicho && (
        <p className="vidrio absolute top-[7.2rem] right-3 left-3 mx-auto max-w-sm rounded-2xl px-3 py-2 text-[14px] leading-snug" aria-live="polite">
          {dicho}
        </p>
      )}
      <div className="absolute top-[30%] right-0 left-0 flex justify-between px-2">
        <button type="button" onClick={() => ir(-1)} aria-label="Look anterior" className="vidrio grid size-10 place-items-center rounded-full text-[18px]">
          ‹
        </button>
        <button type="button" onClick={() => ir(1)} aria-label="Look siguiente" className="vidrio grid size-10 place-items-center rounded-full text-[18px]">
          ›
        </button>
      </div>
      <p className="vidrio pointer-events-none absolute top-[calc(30%+3.2rem)] left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[12px] font-semibold whitespace-nowrap">
        Look {l.nombre} · {i + 1}/{LOOKS.length}
      </p>
    </div>
  )
}
