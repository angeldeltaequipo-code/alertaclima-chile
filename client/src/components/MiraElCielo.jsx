import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { CAMARAS_CIELO, calidadNoche, faseLunar, urlFresca } from '../services/cielo'
import { hhmm } from '../services/formato'
import ImagenViva from './ImagenViva'
import Resguardo from './Resguardo'

/** Dibujo de la Luna tal como se ve desde Chile (hemisferio sur: crece por la izquierda). */
export function Luna({ fase, tam = 64 }) {
  const r = 30
  const k = Math.cos(2 * Math.PI * fase.fraccion)
  const rx = Math.abs(k) * r
  // Mitad iluminada a la derecha (como en el hemisferio norte creciente) y luego se refleja según corresponda.
  const d = `M50 ${50 - r} A${r} ${r} 0 0 1 50 ${50 + r} A${rx} ${r} 0 0 ${k > 0 ? 0 : 1} 50 ${50 - r} Z`
  return (
    <svg width={tam} height={tam} viewBox="0 0 100 100" role="img" aria-label={`${fase.nombre}, ${Math.round(fase.iluminacion * 100)} % iluminada`}>
      <defs>
        <radialGradient id="luna-brillo" cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor="#fef9c3" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#fef9c3" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill="url(#luna-brillo)" />
      <circle cx="50" cy="50" r={r} fill="#334155" />
      <path d={d} fill="#fef3c7" transform={fase.creciente ? 'translate(100 0) scale(-1 1)' : undefined} />
      <circle cx="50" cy="50" r={r} fill="none" stroke="#fef3c7" strokeOpacity="0.3" />
    </svg>
  )
}

/** Panorámica de 360° que gira sola (y se puede arrastrar), con la imagen renovada cada pocos minutos. */
function Panorama({ camara, onError }) {
  const caja = useRef(null)
  const tocando = useRef(false)
  const [url, setUrl] = useState(() => urlFresca(camara.url))
  useEffect(() => {
    const id = setInterval(() => setUrl(urlFresca(camara.url)), 120000)
    return () => clearInterval(id)
  }, [camara.url])
  useEffect(() => {
    let raf
    let x = 0
    const paso = () => {
      const el = caja.current
      if (el && !tocando.current && el.scrollWidth > el.clientWidth) {
        x = el.scrollLeft + 0.6
        if (x >= el.scrollWidth - el.clientWidth - 1) x = 0
        el.scrollLeft = x
      }
      raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div
      ref={caja}
      className="relative overflow-x-auto [scrollbar-width:none]"
      onPointerDown={() => (tocando.current = true)}
      onPointerUp={() => setTimeout(() => (tocando.current = false), 2500)}
      onPointerCancel={() => (tocando.current = false)}
    >
      <img src={url} alt={`Panorámica en vivo: ${camara.nombre}`} onError={onError} className="block h-[46vh] max-h-[420px] w-auto max-w-none" />
      <span className="sticky top-2 left-2 ml-2 -mt-[calc(46vh-0.5rem)] inline-flex items-center gap-1.5 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-bold text-white">
        <span className="size-1.5 animate-pulse rounded-full bg-red-500" aria-hidden="true" /> EN VIVO · 360°
      </span>
    </div>
  )
}

function Visor({ camara, onCerrar }) {
  const ref = useRef(null)
  const [error, setError] = useState(false)
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
  const pano = camara.tipo === 'panorama'
  return (
    <div className="fixed inset-0 z-[1100] flex items-end justify-center bg-black/80 sm:items-center" onClick={onCerrar}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={camara.nombre}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="safe-bottom w-full max-w-xl rounded-t-3xl bg-[#0b1020] p-4 text-white shadow-2xl sm:rounded-3xl"
      >
        <div className="mb-3 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[19px] leading-tight font-bold">{camara.nombre}</p>
            <p className="text-[14px] text-white/70">{camara.lugar}</p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="overflow-hidden rounded-2xl bg-black">
          {error ? (
            <p className="grid aspect-video place-items-center p-4 text-center text-[15px] text-white/70">La cámara no respondió. Prueba en unos minutos.</p>
          ) : pano ? (
            <Panorama camara={camara} onError={() => setError(true)} />
          ) : (
            <ImagenViva src={camara.url} fresca={urlFresca} cada={60000} alt={`Imagen en vivo: ${camara.nombre}`} className="mx-auto aspect-square max-h-[60vh]" imgClassName="h-full w-full object-contain" onError={() => setError(true)} />
          )}
        </div>
        {pano && !error && <p className="mt-1 text-center text-[13px] text-white/60">Gira sola. Arrástrala para mirar alrededor.</p>}
        <p className="mt-2 text-[15px] leading-snug text-white/85">{camara.descripcion}</p>
        <p className="mt-2 text-[12px] text-white/60">
          Imagen: {camara.credito} ·{' '}
          <a href={camara.enlace} target="_blank" rel="noopener" className="underline">
            más cámaras en eso.org
          </a>
        </p>
      </div>
    </div>
  )
}

/** Tarjeta «Mira el cielo»: la Luna, cómo viene la noche y los observatorios de Chile en vivo. */
const CieloEnVivo = lazy(() => import('./CieloEnVivo'))

export default function MiraElCielo({ horas, hoy, punto, comuna }) {
  const [abierta, setAbierta] = useState(null)
  const fase = faseLunar()
  const noche = calidadNoche(horas)
  return (
    <section aria-labelledby="t-cielo" className="cielo-tarjeta">
      <div className="cielo-estrellas" aria-hidden="true" />
      <div className="relative">
        <h2 id="t-cielo" className="text-[19px] font-bold text-white">
          Mira el cielo
        </h2>
        <div className="mt-2 flex items-center gap-4">
          <Luna fase={fase} />
          <div className="min-w-0 text-white">
            <p className="text-[17px] font-bold">{fase.nombre}</p>
            <p className="text-[14px] text-white/75">
              {Math.round(fase.iluminacion * 100)} % iluminada · llena el {fase.proximaLlena.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })}
            </p>
            {hoy?.puesta && <p className="text-[14px] text-white/75">El sol se pone a las {hhmm(hoy.puesta)}</p>}
          </div>
        </div>
        {noche && (
          <div className="mt-3 rounded-2xl bg-white/10 p-3 text-white ring-1 ring-white/10">
            <p className="flex items-center gap-2 text-[15px]">
              <span className="font-bold">Esta noche: {noche.texto}</span>
              <span className="flex gap-0.5" aria-hidden="true">
                {[1, 2, 3, 4].map((i) => (
                  <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={i <= noche.puntos ? '#fde68a' : 'none'} stroke="#fde68a" strokeWidth="1.8">
                    <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z" />
                  </svg>
                ))}
              </span>
            </p>
            <p className="mt-0.5 text-[14px] text-white/75">
              {noche.detalle} Nubosidad media {noche.nubes} %.
            </p>
          </div>
        )}
        {punto && (
          <div className="mt-4">
            <h3 className="text-[16px] font-bold text-white">El cielo sobre {comuna ?? 'ti'}, en vivo</h3>
            <div className="mt-2">
              <Resguardo>
                <Suspense fallback={<p className="py-10 text-center text-[14px] text-white/70">Cargando el cielo…</p>}>
                  <CieloEnVivo punto={punto} comuna={comuna} />
                </Suspense>
              </Resguardo>
            </div>
          </div>
        )}

        <h3 className="mt-4 text-[16px] font-bold text-white">Observatorios de Chile en vivo</h3>
        <ul className="-mx-4 mt-2 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {CAMARAS_CIELO.map((c) => (
            <li key={c.id} className="w-44 shrink-0 snap-start">
              <button type="button" onClick={() => setAbierta(c)} className="block w-full text-left" aria-label={`Ver ${c.nombre}`}>
                <ImagenViva src={c.url} fresca={urlFresca} cada={120000} movimiento className="aspect-square rounded-2xl bg-black ring-1 ring-white/15" onError={(e) => (e.currentTarget.style.opacity = '0.2')} />
                <span className="mt-1 block text-[14px] leading-tight font-bold text-white">{c.nombre}</span>
                <span className="block truncate text-[12px] text-white/65">{c.lugar}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[12px] text-white/55">Cámaras de ESO y sus socios. De día se ven los telescopios; de noche, las estrellas.</p>
      </div>
      {abierta && <Visor camara={abierta} onCerrar={() => setAbierta(null)} />}
    </section>
  )
}
