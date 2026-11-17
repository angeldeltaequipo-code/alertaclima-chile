// Brazos de ZUMI con malla deformable (como Live2D/Spine): cada brazo es una malla de triángulos con dos
// «huesos» (hombro y codo). Se dobla en el codo y nace fijo del hombro, sin girar como una pieza rígida,
// y sus bordes se funden con el torso, que se dibuja debajo. La pinta zumiGL.js en la tarjeta gráfica.
//
// Pesos: salen de las máscaras de los brazos (difuminadas) y de la posición a lo largo del brazo
// (hombro → codo → mano). 

const PASO = 14 // px de imagen entre vértices
const MARGEN = 240 // espacio alrededor del cuerpo para que los brazos puedan abrirse

const paso = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Crea la malla de un escenario. pieza: pieza.json; img: imágenes (cuerpo, brazo_izq, brazo_der).
 * Devuelve la geometría { textura, uv, idx, x, y, posiciones(poses) } en coordenadas de la escena.
 */
export function crearMalla(pieza, img) {
  if (!img.brazo_izq || !img.brazo_der || !pieza.hombros) return null
  const cu = pieza.pos.cuerpo
  const W = Math.round(cu[2] + MARGEN * 2)
  const H = Math.round(cu[3] + MARGEN)
  const ox = cu[0] - MARGEN // origen de la malla en la escena
  const oy = cu[1]

  // Textura: solo los brazos (el torso se dibuja aparte, debajo). Bordes suavizados para que se
  // fundan con el pelo del torso en vez de verse recortados.
  const comp = document.createElement('canvas')
  comp.width = W
  comp.height = H
  const g = comp.getContext('2d')
  for (const lado of ['izq', 'der']) {
    const r = pieza.pos[`brazo_${lado}`]
    g.drawImage(img[`brazo_${lado}`], r[0] - ox, r[1] - oy, r[2], r[3])
  }
  const suav = document.createElement('canvas')
  suav.width = W
  suav.height = H
  const sg = suav.getContext('2d')
  sg.filter = 'blur(3px)'
  sg.drawImage(comp, 0, 0)
  g.globalCompositeOperation = 'destination-in'
  g.drawImage(suav, 0, 0)
  g.globalCompositeOperation = 'source-over'

  // Zona de cada brazo (ensanchada): todos sus vértices, incluido el borde transparente, se mueven
  // juntos con el brazo; así nada se estira como una membrana.
  const Q = 4 // las máscaras se calculan a 1/4 de resolución: bastan para los pesos y son 16 veces más baratas
  const mw = Math.ceil(W / Q)
  const mh = Math.ceil(H / Q)
  const mascara = (lado) => {
    const m = document.createElement('canvas')
    m.width = mw
    m.height = mh
    const mg = m.getContext('2d', { willReadFrequently: true })
    mg.filter = `blur(${14 / Q}px)`
    const r = pieza.pos[`brazo_${lado}`]
    for (let i = 0; i < 3; i++) mg.drawImage(img[`brazo_${lado}`], (r[0] - ox) / Q, (r[1] - oy) / Q, r[2] / Q, r[3] / Q)
    return mg.getImageData(0, 0, mw, mh).data
  }
  const mIzq = mascara('izq')
  const mDer = mascara('der')

  // Huesos de cada brazo (en coordenadas de la malla)
  const huesos = {}
  for (const lado of ['izq', 'der']) {
    const r = pieza.pos[`brazo_${lado}`]
    const [hx, hy] = pieza.hombros[lado]
    const mano = [r[0] + r[2] / 2 - ox, r[1] + r[3] - oy]
    const hombro = [hx - ox, hy - oy]
    const largo = Math.hypot(mano[0] - hombro[0], mano[1] - hombro[1])
    const dir = [(mano[0] - hombro[0]) / largo, (mano[1] - hombro[1]) / largo]
    const codo = [hombro[0] + dir[0] * largo * 0.48, hombro[1] + dir[1] * largo * 0.48]
    huesos[lado] = { hombro, codo, dir, largo }
  }

  // Vértices de la rejilla con sus pesos (solo se recalculan los que se mueven)
  const cols = Math.ceil(W / PASO) + 1
  const filas = Math.ceil(H / PASO) + 1
  const n = cols * filas
  const base = new Float32Array(n * 2)
  const uv = new Float32Array(n * 2)
  const pesos = [] // [índice, lado, wHombro, wCodo]
  const enZona = new Uint8Array(n) // vértices que pertenecen a algún brazo
  for (let j = 0; j < filas; j++)
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i
      const x = Math.min(W, i * PASO)
      const y = Math.min(H, j * PASO)
      base[k * 2] = x
      base[k * 2 + 1] = y
      uv[k * 2] = x / W
      uv[k * 2 + 1] = y / H
      const px = (Math.min(mh - 1, Math.round(y / Q)) * mw + Math.min(mw - 1, Math.round(x / Q))) * 4 + 3
      for (const [lado, m] of [['izq', mIzq], ['der', mDer]]) {
        if (m[px] < 3) continue // fuera de la zona de este brazo
        enZona[k] = 1
        const a = 1
        const h = huesos[lado]
        const s = ((x - h.hombro[0]) * h.dir[0] + (y - h.hombro[1]) * h.dir[1]) / h.largo // 0 hombro … 1 mano
        const total = a * paso(-0.04, 0.26, s) // el hombro queda pegado al cuerpo
        if (total < 0.01) continue
        const fore = paso(0.36, 0.6, s)
        pesos.push([k, lado, total * (1 - fore), total * fore])
      }
    }
  const idx = []
  for (let j = 0; j < filas - 1; j++)
    for (let i = 0; i < cols - 1; i++) {
      const a = j * cols + i
      // solo los triángulos de los brazos: el resto de la malla está vacío (el torso va aparte)
      if (!(enZona[a] || enZona[a + 1] || enZona[a + cols] || enZona[a + cols + 1])) continue
      idx.push(a, a + 1, a + cols, a + 1, a + cols + 1, a + cols)
    }

  // Solo los vértices que usan los triángulos de los brazos (la malla queda chica y rápida)
  const nuevo = new Int32Array(n).fill(-1)
  let usados = 0
  for (const v of idx) if (nuevo[v] < 0) nuevo[v] = usados++
  const base2 = new Float32Array(usados * 2)
  const uv2 = new Float32Array(usados * 2)
  for (let v = 0; v < n; v++) {
    const q = nuevo[v]
    if (q < 0) continue
    base2[q * 2] = base[v * 2]
    base2[q * 2 + 1] = base[v * 2 + 1]
    uv2[q * 2] = uv[v * 2]
    uv2[q * 2 + 1] = uv[v * 2 + 1]
  }
  const pesos2 = pesos.filter(([k]) => nuevo[k] >= 0).map(([k, l, a, b]) => [nuevo[k], l, a, b])
  const grande = usados > 65535
  const ind = grande ? new Uint32Array(idx.map((v) => nuevo[v])) : new Uint16Array(idx.map((v) => nuevo[v]))
  const pos = new Float32Array(base2)

  const gira = (x, y, cx, cy, c, s) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]

  /** poses: { izq: { hombro, codo }, der: { hombro, codo } } en grados; + = hacia afuera. Devuelve las posiciones. */
  const posiciones = (poses) => {
    const R = {}
    for (const lado of ['izq', 'der']) {
      const sg = lado === 'izq' ? 1 : -1 // afuera = horario a la izquierda, antihorario a la derecha
      const as = (sg * poses[lado].hombro * Math.PI) / 180
      const ae = (sg * poses[lado].codo * Math.PI) / 180
      R[lado] = { h: huesos[lado], cs: Math.cos(as), ss: Math.sin(as), ce: Math.cos(ae), se: Math.sin(ae) }
    }
    pos.set(base2)
    for (const [k, lado, wh, wc] of pesos2) {
      const { h, cs, ss, ce, se } = R[lado]
      const x = base2[k * 2]
      const y = base2[k * 2 + 1]
      const [x1, y1] = gira(x, y, h.hombro[0], h.hombro[1], cs, ss) // hombro
      const [xe, ye] = gira(x, y, h.codo[0], h.codo[1], ce, se) // codo, y luego hombro (el antebrazo sigue al brazo)
      const [x2, y2] = gira(xe, ye, h.hombro[0], h.hombro[1], cs, ss)
      const w0 = 1 - wh - wc
      pos[k * 2] = w0 * x + wh * x1 + wc * x2
      pos[k * 2 + 1] = w0 * y + wh * y1 + wc * y2
    }
    return pos
  }

  return { textura: comp, uv: uv2, idx: ind, grande, x: ox, y: oy, posiciones }
}
