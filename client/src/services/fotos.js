// Fotos de los reportes: se achican en el celular antes de enviarlas (cargan rápido
// con mala señal) y, al volver a dibujarlas, pierden los metadatos ocultos (EXIF),
// que pueden incluir la ubicación exacta de la casa de quien tomó la foto.
import { API_URL, ErrorApi, idDispositivo } from './reportes'

const LADO_MAX = 1280
const BYTES_MAX = 700 * 1024

const aBlob = (canvas, tipo, calidad) => new Promise((ok) => canvas.toBlob(ok, tipo, calidad))

export async function comprimirFoto(archivo) {
  if (!archivo?.type?.startsWith('image/')) throw new Error('El archivo no es una foto')
  let bitmap
  try {
    bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('No se pudo leer la foto. Prueba con otra.')
  }
  const escala = Math.min(1, LADO_MAX / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * escala)
  canvas.height = Math.round(bitmap.height * escala)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()

  // WebP pesa menos; si el navegador no lo genera, se usa JPEG.
  for (const calidad of [0.78, 0.65, 0.5, 0.38]) {
    let blob = await aBlob(canvas, 'image/webp', calidad)
    if (!blob || blob.type !== 'image/webp') blob = await aBlob(canvas, 'image/jpeg', calidad)
    if (blob && blob.size <= BYTES_MAX) return blob
  }
  throw new Error('La foto pesa demasiado incluso después de achicarla.')
}

export async function subirFoto(reporteId, clave, blob) {
  let r
  try {
    r = await fetch(`${API_URL}/api/reportes/${reporteId}/foto`, {
      method: 'POST',
      headers: { 'content-type': blob.type, 'x-clave-edicion': clave },
      body: blob,
    })
  } catch {
    throw new ErrorApi('No hay conexión con el servidor', 0)
  }
  const cuerpo = await r.json().catch(() => ({}))
  if (!r.ok) throw new ErrorApi(cuerpo.error ?? `El servidor respondió ${r.status}`, r.status)
  return cuerpo.reporte
}

export const urlFoto = (id) => `${API_URL}/api/fotos/${id}`

export async function denunciarFoto(id) {
  const r = await fetch(`${API_URL}/api/fotos/${id}/denuncias`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dispositivo: idDispositivo() }),
  })
  const cuerpo = await r.json().catch(() => ({}))
  if (!r.ok) throw new ErrorApi(cuerpo.error ?? 'No se pudo enviar la denuncia', r.status)
  return cuerpo
}

/** Enlace a Google Maps con Street View en ese punto (imagen de archivo de Google, no en vivo). */
export const enlaceStreetView = (lat, lng) =>
  `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lng.toFixed(6)}`
