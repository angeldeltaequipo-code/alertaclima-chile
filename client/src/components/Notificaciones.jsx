import { poseZumi } from './ZumiTeCuenta'
import { useState } from 'react'
import { comunaPorCut } from '../services/comunas'
import { guardar, leer } from '../services/almacen'
import { AbrirEnNavegador, GuiaPermiso } from './GuiaPermiso'

const PASOS_IPHONE = (
  <ol className="list-decimal space-y-1 pl-5 text-[16px]">
    <li>Abre esta página en Safari.</li>
    <li>Toca el botón para compartir (un cuadrado con una flecha hacia arriba).</li>
    <li>Elige «Agregar a inicio».</li>
    <li>Abre AlertaClima desde su nuevo ícono y toca «Activar».</li>
  </ol>
)

function Desbloquear({ notif }) {
  return <GuiaPermiso entorno={notif.entorno} />
}

function MensajeError({ notif }) {
  if (!notif.error || notif.error.codigo === 'bloqueadas') return null
  return (
    <p role="alert" className="text-[15px] font-bold text-peligro">
      {notif.error.mensaje}
    </p>
  )
}

function Prueba({ notif }) {
  return (
    <div>
      <button
        type="button"
        disabled={notif.prueba === 'enviando'}
        onClick={notif.probar}
        className="min-h-12 w-full rounded-xl bg-superficie-2 text-[16px] font-bold disabled:opacity-60"
      >
        {notif.prueba === 'enviando' ? 'Enviando…' : 'Enviarme una notificación de prueba'}
      </button>
      {notif.prueba === 'enviada' && (
        <p role="status" className="mt-2 text-[15px]">
          Enviada. Te debería llegar en unos segundos. Si no llega, revisa que el modo «No molestar» esté apagado.
        </p>
      )}
      {notif.prueba && !['enviando', 'enviada'].includes(notif.prueba) && (
        <p role="alert" className="mt-2 text-[15px] font-bold text-peligro">
          {notif.prueba}
        </p>
      )}
    </div>
  )
}

/** Sección completa, para Ajustes. */
export function AjustesNotificaciones({ notif, comuna }) {
  const nombre = (cut) => comunaPorCut(cut)?.nombre ?? cut

  if (notif.soporte === 'sin-servidor') return <p className="text-[16px]">Esta versión no tiene servidor de notificaciones.</p>
  if (notif.soporte === 'integrado') return <AbrirEnNavegador />
  if (notif.soporte === 'ios-instalar')
    return (
      <>
        <p className="mb-2 text-[16px]">En iPhone, las notificaciones solo funcionan con la app agregada a tu pantalla de inicio:</p>
        {PASOS_IPHONE}
      </>
    )
  if (notif.soporte === 'no')
    return <p className="text-[16px]">Este navegador no puede recibir avisos. Prueba abriendo AlertaClima en Chrome o Safari.</p>

  return (
    <div className="space-y-3">
      <p className="text-[16px]">
        Te avisamos cuando se publica una alerta oficial en tus comunas, cuando sube de nivel y cuando termina, aunque la app esté
        cerrada. Los reportes de vecinos no envían notificaciones.
      </p>
      {notif.bloqueadas ? (
        <Desbloquear notif={notif} />
      ) : notif.activas ? (
        <>
          <p className="flex items-center gap-2 text-[16px] font-bold text-ok">
            <span className="size-2.5 rounded-full bg-ok" aria-hidden="true" /> Activadas en este dispositivo
          </p>
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
          <Prueba notif={notif} />
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
          {notif.ocupado ? 'Activando… (puede tardar hasta un minuto)' : `Activar notificaciones para ${comuna?.nombre ?? 'tu comuna'}`}
        </button>
      )}
      <MensajeError notif={notif} />
      <p className="text-[14px] text-texto-2">Puedes seguir hasta 5 comunas (por ejemplo, tu casa, tu trabajo y la de tu familia).</p>
    </div>
  )
}

/** Invitación breve en la pestaña Ahora; se puede descartar. */
export function InvitacionNotificaciones({ notif, comuna }) {
  const [descartada, setDescartada] = useState(() => leer('notif:invitacion-descartada', false))
  const [listo, setListo] = useState(false)
  const [guia, setGuia] = useState(false)
  if (listo)
    return (
      <section className="tarjeta entrar" role="status">
        <p className="text-[17px] font-bold">Listo: te avisaremos de las alertas en {comuna.nombre}.</p>
        <div className="mt-3">
          <Prueba notif={notif} />
        </div>
      </section>
    )
  if (descartada || notif.activas || ['no', 'sin-servidor'].includes(notif.soporte)) return null
  const descartar = () => {
    guardar('notif:invitacion-descartada', true)
    setDescartada(true)
  }
  const integrado = notif.soporte === 'integrado'
  const ios = notif.soporte === 'ios-instalar'
  const texto = integrado
    ? 'Para recibir avisos, abre AlertaClima en tu navegador'
    : notif.bloqueadas
      ? 'Los avisos están apagados en este navegador'
      : `Recibe avisos de alertas en ${comuna.nombre}, aunque la app esté cerrada`
  return (
    <section aria-label="Avisos de alertas" className="banda-invita entrar">
      <div className="flex items-center gap-3">
        <img src={poseZumi('telefono')} alt="" width="48" height="56" className="zumi-pose h-14 w-auto shrink-0" />
        <p className="min-w-0 flex-1 text-[15px] leading-snug font-bold">{texto}</p>
        {notif.soporte === 'ok' && !notif.bloqueadas ? (
          <button
            type="button"
            disabled={notif.ocupado}
            onClick={async () => (await notif.activar([comuna.cut])) && setListo(true)}
            className="min-h-10 shrink-0 rounded-full bg-senal px-4 text-[15px] font-bold text-sobre-senal disabled:opacity-60"
          >
            {notif.ocupado ? '…' : 'Activar'}
          </button>
        ) : (
          <button type="button" onClick={() => setGuia(!guia)} aria-expanded={guia} className="min-h-10 shrink-0 rounded-full bg-superficie-2 px-3 text-[14px] font-bold">
            {guia ? 'Ocultar' : 'Cómo'}
          </button>
        )}
        <button type="button" onClick={descartar} aria-label="No mostrar más" className="grid size-9 shrink-0 place-items-center rounded-full text-texto-2">
          <svg width="14" height="14" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {guia && (
        <div className="mt-3">
          {integrado ? <AbrirEnNavegador /> : ios ? (
            <>
              <p className="mb-1 text-[15px]">En iPhone, primero agrega la app a tu pantalla de inicio:</p>
              {PASOS_IPHONE}
            </>
          ) : (
            <Desbloquear notif={notif} />
          )}
        </div>
      )}
      <div className="mt-1">
        <MensajeError notif={notif} />
      </div>
    </section>
  )
}
