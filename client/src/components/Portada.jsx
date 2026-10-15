import IconoClima from './IconoClima'
import { direccionViento } from '../services/clima'

const grados = (v) => `${Math.round(v)}°`

// Cielo de fondo según el tiempo y si es de día o de noche.
// Todos los degradados son lo bastante oscuros para texto blanco (contraste ≥ 4,5:1).
function escena(icono, esDeDia) {
  if (icono === 'tormenta') return 'tormenta'
  if (icono === 'lluvia' || icono === 'lluvia-fuerte' || icono === 'llovizna') return esDeDia ? 'lluvia' : 'lluvia-noche'
  if (icono === 'nieve') return 'nieve'
  if (icono === 'niebla') return esDeDia ? 'niebla' : 'nublado-noche'
  if (icono === 'nublado') return esDeDia ? 'nublado' : 'nublado-noche'
  if (icono === 'parcial') return esDeDia ? 'parcial' : 'despejado-noche'
  return esDeDia ? 'despejado' : 'despejado-noche'
}

// Estrellas fijas (posiciones pseudoaleatorias estables) para las noches despejadas.
let semilla = 7
const azar = () => ((semilla = (semilla * 16807) % 2147483647) - 1) / 2147483646
const ESTRELLAS = Array.from({ length: 26 }, (_, i) => ({
  x: 4 + azar() * 92,
  y: 3 + azar() * 60,
  r: i % 5 === 0 ? 1.5 : 0.9,
  o: 0.3 + azar() * 0.55,
}))

/**
 * Portada de la pestaña Ahora: el tiempo de un vistazo, con un cielo que acompaña
 * a la condición. Lo esencial (temperatura y condición) va en grande y en palabras.
 */
export default function Portada({ ahora, hoy, comuna, nombre }) {
  const h = new Date().getHours()
  const saludo = h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches'
  const sc = escena(ahora.icono, ahora.esDeDia)
  const llueve = sc.startsWith('lluvia') || sc === 'tormenta'
  return (
    <section aria-label={`Condiciones actuales en ${comuna.nombre}`} className={`portada portada-${sc}`}>
      {sc === 'despejado-noche' && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          {ESTRELLAS.map((e, i) => (
            <circle key={i} cx={`${e.x}%`} cy={`${e.y}%`} r={e.r} fill="#fff" opacity={e.o} />
          ))}
        </svg>
      )}
      {llueve && <div className="portada-gotas" aria-hidden="true" />}
      {sc === 'despejado' && <div className="portada-sol" aria-hidden="true" />}

      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[15px] font-bold opacity-90">
              {saludo}
              {nombre ? `, ${nombre.split(' ')[0]}` : ''}
            </p>
            <p className="text-[13px] opacity-75 first-letter:uppercase">{new Date().toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })} · ahora</p>
            <p className="mt-1 text-[88px] leading-[0.88] font-bold tracking-tighter tabular-nums">{grados(ahora.temperatura)}</p>
          </div>
          <div className="portada-icono -mt-1 -mr-1 shrink-0">
            <IconoClima icono={ahora.icono} esDeDia={ahora.esDeDia} size={104} />
          </div>
        </div>
        <p className="mt-2 text-[22px] leading-tight font-bold">{ahora.texto}</p>
        {hoy && (
          <p className="mt-0.5 text-[17px] tabular-nums opacity-95">
            Máx. {grados(hoy.max)} · Mín. {grados(hoy.min)}
          </p>
        )}

        <dl className="mt-4 grid grid-cols-3 gap-2">
          <Dato titulo="Sensación" valor={grados(ahora.sensacion)} />
          <Dato
            titulo="Viento"
            valor={
              <>
                {Math.round(ahora.viento)}
                <span className="text-[13px] font-normal"> km/h</span>
              </>
            }
            extra={ahora.direccion != null ? `del ${direccionViento(ahora.direccion)}` : null}
          />
          <Dato titulo="Humedad" valor={`${Math.round(ahora.humedad)} %`} />
        </dl>
      </div>
    </section>
  )
}

function Dato({ titulo, valor, extra }) {
  return (
    <div className="rounded-2xl bg-white/14 px-3 py-2 backdrop-blur-sm">
      <dt className="text-[13px] font-bold opacity-90">{titulo}</dt>
      <dd className="text-[20px] leading-tight font-bold tabular-nums">{valor}</dd>
      {extra && <dd className="truncate text-[13px] opacity-90">{extra}</dd>}
    </div>
  )
}
