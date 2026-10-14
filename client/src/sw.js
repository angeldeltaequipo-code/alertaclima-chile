// Service worker de AlertaClima: guarda la app para abrir sin conexión y muestra
// las notificaciones de alertas oficiales aunque la app esté cerrada.
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

self.skipWaiting()
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

// ---- Sin conexión ----
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// Límites comunales: cambian casi nunca.
registerRoute(
  ({ url }) => url.pathname.includes('/limites/'),
  new StaleWhileRevalidate({ cacheName: 'limites', plugins: [new ExpirationPlugin({ maxEntries: 20 })] }),
)
// Pronóstico y búsqueda de localidades: lo más nuevo si hay señal.
registerRoute(
  ({ url }) => url.hostname.endsWith('open-meteo.com'),
  new NetworkFirst({
    cacheName: 'clima',
    networkTimeoutSeconds: 8,
    plugins: [new ExpirationPlugin({ maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 })],
  }),
)
// Índice de cuadros de radar.
registerRoute(
  ({ url }) => url.hostname === 'api.rainviewer.com',
  new NetworkFirst({
    cacheName: 'radar-indice',
    networkTimeoutSeconds: 6,
    plugins: [new ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 60 * 60 * 6 })],
  }),
)
registerRoute(
  ({ url }) => url.hostname.endsWith('rainviewer.com'),
  new CacheFirst({
    cacheName: 'radar-cuadros',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 60 * 60 * 3 }),
    ],
  }),
)
// El mapa base de OpenStreetMap NO se guarda aquí: su política no lo permite.

// ---- Notificaciones ----

// Vibración según la gravedad (en Android; el iPhone usa su propio aviso).
const VIBRACION = {
  preventiva: [300, 150, 300],
  amarilla: [400, 150, 400, 150, 400],
  roja: [700, 200, 700, 200, 700, 200, 700],
  evacuacion: [1000, 200, 1000, 200, 1000, 200, 1000, 200, 1000],
}

self.addEventListener('push', (evento) => {
  let m = {}
  try {
    m = evento.data ? evento.data.json() : {}
  } catch {
    m = { titulo: 'AlertaClima', cuerpo: evento.data?.text() ?? '' }
  }
  const base = self.registration.scope
  evento.waitUntil(
    self.registration.showNotification(m.titulo ?? 'Alerta oficial', {
      body: m.cuerpo ?? '',
      icon: `${base}icono-192.png`,
      badge: `${base}insignia-96.png`,
      tag: m.etiqueta ?? 'alertaclima',
      renotify: true,
      requireInteraction: Boolean(m.grave),
      vibrate: m.tipo === 'termina' ? [200] : (VIBRACION[m.nivel] ?? VIBRACION.amarilla),
      lang: 'es-CL',
      timestamp: Date.now(),
      data: { url: m.url ?? base },
    }),
  )
})

// Al tocar la notificación: se abre la app (o se trae al frente si ya estaba abierta).
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const url = evento.notification.data?.url ?? self.registration.scope
  evento.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const abierta = ventanas.find((v) => v.url.startsWith(self.registration.scope))
      if (abierta) {
        await abierta.focus()
        abierta.postMessage({ tipo: 'notificacion-abierta' })
        return
      }
      await self.clients.openWindow(url)
    })(),
  )
})

// Si el servicio de notificaciones renueva o cancela la suscripción (pasa de vez en cuando),
// el service worker se vuelve a suscribir solo y avisa al servidor, aunque la app esté cerrada.
const API = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
function aUint8(b64url) {
  const b64 = (b64url + '='.repeat((4 - (b64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}
self.addEventListener('pushsubscriptionchange', (evento) => {
  evento.waitUntil(
    (async () => {
      const anterior = evento.oldSubscription?.endpoint
      let nueva = evento.newSubscription
      if (!nueva && API) {
        const { clave } = await fetch(`${API}/api/push/clave`).then((r) => r.json())
        nueva = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aUint8(clave) })
      }
      if (anterior && nueva && API) {
        await fetch(`${API}/api/push/renovar`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ anterior, suscripcion: nueva.toJSON() }),
        })
      }
      const ventanas = await self.clients.matchAll({ type: 'window' })
      ventanas.forEach((v) => v.postMessage({ tipo: 'renovar-suscripcion' }))
    })().catch(() => {}),
  )
})
