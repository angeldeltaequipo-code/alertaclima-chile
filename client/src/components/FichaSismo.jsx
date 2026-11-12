import { colorMagnitud, descripcionMagnitud, distanciaKm } from '../services/riesgos'
import { hace } from '../services/reportes'

const num = (v, d = 1) => Number(v).toFixed(d).replace('.', ',')

/** Qué tan profundo fue, en palabras (los superficiales se sienten más fuerte). */
function profundidad(km) {
  if (km == null) return null
  if (km < 70) return { texto: 'Superficial', detalle: 'Los sismos poco profundos se sienten con más fuerza cerca del epicentro.' }
  if (km < 300) return { texto: 'Intermedio', detalle: 'A esta profundidad la energía se reparte: se siente en una zona amplia, pero más suave.' }
  return { texto: 'Profundo', detalle: 'Muy profundo: suele sentirse poco en la superficie.' }
}

/** ¿Se habrá sentido donde estás? Estimación simple por magnitud y distancia (no es un dato oficial). */
function sentidoAqui(m, km) {
  if (km == null) return null
  if (m >= 7 && km < 600) return 'Probablemente se sintió fuerte en tu zona.'
  if (m >= 6 && km < 300) return 'Probablemente se sintió en tu zona.'
  if (m >= 5 && km < 150) return 'Pudo sentirse en tu zona.'
  if (m >= 4 && km < 50) return 'Pudo sentirse levemente en tu zona.'
  return 'Es poco probable que se haya sentido donde estás.'
}

/**
 * Ficha de un sismo tocado en el mapa o en la lista: magnitud, dónde, cuándo, profundidad, a cuánto
 * está de ti, si hubo aviso de tsunami y qué hacer. Con los enlaces a las fuentes oficiales.
 */
export default function FichaSismo({ sismo: s, punto, onCerrar, enMapa = false, onVerEnMapa }) {
  const d = descripcionMagnitud(s.magnitud)
  const color = colorMagnitud(s.magnitud)
  const km = punto ? Math.round(distanciaKm(punto, s)) : null
  const prof = profundidad(s.profundidadKm)
  const fecha = new Date(s.hora)
  const fuerte = s.magnitud >= 6

  return (
    <div className={`${enMapa ? 'max-h-[70dvh] overflow-y-auto rounded-2xl border-2 border-borde shadow-xl' : ''} bg-superficie p-4`} role={enMapa ? 'dialog' : undefined} aria-label={`Sismo de magnitud ${num(s.magnitud)}`}>
      <div className="flex items-start gap-3">
        <span className="grid size-16 shrink-0 place-items-center rounded-2xl text-[26px] font-black text-white tabular-nums" style={{ background: color, boxShadow: `0 0 22px -4px ${color}` }}>
          {num(s.magnitud)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-bold tracking-wide uppercase" style={{ color }}>
            {d.texto}
          </p>
          <p className="text-[19px] leading-tight font-bold first-letter:uppercase">{s.lugar ?? 'Chile'}</p>
          <p className="mt-0.5 text-[15px] text-texto-2">
            {fecha.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}, {fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })} · {hace(fecha)}
          </p>
        </div>
        {onCerrar && (
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid size-10 shrink-0 place-items-center rounded-full text-[22px]">
            ×
          </button>
        )}
      </div>

      {s.alertaTsunami && (
        <p className="mt-3 rounded-xl bg-peligro/15 px-3 py-2 text-[15px] font-bold text-peligro" role="status">
          Este sismo tuvo aviso de tsunami en su momento. Revisa el estado actual en SHOA y SENAPRED.
        </p>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-2">
        <Dato titulo="Magnitud" valor={num(s.magnitud)} extra={d.texto} />
        <Dato titulo="Profundidad" valor={s.profundidadKm != null ? `${s.profundidadKm} km` : '—'} extra={prof?.texto} />
        <Dato titulo="Distancia a ti" valor={km != null ? `${km.toLocaleString('es-CL')} km` : '—'} extra={km != null ? sentidoAqui(s.magnitud, km) : 'Activa tu ubicación para calcularla'} />
        <Dato titulo="Personas que lo sintieron" valor={s.sentido != null ? s.sentido.toLocaleString('es-CL') : '—'} extra={s.sentido != null ? 'Reportes al USGS' : 'Sin reportes'} />
      </dl>

      {prof && <p className="mt-3 text-[15px] text-texto-2">{prof.detalle}</p>}

      <div className="mt-3 rounded-2xl bg-superficie-2 p-3">
        <p className="text-[15px] font-bold">{fuerte ? 'Si vuelve a temblar fuerte' : 'Si tiembla donde estás'}</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[15px]">
          <li>Agáchate, cúbrete y afírmate hasta que pase.</li>
          <li>Aléjate de ventanas y de lo que pueda caer.</li>
          <li>Si estás en la costa y no puedes mantenerte en pie, sube a zona segura sin esperar aviso.</li>
          {fuerte && <li>Prepárate para réplicas y revisa gas, agua y luz antes de volver a usarlos.</li>}
        </ul>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {onVerEnMapa && (
          <button type="button" onClick={() => onVerEnMapa(s)} className="min-h-11 rounded-full bg-senal px-4 text-[15px] font-bold text-sobre-senal">
            Ver en el mapa
          </button>
        )}
        {s.url && (
          <a href={s.url} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-full border-2 border-borde px-4 text-[15px] font-bold">
            Detalle en USGS
          </a>
        )}
        <a href="https://www.sismologia.cl/" target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-full border-2 border-borde px-4 text-[15px] font-bold">
          Centro Sismológico Nacional
        </a>
      </div>
      <p className="mt-2 text-[13px] text-texto-2">Datos del USGS. La magnitud oficial en Chile la informa el Centro Sismológico Nacional y puede diferir un poco.</p>
    </div>
  )
}

function Dato({ titulo, valor, extra }) {
  return (
    <div className="rounded-2xl bg-superficie-2 p-3">
      <dt className="text-[13px] font-bold text-texto-2">{titulo}</dt>
      <dd className="text-[22px] leading-tight font-bold tabular-nums">{valor}</dd>
      {extra && <dd className="mt-0.5 text-[13px] leading-snug text-texto-2">{extra}</dd>}
    </div>
  )
}
