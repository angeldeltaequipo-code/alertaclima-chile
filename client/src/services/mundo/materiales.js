// Texturas dibujadas al vuelo (sin descargar nada): asfalto con líneas, vereda de baldosas, fachadas
// con ventanas, tejas, zinc, pasto, agua. Y los materiales del mundo.
import * as THREE from 'three'

function lienzo(w, h, dibujar) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  dibujar(c.getContext('2d'), w, h)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}
function grano(g, w, h, n, a, colores) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colores[i % colores.length]
    g.globalAlpha = a * (0.4 + Math.random() * 0.6)
    const s = 1 + Math.random() * 2
    g.fillRect(Math.random() * w, Math.random() * h, s, s)
  }
  g.globalAlpha = 1
}

// Asfalto: u = a lo largo (1 = 8 m), v = de borde a borde.
const asfalto = (principal) =>
  lienzo(256, 256, (g, w, h) => {
    g.fillStyle = '#62666d'
    g.fillRect(0, 0, w, h)
    grano(g, w, h, 9000, 0.35, ['#757980', '#4f5359', '#83878d'])
    if (principal) {
      g.fillStyle = '#f3f1ea'
      g.fillRect(0, 10, w, 7)
      g.fillRect(0, h - 17, w, 7)
      g.fillStyle = '#f2c230'
      g.fillRect(0, h / 2 - 5, w * 0.55, 10)
    } else {
      g.fillStyle = 'rgba(243,241,234,.9)'
      g.fillRect(0, h / 2 - 4, w * 0.4, 8)
    }
  })
const baldosa = () =>
  lienzo(128, 128, (g, w, h) => {
    g.fillStyle = '#cfcbc2'
    g.fillRect(0, 0, w, h)
    grano(g, w, h, 1600, 0.25, ['#bdb8ae', '#ddd9d1'])
    g.strokeStyle = 'rgba(120,115,105,.45)'
    g.lineWidth = 2
    for (let i = 0; i <= 2; i++) {
      g.beginPath()
      g.moveTo((i * w) / 2, 0)
      g.lineTo((i * w) / 2, h)
      g.stroke()
    }
    // solera (borde de la vereda)
    g.fillStyle = '#e9e6df'
    g.fillRect(0, 0, w, 6)
    g.fillRect(0, h - 6, w, 6)
  })
// Fachada: una celda = un tramo de muro de un piso con una ventana (u: 3,2 m, v: 3,2 m).
const fachada = (alto) =>
  lienzo(256, 256, (g, w, h) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, w, h)
    grano(g, w, h, 2500, 0.08, ['#000', '#fff'])
    // zócalo abajo y cornisa arriba
    g.fillStyle = 'rgba(0,0,0,.10)'
    g.fillRect(0, h - 22, w, 22)
    g.fillStyle = 'rgba(255,255,255,.6)'
    g.fillRect(0, 0, w, 8)
    const [x0, y0, ww, hh] = alto ? [36, 46, 184, 150] : [70, 54, 116, 128]
    g.fillStyle = alto ? '#dfe3e6' : '#f7f4ec'
    g.fillRect(x0 - 8, y0 - 8, ww + 16, hh + 16) // marco
    const vidrio = g.createLinearGradient(x0, y0, x0 + ww, y0 + hh)
    vidrio.addColorStop(0, '#8fb4cf')
    vidrio.addColorStop(0.45, '#3f5f7a')
    vidrio.addColorStop(1, '#22384d')
    g.fillStyle = vidrio
    g.fillRect(x0, y0, ww, hh)
    g.fillStyle = 'rgba(255,255,255,.28)'
    g.beginPath()
    g.moveTo(x0, y0 + hh * 0.7)
    g.lineTo(x0 + ww * 0.45, y0)
    g.lineTo(x0 + ww * 0.62, y0)
    g.lineTo(x0, y0 + hh)
    g.fill()
    g.fillStyle = alto ? '#dfe3e6' : '#f7f4ec'
    g.fillRect(x0 + ww / 2 - 3, y0, 6, hh) // parteluz
    if (!alto) g.fillRect(x0, y0 + hh * 0.42, ww, 5)
    g.fillStyle = 'rgba(0,0,0,.18)'
    g.fillRect(x0 - 10, y0 + hh + 8, ww + 20, 7) // alféizar
  })
// Luz de ventanas de noche (misma celda; una de cada tres encendida a lo largo del muro)
const luces = (alto) =>
  lienzo(256, 256, (g, w, h) => {
    g.fillStyle = '#000'
    g.fillRect(0, 0, w, h)
    const [x0, y0, ww, hh] = alto ? [36, 46, 184, 150] : [70, 54, 116, 128]
    if (Math.random() < 0.6) {
      g.fillStyle = '#ffcf7a'
      g.fillRect(x0, y0, ww, hh)
    }
  })
const teja = () =>
  lienzo(128, 128, (g, w, h) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, w, h)
    for (let y = 0; y < h; y += 16)
      for (let x = (y / 16) % 2 ? -8 : 0; x < w; x += 16) {
        const gr = g.createRadialGradient(x + 8, y + 4, 1, x + 8, y + 8, 11)
        gr.addColorStop(0, 'rgba(255,255,255,1)')
        gr.addColorStop(1, 'rgba(120,120,120,1)')
        g.fillStyle = gr
        g.beginPath()
        g.ellipse(x + 8, y + 8, 8, 9, 0, 0, Math.PI * 2)
        g.fill()
      }
  })
const zinc = () =>
  lienzo(64, 64, (g, w, h) => {
    for (let x = 0; x < w; x += 8) {
      const gr = g.createLinearGradient(x, 0, x + 8, 0)
      gr.addColorStop(0, '#9a9a9a')
      gr.addColorStop(0.5, '#ffffff')
      gr.addColorStop(1, '#8a8a8a')
      g.fillStyle = gr
      g.fillRect(x, 0, 8, h)
    }
  })
const pasto = () =>
  lienzo(256, 256, (g, w, h) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, w, h)
    grano(g, w, h, 14000, 0.22, ['#cfd8c0', '#ffffff', '#b8c4a4', '#e8eedc'])
  })
const tierra = () =>
  lienzo(128, 128, (g, w, h) => {
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, w, h)
    grano(g, w, h, 5000, 0.35, ['#d6cbb8', '#b5a78f', '#fff'])
  })
const aguaTex = () =>
  lienzo(256, 256, (g, w, h) => {
    g.fillStyle = '#3e8fc6'
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 140; i++) {
      g.strokeStyle = `rgba(255,255,255,${0.08 + Math.random() * 0.18})`
      g.lineWidth = 1 + Math.random() * 2
      const x = Math.random() * w
      const y = Math.random() * h
      g.beginPath()
      g.moveTo(x, y)
      g.quadraticCurveTo(x + 10, y - 4, x + 24, y)
      g.stroke()
    }
  })

// Una sola geometría de auto (con colores por vértice: carrocería blanca para teñir, vidrios y ruedas oscuros)
function pintar(g, hex) {
  const c = new THREE.Color(hex)
  const n = g.attributes.position.count
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3)
  g.setAttribute('color', new THREE.BufferAttribute(a, 3))
  if (g.index) return g.toNonIndexed()
  return g
}
function unir(partes) {
  const lista = partes.map((g) => (g.index ? g.toNonIndexed() : g))
  const total = lista.reduce((s, g) => s + g.attributes.position.count, 0)
  const out = new THREE.BufferGeometry()
  for (const k of ['position', 'normal', 'color']) {
    const arr = new Float32Array(total * 3)
    let o = 0
    for (const g of lista) {
      arr.set(g.attributes[k].array, o)
      o += g.attributes[k].array.length
    }
    out.setAttribute(k, new THREE.BufferAttribute(arr, 3))
  }
  out.computeBoundingSphere()
  return out
}
function geoAuto() {
  const p = []
  const caja = (w, h, d, x, y, z, col) => p.push(pintar(new THREE.BoxGeometry(w, h, d).translate(x, y, z).toNonIndexed(), col))
  caja(1.78, 0.62, 4.25, 0, 0.62, 0, '#ffffff') // carrocería
  caja(1.6, 0.52, 2.1, 0, 1.18, 0.15, '#22303c') // vidrios
  caja(1.5, 0.06, 1.9, 0, 1.46, 0.15, '#ffffff') // techo
  caja(1.7, 0.16, 0.06, 0, 0.62, -2.13, '#e8e8e8') // parachoques
  for (const s of [-1, 1]) {
    caja(0.36, 0.12, 0.04, 0.58 * s, 0.78, -2.14, '#f3efe2') // focos
    caja(0.4, 0.12, 0.04, 0.58 * s, 0.8, 2.14, '#b8221a') // luces traseras
  }
  for (const [x, z] of [[-0.84, -1.32], [0.84, -1.32], [-0.84, 1.32], [0.84, 1.32]])
    p.push(pintar(new THREE.CylinderGeometry(0.34, 0.34, 0.26, 14).rotateZ(Math.PI / 2).translate(x, 0.34, z).toNonIndexed(), '#141414'))
  return unir(p)
}
function geoPoste() {
  return unir([
    pintar(new THREE.CylinderGeometry(0.11, 0.15, 8.2, 8).translate(0, 4.1, 0).toNonIndexed(), '#6d5844'),
    pintar(new THREE.BoxGeometry(1.4, 0.12, 0.12).translate(0, 7.3, 0).toNonIndexed(), '#5b4a39'),
    pintar(new THREE.BoxGeometry(0.1, 0.1, 1.6).translate(0, 6.6, -0.75).toNonIndexed(), '#444a50'), // brazo de la luminaria
    pintar(new THREE.BoxGeometry(0.34, 0.14, 0.55).translate(0, 6.52, -1.5).toNonIndexed(), '#d9d6cc'), // luminaria
  ])
}

export function crearMateriales() {
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o })
  const fachadaBaja = fachada(false)
  const fachadaAlta = fachada(true)
  const m = {
    suelo: std({ vertexColors: true, map: pasto(), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    agua: std({ map: aguaTex(), roughness: 0.15, metalness: 0.1, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    vereda: std({ map: baldosa(), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    tierra: std({ vertexColors: true, map: tierra(), side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }),
    calle: std({ map: asfalto(false), roughness: 0.82, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
    callePpal: std({ map: asfalto(true), roughness: 0.8, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }),
    muro: std({ vertexColors: true, map: fachadaBaja, emissiveMap: luces(false), emissive: new THREE.Color('#000000'), side: THREE.DoubleSide }),
    muroAlto: std({ vertexColors: true, map: fachadaAlta, emissiveMap: luces(true), emissive: new THREE.Color('#000000'), roughness: 0.6, side: THREE.DoubleSide }),
    teja: std({ vertexColors: true, map: teja(), roughness: 0.75, side: THREE.DoubleSide }),
    zinc: std({ vertexColors: true, map: zinc(), roughness: 0.45, metalness: 0.35, side: THREE.DoubleSide }),
    plano: std({ vertexColors: true, map: tierra(), side: THREE.DoubleSide }),
    tronco: std({ color: '#6b4a32' }),
    copa: std({ color: '#ffffff', flatShading: true, roughness: 0.95 }),
    puerta: std({ vertexColors: true, roughness: 0.6 }),
    auto: new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: 0.35, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
    autoGeo: geoAuto(),
    poste: std({ vertexColors: true, roughness: 0.95 }),
    posteGeo: geoPoste(),
    cable: new THREE.LineBasicMaterial({ color: '#1b1b1b', transparent: true, opacity: 0.85 }),
    troncoGeo: new THREE.CylinderGeometry(0.16, 0.24, 2.6, 6).translate(0, 1.3, 0),
    copaGeo: (() => {
      const g = new THREE.IcosahedronGeometry(2.3, 0)
      g.scale(1, 1.15, 1)
      g.translate(0, 4.1, 0)
      return g
    })(),
  }
  return m
}

/** De noche se encienden las ventanas. */
export function nocheMateriales(m, noche) {
  for (const k of ['muro', 'muroAlto']) {
    m[k].emissive.set(noche ? '#ffb25a' : '#000000')
    m[k].emissiveIntensity = noche ? 1.1 : 0
  }
}
