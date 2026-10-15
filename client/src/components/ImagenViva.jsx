// Imagen de una cámara que se mantiene viva: trae la foto nueva sola cada cierto tiempo, la funde
// con la anterior (sin parpadeos), muestra «EN VIVO · hace 12 s» y la cuenta regresiva a la próxima.
import { useEffect, useRef, useState } from 'react'

const segundos = (ms) => Math.max(0, Math.round(ms / 1000))
const formatoHace = (s) => (s < 60 ? `hace ${s} s` : `hace ${Math.floor(s / 60)} min`)

/**
 * @param src URL de la imagen (si cambia, se funde con la nueva)
 * @param fresca función que agrega un parámetro para evitar la caché (o null si la URL ya viene nueva)
 * @param cada cada cuántos ms se vuelve a pedir
 * @param movimiento acercamiento lento tipo «Ken Burns» (no usar si las condiciones prohíben agrandar)
 */
export default function ImagenViva({ src, fresca = null, cada = 120000, alt = '', className = '', imgClassName = 'h-full w-full object-cover', movimiento = false, etiqueta = true, onError }) {
  const [capas, setCapas] = useState(() => [{ url: fresca ? fresca(src) : src, id: 0 }])
  const [cargada, setCargada] = useState(Date.now())
  const [ahora, setAhora] = useState(Date.now())
  const proxima = useRef(Date.now() + cada)
  const n = useRef(0)

  const traer = (base) => {
    const url = fresca ? fresca(base, true) : base
    const img = new Image()
    img.onload = () => {
      n.current += 1
      setCapas((c) => [...c.slice(-1), { url, id: n.current }])
      setCargada(Date.now())
    }
    img.src = url
    proxima.current = Date.now() + cada
  }

  // La URL cambió (por ejemplo, el servidor entregó una foto nueva)
  const primera = useRef(true)
  useEffect(() => {
    if (primera.current) {
      primera.current = false
      return
    }
    traer(src)
  }, [src]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(() => {
      setAhora(Date.now())
      if (!document.hidden && Date.now() >= proxima.current && fresca) traer(src)
    }, 1000)
    return () => clearInterval(id)
  }, [src, cada]) // eslint-disable-line react-hooks/exhaustive-deps

  const falta = segundos(proxima.current - ahora)
  return (
    <span className={`imagen-viva relative block overflow-hidden ${className}`}>
      {capas.map((c, i) => (
        <img
          key={c.id}
          src={c.url}
          alt={i === capas.length - 1 ? alt : ''}
          onError={onError}
          className={`absolute inset-0 ${imgClassName} ${movimiento ? 'ken-burns' : ''} ${i === capas.length - 1 ? 'imagen-entra' : ''}`}
          style={movimiento ? { animationDelay: `${-(c.id % 4) * 6}s` } : undefined}
        />
      ))}
      {etiqueta && (
        <span className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur-sm">
          <span className="size-1.5 animate-pulse rounded-full bg-red-500" aria-hidden="true" />
          EN VIVO · {formatoHace(segundos(ahora - cargada))}
          {fresca && (
            <svg width="14" height="14" viewBox="0 0 20 20" className="-rotate-90" aria-label={`Nueva imagen en ${falta} segundos`}>
              <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="3" />
              <circle cx="10" cy="10" r="8" fill="none" stroke="#fff" strokeWidth="3" strokeDasharray={50.3} strokeDashoffset={50.3 * (falta / (cada / 1000))} />
            </svg>
          )}
        </span>
      )}
    </span>
  )
}
