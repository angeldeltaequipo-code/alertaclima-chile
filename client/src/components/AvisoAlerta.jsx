import { useEffect, useRef } from 'react'
import { NIVELES } from '../services/alertas'
import { hhmm } from '../services/formato'

/** Aviso a pantalla completa cuando llega una alerta oficial nueva (o sube de nivel). */
export default function AvisoAlerta({ alerta, comuna, onVerDetalle, onEntendido }) {
  const n = NIVELES[alerta.nivel]
  const boton = useRef(null)
  useEffect(() => boton.current?.focus(), [])

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="aviso-titulo"
      aria-describedby="aviso-texto"
      className="safe-top safe-bottom fixed inset-0 z-[1300] flex flex-col justify-between px-5 py-6"
      style={{ background: `var(--nivel-${n.clave}-fondo)`, color: `var(--nivel-${n.clave}-texto)` }}
    >
      <div className="mx-auto w-full max-w-md pt-6">
        <div className="aviso-pulso mb-6 grid size-20 place-items-center rounded-full border-4 border-current" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l9.5 17h-19z" />
            <path d="M12 10v4.5" />
            <circle cx="12" cy="17.4" r=".8" fill="currentColor" />
          </svg>
        </div>
        <p className="text-[18px] font-bold opacity-90">Nueva alerta oficial en {comuna.nombre}</p>
        <h2 id="aviso-titulo" className="mt-1 text-[40px] leading-tight font-bold text-balance">
          {n.etiqueta}
        </h2>
        <p className="mt-1 text-[24px] leading-tight font-bold">{alerta.amenaza}</p>
        <p id="aviso-texto" className="mt-4 text-[19px] leading-snug">
          {alerta.titulo}
        </p>
        {alerta.instrucciones && (
          <div className="mt-4 rounded-2xl bg-black/15 p-4">
            <p className="text-[16px] font-bold">Qué hacer</p>
            <p className="mt-1 text-[18px] leading-snug whitespace-pre-line">{alerta.instrucciones}</p>
          </div>
        )}
        <p className="mt-4 text-[15px] opacity-90">
          Fuente: {alerta.fuente_nombre}, verificada a las {hhmm(alerta.confirmada_en)}.
        </p>
      </div>
      <div className="mx-auto grid w-full max-w-md gap-3">
        <button
          type="button"
          onClick={onVerDetalle}
          className="min-h-14 rounded-2xl border-2 border-current text-[18px] font-bold"
        >
          Ver todo el detalle
        </button>
        <button
          ref={boton}
          type="button"
          onClick={onEntendido}
          className="min-h-14 rounded-2xl text-[18px] font-bold"
          style={{ background: `var(--nivel-${n.clave}-texto)`, color: `var(--nivel-${n.clave}-fondo)` }}
        >
          Entendido
        </button>
      </div>
    </div>
  )
}
