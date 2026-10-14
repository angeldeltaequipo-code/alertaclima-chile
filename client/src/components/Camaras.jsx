import { hace } from '../services/reportes'

export const CREDITO_WINDY = (
  <>
    Cámaras: <a href="https://www.windy.com/" target="_blank" rel="noopener" className="underline">Windy.com</a> ·{' '}
    <a href="https://www.windy.com/webcams/add" target="_blank" rel="noopener" className="underline">
      Agrega una cámara
    </a>
  </>
)

const cuando = (iso) => (iso ? hace(new Date(iso)) : 'sin hora informada')

/** Tarjeta de una cámara: la imagen siempre enlaza a su página en Windy, como piden sus condiciones. */
export function TarjetaCamara({ camara, grande = false }) {
  return (
    <a href={camara.enlace} target="_blank" rel="noopener" className="block">
      <img
        src={grande ? camara.imagen : camara.miniatura}
        alt={`Imagen de la cámara ${camara.titulo}`}
        loading="lazy"
        className={`w-full rounded-2xl bg-superficie-2 object-cover ${grande ? 'max-h-56' : 'aspect-video'}`}
      />
      <span className="mt-1 block truncate text-[15px] font-bold">{camara.titulo}</span>
      <span className="block text-[13px] text-texto-2">
        A {camara.distanciaKm} km · imagen {cuando(camara.actualizada)}
      </span>
    </a>
  )
}

/** Sección de la pestaña Ahora. Si no hay clave de Windy, no aparece; si no hay cámaras, lo dice. */
export default function CamarasCercanas({ datos, comuna }) {
  if (!datos.disponible) return null
  const { camaras } = datos
  return (
    <section aria-labelledby="t-camaras" className="tarjeta">
      <h2 id="t-camaras" className="titulo-tarjeta">
        Cámaras cercanas
      </h2>
      {camaras.length === 0 ? (
        <p className="text-[16px] text-texto-2">
          No hay cámaras públicas cerca de {comuna.nombre}. Las fotos de los reportes de vecinos son la mejor forma de ver
          cómo están las calles.
        </p>
      ) : (
        <>
          <p className="mb-3 text-[15px] text-texto-2">
            Imágenes de cámaras públicas de la zona. Toca una para ver cómo ha cambiado en las últimas horas.
          </p>
          <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
            {camaras.map((c) => (
              <li key={c.id} className="w-60 shrink-0 snap-start">
                <TarjetaCamara camara={c} />
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-2 text-[12px] text-texto-2">{CREDITO_WINDY}</p>
    </section>
  )
}

/** Ficha de una cámara al tocarla en el mapa. */
export function FichaCamara({ camara, onCerrar }) {
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
      <TarjetaCamara camara={camara} grande />
      <p className="mt-2 text-[12px] text-texto-2">{CREDITO_WINDY}</p>
    </section>
  )
}
