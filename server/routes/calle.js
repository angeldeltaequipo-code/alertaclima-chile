import { Router } from 'express'

// «Ver la calle real»: fotos a pie de calle de Mapillary (CC BY-SA, subidas por personas).
// MAPILLARY_TOKEN es la «client token» de Mapillary: está hecha para usarse dentro de apps web
// (el visor la necesita en el teléfono), así que se entrega a la app; igual vive en el servidor
// para poder cambiarla sin publicar la app de nuevo.
const cache = new Map()
const token = () => (process.env.MAPILLARY_TOKEN ?? '').trim()

export function calleRouter({ fetchFn = fetch } = {}) {
  const r = Router()
  r.get('/config', (req, res) => {
    res.set('Cache-Control', 'public, max-age=600').json({ activa: Boolean(token()), token: token() || null })
  })
  // Mundo fotorrealista (maqueta 3D de Google vía Cesium ion). CESIUM_TOKEN es un token de navegador
  // de Cesium ion (gratis en el plan Community); se pega a mano en Environment.
  r.get('/mundo', (req, res) => {
    const t = (process.env.CESIUM_TOKEN ?? '').trim()
    res.set('Cache-Control', 'public, max-age=600').json({ fotorreal: Boolean(t), cesium: t || null })
  })
  // Fotos cercanas a un punto (las más próximas primero).
  r.get('/cerca', async (req, res, next) => {
    try {
      if (!token()) return res.status(503).json({ error: 'Vista de calle no configurada' })
      const lat = Number(req.query.lat)
      const lng = Number(req.query.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -56.5 || lat > -17 || lng < -110 || lng > -66) return res.status(400).json({ error: 'Punto fuera de Chile' })
      const radio = Math.min(Math.max(Number(req.query.radio) || 80, 20), 250) // metros
      const clave = `${lat.toFixed(4)},${lng.toFixed(4)},${radio}`
      const c = cache.get(clave)
      if (c && Date.now() - c.t < 6 * 3600e3) return res.set('Cache-Control', 'public, max-age=3600').json(c.v)
      const dLat = radio / 111320
      const dLng = radio / (111320 * Math.cos((lat * Math.PI) / 180))
      const url = new URL('https://graph.mapillary.com/images')
      url.searchParams.set('fields', 'id,captured_at,compass_angle,computed_geometry,is_pano,thumb_1024_url,creator')
      url.searchParams.set('bbox', [lng - dLng, lat - dLat, lng + dLng, lat + dLat].map((x) => x.toFixed(6)).join(','))
      url.searchParams.set('limit', '60')
      const g = await fetchFn(url, { headers: { Authorization: `OAuth ${token()}` }, signal: AbortSignal.timeout(12000) })
      if (!g.ok) return res.status(502).json({ error: `Mapillary respondió ${g.status}` })
      const d = await g.json()
      const dist = (p) => Math.hypot((p[1] - lat) * 111320, (p[0] - lng) * 111320 * Math.cos((lat * Math.PI) / 180))
      const fotos = (d.data ?? [])
        .filter((x) => x.computed_geometry?.coordinates)
        .map((x) => ({
          id: x.id,
          lat: x.computed_geometry.coordinates[1],
          lng: x.computed_geometry.coordinates[0],
          m: Math.round(dist(x.computed_geometry.coordinates)),
          fecha: x.captured_at ? new Date(x.captured_at).toISOString().slice(0, 10) : null,
          rumbo: x.compass_angle ?? null,
          pano: Boolean(x.is_pano),
          miniatura: x.thumb_1024_url ?? null,
          autor: x.creator?.username ?? null,
        }))
        .sort((a, b) => a.m - b.m || Number(b.pano) - Number(a.pano) || String(b.fecha).localeCompare(String(a.fecha)))
        .slice(0, 20)
      const v = { fotos }
      cache.set(clave, { t: Date.now(), v })
      if (cache.size > 3000) cache.clear()
      res.set('Cache-Control', 'public, max-age=3600').json(v)
    } catch (e) {
      next(e)
    }
  })
  return r
}
