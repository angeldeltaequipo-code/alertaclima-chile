// «Comparte el clima con ZUMI»: arma una tarjeta vertical (formato historia, 1080×1920) con ZUMI en
// su escena, la temperatura, el cielo y lo que dice ZUMI, lista para X, WhatsApp, Instagram o TikTok.
// Todo se dibuja en el teléfono; si el teléfono no puede compartir imágenes, la descarga.
import { POSTER } from './zumiVideos'

const cargar = (src) =>
  new Promise((ok, mal) => {
    const i = new Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => ok(i)
    i.onerror = mal
    i.src = src
  })

function envolver(g, texto, x, y, ancho, alto) {
  const palabras = String(texto).split(/\s+/)
  let linea = ''
  let n = 0
  for (const p of palabras) {
    const prueba = linea ? `${linea} ${p}` : p
    if (g.measureText(prueba).width > ancho && linea) {
      g.fillText(linea, x, y + n * alto)
      linea = p
      n += 1
      if (n >= 4) return
    } else linea = prueba
  }
  if (linea) g.fillText(linea, x, y + n * alto)
}

export async function tarjetaClima({ escena = 'sala', comuna, temperatura, texto, max, min, frase }) {
  const W = 1080
  const H = 1920
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')
  const fondo = await cargar(POSTER(escena))
  g.drawImage(fondo, 0, 0, W, H)
  // velo arriba y abajo para que el texto se lea
  let v = g.createLinearGradient(0, 0, 0, 640)
  v.addColorStop(0, 'rgba(10,8,6,.85)')
  v.addColorStop(1, 'rgba(10,8,6,0)')
  g.fillStyle = v
  g.fillRect(0, 0, W, 640)
  v = g.createLinearGradient(0, H - 760, 0, H)
  v.addColorStop(0, 'rgba(10,8,6,0)')
  v.addColorStop(0.35, 'rgba(10,8,6,.88)')
  v.addColorStop(1, 'rgba(10,8,6,.96)')
  g.fillStyle = v
  g.fillRect(0, H - 760, W, 760)

  g.fillStyle = '#fff'
  g.font = '800 64px system-ui, -apple-system, sans-serif'
  g.fillText(comuna ?? 'Chile', 72, 150)
  g.font = '900 260px system-ui, -apple-system, sans-serif'
  g.fillText(`${Math.round(temperatura)}°`, 60, 410)
  g.font = '700 54px system-ui, -apple-system, sans-serif'
  g.fillText(texto ?? '', 72, 490)
  if (max != null) {
    g.fillStyle = 'rgba(255,255,255,.8)'
    g.font = '600 44px system-ui, -apple-system, sans-serif'
    g.fillText(`Máx. ${Math.round(max)}° · Mín. ${Math.round(min)}°`, 72, 556)
  }

  // globo de ZUMI
  if (frase) {
    g.fillStyle = 'rgba(255,255,255,.96)'
    const y = H - 600
    g.beginPath()
    g.roundRect(60, y, W - 120, 300, 48)
    g.fill()
    g.fillStyle = '#1c1208'
    g.font = '700 50px system-ui, -apple-system, sans-serif'
    envolver(g, `«${frase}»`, 110, y + 92, W - 220, 64)
  }
  g.fillStyle = '#ffc93c'
  g.font = '900 58px system-ui, -apple-system, sans-serif'
  g.fillText('ZUMI · zumichile.com', 72, H - 170)
  g.fillStyle = 'rgba(255,255,255,.75)'
  g.font = '600 38px system-ui, -apple-system, sans-serif'
  g.fillText('El clima y las alertas de Chile, con tu amigo ZUMI', 72, H - 108)

  return new Promise((ok) => c.toBlob((b) => ok(b), 'image/jpeg', 0.9))
}

export const URL_APP = 'https://angeldeltaequipo-code.github.io/alertaclima-chile/'

/** Comparte la tarjeta (con imagen si el teléfono puede); si no, la descarga. */
export async function compartirClima(datos) {
  const blob = await tarjetaClima(datos)
  const archivo = new File([blob], `zumi-${(datos.comuna ?? 'clima').toLowerCase().replace(/\s+/g, '-')}.jpg`, { type: 'image/jpeg' })
  const texto = `${datos.comuna}: ${Math.round(datos.temperatura)}° y ${String(datos.texto ?? '').toLowerCase()}. ${datos.frase ? `ZUMI dice: «${datos.frase}» ` : ''}`
  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], text: `${texto}${URL_APP}`, title: 'El clima con ZUMI' })
      return 'compartido'
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelado'
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = archivo.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  return 'descargado'
}

/** Publicar en X (con texto y enlace; la imagen se adjunta a mano si se descargó). */
export const enlaceX = (datos) =>
  `https://x.com/intent/post?text=${encodeURIComponent(`${datos.comuna}: ${Math.round(datos.temperatura)}° y ${String(datos.texto ?? '').toLowerCase()} 🌦️ El clima de Chile con ZUMI 🐼`)}&url=${encodeURIComponent(URL_APP)}`
