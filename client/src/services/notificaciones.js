// Notificaciones de alertas oficiales (Web Push).
// Funcionan con la app cerrada. En iPhone solo funcionan si la app está agregada
// a la pantalla de inicio (iOS 16.4 o superior): es una regla de Apple.
import { API_URL } from './reportes'
import { guardar, leer } from './almacen'

const ua = () => navigator.userAgent
const esIOS = () => /iphone|ipad|ipod/i.test(ua()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const instalada = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

/**
 * Dónde está abierta la app, para dar instrucciones que calcen con lo que la persona ve.
 * navegador: chrome | edge | samsung | firefox | safari | brave | opera | integrado
 * sistema: android | ios | mac | windows | otro
 */
export function entorno() {
  const u = ua()
  let navegador = 'chrome'
  // Navegadores dentro de otras apps (WhatsApp, Instagram, Facebook, la app de Claude…): no permiten notificaciones.
  if (/FBAN|FBAV|Instagram|Line\/|WhatsApp|Claude\/|Electron|; wv\)/i.test(u)) navegador = 'integrado'
  else if (navigator.brave) navegador = 'brave'
  else if (/SamsungBrowser/i.test(u)) navegador = 'samsung'
  else if (/Edg(A|iOS)?\//.test(u)) navegador = 'edge'
  else if (/OPR\/|Opera/.test(u)) navegador = 'opera'
  else if (/Firefox|FxiOS/.test(u)) navegador = 'firefox'
  else if (/Safari/.test(u) && !/Chrome|CriOS|Chromium/.test(u)) navegador = 'safari'
  let sistema = 'otro'
  if (/Android/i.test(u)) sistema = 'android'
  else if (esIOS()) sistema = 'ios'
  else if (/Mac OS X|Macintosh/.test(u)) sistema = 'mac'
  else if (/Windows/.test(u)) sistema = 'windows'
  return { navegador, sistema, instalada: instalada() }
}

/** 'ok' | 'ios-instalar' | 'integrado' (navegador dentro de otra app) | 'no' | 'sin-servidor' */
export function soporte() {
  if (!API_URL) return 'sin-servidor'
  if (entorno().navegador === 'integrado') return 'integrado'
  if (esIOS() && !instalada()) return 'ios-instalar'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'no'
  return 'ok'
}

/** 'default' (aún no se ha preguntado) | 'granted' | 'denied' (bloqueadas en este navegador) */
export const permiso = () => (typeof Notification === 'undefined' ? 'default' : Notification.permission)
export const comunasSuscritas = () => leer('notif:comunas', [])

/** Llama a `fn` cada vez que cambia el permiso (por ejemplo, si la persona lo habilita en el navegador). */
export function vigilarPermiso(fn) {
  let estado = null
  let vivo = true
  navigator.permissions
    ?.query({ name: 'notifications' })
    .then((s) => {
      if (!vivo) return
      estado = s
      s.onchange = () => fn(permiso())
    })
    .catch(() => {})
  // Respaldo (Safari y otros): revisar al volver a la app.
  const alVolver = () => document.visibilityState === 'visible' && fn(permiso())
  document.addEventListener('visibilitychange', alVolver)
  return () => {
    vivo = false
    if (estado) estado.onchange = null
    document.removeEventListener('visibilitychange', alVolver)
  }
}

export class ErrorNotificacion extends Error {
  constructor(mensaje, codigo) {
    super(mensaje)
    this.codigo = codigo
  }
}

function aUint8(base64url) {
  const relleno = '='.repeat((4 - (base64url.length % 4)) % 4)
  const b64 = (base64url + relleno).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

async function enviar(ruta, cuerpo) {
  let r
  try {
    r = await fetch(`${API_URL}/api/push${ruta}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    })
  } catch {
    throw new ErrorNotificacion('No hay conexión. Revisa tu señal y vuelve a intentarlo.', 'red')
  }
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new ErrorNotificacion(d.error ?? `El servidor respondió ${r.status}`, 'servidor')
  return d
}

/** El servidor gratuito se duerme tras un rato sin uso: la primera consulta puede tardar hasta un minuto. */
async function claveDelServidor() {
  for (let intento = 0; intento < 2; intento++) {
    try {
      const r = await fetch(`${API_URL}/api/push/clave`, { signal: AbortSignal.timeout(70000) })
      if (r.ok) return (await r.json()).clave
    } catch {
      /* reintento */
    }
  }
  throw new ErrorNotificacion('No pudimos conectarnos. Espera un minuto y vuelve a intentarlo.', 'servidor')
}

async function suscripcionActual(crear) {
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, no) => setTimeout(() => no(new ErrorNotificacion('La app todavía se está preparando. Vuelve a cargar la página e inténtalo otra vez.', 'sw')), 15000)),
  ])
  let sub = await reg.pushManager.getSubscription()
  if (!sub && crear) {
    const clave = aUint8(await claveDelServidor())
    try {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: clave })
    } catch (e) {
      // Una suscripción antigua con otra clave impide crear la nueva: se borra y se reintenta.
      if (e.name === 'InvalidStateError') {
        await (await reg.pushManager.getSubscription())?.unsubscribe()
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: clave }).catch(() => null)
      }
      if (!sub) {
        if (permiso() === 'denied') throw bloqueadas()
        if (entorno().navegador === 'brave')
          throw new ErrorNotificacion(
            'El navegador Brave no deja recibir avisos si no se cambia un ajuste. Lo más fácil: abre AlertaClima en Chrome.',
            'brave',
          )
        throw new ErrorNotificacion(
          'No se pudieron activar los avisos en este navegador. Revisa tu conexión o prueba en Chrome o Safari.',
          'suscribir',
        )
      }
    }
  }
  return sub
}

const bloqueadas = () =>
  new ErrorNotificacion('Las notificaciones están apagadas en este navegador.', 'bloqueadas')

/** Pide permiso (debe llamarse directo desde un toque de la persona) y suscribe estas comunas. */
export async function activar(comunas) {
  if (permiso() === 'denied') throw bloqueadas()
  const p = await Notification.requestPermission()
  if (p === 'denied') throw bloqueadas()
  if (p !== 'granted') throw new ErrorNotificacion('Cerraste la pregunta sin responder. Toca «Activar» otra vez y elige «Permitir».', 'sin-respuesta')
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
  const sub = await suscripcionActual(false).catch(() => null)
  if (sub) {
    await enviar('/baja', { endpoint: sub.endpoint }).catch(() => {})
    await sub.unsubscribe().catch(() => {})
  }
  guardar('notif:comunas', [])
  return []
}

/** Pide al servidor una notificación de prueba a este dispositivo. */
export async function probar() {
  const sub = await suscripcionActual(false)
  if (!sub) throw new ErrorNotificacion('Algo se desconectó. Toca «Desactivar notificaciones» y vuelve a activarlas.', 'sin-suscripcion')
  await enviar('/prueba', { endpoint: sub.endpoint })
}

/** Revisa que la suscripción guardada siga existiendo (el navegador puede borrarla) y la reenvía. */
export async function revisar() {
  const comunas = comunasSuscritas()
  if (!comunas.length || soporte() !== 'ok') return comunas
  // Si la persona bloqueó las notificaciones después de activarlas, se da de baja.
  if (permiso() === 'denied') return desactivar()
  if (permiso() !== 'granted') return comunas
  try {
    const sub = await suscripcionActual(true)
    await enviar('/suscripciones', { suscripcion: sub.toJSON(), comunas })
  } catch {
    /* se reintenta la próxima vez */
  }
  return comunas
}
