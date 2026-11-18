// Las 4 funciones bajo ZUMI: tarjetas grandes que abren cada función en pantalla completa (hoja).
// Así la portada es solo ZUMI + 4 puertas, y cada función tiene espacio para ser una herramienta de verdad.
import { useEffect, useState } from 'react'
import Hoja from './Hoja'
import { leerGrupo } from '../services/familiaGPS'

const FUNCIONES = [
  { id: 'familia', icono: '📍', titulo: 'Mi familia', sub: 'GPS familiar: ¿dónde están los tuyos?', tono: 'hogar' },
  { id: 'vecinos', icono: '📣', titulo: 'Vecinos', sub: 'Lo que ven cerca de ti, ahora', tono: 'vecinos' },
  { id: 'camaras', icono: '🎥', titulo: 'Cámaras', sub: 'Calles, cerros y cielo en vivo', tono: 'camara' },
  { id: 'cielo', icono: '🚀', titulo: 'Espacio', sub: 'SpaceX, Starship, la Luna y el cielo', tono: 'espacio' },
]

export default function Funciones({ familia, reportes, nReportes = 0, camaras, cielo }) {
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
  const contenido = { familia, vecinos: reportes, camaras, cielo }
  const actual = FUNCIONES.find((f) => f.id === abierta)
  const sub = (f) => (f.id === 'vecinos' && nReportes ? `${nReportes} avisos cerca de ti` : f.id === 'familia' && grupo ? 'Toca para ver dónde está cada uno' : f.sub)

  return (
    <section aria-label="Funciones" className="grid grid-cols-2 gap-3 pt-1">
      {FUNCIONES.filter((f) => contenido[f.id]).map((f) => (
        <button
          key={f.id}
          type="button"
          onClick={() => setAbierta(f.id)}
          className={`desplegable-boton tono-${f.tono} flex min-h-[8.5rem] flex-col items-start justify-between rounded-[26px] p-4 text-left text-white`}
        >
          <span className="grid size-12 place-items-center rounded-2xl bg-white/15 text-[28px]" aria-hidden="true">
            {f.icono}
          </span>
          <span>
            <span className="block text-[19px] leading-tight font-black">{f.titulo}</span>
            <span className="mt-0.5 block text-[13px] leading-snug text-white/85">{sub(f)}</span>
          </span>
        </button>
      ))}
      {actual && (
        <Hoja titulo={`${actual.icono} ${actual.titulo}`} onCerrar={() => setAbierta(null)}>
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
