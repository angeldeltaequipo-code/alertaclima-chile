// «Mira a ZUMI»: todas sus películas (hechas con Google Flow, con su voz) en una fila que se desliza.
// Al tocar una, se abre a pantalla completa con sonido. Las nuevas aparecen primero con un punto.
import { PELICULAS, RUTA_CINE, yaVista } from '../services/cine'

const ORDEN = ['pronostico', 'hola', 'sismo', 'temblor', 'lluvia', 'calor', 'mochila', 'alarma', 'iglesia']

export default function VideosZumi() {
  const ids = [...ORDEN.filter((id) => PELICULAS[id]), ...Object.keys(PELICULAS).filter((id) => !ORDEN.includes(id))]
  const lista = [...ids.filter((id) => !yaVista(id)), ...ids.filter((id) => yaVista(id))]
  return (
    <section aria-labelledby="t-videos" className="pt-1">
      <div className="mb-2 flex items-baseline justify-between px-0.5">
        <h2 id="t-videos" className="text-[19px] font-bold">Mira a ZUMI</h2>
        <span className="text-[13px] text-texto-2">{ids.length} videos</span>
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {lista.map((id) => {
          const p = PELICULAS[id]
          const nuevo = !yaVista(id)
          return (
            <button
              key={id}
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('ac:pelicula', { detail: id }))}
              className="video-zumi relative w-[132px] shrink-0 snap-start overflow-hidden rounded-[20px] bg-superficie text-left"
              aria-label={`Ver: ${p.titulo}`}
            >
              <img src={`${RUTA_CINE}${id}.webp`} alt="" loading="lazy" className="aspect-[9/14] w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2.5 pt-8 pb-2.5 text-[13.5px] leading-tight font-bold text-white">
                {p.titulo}
              </span>
              <span className="absolute top-2 left-2 grid size-8 place-items-center rounded-full bg-black/55 text-[13px] text-white" aria-hidden="true">▶</span>
              {nuevo && <span className="absolute top-2 right-2 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-black">Nuevo</span>}
            </button>
          )
        })}
      </div>
    </section>
  )
}
