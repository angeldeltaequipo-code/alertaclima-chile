import { useState } from 'react'
import { comunaPorCut } from '../services/comunas'
import { guardar, leer } from '../services/almacen'

const PASOS_IPHONE = (
  <ol className="list-decimal space-y-1 pl-5 text-[16px]">
    <li>Abre esta página en Safari.</li>
    <li>Toca el botón Compartir (el cuadrado con una flecha hacia arriba).</li>
    <li>Elige «Agregar a inicio» y abre AlertaClima desde ese ícono.</li>
    <li>Toca «Activar» y luego «Permitir».</li>
  </ol>
)

/** Pasos para desbloquear las notificaciones, según el navegador y el sistema de la persona. */
function pasosDesbloqueo({ navegador, sistema, instalada }) {
  if (sistema === 'ios')
    return ['Abre la app Ajustes del iPhone.', 'Entra a Notificaciones y busca AlertaClima.', 'Activa «Permitir notificaciones».', 'Vuelve a AlertaClima.']
  if (sistema === 'android' && instalada)
    return [
      'Mantén presionado el ícono de AlertaClima en tu pantalla de inicio.',
      'Toca «Información de la app» (la i dentro de un círculo).',
      'Entra a «Notificaciones» y actívalas.',
      'Vuelve a AlertaClima.',
    ]
  if (navegador === 'samsung')
    return ['Toca el menú (☰) y entra a «Configuración».', '«Sitios y descargas» → «Notificaciones».', 'Busca esta página y permítela.', 'Vuelve a AlertaClima.']
  if (navegador === 'firefox')
    return [
      'Toca o haz clic en el candado, a la izquierda de la dirección.',
      'Junto a «Enviar notificaciones: Bloqueado», toca la ✕ para quitar el bloqueo.',
      'Recarga la página y toca «Activar» otra vez.',
    ]
  if (navegador === 'safari')
    return ['En el menú Safari, abre «Configuración» y la pestaña «Sitios web».', 'Elige «Notificaciones» a la izquierda.', 'Busca esta página y cambia a «Permitir».', 'Recarga la página.']
  if (sistema === 'android')
    return [
      'Toca el ícono que está a la izquierda de la dirección de la página.',
      'Toca «Permisos» (o «Configuración del sitio»).',
      'Entra a «Notificaciones» y elige «Permitir».',
      'Vuelve a esta página.',
    ]
  // Chrome, Edge, Brave y Opera en computador
  const pasos = [
    'Haz clic en el ícono que está a la izquierda de la dirección de la página (un candado o dos rayitas).',
    'Busca «Notificaciones» y cámbialo a «Permitir».',
    'Recarga la página.',
  ]
  if (sistema === 'mac')
    pasos.push(
      `Si aun así no aparecen: abre Configuración del Sistema → Notificaciones → ${
        navegador === 'edge' ? 'Microsoft Edge' : navegador === 'brave' ? 'Brave Browser' : 'Google Chrome'
      } y activa «Permitir notificaciones».`,
    )
  if (sistema === 'windows')
    pasos.push(`Si aun así no aparecen: en Windows abre Configuración → Sistema → Notificaciones y actívalas para ${navegador === 'edge' ? 'Edge' : 'Chrome'}.`)
  return pasos
}

/** Aviso con los pasos para desbloquear: se cierra solo cuando el permiso cambia. */
function Desbloquear({ notif }) {
  return (
    <div role="alert" className="rounded-2xl border-2 border-senal bg-superficie-2 p-3">
      <p className="text-[16px] font-bold">Las notificaciones están bloqueadas en este navegador</p>
      <p className="mt-1 text-[15px] text-texto-2">
        Alguna vez se eligió «Bloquear» (o el navegador lo hizo solo). Desde la app no se puede cambiar: hay que hacerlo así:
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-[15px]">
        {pasosDesbloqueo(notif.entorno).map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ol>
      <p className="mt-2 text-[14px] text-texto-2">Cuando lo cambies, esta sección se actualiza sola.</p>
    </div>
  )
}

function AbrirEnNavegador() {
  return (
    <p className="text-[16px]">
      Estás viendo AlertaClima dentro de otra app, y ahí no se pueden recibir notificaciones. Ábrela en{' '}
      <strong>Chrome</strong> (Android o computador) o <strong>Safari</strong> (iPhone): toca el menú de la página y elige «Abrir en el
      navegador».
    </p>
  )
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
          Enviada. Debería aparecer en unos segundos. Si no llega, revisa que el modo «No molestar» esté apagado.
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
    return <p className="text-[16px]">Este navegador no permite notificaciones. Prueba con Chrome, Firefox, Edge o Safari actualizados.</p>

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
  if (listo)
    return (
      <section className="tarjeta" role="status">
        <p className="text-[17px] font-bold">Listo: te avisaremos de las alertas en {comuna.nombre}.</p>
        <div className="mt-3">
          <Prueba notif={notif} />
        </div>
      </section>
    )
  if (descartada || notif.activas || ['no', 'sin-servidor', 'integrado'].includes(notif.soporte)) return null
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
      {notif.bloqueadas && (
        <div className="mt-3">
          <Desbloquear notif={notif} />
        </div>
      )}
      <div className="mt-2">
        <MensajeError notif={notif} />
      </div>
      <div className="mt-3 flex gap-2">
        {notif.soporte === 'ok' && !notif.bloqueadas && (
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
