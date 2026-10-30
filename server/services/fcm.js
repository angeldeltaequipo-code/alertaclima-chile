// Notificaciones de la app nativa (App Store y Google Play) por Firebase Cloud Messaging.
// FCM entrega en Android directamente y en iPhone a través de APNs (configurado en Firebase).
//
// Inactivo hasta definir FCM_CREDENCIALES con el JSON de una cuenta de servicio de Firebase
// (Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada).
// Las suscripciones nativas se guardan con endpoint «fcm:<token>».
import { JWT } from 'google-auth-library'

export const PREFIJO_FCM = 'fcm:'
export const esNativa = (endpoint) => typeof endpoint === 'string' && endpoint.startsWith(PREFIJO_FCM)
export const fcmActivo = () => Boolean(process.env.FCM_CREDENCIALES)

let cliente = null
let proyecto = null
function credenciales() {
  if (cliente) return cliente
  const c = JSON.parse(process.env.FCM_CREDENCIALES)
  proyecto = c.project_id
  cliente = new JWT({ email: c.client_email, key: c.private_key, scopes: ['https://www.googleapis.com/auth/firebase.messaging'] })
  return cliente
}

/** Arma el mensaje FCM: notificación visible + datos para abrir la app en el lugar correcto. */
export function mensajeFCM(token, m, { urgente = true, ttlSegundos = 6 * 3600 } = {}) {
  return {
    message: {
      token,
      notification: { title: m.titulo, body: m.cuerpo },
      data: { url: String(m.url ?? ''), nivel: String(m.nivel ?? ''), tipo: String(m.tipo ?? ''), etiqueta: String(m.etiqueta ?? '') },
      android: {
        priority: urgente ? 'HIGH' : 'NORMAL',
        ttl: `${ttlSegundos}s`,
        notification: { channel_id: m.grave ? 'alertas-graves' : 'alertas', tag: m.etiqueta ?? undefined, default_vibrate_timings: true },
      },
      apns: {
        headers: { 'apns-priority': urgente ? '10' : '5', 'apns-expiration': String(Math.floor(Date.now() / 1000) + ttlSegundos) },
        payload: { aps: { sound: 'default', 'thread-id': m.etiqueta ?? 'alertas', ...(m.grave ? { 'interruption-level': 'time-sensitive' } : {}) } },
      },
    },
  }
}

/**
 * Envía a un dispositivo nativo. Lanza un error con statusCode 404 si el token ya no existe
 * (la app se desinstaló), igual que web-push, para que la suscripción se borre.
 */
export async function enviarFCM(endpoint, mensajeTexto, opciones = {}, { fetchFn = fetch } = {}) {
  if (!fcmActivo()) {
    const e = new Error('FCM no configurado')
    e.statusCode = 503
    throw e
  }
  const token = endpoint.slice(PREFIJO_FCM.length)
  const jwt = credenciales()
  const { token: acceso } = await jwt.getAccessToken()
  const m = typeof mensajeTexto === 'string' ? JSON.parse(mensajeTexto) : mensajeTexto
  const r = await fetchFn(`https://fcm.googleapis.com/v1/projects/${proyecto}/messages:send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${acceso}`, 'content-type': 'application/json' },
    body: JSON.stringify(mensajeFCM(token, m, { urgente: opciones.urgency !== 'normal', ttlSegundos: opciones.TTL ?? 6 * 3600 })),
    signal: AbortSignal.timeout(15000),
  })
  if (r.ok) return { statusCode: 200 }
  const cuerpo = await r.json().catch(() => ({}))
  const codigo = cuerpo?.error?.details?.find?.((d) => d.errorCode)?.errorCode ?? cuerpo?.error?.status
  const e = new Error(`FCM ${r.status} ${codigo ?? ''}`)
  e.statusCode = codigo === 'UNREGISTERED' || r.status === 404 ? 404 : r.status
  e.body = JSON.stringify(cuerpo).slice(0, 300)
  throw e
}
