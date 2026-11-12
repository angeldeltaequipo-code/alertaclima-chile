// Brazos de ZUMI con malla deformable (como Live2D/Spine): cada brazo es una malla de triángulos con dos
// «huesos» (hombro y codo). Se dobla en el codo y nace fijo del hombro, sin girar como una pieza rígida,
// y sus bordes se funden con el torso, que se dibuja debajo. Se dibuja con WebGL (un solo trazo) y se copia al lienzo 2D.
//
// Pesos: salen de las máscaras de los brazos (difuminadas) y de la posición a lo largo del brazo
// (hombro → codo → mano). Sin WebGL devuelve null y el motor usa el dibujo simple.

const PASO = 14 // px de imagen entre vértices
const MARGEN = 240 // espacio alrededor del cuerpo para que los brazos puedan abrirse

const paso = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

const VS = `
attribute vec2 p; attribute vec2 uv; uniform vec2 tam; varying vec2 v;
void main(){ v = uv; vec2 c = p / tam * 2.0 - 1.0; gl_Position = vec4(c.x, -c.y, 0.0, 1.0); }`
const FS = `
precision mediump float; varying vec2 v; uniform sampler2D tex;
void main(){ gl_FragColor = texture2D(tex, v); }`

function programa(gl) {
  const sh = (tipo, src) => {
    const s = gl.createShader(tipo)
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s))
    return s
  }
  const pr = gl.createProgram()
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS))
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS))
  gl.linkProgram(pr)
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr))
  return pr
}

/**
 * Crea la malla de un escenario. pieza: pieza.json; img: imágenes (cuerpo, brazo_izq, brazo_der).
 * Devuelve { lienzo, x, y, w, h, dibujar(poses) } en coordenadas de la escena, o null.
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
  const mascara = (lado) => {
    const m = document.createElement('canvas')
    m.width = W
    m.height = H
    const mg = m.getContext('2d', { willReadFrequently: true })
    mg.filter = 'blur(14px)'
    const r = pieza.pos[`brazo_${lado}`]
    for (let i = 0; i < 3; i++) mg.drawImage(img[`brazo_${lado}`], r[0] - ox, r[1] - oy, r[2], r[3])
    return mg.getImageData(0, 0, W, H).data
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
      const px = (Math.min(H - 1, Math.round(y)) * W + Math.min(W - 1, Math.round(x))) * 4 + 3
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

  // WebGL
  // Se dibuja a menor resolución (los brazos son pelaje suave: no se nota y rinde mucho más)
  const ESCALA = 0.6
  const lienzo = document.createElement('canvas')
  lienzo.width = Math.round(W * ESCALA)
  lienzo.height = Math.round(H * ESCALA)
  const gl = lienzo.getContext('webgl', { premultipliedAlpha: true, alpha: true, preserveDrawingBuffer: true, antialias: true })
  if (!gl) return null
  let pr
  try {
    pr = programa(gl)
  } catch {
    return null
  }
  gl.useProgram(pr)
  const pos = new Float32Array(base)
  const bPos = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, bPos)
  gl.bufferData(gl.ARRAY_BUFFER, pos, gl.DYNAMIC_DRAW)
  const aP = gl.getAttribLocation(pr, 'p')
  gl.enableVertexAttribArray(aP)
  gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 0, 0)
  const bUv = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, bUv)
  gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW)
  const aUv = gl.getAttribLocation(pr, 'uv')
  gl.enableVertexAttribArray(aUv)
  gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0)
  const bIdx = gl.createBuffer()
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bIdx)
  const grande = n > 65535
  if (grande && !gl.getExtension('OES_element_index_uint')) return null
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, grande ? new Uint32Array(idx) : new Uint16Array(idx), gl.STATIC_DRAW)
  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, comp)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.uniform2f(gl.getUniformLocation(pr, 'tam'), W, H)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  gl.viewport(0, 0, lienzo.width, lienzo.height)

  const gira = (x, y, cx, cy, c, s) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]
  let ultima = ''

  /** poses: { izq: { hombro, codo }, der: { hombro, codo } } en grados; + = hacia afuera. */
  const dibujar = (poses) => {
    const clave = ['izq', 'der'].map((l) => `${poses[l].hombro.toFixed(1)},${poses[l].codo.toFixed(1)}`).join('|')
    if (clave === ultima) return
    ultima = clave
    const R = {}
    for (const lado of ['izq', 'der']) {
      const sg = lado === 'izq' ? 1 : -1 // afuera = horario a la izquierda, antihorario a la derecha
      const as = (sg * poses[lado].hombro * Math.PI) / 180
      const ae = (sg * poses[lado].codo * Math.PI) / 180
      const h = huesos[lado]
      R[lado] = { h, cs: Math.cos(as), ss: Math.sin(as), ce: Math.cos(ae), se: Math.sin(ae) }
    }
    pos.set(base)
    for (const [k, lado, wh, wc] of pesos) {
      const { h, cs, ss, ce, se } = R[lado]
      const x = base[k * 2]
      const y = base[k * 2 + 1]
      // hombro solo
      const [x1, y1] = gira(x, y, h.hombro[0], h.hombro[1], cs, ss)
      // codo y luego hombro (el antebrazo sigue al brazo)
      const [xe, ye] = gira(x, y, h.codo[0], h.codo[1], ce, se)
      const [x2, y2] = gira(xe, ye, h.hombro[0], h.hombro[1], cs, ss)
      const w0 = 1 - wh - wc
      pos[k * 2] = w0 * x + wh * x1 + wc * x2
      pos[k * 2 + 1] = w0 * y + wh * y1 + wc * y2
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, bPos)
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, pos)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawElements(gl.TRIANGLES, idx.length, grande ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0)
  }

  return { lienzo, x: ox, y: oy, w: W, h: H, dibujar }
}
