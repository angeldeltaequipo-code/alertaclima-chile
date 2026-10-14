// Notificaciones de alertas oficiales (Web Push).
// Funcionan con la app cerrada. En iPhone solo funcionan si la app está agregada
// a la pantalla de inicio (iOS 16.4 o superior): es una regla de Apple.
import { API_URL } from './reportes'
import { guardar, leer } from './almacen'

const esIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const instalada = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

/** 'ok' | 'ios-instalar' (iPhone: hay que agregarla a inicio) | 'no' (navegador sin soporte) | 'sin-servidor' */
export function soporte() {
  if (!API_URL) return 'sin-servidor'
  if (esIOS() && !instalada()) return 'ios-instalar'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'no'
  return 'ok'
}

export const permiso = () => (typeof Notification === 'undefined' ? 'default' : Notification.permission)
export const comunasSuscritas = () => leer('notif:comunas', [])

function aUint8(base64url) {
  const relleno = '='.repeat((4 - (base64url.length % 4)) % 4)
  const b64 = (base64url + relleno).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

async function enviar(ruta, cuerpo) {
  const r = await fetch(`${API_URL}/api/push${ruta}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? `El servidor respondió ${r.status}`)
  return d
}

async function suscripcionActual(crear) {
  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub && crear) {
    const r = await fetch(`${API_URL}/api/push/clave`)
    if (!r.ok) throw new Error('El servidor no respondió. Si estuvo inactivo, espera un minuto y vuelve a intentar.')
    const { clave } = await r.json()
    try {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aUint8(clave) })
    } catch {
      throw new Error(
        'Este navegador no pudo registrarse para recibir notificaciones. Revisa que tenga permiso y conexión, o prueba con Chrome.',
      )
    }
  }
  return sub
}

/** Pide permiso (debe llamarse desde un toque de la persona) y suscribe estas comunas. */
export async function activar(comunas) {
  const p = await Notification.requestPermission()
  if (p !== 'granted') {
    throw new Error(
      p === 'denied'
        ? 'Las notificaciones están bloqueadas para esta app. Actívalas en la configuración del navegador o del teléfono.'
        : 'No se activaron las notificaciones.',
    )
  }
  const sub = await suscripcionActual(true)
  await enviar('/suscripciones', { suscripcion: sub.toJSON(), comunas })
  guardar('notif:comunas', comunas)
  return comunas
}

export async function cambiarComunas(comunas) {
  if (!comunas.length) return desactivar()
  const sub = await suscripcionActual(true)
  await enviar('/suscripciones', { suscripcion: sub.toJSON(), comunas })
  guardar('notif:comunas', comunas)
  return comunas
}

export async function desactivar() {
  const sub = await suscripcionActual(false)
  if (sub) {
    await enviar('/baja', { endpoint: sub.endpoint }).catch(() => {})
    await sub.unsubscribe().catch(() => {})
  }
  guardar('notif:comunas', [])
  return []
}

/** Revisa que la suscripción guardada siga existiendo (el navegador puede borrarla) y la reenvía. */
export async function revisar() {
  const comunas = comunasSuscritas()
  if (!comunas.length || soporte() !== 'ok' || permiso() !== 'granted') return comunas
  try {
    const sub = await suscripcionActual(true)
    await enviar('/suscripciones', { suscripcion: sub.toJSON(), comunas })
  } catch {
    /* se reintenta la próxima vez */
  }
  return comunas
}
