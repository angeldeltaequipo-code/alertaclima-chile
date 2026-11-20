// Texturas para que el paseo 3D se vea real y no como cajas blancas:
// fachadas con ventanas (casas chilenas de 1–2 pisos y edificios), dibujadas al vuelo en un canvas,
// y bosques en relieve con follaje. Nada se descarga: todo se genera en el teléfono.

function lienzo(w, h, dibujar) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')
  dibujar(g, w, h)
  return g.getImageData(0, 0, w, h)
}
const ruido = (g, w, h, alfa = 0.06) => {
  for (let i = 0; i < (w * h) / 6; i++) {
    g.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${alfa})` : `rgba(255,255,255,${alfa})`
    g.fillRect(Math.random() * w, Math.random() * h, 1, 1)
  }
}

// Casa: muro estucado de color (crema, ocre, terracota, celeste) con ventanas de marco blanco y zócalo.
function casa(color) {
  return lienzo(64, 64, (g, w, h) => {
    g.fillStyle = color
    g.fillRect(0, 0, w, h)
    ruido(g, w, h, 0.07)
    g.fillStyle = 'rgba(0,0,0,0.18)'
    g.fillRect(0, h - 8, w, 8) // zócalo
    for (const x of [10, 38]) {
      g.fillStyle = '#f4f1ea'
      g.fillRect(x - 2, 16, 20, 24)
      g.fillStyle = '#2b3542'
      g.fillRect(x, 18, 16, 20)
      g.fillStyle = 'rgba(160,200,230,0.35)'
      g.fillRect(x, 18, 7, 20)
      g.fillStyle = '#f4f1ea'
      g.fillRect(x + 7, 18, 2, 20)
    }
  })
}
// Edificio: hormigón con hileras de ventanas de vidrio (algunas con luz).
function edificio(base) {
  return lienzo(64, 64, (g, w, h) => {
    g.fillStyle = base
    g.fillRect(0, 0, w, h)
    ruido(g, w, h, 0.05)
    for (let y = 4; y < h; y += 16) {
      g.fillStyle = 'rgba(0,0,0,0.12)'
      g.fillRect(0, y + 11, w, 2) // losa
      for (let x = 3; x < w; x += 15) {
        const luz = Math.random() < 0.18
        const vidrio = g.createLinearGradient(x, y, x + 11, y + 10)
        vidrio.addColorStop(0, luz ? '#f6dc9c' : '#3c5671')
        vidrio.addColorStop(1, luz ? '#d9b46a' : '#1d2b3a')
        g.fillStyle = vidrio
        g.fillRect(x, y, 11, 10)
      }
    }
  })
}
// Follaje: verdes con luces y sombras de copas.
function follaje() {
  return lienzo(64, 64, (g, w, h) => {
    g.fillStyle = '#2f4f27'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 90; i++) {
      const x = Math.random() * w
      const y = Math.random() * h
      const r = 3 + Math.random() * 6
      g.fillStyle = ['#3e6b31', '#4c7d39', '#28431f', '#5b8c43'][i % 4]
      g.beginPath()
      g.arc(x, y, r, 0, Math.PI * 2)
      g.fill()
    }
  })
}

export const COLORES_CASA = { 'casa-crema': '#e9dcc0', 'casa-ocre': '#d8a96a', 'casa-terracota': '#c97b5a', 'casa-celeste': '#a9c7d6', 'casa-blanca': '#efece4', 'casa-verde': '#b9c9a0' }
export const COLORES_EDIFICIO = { 'edif-gris': '#b8b6b0', 'edif-arena': '#cbbfa8' }

/** Registra las texturas en el mapa (una vez por mapa). */
export function registrarTexturas(m) {
  for (const [id, c] of Object.entries(COLORES_CASA)) if (!m.hasImage(id)) m.addImage(id, casa(c), { pixelRatio: 2 })
  for (const [id, c] of Object.entries(COLORES_EDIFICIO)) if (!m.hasImage(id)) m.addImage(id, edificio(c), { pixelRatio: 2 })
  if (!m.hasImage('follaje')) m.addImage('follaje', follaje(), { pixelRatio: 2 })
}

const CASAS = Object.keys(COLORES_CASA)
const EDIFS = Object.keys(COLORES_EDIFICIO)
/** Expresión: cada edificio con su textura (casas bajas de colores; altos, edificio), estable por forma. */
export const PATRON_EDIFICIO = [
  'case',
  ['>=', ['coalesce', ['get', 'render_height'], 6], 12],
  ['match', ['%', ['round', ['to-number', ['coalesce', ['id'], ['get', 'render_height'], 0]]], 2], 0, EDIFS[0], EDIFS[1]],
  ['match', ['%', ['round', ['+', ['to-number', ['coalesce', ['id'], 0]], ['*', ['coalesce', ['get', 'render_height'], 5], 7]]], CASAS.length], ...CASAS.flatMap((c, i) => [i, c]), CASAS[0]],
]
