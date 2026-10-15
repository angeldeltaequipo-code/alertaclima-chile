import { useEffect, useRef, useState } from 'react'
import { hace } from '../services/reportes'
import ImagenViva from './ImagenViva'

export const CREDITO_WINDY = (
  <>
    Cámaras: <a href="https://www.windy.com/" target="_blank" rel="noopener" className="underline">Windy.com</a> ·{' '}
    <a href="https://www.windy.com/webcams/add" target="_blank" rel="noopener" className="underline">
      Agrega una cámara
    </a>
  </>
)

const cuando = (iso) => (iso ? hace(new Date(iso)) : 'sin hora informada')
// Una imagen de hace más de 3 horas ya no muestra lo que pasa ahora.
const reciente = (iso) => iso && Date.now() - new Date(iso).getTime() < 3 * 3600e3

function Etiqueta({ children, viva = false }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[12px] font-bold text-white backdrop-blur-sm">
      {viva && <span className="size-2 animate-pulse rounded-full bg-[#4ade80]" aria-hidden="true" />}
      {children}
    </span>
  )
}

/** Tarjeta de una cámara en la lista: la imagen con su nombre encima. Al tocarla se abre el visor. */
export function TarjetaCamara({ camara, onAbrir }) {
  return (
    <button type="button" onClick={() => onAbrir(camara)} className="group block w-full text-left" aria-label={`Ver la cámara ${camara.titulo}`}>
      <span className="relative block overflow-hidden rounded-2xl bg-superficie-2">
        <ImagenViva src={camara.miniatura} etiqueta={false} className="aspect-video w-full" />
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pt-8 pb-2">
          <span className="block truncate text-[15px] font-bold text-white">{camara.titulo.split(':').pop().trim()}</span>
          <span className="block truncate text-[12px] text-white/85">{camara.lugar ?? camara.titulo}</span>
        </span>
        <span className="absolute top-2 left-2 flex gap-1">
          <Etiqueta viva={reciente(camara.actualizada)}>{cuando(camara.actualizada)}</Etiqueta>
        </span>
        <span className="absolute top-2 right-2">
          <Etiqueta>{camara.distanciaKm < 1 ? 'Aquí' : `${Math.round(camara.distanciaKm)} km`}</Etiqueta>
        </span>
        {camara.reproductor && (
          <span className="absolute right-2 bottom-2 grid size-9 place-items-center rounded-full bg-white/90 text-black shadow" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <path d="M3.5 2l8 5-8 5z" fill="currentColor" />
            </svg>
          </span>
        )}
      </span>
    </button>
  )
}

/** Sección de la pestaña Ahora. Si no hay clave de Windy, no aparece; si no hay cámaras, lo dice. */
export default function CamarasCercanas({ datos, comuna, onAbrir, totalChile = 0, onVerMapa = null }) {
  if (!datos.disponible) return null
  const { camaras } = datos
  const cerca = camaras.filter((c) => !c.lejana)
  const lejos = camaras.filter((c) => c.lejana)
  return (
    <section aria-labelledby="t-camaras" className="tarjeta">
      <h2 id="t-camaras" className="titulo-tarjeta">
        Cámaras en vivo
      </h2>
      {camaras.length === 0 ? (
        <p className="text-[16px] text-texto-2">
          No hay cámaras públicas cerca de {comuna.nombre}. Las fotos de los reportes de vecinos son la mejor forma de ver cómo
          están las calles.
        </p>
      ) : (
        <>
          <p className="mb-3 text-[15px] text-texto-2">
            {cerca.length
              ? 'Cámaras públicas de la zona. Toca una para verla en grande y ver cómo cambió durante el día.'
              : `No hay cámaras públicas en ${comuna.nombre}; estas son las más cercanas.`}
          </p>
          <Carrusel camaras={cerca.length ? cerca : lejos} onAbrir={onAbrir} />
          {cerca.length > 0 && lejos.length > 0 && (
            <>
              <h3 className="mt-4 mb-2 text-[16px] font-bold">Más lejos</h3>
              <Carrusel camaras={lejos} onAbrir={onAbrir} />
            </>
          )}
        </>
      )}
      {onVerMapa && totalChile > 0 && (
        <button type="button" onClick={onVerMapa} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-superficie-2 text-[15px] font-bold">
          Ver las {totalChile} cámaras de Chile en el mapa
        </button>
      )}
      <p className="mt-3 text-[12px] text-texto-2">{CREDITO_WINDY}</p>
    </section>
  )
}

function Carrusel({ camaras, onAbrir }) {
  return (
    <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {camaras.map((c) => (
        <li key={c.id} className="w-64 shrink-0 snap-start">
          <TarjetaCamara camara={c} onAbrir={onAbrir} />
        </li>
      ))}
    </ul>
  )
}

/**
 * Visor de una cámara dentro de la app: la imagen actual y, si Windy lo ofrece, el
 * reproductor con la secuencia del día. Según las condiciones de Windy, la imagen
 * enlaza a su reproductor o a su página, y se muestra sin agrandarla.
 */
export function VisorCamara({ camara, onCerrar }) {
  // Si Windy tiene la secuencia del día, se abre directo en ella: se ve el movimiento de las nubes y la luz.
  const [modo, setModo] = useState(camara.reproductor ? 'dia' : 'imagen')
  const [cargado, setCargado] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const previo = document.activeElement
    ref.current?.focus()
    const tecla = (e) => e.key === 'Escape' && onCerrar()
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('keydown', tecla)
      previo?.focus?.()
    }
  }, [onCerrar])

  const [lugar, nombre] = camara.titulo.includes(':') ? camara.titulo.split(/:(.*)/) : [camara.lugar, camara.titulo]

  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/75 sm:items-center" onClick={onCerrar}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`Cámara ${camara.titulo}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="safe-bottom w-full max-w-xl rounded-t-3xl bg-superficie p-4 shadow-2xl sm:rounded-3xl"
      >
        <div className="mb-3 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[19px] leading-tight font-bold">{(nombre ?? camara.titulo).trim()}</p>
            <p className="truncate text-[14px] text-texto-2">
              {(lugar ?? '').trim()} · a {camara.distanciaKm < 1 ? 'menos de 1' : Math.round(camara.distanciaKm)} km
            </p>
            <p className="text-[14px] text-texto-2">Imagen {cuando(camara.actualizada)}</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar cámara"
            className="grid size-11 shrink-0 place-items-center rounded-full bg-superficie-2"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {camara.reproductor && (
          <div role="tablist" aria-label="Qué ver" className="mb-3 grid grid-cols-2 rounded-xl bg-superficie-2 p-1">
            {[
              ['dia', '▶ Animación de hoy'],
              ['imagen', 'Imagen actual'],
            ].map(([k, t]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={modo === k}
                onClick={() => setModo(k)}
                className={`min-h-11 rounded-lg text-[15px] font-bold ${modo === k ? 'bg-superficie text-texto shadow' : 'text-texto-2'}`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        <div className="grid aspect-video place-items-center overflow-hidden rounded-2xl bg-black">
          {modo === 'imagen' || !camara.reproductor ? (
            <a
              href={camara.reproductor ? undefined : camara.enlace}
              target="_blank"
              rel="noopener"
              onClick={(e) => {
                if (camara.reproductor) {
                  e.preventDefault()
                  setModo('dia')
                }
              }}
              className="grid h-full w-full place-items-center"
            >
              {/* La imagen se muestra a su tamaño o menor, nunca agrandada (condición de Windy). */}
              <img src={camara.imagen} alt={`Imagen actual de la cámara ${camara.titulo}`} className="block max-h-full max-w-full" />
            </a>
          ) : (
            <div className="relative h-full w-full">
              {!cargado && <p className="absolute inset-0 grid place-items-center text-[15px] text-white/80">Cargando la secuencia del día…</p>}
              <iframe
                src={camara.reproductor}
                title={`Secuencia del día de la cámara ${camara.titulo}`}
                className="absolute inset-0 h-full w-full border-0"
                allow="fullscreen"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                onLoad={() => setCargado(true)}
              />
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[12px] text-texto-2">{camara.observatorio ? 'Imagen: ESO y observatorios asociados' : CREDITO_WINDY}</p>
          <a
            href={camara.enlace}
            target="_blank"
            rel="noopener"
            className="shrink-0 rounded-lg border-2 border-borde px-3 py-2 text-[14px] font-bold"
          >
            {camara.observatorio ? 'Más en ESO' : 'Abrir en Windy'}
          </a>
        </div>
      </div>
    </div>
  )
}

/** Ficha de una cámara al tocarla en el mapa. */
export function FichaCamara({ camara, onCerrar, onAbrir }) {
  return (
    <section aria-label={`Cámara ${camara.titulo}`} className="rounded-3xl bg-superficie p-3 shadow-xl ring-1 ring-linea">
      <div className="mb-2 flex items-center gap-2">
        <p className="flex-1 text-[16px] font-bold">Cámara pública</p>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar cámara"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-superficie-2"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <TarjetaCamara camara={camara} onAbrir={onAbrir} />
      <p className="mt-2 text-[12px] text-texto-2">{CREDITO_WINDY}</p>
    </section>
  )
}
