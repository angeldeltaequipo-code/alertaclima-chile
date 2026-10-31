import { useEffect } from 'react'
import { escenasReporte, nombrePreferido, paraVoz } from '../services/narrador'
import { precargarFrases } from '../services/vozZumi'
import { PELICULAS, RUTA_CINE, consejoDelDia } from '../services/cine'
import { alertaPrincipal } from '../services/alertas'

const BASE = import.meta.env.BASE_URL
export const poseZumi = (nombre) => `${BASE}zumi/poses/${nombre}.webp`

/** Qué pose usa ZUMI según cómo está el día. */
export function elegirPose({ alertas, horas, ahora }, hora = new Date().getHours()) {
  if (alertas?.alertas && alertaPrincipal(alertas.alertas)) return 'alerta'
  if ((horas ?? []).slice(0, 12).some((h) => h.lluvia >= 0.5)) return 'paraguas'
  if (hora >= 21 || hora < 6) return 'noche'
  if (ahora?.temperatura >= 27) return 'verano'
  return hora < 12 ? 'saludo' : 'ok'
}

/**
 * Lo primero que se ve: ZUMI resume el día en 2 o 3 frases simples, con un botón grande para
 * escucharlo en voz alta. Pensado para quien no quiere leer gráficos.
 */
export default function ZumiTeCuenta({ datos, onEscuchar, onPelicula }) {
  const escenas = escenasReporte(datos)
  // Sin el saludo ni la despedida: solo lo importante.
  const frases = escenas
    .slice(1, -1)
    .filter((e) => e.tarjeta?.tipo !== 'luna' && e.tarjeta?.tipo !== 'vecinos')
    .slice(0, 3)
    .map((e) => e.texto)
  const pose = elegirPose(datos)
  const consejo = consejoDelDia(datos)

  const claveVoz = escenas.map((x) => x.texto).join('|') + (datos.nombre ?? '')
  // La voz de ZUMI se va preparando en segundo plano: al tocar «Escuchar», habla de inmediato.
  useEffect(() => {
    const t = setTimeout(() => {
      const quien = nombrePreferido() || datos.nombre?.split(' ')[0]
      precargarFrases(escenasReporte({ ...datos, nombre: quien }).map((x) => paraVoz(x.texto)))
    }, 3000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveVoz])
  const hayAlerta = datos.alertas?.alertas && alertaPrincipal(datos.alertas.alertas)

  return (
    <section aria-labelledby="t-zumi-cuenta" className={`zumi-cuenta relative overflow-hidden rounded-[28px] p-4 ${hayAlerta ? 'ring-2 ring-peligro' : ''}`}>
      <div className="flex items-start gap-3">
        <img src={poseZumi(pose)} alt="" width="76" height="88" className="zumi-pose -ml-1 h-[88px] w-auto shrink-0 object-contain" />
        <div className="min-w-0 flex-1">
          <h2 id="t-zumi-cuenta" className="text-[15px] font-black tracking-wide text-senal-texto uppercase">
            ZUMI te cuenta
          </h2>
          <ul className="mt-1 space-y-1.5 text-[17px] leading-snug font-semibold">
            {frases.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      </div>
      <button
        type="button"
        onClick={onEscuchar}
        className="mt-3 flex min-h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-senal text-[19px] font-bold text-sobre-senal shadow-lg active:scale-[0.99]"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
        </svg>
        Escuchar a ZUMI
      </button>
      {consejo && onPelicula && (
        <button type="button" onClick={() => onPelicula(consejo)} className="mt-2 flex w-full items-center gap-3 rounded-2xl bg-superficie/70 p-2 text-left ring-1 ring-borde active:scale-[0.99]">
          <span className="relative h-16 w-11 shrink-0 overflow-hidden rounded-xl">
            <img src={`${RUTA_CINE}${consejo}.webp`} alt="" className="h-full w-full object-cover" />
            <span className="absolute inset-0 grid place-items-center text-[16px] text-white drop-shadow" aria-hidden="true">▶</span>
          </span>
          <span className="min-w-0">
            <span className="block text-[13px] font-black tracking-wide text-senal-texto uppercase">ZUMI te muestra</span>
            <span className="block text-[16px] leading-snug font-bold">{PELICULAS[consejo].titulo}</span>
          </span>
        </button>
      )}
      <p className="mt-2 text-center text-[14px] text-texto-2">También puedes hacerle preguntas con tu voz.</p>
    </section>
  )
}
