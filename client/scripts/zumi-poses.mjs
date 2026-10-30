// Recorta las poses de ZUMI desde hojas generadas con Higgsfield (fondo verde de croma).
// Lee client/zumi/hojas.json, descarga cada hoja, quita el fondo verde, separa la grilla,
// recorta el borde vacío y guarda cada pose en public/zumi/poses/<nombre>.webp (alto 560 px).
// Se ejecuta en GitHub Actions (workflow «ZUMI»): node scripts/zumi-poses.mjs
import { readFileSync, mkdirSync } from 'node:fs'
import sharp from 'sharp'

const hojas = JSON.parse(readFileSync(new URL('../zumi/hojas.json', import.meta.url)))
const SALIDA = new URL('../public/zumi/poses/', import.meta.url)
mkdirSync(SALIDA, { recursive: true })
const ALTO = Number(process.env.ALTO_POSE ?? 560)

/** Fondo verde → transparente, con borde suave y sin halo verde en el pelaje. */
function quitarVerde(px) {
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i], g = px[i + 1], b = px[i + 2]
    const verdor = g - Math.max(r, b)
    let a = 1
    if (verdor > 70) a = 0
    else if (verdor > 22) a = 1 - (verdor - 22) / 48
    px[i + 3] = Math.round(a * 255)
    if (verdor > 0) px[i + 1] = Math.max(r, b) + Math.min(verdor, 6) // quita el reflejo verde
  }
}

for (const h of hojas) {
  const r = await fetch(h.url)
  if (!r.ok) throw new Error(`No se pudo descargar ${h.url}: ${r.status}`)
  const original = Buffer.from(await r.arrayBuffer())
  const { data, info } = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  quitarVerde(data)
  const anchoCelda = Math.floor(info.width / h.columnas)
  const altoCelda = Math.floor(info.height / h.filas)
  for (const [i, nombre] of h.nombres.entries()) {
    if (!nombre) continue
    const left = (i % h.columnas) * anchoCelda
    const top = Math.floor(i / h.columnas) * altoCelda
    const celda = await sharp(data, { raw: info }).extract({ left, top, width: anchoCelda, height: altoCelda }).png().toBuffer()
    const recortada = await sharp(celda).trim({ threshold: 1 }).toBuffer()
    await sharp(recortada)
      .resize({ height: ALTO, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 86, alphaQuality: 90, effort: 6 })
      .toFile(new URL(`${nombre}.webp`, SALIDA).pathname)
    console.log('Pose lista:', nombre)
  }
}
