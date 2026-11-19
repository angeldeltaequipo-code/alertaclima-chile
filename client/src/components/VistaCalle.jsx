// La calle real, a pie: fotos de Mapillary tomadas por personas, por las que se puede avanzar
// como en un paseo (flechas). Muestra siempre quién tomó la foto y cuándo: no es en vivo.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Viewer } from 'mapillary-js'
import 'mapillary-js/dist/mapillary.css'
import { configCalle, fotosCalle } from '../services/calle'

const fechaLarga = (t) => (t ? new Date(t).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }) : null)

export default function VistaCalle({ punto, onCerrar }) {
  const caja = useRef(null)
  const visor = useRef(null)
  const [estado, setEstado] = useState('buscando') // buscando | listo | sin-fotos | no-configurada | error
  const [foto, setFoto] = useState(null) // { fecha, autor, m }

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const cfg = await configCalle()
        if (!cfg.activa) return vivo && setEstado('no-configurada')
        const fotos = await fotosCalle(punto)
        if (!vivo) return
        if (!fotos.length) return setEstado('sin-fotos')
        const primera = fotos[0]
        setFoto({ fecha: primera.fecha, autor: primera.autor, m: primera.m })
        const v = new Viewer({ accessToken: cfg.token, container: caja.current, imageId: primera.id, component: { cover: false, bearing: true, sequence: { visible: true } } })
        visor.current = v
        v.on('image', (e) => {
          const im = e.image
          if (!vivo || !im) return
          setFoto((f) => ({ ...f, fecha: im.capturedAt ? new Date(im.capturedAt).toISOString().slice(0, 10) : f?.fecha, autor: im.creatorUsername ?? f?.autor, m: null }))
        })
        setEstado('listo')
      } catch (e) {
        if (vivo) setEstado(e.message === 'no-configurada' ? 'no-configurada' : 'error')
      }
    })()
    return () => {
      vivo = false
      visor.current?.remove()
      visor.current = null
    }
  }, [punto.lat, punto.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const f = (e) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [onCerrar])

  const mensaje = {
    buscando: 'Buscando fotos de esta calle…',
    'sin-fotos': `Nadie ha fotografiado esta calle todavía${punto.nombre ? ` cerca de ${punto.nombre}` : ''}. Prueba en una avenida o en el centro.`,
    'no-configurada': 'La vista de calle real se está activando. Vuelve en un rato.',
    error: 'No pude traer las fotos de la calle ahora. Revisa tu conexión e inténtalo de nuevo.',
  }[estado]

  return createPortal(
    <div className="vista-calle fixed inset-0 z-[1250] bg-black text-white" role="dialog" aria-label={`Calle real${punto.nombre ? `: ${punto.nombre}` : ''}`}>
      <div ref={caja} className="absolute inset-0" />
      <div className="absolute top-0 right-0 left-0 flex items-start gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={onCerrar} aria-label="Cerrar la calle real" className="vidrio-solido grid size-11 shrink-0 place-items-center rounded-full text-[20px]">
          ✕
        </button>
        <div className="vidrio-solido min-w-0 flex-1 rounded-[18px] px-3 py-2">
          <p className="rotulo flex items-center gap-1.5 !text-[9.5px]">📷 Calle real · foto de personas, no en vivo</p>
          <p className="truncate text-[14.5px] font-semibold">{foto?.fecha ? `Foto del ${fechaLarga(foto.fecha)}` : punto.nombre || 'Aquí'}</p>
        </div>
      </div>
      {mensaje && (
        <div className="absolute inset-0 grid place-items-center p-6 text-center">
          <div className="max-w-sm">
            <img src={`${import.meta.env.BASE_URL}zumi/viajes/avatar.png`} alt="" className="mx-auto size-16 rounded-full" />
            <p className="mt-3 text-[16px] leading-snug" aria-live="polite">
              {mensaje}
            </p>
            {estado !== 'buscando' && (
              <button type="button" onClick={onCerrar} className="boton-primario mt-4 px-6">
                Volver
              </button>
            )}
          </div>
        </div>
      )}
      {estado === 'listo' && (
        <p className="pointer-events-none absolute right-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-2 text-center text-[11px] text-white/80 [text-shadow:0_1px_3px_#000]">
          Toca las flechas para avanzar por la calle · Foto: {foto?.autor ?? 'comunidad'} en Mapillary (CC BY-SA)
        </p>
      )}
    </div>,
    document.body,
  )
}
