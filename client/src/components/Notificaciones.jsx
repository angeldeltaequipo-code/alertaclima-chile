import { useState } from 'react'
import { comunaPorCut } from '../services/comunas'
import { guardar, leer } from '../services/almacen'

const PASOS_IPHONE = (
  <ol className="list-decimal space-y-1 pl-5 text-[16px]">
    <li>Abre esta página en Safari.</li>
    <li>Toca el botón Compartir (el cuadrado con una flecha hacia arriba).</li>
    <li>Elige «Agregar a inicio» y abre AlertaClima desde ese ícono.</li>
    <li>Vuelve a esta sección y toca «Activar notificaciones».</li>
  </ol>
)

/** Sección completa, para Ajustes. */
export function AjustesNotificaciones({ notif, comuna }) {
  const nombre = (cut) => comunaPorCut(cut)?.nombre ?? cut

  if (notif.soporte === 'sin-servidor') return <p className="text-[16px]">Esta versión no tiene servidor de notificaciones.</p>
  if (notif.soporte === 'ios-instalar')
    return (
      <>
        <p className="mb-2 text-[16px]">En iPhone, las notificaciones solo funcionan con la app agregada a tu pantalla de inicio:</p>
        {PASOS_IPHONE}
      </>
    )
  if (notif.soporte === 'no')
    return <p className="text-[16px]">Este navegador no permite notificaciones. Prueba con Chrome, Firefox, Edge o Safari actualizados.</p>

  return (
    <div className="space-y-3">
      <p className="text-[16px]">
        Te avisamos cuando se publica una alerta oficial en tus comunas, cuando sube de nivel y cuando termina, aunque la app
        esté cerrada. Los reportes de vecinos no envían notificaciones.
      </p>
      {notif.activas ? (
        <>
          <ul className="divide-y divide-linea rounded-2xl bg-superficie-2 px-3">
            {notif.comunas.map((c) => (
              <li key={c} className="flex min-h-12 items-center justify-between gap-2">
                <span className="text-[16px] font-bold">{nombre(c)}</span>
                <button type="button" disabled={notif.ocupado} onClick={() => notif.quitar(c)} className="min-h-11 px-2 text-[15px] underline">
                  Quitar
                </button>
              </li>
            ))}
          </ul>
          {comuna && !notif.comunas.includes(comuna.cut) && notif.comunas.length < 5 && (
            <button
              type="button"
              disabled={notif.ocupado}
              onClick={() => notif.agregar(comuna.cut)}
              className="min-h-12 w-full rounded-xl bg-superficie-2 text-[16px] font-bold"
            >
              Agregar {comuna.nombre}
            </button>
          )}
          <button type="button" disabled={notif.ocupado} onClick={notif.desactivar} className="min-h-12 w-full rounded-xl border border-borde text-[16px] font-bold">
            Desactivar notificaciones
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled={notif.ocupado || !comuna}
          onClick={() => notif.activar([comuna.cut])}
          className="min-h-14 w-full rounded-xl bg-senal text-[17px] font-bold text-sobre-senal disabled:opacity-60"
        >
          {notif.ocupado ? 'Activando…' : `Activar notificaciones para ${comuna?.nombre ?? 'tu comuna'}`}
        </button>
      )}
      {notif.error && (
        <p role="alert" className="text-[15px] font-bold text-peligro">
          {notif.error}
        </p>
      )}
      <p className="text-[14px] text-texto-2">Puedes seguir hasta 5 comunas (por ejemplo, tu casa, tu trabajo y la de tu familia).</p>
    </div>
  )
}

/** Invitación breve en la pestaña Ahora; se puede descartar. */
export function InvitacionNotificaciones({ notif, comuna }) {
  const [descartada, setDescartada] = useState(() => leer('notif:invitacion-descartada', false))
  const [listo, setListo] = useState(false)
  if (descartada || notif.activas || notif.soporte === 'no' || notif.soporte === 'sin-servidor') return null
  if (listo)
    return (
      <section className="tarjeta" role="status">
        <p className="text-[17px] font-bold">Listo: te avisaremos de las alertas en {comuna.nombre}.</p>
      </section>
    )
  const descartar = () => {
    guardar('notif:invitacion-descartada', true)
    setDescartada(true)
  }
  return (
    <section aria-labelledby="t-invita" className="tarjeta">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-senal text-sobre-senal" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
            <path d="M10 20a2 2 0 0 0 4 0" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="t-invita" className="text-[18px] leading-tight font-bold">
            Recibe las alertas aunque la app esté cerrada
          </h2>
          {notif.soporte === 'ios-instalar' ? (
            <div className="mt-2">
              <p className="mb-1 text-[15px]">En iPhone, primero agrega la app a tu pantalla de inicio:</p>
              {PASOS_IPHONE}
            </div>
          ) : (
            <p className="mt-1 text-[15px] text-texto-2">Solo alertas oficiales de {comuna.nombre}: cuando se publican, suben de nivel o terminan.</p>
          )}
        </div>
      </div>
      {notif.error && (
        <p role="alert" className="mt-2 text-[15px] font-bold text-peligro">
          {notif.error}
        </p>
      )}
      <div className="mt-3 flex gap-2">
        {notif.soporte === 'ok' && (
          <button
            type="button"
            disabled={notif.ocupado}
            onClick={async () => (await notif.activar([comuna.cut])) && setListo(true)}
            className="min-h-12 flex-1 rounded-full bg-senal px-4 text-[16px] font-bold text-sobre-senal disabled:opacity-60"
          >
            {notif.ocupado ? 'Activando…' : 'Activar'}
          </button>
        )}
        <button type="button" onClick={descartar} className="min-h-12 rounded-full px-4 text-[16px] font-bold text-texto-2">
          Ahora no
        </button>
      </div>
    </section>
  )
}
