// Cámaras públicas cercanas, desde Windy Webcams (cámaras publicadas a propósito por sus
// dueños: municipios, puertos, centros de esquí, hoteles…). Requiere WINDY_API_KEY.
//
// Condiciones de Windy: dar crédito visible a Windy.com, enlazar cada imagen a su página,
// no agrandar las imágenes y no guardarlas. En el plan gratuito las imágenes son de baja
// resolución y sus enlaces caducan a los 10 minutos, por eso se piden en cada consulta
// (con una caché corta por zona para no sobrecargar el servicio).

const API = 'https://api.windy.com/webcams/api/v3/webcams'
const RADIO_KM = Number(process.env.CAMARAS_RADIO_KM ?? 30)
const CACHE_MS = 5 * 60 * 1000
const cache = new Map() // zona -> { hasta, datos }

export const camarasDisponibles = () => Boolean(process.env.WINDY_API_KEY)

/** Normaliza la respuesta de Windy a lo que muestra la app. Tolera campos ausentes. */
export function interpretarCamara(w, punto) {
  const lat = w.location?.latitude
  const lng = w.location?.longitude
  const imagen = w.images?.current?.preview ?? w.images?.current?.thumbnail ?? null
  if (lat == null || lng == null || !imagen) return null
  return {
    id: String(w.webcamId ?? w.id),
    titulo: w.title ?? 'Cámara pública',
    lugar: [w.location?.city, w.location?.region].filter(Boolean).join(', ') || null,
    lat,
    lng,
    distanciaKm: punto ? Math.round(distancia(punto, { lat, lng }) * 10) / 10 : null,
    imagen,
    miniatura: w.images?.current?.thumbnail ?? imagen,
    actualizada: w.lastUpdatedOn ?? null,
    enlace: w.urls?.detail ?? w.player?.day ?? `https://www.windy.com/webcams/${w.webcamId}`,
  }
}

function distancia(a, b) {
  const R = 6371
  const rad = (x) => (x * Math.PI) / 180
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export async function camarasCercanas(punto, { fetchFn = fetch } = {}) {
  if (!camarasDisponibles()) return { disponible: false, camaras: [] }
  // Zona redondeada a ~5 km para compartir la caché entre vecinos de la misma comuna.
  const zona = `${punto.lat.toFixed(2)},${punto.lng.toFixed(2)}`
  const c = cache.get(zona)
  if (c && Date.now() < c.hasta) return { disponible: true, camaras: c.datos }

  const url = new URL(API)
  url.searchParams.set('nearby', `${punto.lat.toFixed(4)},${punto.lng.toFixed(4)},${RADIO_KM}`)
  url.searchParams.set('include', 'images,location,urls,player')
  url.searchParams.set('limit', '10')
  url.searchParams.set('lang', 'es')
  const r = await fetchFn(url, {
    headers: { 'x-windy-api-key': process.env.WINDY_API_KEY },
    signal: AbortSignal.timeout(10000),
  })
  if (!r.ok) {
    console.error('Windy Webcams respondió', r.status)
    return { disponible: true, camaras: [], error: 'El servicio de cámaras no respondió' }
  }
  const datos = await r.json()
  const camaras = (datos.webcams ?? [])
    .filter((w) => !w.status || w.status === 'active')
    .map((w) => interpretarCamara(w, punto))
    .filter(Boolean)
    .sort((a, b) => a.distanciaKm - b.distanciaKm)
  cache.set(zona, { hasta: Date.now() + CACHE_MS, datos: camaras })
  if (cache.size > 500) cache.delete(cache.keys().next().value)
  return { disponible: true, camaras }
}
