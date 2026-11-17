// Pintor de ZUMI en WebGL: el escenario, el cuerpo, los brazos (malla), la cabeza, la boca y los ojos se
// dibujan en la tarjeta gráfica, en un solo lienzo y sin copiar imágenes entre lienzos. Expone una API
// parecida a la de un lienzo 2D (guardar/restaurar, trasladar, girar, escalar, alfa, imagen) para que la
// lógica de animación sea la misma con WebGL o, si no hay WebGL, con el lienzo 2D de siempre.

const VS = `
attribute vec2 p; attribute vec2 uv; uniform vec2 tam; varying vec2 v;
void main(){ v = uv; vec2 c = p / tam * 2.0 - 1.0; gl_Position = vec4(c.x, -c.y, 0.0, 1.0); }`
const FS = `
precision mediump float; varying vec2 v; uniform sampler2D tex; uniform vec4 tinte;
void main(){ gl_FragColor = texture2D(tex, v) * tinte; }`

const ident = () => [1, 0, 0, 1, 0, 0]
const mult = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
]

/** Pintor WebGL sobre un <canvas>. Devuelve null si no hay WebGL. */
export function pintorGL(canvas) {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: false, antialias: true, powerPreference: 'low-power' })
  if (!gl) return null
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
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null
  gl.useProgram(pr)
  const uTam = gl.getUniformLocation(pr, 'tam')
  const uTinte = gl.getUniformLocation(pr, 'tinte')
  const aP = gl.getAttribLocation(pr, 'p')
  const aUv = gl.getAttribLocation(pr, 'uv')
  const bP = gl.createBuffer()
  const bUv = gl.createBuffer()
  const bIdx = gl.createBuffer()
  gl.enableVertexAttribArray(aP)
  gl.enableVertexAttribArray(aUv)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  const idx32 = gl.getExtension('OES_element_index_uint')

  const texturas = new WeakMap()
  const textura = (img) => {
    let t = texturas.get(img)
    if (t) return t
    t = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    texturas.set(img, t)
    return t
  }
  // pixel blanco para rellenos de color
  const blanco = document.createElement('canvas')
  blanco.width = blanco.height = 2
  const bg = blanco.getContext('2d')
  bg.fillStyle = '#fff'
  bg.fillRect(0, 0, 2, 2)

  let m = ident()
  let alfa = 1
  const pila = []
  const quad = new Float32Array(8)
  const quv = new Float32Array(8)
  const QIDX = new Uint16Array([0, 1, 2, 1, 3, 2])

  const dibujarTri = (tex, pos, uv, ind, tinte) => {
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.uniform4fv(uTinte, tinte)
    gl.bindBuffer(gl.ARRAY_BUFFER, bP)
    gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STREAM_DRAW)
    gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, bUv)
    gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STREAM_DRAW)
    gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bIdx)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ind, gl.STREAM_DRAW)
    gl.drawElements(gl.TRIANGLES, ind.length, ind instanceof Uint32Array ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT, 0)
  }
  const aplica = (x, y, out, i) => {
    out[i] = m[0] * x + m[2] * y + m[4]
    out[i + 1] = m[1] * x + m[3] * y + m[5]
  }

  return {
    gl: true,
    /** Ajusta el tamaño (px CSS × dpr) y limpia. */
    empezar(cw, ch, dpr, fondo = [0.106, 0.078, 0.063]) {
      const w = Math.round(cw * dpr)
      const h = Math.round(ch * dpr)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      gl.viewport(0, 0, w, h)
      gl.uniform2f(uTam, cw, ch)
      gl.clearColor(fondo[0], fondo[1], fondo[2], 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
      m = ident()
      alfa = 1
      pila.length = 0
    },
    save() {
      pila.push([m, alfa])
    },
    restore() {
      ;[m, alfa] = pila.pop() ?? [ident(), 1]
    },
    translate(x, y) {
      m = mult(m, [1, 0, 0, 1, x, y])
    },
    rotate(a) {
      const c = Math.cos(a)
      const s = Math.sin(a)
      m = mult(m, [c, s, -s, c, 0, 0])
    },
    scale(x, y) {
      m = mult(m, [x, 0, 0, y, 0, 0])
    },
    set globalAlpha(v) {
      alfa = v
    },
    get globalAlpha() {
      return alfa
    },
    /** drawImage(img, x, y, w, h) o drawImage(img, sx, sy, sw, sh, x, y, w, h) */
    drawImage(img, ...a) {
      if (!img || alfa <= 0.003) return
      let sx = 0
      let sy = 0
      let sw = img.width
      let sh = img.height
      let x, y, w, h
      if (a.length >= 8) [sx, sy, sw, sh, x, y, w, h] = a
      else [x, y, w, h] = a
      aplica(x, y, quad, 0)
      aplica(x + w, y, quad, 2)
      aplica(x, y + h, quad, 4)
      aplica(x + w, y + h, quad, 6)
      const u0 = sx / img.width
      const v0 = sy / img.height
      const u1 = (sx + sw) / img.width
      const v1 = (sy + sh) / img.height
      quv.set([u0, v0, u1, v0, u0, v1, u1, v1])
      dibujarTri(textura(img), quad, quv, QIDX, [alfa, alfa, alfa, alfa])
    },
    /** Relleno de color (r, g, b en 0..1) en coordenadas actuales. */
    rellenar(x, y, w, h, [r, g, b]) {
      aplica(x, y, quad, 0)
      aplica(x + w, y, quad, 2)
      aplica(x, y + h, quad, 4)
      aplica(x + w, y + h, quad, 6)
      quv.set([0, 0, 1, 0, 0, 1, 1, 1])
      dibujarTri(textura(blanco), quad, quv, QIDX, [r * alfa, g * alfa, b * alfa, alfa])
    },
    /** Malla deformable (brazos): posiciones en coordenadas locales + desplazamiento. */
    malla(geo, pos, ox, oy) {
      if (geo.grande && !idx32) return
      const n = pos.length / 2
      if (!geo._buf || geo._buf.length !== pos.length) geo._buf = new Float32Array(pos.length)
      const out = geo._buf
      for (let i = 0; i < n; i++) aplica(pos[i * 2] + ox, pos[i * 2 + 1] + oy, out, i * 2)
      dibujarTri(textura(geo.textura), out, geo.uv, geo.idx, [alfa, alfa, alfa, alfa])
    },
    destruir() {
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}

/** Respaldo: el mismo «pintor» sobre un lienzo 2D (sin malla: brazos rígidos). */
export function pintor2D(canvas) {
  const g = canvas.getContext('2d')
  return {
    gl: false,
    empezar(cw, ch, dpr) {
      const w = Math.round(cw * dpr)
      const h = Math.round(ch * dpr)
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.imageSmoothingQuality = 'high'
      g.globalAlpha = 1
      g.fillStyle = '#1b1410'
      g.fillRect(0, 0, cw, ch)
    },
    save: () => g.save(),
    restore: () => g.restore(),
    translate: (x, y) => g.translate(x, y),
    rotate: (a) => g.rotate(a),
    scale: (x, y) => g.scale(x, y),
    set globalAlpha(v) {
      g.globalAlpha = v
    },
    get globalAlpha() {
      return g.globalAlpha
    },
    drawImage: (...a) => g.drawImage(...a),
    rellenar(x, y, w, h, [r, gg, b]) {
      g.fillStyle = `rgb(${r * 255},${gg * 255},${b * 255})`
      g.fillRect(x, y, w, h)
    },
    malla: null,
    destruir() {},
  }
}

/** Pelota de playa dibujada una vez (gajos + luz); se gira al pintarla. */
export function texturasPelota(r = 64) {
  const gajos = document.createElement('canvas')
  gajos.width = gajos.height = r * 2
  const g = gajos.getContext('2d')
  g.translate(r, r)
  g.beginPath()
  g.arc(0, 0, r, 0, Math.PI * 2)
  g.clip()
  const colores = ['#ef4444', '#ffffff', '#3b82f6', '#ffffff', '#facc15', '#ffffff']
  for (let i = 0; i < 6; i++) {
    g.fillStyle = colores[i]
    g.beginPath()
    g.moveTo(0, 0)
    g.arc(0, 0, r, (i * Math.PI) / 3, ((i + 1) * Math.PI) / 3)
    g.fill()
  }
  const luz = document.createElement('canvas')
  luz.width = luz.height = r * 2
  const l = luz.getContext('2d')
  l.translate(r, r)
  l.beginPath()
  l.arc(0, 0, r, 0, Math.PI * 2)
  l.clip()
  const gr = l.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.05, 0, 0, r)
  gr.addColorStop(0, 'rgba(255,255,255,0.55)')
  gr.addColorStop(0.45, 'rgba(255,255,255,0.05)')
  gr.addColorStop(1, 'rgba(40,20,10,0.45)')
  l.fillStyle = gr
  l.fillRect(-r, -r, r * 2, r * 2)
  return { gajos, luz }
}
