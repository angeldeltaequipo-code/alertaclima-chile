import { FUENTE_OFICIAL, NIVELES, alertaPrincipal } from '../services/alertas'
import { describir } from '../services/clima'
import { hhmm } from '../services/formato'
import IconoClima from './IconoClima'

const fechaHora = (d) => {
  const hoy = new Date()
  const mismoDia = d.toDateString() === hoy.toDateString()
  return mismoDia ? hhmm(d) : `${d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })} ${hhmm(d)}`
}

/** Línea de estado oficial bajo el nombre de la comuna. */
function LineaOficial({ estado, onVerAlertas }) {
  const enlaceSenapred = (
    <a href={FUENTE_OFICIAL.url} target="_blank" rel="noopener" className="font-bold underline underline-offset-2">
      senapred.cl
    </a>
  )
  if (!estado) return <p className="opacity-80">Consultando alertas oficiales…</p>
  if (estado.tipo === 'sin_servidor')
    return (
      <p>
        <strong>Alertas oficiales:</strong> todavía no están conectadas a esta app. Revisa {enlaceSenapred}.
      </p>
    )

  const principal = alertaPrincipal(estado.alertas)
  const sinConfirmar = estado.alertas.filter((a) => a.sin_confirmar)
  const verDetalle = estado.alertas.length > 0 && (
    <button type="button" onClick={onVerAlertas} className="ml-1 font-bold underline underline-offset-2">
      Ver detalle
    </button>
  )

  if (principal)
    return (
      <div>
        <p className="text-[18px] leading-tight font-bold">
          {NIVELES[principal.nivel].etiqueta}: {principal.amenaza}
        </p>
        <p className="mt-0.5">
          Fuente: {principal.fuente_nombre}, confirmada {fechaHora(principal.confirmada_en)}.
          {estado.alertas.length > 1 && ` Hay ${estado.alertas.length} alertas.`}
          {verDetalle}
        </p>
        {estado.tipo === 'sin_conexion' && (
          <p className="mt-0.5 font-bold">Sin conexión: puede haber cambios. Último dato de las {hhmm(estado.consultado)}.</p>
        )}
      </div>
    )

  if (sinConfirmar.length)
    return (
      <p>
        <strong>
          {NIVELES[sinConfirmar[0].nivel].etiqueta} sin confirmar desde {fechaHora(sinConfirmar[0].confirmada_en)}.
        </strong>{' '}
        Puede que ya no esté vigente: revisa {enlaceSenapred} antes de actuar.{verDetalle}
      </p>
    )

  if (estado.tipo === 'sin_conexion')
    return (
      <p>
        <strong>No se pudieron consultar las alertas.</strong>{' '}
        {estado.consultado ? `Último dato de las ${hhmm(estado.consultado)}. ` : ''}Revisa {enlaceSenapred}.
      </p>
    )

  return (
    <p>
      <strong>Sin alertas oficiales cargadas</strong> para tu comuna. Confirma siempre en {enlaceSenapred}.
    </p>
  )
}

/**
 * Banda superior: dónde estás mirando, el tiempo de un vistazo y el estado oficial.
 * El color de la banda depende SOLO de una alerta oficial confirmada y con fuente.
 */
/** ¿Hay algo que decir sobre las alertas que merezca una línea entera? (alerta, sin confirmar, sin conexión) */
function hayQueAvisar(estado) {
  if (!estado) return false
  if (estado.tipo === 'sin_conexion' || estado.tipo === 'sin_servidor') return true
  return Boolean(alertaPrincipal(estado.alertas ?? []) || (estado.alertas ?? []).some((a) => a.sin_confirmar))
}

export default function BandaEstado({ comuna, estado, ahora, onCambiar, onVerAlertas, onSOS }) {
  const principal = estado?.alertas ? alertaPrincipal(estado.alertas) : null
  const lineaCompleta = hayQueAvisar(estado)
  const clave = principal ? NIVELES[principal.nivel].clave : 'sin'
  const cond = ahora ? { texto: ahora.texto ?? describir(ahora.codigo).texto, icono: ahora.icono ?? describir(ahora.codigo).icono } : null

  return (
    <header
      className="cabecera safe-top relative z-[2] border-b border-linea"
      style={{ background: `var(--nivel-${clave}-fondo)`, color: `var(--nivel-${clave}-texto)` }}
    >
      <div className="mx-auto flex max-w-xl items-center gap-2 px-4 pt-2.5 pb-2.5">
        <button
          type="button"
          onClick={onCambiar}
          className="group min-w-0 flex-1 rounded-lg text-left"
          aria-label={comuna ? `Comuna: ${comuna.nombre}. Cambiar comuna` : 'Elegir comuna'}
        >
          <span className="flex items-center gap-2">
            <span className="titulo-x truncate text-[23px]">
              {comuna ? comuna.nombre : 'Elige tu comuna'}
            </span>
            <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true" className="shrink-0 opacity-60">
              <path d="M5 8l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="rotulo mt-0.5 block truncate !text-[10.5px]" style={{ color: 'inherit', opacity: 0.62 }}>
            {comuna ? comuna.region.etiqueta : 'Para ver el clima y el radar de tu zona'}
          </span>
        </button>
        {comuna && !lineaCompleta && (
          <button
            type="button"
            onClick={onVerAlertas}
            className="mono flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-current/20 px-3 text-[11px] font-medium tracking-[0.1em] uppercase"
            aria-label={estado ? 'Sin alertas oficiales vigentes. Ver detalle' : 'Consultando alertas oficiales'}
          >
            {estado ? <span className="punto-vivo" aria-hidden="true" /> : <span className="size-1.5 animate-pulse rounded-full bg-current/50" aria-hidden="true" />}
            {estado ? 'Sin alertas' : '…'}
          </button>
        )}
        {ahora && !(comuna && !lineaCompleta) && (
          <div className="flex shrink-0 items-center gap-0.5" aria-label={`${Math.round(ahora.temperatura)} grados, ${cond.texto}`}>
            <IconoClima icono={cond.icono} esDeDia={ahora.esDeDia} size={24} />
            <span className="text-[20px] font-light tracking-tight tabular-nums">{Math.round(ahora.temperatura)}°</span>
          </div>
        )}
        {onSOS && (
          <button type="button" onClick={onSOS} aria-label="Emergencia: llamar o enviar mi ubicación" className="boton-sos-cabecera grid min-h-10 shrink-0 place-items-center rounded-full px-3 text-[14px] font-black tracking-wide text-white">
            SOS
          </button>
        )}
      </div>

      {comuna && lineaCompleta && (
        <div className="border-t border-current/25">
          <div className="mx-auto max-w-xl px-4 py-2 text-[14px] leading-snug" aria-live="polite">
            <LineaOficial estado={estado} onVerAlertas={onVerAlertas} />
          </div>
        </div>
      )}
    </header>
  )
}
