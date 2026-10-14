import { useState } from 'react'
import IconoReporte from './IconoReporte'
import { hace, miVoto, nombreCategoria } from '../services/reportes'

/** Ficha de un reporte vecinal con los botones para confirmarlo o desmentirlo. */
export default function DetalleReporte({ reporte, onVotar, onCerrar }) {
  const [voto, setVoto] = useState(() => miVoto(reporte.id))
  const [enviando, setEnviando] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const categoria = nombreCategoria(reporte.categoria)

  const votar = async (v) => {
    setEnviando(true)
    setMensaje(null)
    try {
      const r = await onVotar(reporte.id, v)
      setVoto(v)
      setMensaje(r.estado === 'activo' ? 'Gracias, tu respuesta quedó registrada.' : 'Gracias. Varios vecinos avisaron que ya no está: lo retiramos del mapa.')
    } catch (e) {
      setMensaje(e.message)
    } finally {
      setEnviando(false)
    }
  }

  const boton = (v) =>
    `min-h-12 flex-1 rounded-lg border-2 px-2 text-[15px] font-bold ${
      voto === v ? 'border-senal bg-senal text-sobre-senal' : 'border-borde bg-superficie-2 text-texto'
    }`

  return (
    <section aria-label={`Reporte: ${categoria}`} className="rounded-xl border-2 border-borde bg-superficie px-3 pt-3 pb-3">
      <div className="flex items-start gap-3">
        <span className="pin-reporte shrink-0" aria-hidden="true">
          <IconoReporte categoria={reporte.categoria} size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[18px] leading-tight font-bold">{categoria}</p>
          {reporte.titulo !== categoria && <p className="text-[16px]">{reporte.titulo}</p>}
          <p className="text-[14px] text-texto-2">
            Reporte vecinal, {hace(reporte.creado)}
          </p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar reporte"
          className="grid size-11 shrink-0 place-items-center rounded-lg border-2 border-borde"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {reporte.descripcion && <p className="mt-2 text-[16px]">{reporte.descripcion}</p>}
      <p className="mt-2 text-[14px] text-texto-2">
        {reporte.confirmaciones === 0
          ? 'Nadie lo ha confirmado todavía'
          : reporte.confirmaciones === 1
            ? '1 vecino confirma'
            : `${reporte.confirmaciones} vecinos confirman`}
        {reporte.desmentidos > 0 && `, ${reporte.desmentidos} ${reporte.desmentidos === 1 ? 'dice' : 'dicen'} que ya no está`}.
      </p>
      <div className="mt-2 flex gap-2" role="group" aria-label="¿Sigue así?">
        <button type="button" disabled={enviando} onClick={() => votar(1)} aria-pressed={voto === 1} className={boton(1)}>
          Sigue así
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
    </section>
  )
}
