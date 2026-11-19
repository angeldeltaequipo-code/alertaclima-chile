// Foto satelital de Esri para maplibre, compartida por el mapa principal y «Pasea en 3D».
// En zonas rurales Esri no tiene foto en los niveles más cercanos y entrega un cuadro gris
// «Map data not yet available». Con blankTile=false responde error en vez del cuadro gris;
// entonces se toma la foto del nivel anterior y se amplía el pedazo que corresponde.
const URL_ESRI = (z, y, x) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}?blankTile=false`
// Hasta qué nivel hay foto en cada zona (se aprende al vuelo): así no se repiten pedidos que fallan.
const maximoZona = new Map()
const zona = (z, y, x) => `${Math.max(0, z - 6)}/${y >> 6}/${x >> 6}`
async function teselaEsri(z, y, x, signal) {
  const conocido = maximoZona.get(zona(z, y, x))
  for (let k = conocido != null && conocido < z ? z - conocido : 0; k <= 4 && z - k >= 0; k++) {
    const zp = z - k
    const yp = y >> k
    const xp = x >> k
    try {
      const r = await fetch(URL_ESRI(zp, yp, xp), { signal })
      if (!r.ok) {
        if (zp >= 16) maximoZona.set(zona(z, y, x), zp - 1)
        continue
      }
      const blob = await r.blob()
      if (k === 0) return await blob.arrayBuffer()
      // Recortar y ampliar el pedazo de la foto del nivel superior.
      const img = await createImageBitmap(blob)
      const n = 2 ** k
      const lado = img.width / n
      const lienzo = new OffscreenCanvas(256, 256)
      const ctx = lienzo.getContext('2d')
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, (x % n) * lado, (y % n) * lado, lado, lado, 0, 0, 256, 256)
      return await (await lienzo.convertToBlob({ type: 'image/jpeg', quality: 0.9 })).arrayBuffer()
    } catch (e) {
      if (e.name === 'AbortError') throw e
      if (zp >= 16) maximoZona.set(zona(z, y, x), zp - 1) // sin foto a este nivel (Esri responde sin permiso CORS)
    }
  }
  throw new Error('Sin imagen satelital para esta zona')
}

let listo = false
/** Registra el protocolo esri://{z}/{y}/{x} (una sola vez). */
export function registrarEsri(maplibregl) {
  if (listo) return
  listo = true
  maplibregl.addProtocol('esri', async (params, abort) => {
    const [z, y, x] = params.url.replace('esri://', '').split('/').map(Number)
    return { data: await teselaEsri(z, y, x, abort.signal) }
  })
}
