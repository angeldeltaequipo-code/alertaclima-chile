// Las 4 funciones bajo ZUMI: tarjetas grandes que abren cada función en pantalla completa (hoja).
// Así la portada es solo ZUMI + 4 puertas, y cada función tiene espacio para ser una herramienta de verdad.
import { useEffect, useState } from 'react'
import Hoja from './Hoja'
import { leerGrupo } from '../services/familiaGPS'

const FUNCIONES = [
  { id: 'familia', icono: '📍', titulo: 'Mi familia', rotulo: 'GPS · cifrado', sub: '¿Dónde están los tuyos?', acento: 'familia' },
  { id: 'vecinos', icono: '📣', titulo: 'Vecinos', rotulo: 'Red local', sub: 'Lo que ven cerca de ti', acento: 'vecinos' },
  { id: 'aire', icono: '🌫️', titulo: 'Aire', rotulo: 'MP2,5 · en vivo', sub: '¿Se puede respirar hoy?', acento: 'camaras' },
  { id: 'cielo', icono: '🚀', titulo: 'Espacio', rotulo: 'SpaceX · X', sub: 'Starship, Starlink y la Luna', acento: 'espacio' },
]

// Íconos de línea, del mismo trazo que la barra inferior.
const ICONO = {
  familia: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  vecinos: (
    <>
      <path d="M4 10v4h3l6 4V6L7 10H4z" />
      <path d="M17 9.5a3.5 3.5 0 0 1 0 5M19.5 7a7 7 0 0 1 0 10" />
    </>
  ),
  aire: (
    <>
      <path d="M3 8h11a3 3 0 1 0-3-3" />
      <path d="M3 12h16a3 3 0 1 1-3 3" />
      <path d="M3 16h7" />
    </>
  ),
  cielo: (
    <>
      <path d="M12 3c3 2.2 4.5 5.6 4.5 9.2V16h-9v-3.8C7.5 8.6 9 5.2 12 3z" />
      <path d="M7.5 13.5L5 16.5V19l2.5-1.5M16.5 13.5l2.5 3V19l-2.5-1.5M10 19.5c.6 1 1.3 1.5 2 1.5s1.4-.5 2-1.5" />
      <circle cx="12" cy="9.5" r="1.4" />
    </>
  ),
}

export default function Funciones({ familia, reportes, nReportes = 0, aire, cielo }) {
  const [abierta, setAbierta] = useState(() => {
    const p = pendiente
    pendiente = null
    return p
  })
  const grupo = leerGrupo()
  // los atajos de otras pantallas (ZUMI, avisos) pueden abrir una función directo
  useEffect(() => {
    const f = (e) => {
      if (!FUNCIONES.some((x) => x.id === e.detail)) return
      pendiente = null
      setAbierta(e.detail)
    }
    window.addEventListener('ac:abrir-funcion', f)
    return () => window.removeEventListener('ac:abrir-funcion', f)
  }, [])
  const contenido = { familia, vecinos: reportes, aire, cielo }
  const actual = FUNCIONES.find((f) => f.id === abierta)
  const sub = (f) => (f.id === 'vecinos' && nReportes ? `${nReportes} avisos cerca de ti` : f.id === 'familia' && grupo ? 'Toca para ver dónde está cada uno' : f.sub)

  return (
    <section aria-label="Funciones" className="pt-1">
      <div className="mb-2.5 flex items-baseline justify-between px-0.5">
        <h2 className="rotulo">Funciones</h2>
        <span className="rotulo flex items-center gap-2 !tracking-[0.1em]">
          <span className="punto-vivo" aria-hidden="true" /> Sistema en línea
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {FUNCIONES.filter((f) => contenido[f.id]).map((f, i) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setAbierta(f.id)}
            className={`funcion acento-${f.acento} entrar flex min-h-[9rem] flex-col items-start justify-between p-4 text-left`}
            style={{ animationDelay: `${80 + i * 60}ms` }}
          >
            <span className="flex w-full items-start justify-between">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="funcion-icono" aria-hidden="true">
                {ICONO[f.id]}
              </svg>
              <span className="mono text-[11px] text-texto-2" aria-hidden="true">
                0{i + 1}
              </span>
            </span>
            <span>
              <span className="rotulo block !text-[10px]" style={{ color: 'var(--acento)' }}>
                {f.rotulo}
              </span>
              <span className="titulo-x mt-1 block text-[20px]">{f.titulo}</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-texto-2">{sub(f)}</span>
            </span>
          </button>
        ))}
      </div>
      {actual && (
        <Hoja titulo={actual.titulo} onCerrar={() => setAbierta(null)}>
          <div className="space-y-3 px-4 pb-6">{contenido[actual.id]}</div>
        </Hoja>
      )}
    </section>
  )
}

// Si todavía no se muestra la portada (cargando el clima), la función se abre apenas aparezca.
let pendiente = null
export const abrirFuncion = (id) => {
  pendiente = id
  window.dispatchEvent(new CustomEvent('ac:abrir-funcion', { detail: id }))
}
