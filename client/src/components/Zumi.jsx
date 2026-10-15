import { useEffect, useState } from 'react'
import PortalZumi from './PortalZumi'
import { NOMBRE, alCambiarNarrador } from '../services/narrador'
import { guardar, leer } from '../services/almacen'

/** ZUMI en su portal, para usar en cualquier parte (avisos, botones). */
export function AvatarZumi({ tam = 56, hablando = false, traje = 'casco', className = '' }) {
  return <PortalZumi tam={tam} hablando={hablando} traje={traje} className={className} />
}

function useHablando() {
  const [h, setH] = useState(false)
  useEffect(() => alCambiarNarrador((e) => setH(e.hablando)), [])
  return h
}

/** Botón flotante de ZUMI: su portal, siempre a mano para escuchar el reporte o conversar. */
export function BotonZumi({ onAbrir, traje }) {
  const hablando = useHablando()
  const [globo, setGlobo] = useState(() => !leer('zumi:presentado', false))
  useEffect(() => {
    if (!globo) return
    const t = setTimeout(() => {
      setGlobo(false)
      guardar('zumi:presentado', true)
    }, 9000)
    return () => clearTimeout(t)
  }, [globo])
  return (
    <div className="pointer-events-none fixed right-3 bottom-[5.25rem] z-[900] flex items-end gap-2">
      {globo && (
        <p className="globo-zumi pointer-events-auto max-w-[200px] rounded-2xl rounded-br-sm px-3 py-2 text-[14px] leading-snug font-bold">
          ¡Hola! Soy {NOMBRE}. Tócame y te cuento cómo está el clima.
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          setGlobo(false)
          guardar('zumi:presentado', true)
          onAbrir()
        }}
        aria-label={hablando ? `${NOMBRE} está hablando. Abrir` : `Abrir a ${NOMBRE}, tu narrador del clima`}
        className="boton-zumi pointer-events-auto rounded-full"
      >
        <PortalZumi tam={66} traje={traje} hablando={hablando} />
      </button>
    </div>
  )
}
