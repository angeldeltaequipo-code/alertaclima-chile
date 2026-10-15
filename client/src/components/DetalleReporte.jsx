import { useState } from 'react'
import IconoReporte from './IconoReporte'
import { hace, miVoto, nombreCategoria } from '../services/reportes'
import { denunciarFoto, enlaceStreetView, urlFoto } from '../services/fotos'

/** Ficha de un reporte vecinal: foto, qué pasa, votos y enlace para reconocer la calle. */
export default function DetalleReporte({ reporte, onVotar, onCerrar }) {
  const [voto, setVoto] = useState(() => miVoto(reporte.id))
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const [fotoGrande, setFotoGrande] = useState(false)
  const [confirmarDenuncia, setConfirmarDenuncia] = useState(false)
  const [fotoFallo, setFotoFallo] = useState(false)
  const categoria = nombreCategoria(reporte.categoria)

  const votar = async (v) => {
    setEnviando(true)
    setMensaje(null)
    try {
      const r = await onVotar(reporte.id, v)
      if (!r) return // se pidió iniciar sesión
      setVoto(v)
      setMensaje(
        r.estado === 'activo'
          ? 'Gracias, tu respuesta quedó registrada.'
          : 'Gracias. Varios vecinos avisaron que ya no está: lo retiramos del mapa.',
      )
    } catch (e) {
      setMensaje(e.message)
    } finally {
      setEnviando(false)
    }
  }

  const denunciar = async () => {
    setConfirmarDenuncia(false)
    try {
      const r = await denunciarFoto(reporte.foto_id)
      setMensaje(r.oculta ? 'Gracias. La foto quedó oculta hasta que la revisemos.' : 'Gracias, recibimos tu aviso sobre la foto.')
    } catch (e) {
      setMensaje(e.message)
    }
  }

  const boton = (v) =>
    `min-h-12 flex-1 rounded-xl px-2 text-[15px] font-bold ${
      voto === v ? 'bg-senal text-sobre-senal' : 'bg-superficie-2 text-texto'
    }`

  return (
    <section aria-label={`Reporte: ${categoria}`} className="max-h-[62vh] overflow-y-auto rounded-3xl bg-superficie p-3 shadow-xl ring-1 ring-linea">
      <div className="flex items-start gap-3">
        <span className="pin-reporte shrink-0" aria-hidden="true">
          <IconoReporte categoria={reporte.categoria} size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[18px] leading-tight font-bold">{categoria}</p>
          {reporte.titulo !== categoria && <p className="text-[16px]">{reporte.titulo}</p>}
          <p className="text-[14px] text-texto-2">Reporte de un vecino, {hace(reporte.creado)}</p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar reporte"
          className="grid size-11 shrink-0 place-items-center rounded-full bg-superficie-2"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {reporte.foto_id && !fotoFallo && (
        <figure className="mt-3">
          <button type="button" onClick={() => setFotoGrande(true)} className="block w-full" aria-label="Ver la foto en grande">
            <img
              src={urlFoto(reporte.foto_id)}
              alt={`Foto del vecino: ${categoria}`}
              loading="lazy"
              onError={() => setFotoFallo(true)}
              className="max-h-56 w-full rounded-2xl object-cover"
            />
          </button>
          <figcaption className="mt-1 flex items-center justify-between gap-2 text-[13px] text-texto-2">
            <span>Foto tomada por un vecino {hace(reporte.creado)}</span>
            {confirmarDenuncia ? (
              <span className="flex gap-2">
                <button type="button" onClick={denunciar} className="font-bold text-peligro underline">
                  Sí, denunciar
                </button>
                <button type="button" onClick={() => setConfirmarDenuncia(false)} className="underline">
                  No
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmarDenuncia(true)} className="underline">
                Denunciar foto
              </button>
            )}
          </figcaption>
        </figure>
      )}

      {reporte.descripcion && <p className="mt-2 text-[16px]">{reporte.descripcion}</p>}
      <p className="mt-2 text-[14px] text-texto-2">
        {reporte.confirmaciones === 0
          ? 'Nadie lo ha confirmado todavía'
          : reporte.confirmaciones === 1
            ? '1 vecino confirma'
            : `${reporte.confirmaciones} vecinos confirman`}
        {reporte.desmentidos > 0 && `, ${reporte.desmentidos} ${reporte.desmentidos === 1 ? 'dice' : 'dicen'} que ya no está`}.
      </p>
      <p className="mt-2 text-[15px] font-bold">¿Sigue así?</p>
      <div className="mt-1 flex gap-2" role="group" aria-label="¿Sigue así?">
        <button type="button" disabled={enviando} onClick={() => votar(1)} aria-pressed={voto === 1} className={boton(1)}>
          Sí, sigue así
        </button>
        <button type="button" disabled={enviando} onClick={() => votar(-1)} aria-pressed={voto === -1} className={boton(-1)}>
          Ya no está
        </button>
      </div>
      {mensaje && (
        <p role="status" className="mt-2 text-[14px]">
          {mensaje}
        </p>
      )}

      <a
        href={enlaceStreetView(reporte.lat, reporte.lng)}
        target="_blank"
        rel="noopener"
        className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-borde px-3 text-[15px] font-bold"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="5" r="2.5" />
          <path d="M9 21v-6l-2-1 1-5h8l1 5-2 1v6" />
        </svg>
        Ver la calle en Google Maps
      </a>
      <p className="mt-1 text-center text-[12px] text-texto-2">
        Muestra cómo es el lugar normalmente (fotos de archivo de Google), no cómo está ahora.
      </p>

      {fotoGrande && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Foto del reporte"
          className="fixed inset-0 z-[1200] flex flex-col bg-black/95"
          onClick={() => setFotoGrande(false)}
        >
          <div className="safe-top flex justify-end p-3">
            <button type="button" className="min-h-11 rounded-xl bg-white px-4 font-bold text-black" onClick={() => setFotoGrande(false)}>
              Cerrar
            </button>
          </div>
          <img src={urlFoto(reporte.foto_id)} alt={`Foto del vecino: ${categoria}`} className="m-auto max-h-[85vh] max-w-full object-contain" />
        </div>
      )}
    </section>
  )
}
