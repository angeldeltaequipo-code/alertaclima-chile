// Integración con la app nativa (App Store y Google Play), empaquetada con Capacitor.
// En la web todo esto queda inactivo: Capacitor.isNativePlatform() es falso.
import { Capacitor } from '@capacitor/core'

export const esNativa = () => Capacitor.isNativePlatform()
export const plataforma = () => Capacitor.getPlatform() // 'ios' | 'android' | 'web'

/** Preparación al abrir la app nativa: barra de estado, pantalla de inicio y canales de aviso. */
export async function iniciarNativo({ onAbrirAviso } = {}) {
  if (!esNativa()) return
  const [{ StatusBar, Style }, { SplashScreen }, { FirebaseMessaging }] = await Promise.all([
    import('@capacitor/status-bar'),
    import('@capacitor/splash-screen'),
    import('@capacitor-firebase/messaging'),
  ])
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
  if (plataforma() === 'android') {
    StatusBar.setBackgroundColor({ color: '#0E1A24' }).catch(() => {})
    // Canales de Android: las alertas graves suenan y vibran aunque el teléfono esté en «No molestar» (si la persona lo permite).
    await FirebaseMessaging.createChannel({ id: 'alertas', name: 'Alertas oficiales', description: 'Alertas de SENAPRED en tus comunas', importance: 4, vibration: true, visibility: 1 }).catch(() => {})
    await FirebaseMessaging.createChannel({ id: 'alertas-graves', name: 'Alertas rojas y evacuaciones', description: 'Avisos urgentes: alerta roja y evacuación', importance: 5, vibration: true, visibility: 1 }).catch(() => {})
  }
  // Tocar una notificación abre la app en la alerta.
  FirebaseMessaging.addListener('notificationActionPerformed', (a) => onAbrirAviso?.(a.notification?.data ?? {})).catch(() => {})
  setTimeout(() => SplashScreen.hide().catch(() => {}), 300)
}

/** Vibración nativa (más confiable que navigator.vibrate, que iPhone no tiene). */
export async function vibrarNativo(patron = 'fuerte') {
  if (!esNativa()) return false
  const { Haptics, NotificationType } = await import('@capacitor/haptics')
  await Haptics.notification({ type: patron === 'fuerte' ? NotificationType.Warning : NotificationType.Success }).catch(() => {})
  return true
}

/** Compartir con la hoja nativa del sistema (WhatsApp, mensajes…). */
export async function compartirNativo({ titulo, texto, url }) {
  if (!esNativa()) return false
  const { Share } = await import('@capacitor/share')
  await Share.share({ title: titulo, text: texto, url, dialogTitle: 'Compartir' })
  return true
}

/**
 * Registro para notificaciones nativas con Firebase Cloud Messaging (Android y iPhone).
 * Devuelve el token FCM o lanza un error con codigo 'bloqueadas' si la persona no dio permiso.
 */
export async function tokenNativo() {
  const { FirebaseMessaging } = await import('@capacitor-firebase/messaging')
  let p = await FirebaseMessaging.checkPermissions()
  if (p.receive !== 'granted' && p.receive !== 'denied') p = await FirebaseMessaging.requestPermissions()
  if (p.receive !== 'granted') {
    const e = new Error('Las notificaciones están apagadas para AlertaClima en los ajustes del teléfono.')
    e.codigo = 'bloqueadas'
    throw e
  }
  try {
    const { token } = await FirebaseMessaging.getToken()
    return token
  } catch (err) {
    throw Object.assign(new Error('No se pudo registrar el teléfono para avisos. Inténtalo de nuevo.'), { codigo: 'registro', detalle: err?.message })
  }
}

export async function bajaNativa() {
  const { FirebaseMessaging } = await import('@capacitor-firebase/messaging')
  await FirebaseMessaging.deleteToken().catch(() => {})
}
