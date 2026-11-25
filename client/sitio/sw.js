// La app antes vivía en la raíz de zumichile.com y ahora está en /app/.
// Este service worker reemplaza al antiguo: borra su caché, se da de baja y recarga la página.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) await caches.delete(k)
    await self.registration.unregister()
    for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url)
  })())
})
