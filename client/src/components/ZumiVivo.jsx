// ZUMI «vivo» en 3D, dibujado con WebGL en tiempo real.
//
// Cómo se construyó (scripts en el repositorio del proyecto, a partir del video del personaje):
// - Se recortó a ZUMI de un fotograma frontal y se le aumentó la resolución ×4 con una red
//   neuronal (EDSR).
// - Se le calculó la profundidad con una red de visión (MiDaS) más un «inflado» de la silueta: así
//   cada punto del cuerpo tiene volumen real (la nariz y la panza más cerca, las orejas más atrás).
// - Se le armó un esqueleto simple: cabeza, mandíbula, brazo levantado y cola, con pesos suaves.
// - Las bocas son formas REALES de ZUMI sacadas del mismo video (a, e, i, o, m), alineadas al
//   fotograma base.
//
// En pantalla: una malla de ~10.000 puntos con perspectiva. La cabeza gira en 3D hacia tu dedo o
// hacia donde inclinas el teléfono, el cuerpo respira, la cola se mece, saluda con el brazo,
// parpadea, mueve los ojos, y la boca sigue sílaba por sílaba lo que dice la voz (labios.js).
import { useEffect, useRef } from 'react'
import { alCambiarBoca } from '../services/labios'
import { TrajeSVG } from './PortalZumi'

const BASE = import.meta.env.BASE_URL
// Textura base (px) y proporción
const TW = 1400
const TH = 1615
const ASP = TW / TH
const MARGEN = 0.12
// Ojos (centro y radios en px de la textura) y rectángulo de la boca
const OJOS = [
  [650, 420, 48, 47],
  [895, 407.5, 49, 46],
]
const BOCA = [555.4, 438.0, 487, 344]
const HOJA_BOCAS = ['m', 'e', 'a', 'i', 'o'] // orden en zumi3d-bocas.webp; «reposo» es la boca de la textura base
const ENERGIA = { reposo: 0, m: 0.3, e: 0.7, a: 1, i: 0.55, o: 0.85 }
// Puntos del esqueleto (en uv de la textura)
const CUELLO = [0.56, 0.47]
const CABEZA = [0.56, 0.27]
const HOMBRO = [0.3, 0.52]
const COLA = [0.8, 0.75]
// El traje está dibujado en 512 px con los ojos en (198,210) y (318,206)
const ESC_TRAJE = (OJOS[1][0] - OJOS[0][0]) / (318 - 198)

const VS = `
precision highp float;
attribute vec2 aUV;
attribute vec3 aR1; // profundidad, cabeza, mandíbula
attribute vec3 aR2; // brazo, cola, silueta
uniform float uT, uHabla, uOla, uCalma, uResp;
uniform vec2 uMira;
uniform vec2 uEsc;
uniform float uCy;
varying vec2 vUV;
varying float vProf, vLado;
const float A = ${ASP.toFixed(5)};
vec3 aObj(vec2 uv, float z) { return vec3((uv.x - 0.5) * A, 0.5 - uv.y, z); }
vec2 rot(vec2 p, float a) { float s = sin(a), c = cos(a); return vec2(p.x * c - p.y * s, p.x * s + p.y * c); }
void main() {
  float anima = 1.0 - uCalma;
  float z = aR1.x * 0.2;
  vec3 p = aObj(aUV, z);
  // respiración: el pecho se hincha, los pies quedan fijos
  float sobrePies = 1.0 - smoothstep(0.62, 0.98, aUV.y);
  float pecho = (1.0 - aR1.y) * sobrePies;
  p.y += 0.007 * uResp * sobrePies * anima;
  p.x *= 1.0 + 0.012 * uResp * pecho * anima;
  p.z += 0.02 * uResp * pecho * anima;
  // mandíbula: baja un poco con la boca abierta
  p.y -= aR1.z * 0.010 * uHabla;
  // brazo levantado: saluda o se mece
  vec3 h = aObj(vec2(${HOMBRO[0]}, ${HOMBRO[1]}), 0.0);
  float aB = uOla * 0.38 * sin(uT * 7.5) + 0.05 * sin(uT * 1.1) * anima;
  vec2 pb = rot(p.xy - h.xy, -aB) + h.xy;
  p.xy = mix(p.xy, pb, aR2.x);
  // cola
  vec3 c = aObj(vec2(${COLA[0]}, ${COLA[1]}), 0.0);
  vec2 pc = rot(p.xy - c.xy, 0.12 * sin(uT * 1.4) * anima) + c.xy;
  p.xy = mix(p.xy, pc, aR2.y);
  // cabeza: gira en 3D (yaw/pitch) alrededor de su centro y se ladea sobre el cuello
  vec3 hc = aObj(vec2(${CABEZA[0]}, ${CABEZA[1]}), 0.1);
  vec3 q = p - hc;
  float yaw = uMira.x * 0.42 + 0.05 * sin(uT * 0.7) * anima;
  float pitch = uMira.y * 0.26 + uHabla * 0.04 * sin(uT * 9.0);
  q.xz = rot(q.xz, yaw);
  q.yz = rot(q.yz, pitch);
  q += hc;
  vec3 n = aObj(vec2(${CUELLO[0]}, ${CUELLO[1]}), 0.0);
  float roll = 0.04 * sin(uT * 0.9) * anima - uMira.x * 0.05;
  q.xy = rot(q.xy - n.xy, roll) + n.xy;
  p = mix(p, q, aR1.y);
  // todo el cuerpo acompaña un poco el giro
  p.xz = rot(p.xz, uMira.x * 0.12);
  p.yz = rot(p.yz, uMira.y * 0.05);
  // perspectiva
  float s = 2.6 / (2.6 - p.z);
  vec2 xy = p.xy * s;
  vUV = aUV;
  vProf = aR1.x;
  vLado = (aUV.x - 0.5);
  gl_Position = vec4((xy - vec2(0.0, uCy)) * uEsc, -p.z * 0.1, 1.0);
}`

const FS = `
precision mediump float;
uniform sampler2D uTex, uBocas, uTraje;
uniform float uBocaA, uBocaB, uMezcla, uParpado, uHayTraje;
uniform vec2 uOjo;
uniform vec3 uLuzA, uLuzB;
uniform vec2 uMiraF;
varying vec2 vUV;
varying float vProf, vLado;
const vec4 BOCA = vec4(${(BOCA[0] / TW).toFixed(5)}, ${(BOCA[1] / TH).toFixed(5)}, ${(BOCA[2] / TW).toFixed(5)}, ${(BOCA[3] / TH).toFixed(5)});
vec4 boca(float i, vec2 b) {
  if (i < 0.0) return vec4(0.0);
  return texture2D(uBocas, vec2((i + b.x) / 5.0, b.y));
}
vec3 ojo(vec2 uv, vec2 c, vec2 r, inout vec4 col) {
  vec2 d = (uv - c) / r;
  float l = length(d);
  if (l > 1.0) return vec3(0.0);
  // mirada: el contenido del ojo se corre dentro de la cuenca
  float g = smoothstep(1.0, 0.5, l);
  col = texture2D(uTex, uv - uOjo * r * 0.32 * g);
  // párpado que baja desde arriba (piel de la frente)
  float ny = (d.y + 1.0) * 0.5;
  if (ny < uParpado) {
    vec4 piel = texture2D(uTex, vec2(uv.x, uv.y - r.y * 2.1));
    col = vec4(piel.rgb * 0.92, col.a);
  }
  float borde = 1.0 - smoothstep(0.0, 0.07, abs(ny - uParpado));
  col.rgb = mix(col.rgb, vec3(0.16, 0.07, 0.03), borde * step(0.04, uParpado) * 0.85);
  return vec3(1.0);
}
void main() {
  vec4 col = texture2D(uTex, vUV);
  if (col.a < 0.01) discard;
  ojo(vUV, vec2(${(OJOS[0][0] / TW).toFixed(5)}, ${(OJOS[0][1] / TH).toFixed(5)}), vec2(${(OJOS[0][2] / TW).toFixed(5)}, ${(OJOS[0][3] / TH).toFixed(5)}), col);
  ojo(vUV, vec2(${(OJOS[1][0] / TW).toFixed(5)}, ${(OJOS[1][1] / TH).toFixed(5)}), vec2(${(OJOS[1][2] / TW).toFixed(5)}, ${(OJOS[1][3] / TH).toFixed(5)}), col);
  // boca real (fundido entre la forma anterior y la nueva)
  vec2 b = (vUV - BOCA.xy) / BOCA.zw;
  if (b.x > 0.0 && b.x < 1.0 && b.y > 0.0 && b.y < 1.0) {
    vec4 ba = boca(uBocaA, b);
    vec4 bb = boca(uBocaB, b);
    vec4 m = mix(ba, bb, uMezcla);
    col.rgb = mix(col.rgb, m.rgb, m.a);
  }
  // traje
  if (uHayTraje > 0.5) {
    vec4 t = texture2D(uTraje, vUV);
    col.rgb = mix(col.rgb, t.rgb, t.a);
  }
  // iluminación: volumen por profundidad, luz que viene del lado hacia donde gira, y luces de borde
  float luz = mix(0.82, 1.08, vProf) + vLado * uMiraF.x * 0.18;
  float bordeA = clamp(col.a - texture2D(uTex, vUV - vec2(0.006, 0.0015)).a, 0.0, 1.0);
  float bordeB = clamp(col.a - texture2D(uTex, vUV + vec2(0.006, -0.0015)).a, 0.0, 1.0);
  vec3 rgb = col.rgb * luz + (uLuzA * bordeA * 0.45 + uLuzB * bordeB * 0.25);
  gl_FragColor = vec4(rgb * col.a, col.a);
}`

function compilar(gl, tipo, src) {
  const s = gl.createShader(tipo)
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s))
  return s
}

const cargar = (src) =>
  new Promise((ok, no) => {
    const i = new Image()
    i.decoding = 'async'
    i.crossOrigin = 'anonymous'
    i.onload = () => ok(i)
    i.onerror = no
    i.src = src
  })

function pixeles(img) {
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const x = c.getContext('2d', { willReadFrequently: true })
  x.drawImage(img, 0, 0)
  return x.getImageData(0, 0, c.width, c.height)
}

function textura(gl, fuente) {
  const t = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, t)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  if (fuente) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fuente)
  return t
}

/**
 * @param alto alto en px CSS
 * @param traje traje del momento (o null)
 * @param saludar al pasar a true, saluda con el brazo un par de segundos
 * @param luz 'normal' | 'alerta' (luces rojas)
 */
export default function ZumiVivo({ alto = 360, traje = null, saludar = false, luz = 'normal', encuadre = 'cuerpo', className = '' }) {
  const vMax = encuadre === 'busto' ? 0.62 : 1
  const lienzo = useRef(null)
  const refTraje = useRef(null)
  const estado = useRef({ olaHasta: 0, luz, trajeImg: null, trajeSucio: false })

  useEffect(() => {
    estado.current.luz = luz
  }, [luz])
  useEffect(() => {
    if (saludar) estado.current.olaHasta = performance.now() + 2600
  }, [saludar])

  // El traje (SVG) se convierte en una imagen del tamaño de la textura, calzada con los ojos.
  useEffect(() => {
    const svg = refTraje.current
    const e = estado.current
    if (!svg) {
      e.trajeImg = null
      e.trajeSucio = true
      return
    }
    let vivo = true
    cargar(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(svg))}`)
      .then((img) => {
        if (!vivo) return
        const c = document.createElement('canvas')
        c.width = 1024
        c.height = Math.round((1024 * TH) / TW)
        const k = c.width / TW
        const x = c.getContext('2d')
        x.drawImage(img, (OJOS[0][0] - 198 * ESC_TRAJE) * k, (OJOS[0][1] - 210 * ESC_TRAJE) * k, 512 * ESC_TRAJE * k, 512 * ESC_TRAJE * k)
        e.trajeImg = c
        e.trajeSucio = true
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [traje])

  useEffect(() => {
    const cv = lienzo.current
    if (!cv) return
    const e = estado.current
    const calma = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 1 : 0
    let raf = 0
    let vivo = true
    let visible = true
    let reponer = () => {}
    const gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: true, depth: true })
    const io = new IntersectionObserver(([x]) => (visible = x.isIntersecting))
    io.observe(cv)

    // ---- boca ----
    let bocaA = -1
    let bocaB = -1
    let cambio = 0
    let energia = 0
    const quitarBoca = alCambiarBoca((v) => {
      const i = HOJA_BOCAS.indexOf(v)
      if (i === bocaB) return
      bocaA = bocaB
      bocaB = i
      cambio = performance.now()
    })

    // ---- mirada ----
    let mira = [0, 0]
    let objetivo = [0, 0]
    let ojo = [0, 0]
    let ultimoPuntero = 0
    const alMover = (ev) => {
      const r = cv.getBoundingClientRect()
      objetivo = [
        Math.max(-1, Math.min(1, (ev.clientX - (r.left + r.width / 2)) / (window.innerWidth * 0.45))),
        Math.max(-1, Math.min(1, (ev.clientY - (r.top + r.height * 0.28)) / (window.innerHeight * 0.45))),
      ]
      ultimoPuntero = performance.now()
    }
    const alInclinar = (ev) => {
      if (ev.gamma == null) return
      objetivo = [Math.max(-1, Math.min(1, ev.gamma / 28)), Math.max(-1, Math.min(1, ((ev.beta ?? 50) - 50) / 28))]
      ultimoPuntero = performance.now()
    }
    window.addEventListener('pointermove', alMover, { passive: true })
    window.addEventListener('pointerdown', alMover, { passive: true })
    window.addEventListener('deviceorientation', alInclinar, { passive: true })

    const limpiar = () => {
      vivo = false
      cancelAnimationFrame(raf)
      io.disconnect()
      quitarBoca()
      window.removeEventListener('pointermove', alMover)
      window.removeEventListener('pointerdown', alMover)
      window.removeEventListener('deviceorientation', alInclinar)
    }

    // ---- sin WebGL: imagen con la boca, sin 3D ----
    const modo2D = (base, bocas) => {
      // Un lienzo que ya pidió WebGL no puede dibujar en 2D: se usa uno nuevo.
      const c2 = document.createElement('canvas')
      c2.className = cv.className
      c2.dataset.modo = '2d'
      cv.replaceWith(c2)
      reponer = () => c2.replaceWith(cv)
      const x = c2.getContext('2d')
      if (!x) return
      const dib = () => {
        if (!vivo) return
        raf = requestAnimationFrame(dib)
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const r = c2.getBoundingClientRect()
        c2.width = Math.round(r.width * dpr)
        c2.height = Math.round(r.height * dpr)
        const s = c2.height / (TH * vMax * (1 + 2 * MARGEN))
        const ox = (c2.width - TW * s) / 2
        const oy = TH * vMax * MARGEN * s
        x.clearRect(0, 0, c2.width, c2.height)
        x.drawImage(base, ox, oy, TW * s, TH * s)
        if (bocaB >= 0) x.drawImage(bocas, bocaB * BOCA[2], 0, BOCA[2], BOCA[3], ox + BOCA[0] * s, oy + BOCA[1] * s, BOCA[2] * s, BOCA[3] * s)
      }
      dib()
    }

    Promise.all([
      cargar(`${BASE}zumi/zumi3d.webp`),
      cargar(`${BASE}zumi/zumi3d-bocas.webp`),
      cargar(`${BASE}zumi/zumi3d-rig1.png`),
      cargar(`${BASE}zumi/zumi3d-rig2.png`),
    ])
      .then(([base, bocas, rig1, rig2]) => {
        if (!vivo) return
        let prog
        try {
          if (!gl) throw new Error('sin WebGL')
          prog = gl.createProgram()
          gl.attachShader(prog, compilar(gl, gl.VERTEX_SHADER, VS))
          gl.attachShader(prog, compilar(gl, gl.FRAGMENT_SHADER, FS))
          gl.linkProgram(prog)
          if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog))
        } catch (err) {
          console.warn('ZUMI 3D no disponible:', err.message)
          return modo2D(base, bocas)
        }
        cv.dataset.modo = '3d'
        gl.useProgram(prog)

        // Malla con los pesos del esqueleto y la profundidad de cada punto
        const r1 = pixeles(rig1)
        const r2 = pixeles(rig2)
        const NX = 92
        const NY = Math.round(NX / ASP)
        const datos = []
        const leerRig = (img, u, v) => {
          const x = Math.min(img.width - 1, Math.round(u * (img.width - 1)))
          const y = Math.min(img.height - 1, Math.round(v * (img.height - 1)))
          const k = (y * img.width + x) * 4
          return [img.data[k] / 255, img.data[k + 1] / 255, img.data[k + 2] / 255]
        }
        for (let j = 0; j <= NY; j++)
          for (let i = 0; i <= NX; i++) {
            const u = i / NX
            const v = j / NY
            datos.push(u, v, ...leerRig(r1, u, v), ...leerRig(r2, u, v))
          }
        const idx = []
        for (let j = 0; j < NY; j++)
          for (let i = 0; i < NX; i++) {
            const a = j * (NX + 1) + i
            // se omiten los cuadros totalmente vacíos (fuera de la silueta)
            const m = [a, a + 1, a + NX + 1, a + NX + 2].some((q) => datos[q * 8 + 7] > 0.02)
            if (m) idx.push(a, a + 1, a + NX + 1, a + 1, a + NX + 2, a + NX + 1)
          }
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(datos), gl.STATIC_DRAW)
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer())
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW)
        const atr = (n, k, off) => {
          const l = gl.getAttribLocation(prog, n)
          gl.enableVertexAttribArray(l)
          gl.vertexAttribPointer(l, k, gl.FLOAT, false, 32, off)
        }
        atr('aUV', 2, 0)
        atr('aR1', 3, 8)
        atr('aR2', 3, 20)
        const U = (n) => gl.getUniformLocation(prog, n)
        const uni = Object.fromEntries(
          ['uT', 'uHabla', 'uOla', 'uCalma', 'uResp', 'uMira', 'uEsc', 'uTex', 'uBocas', 'uTraje', 'uBocaA', 'uBocaB', 'uMezcla', 'uParpado', 'uHayTraje', 'uOjo', 'uLuzA', 'uLuzB', 'uMiraF', 'uCy'].map((n) => [n, U(n)]),
        )
        gl.activeTexture(gl.TEXTURE0)
        textura(gl, base)
        gl.activeTexture(gl.TEXTURE1)
        textura(gl, bocas)
        gl.activeTexture(gl.TEXTURE2)
        const texTraje = textura(gl, null)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4))
        gl.uniform1i(uni.uTex, 0)
        gl.uniform1i(uni.uBocas, 1)
        gl.uniform1i(uni.uTraje, 2)
        gl.enable(gl.BLEND)
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
        gl.enable(gl.DEPTH_TEST)
        gl.depthFunc(gl.LEQUAL)

        let parpado = 0
        let proximoParpadeo = performance.now() + 1500
        let doble = false
        let proximaMirada = 0
        let ojoObj = [0, 0]
        const t0 = performance.now()
        const cuadro = (ahora) => {
          if (!vivo) return
          raf = requestAnimationFrame(cuadro)
          if (document.hidden || !visible) return
          const t = (ahora - t0) / 1000
          if (e.trajeSucio) {
            gl.activeTexture(gl.TEXTURE2)
            gl.bindTexture(gl.TEXTURE_2D, texTraje)
            if (e.trajeImg) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, e.trajeImg)
            e.trajeSucio = false
          }
          // parpadeo natural (a veces doble)
          if (ahora > proximoParpadeo) {
            const f = (ahora - proximoParpadeo) / 150
            parpado = f < 1 ? Math.sin(f * Math.PI) : 0
            if (f >= 1) {
              doble = !doble && Math.random() < 0.25
              proximoParpadeo = ahora + (doble ? 120 : 2000 + Math.random() * 3800)
            }
          }
          // mirada: sigue el dedo; si no, mira a su alrededor con pequeños saltos de ojos
          if (ahora - ultimoPuntero > 3500) objetivo = [Math.sin(t * 0.31) * 0.3, Math.sin(t * 0.21) * 0.15]
          mira = [mira[0] + (objetivo[0] - mira[0]) * 0.05, mira[1] + (objetivo[1] - mira[1]) * 0.05]
          if (ahora > proximaMirada) {
            ojoObj = [objetivo[0] * 0.8 + (Math.random() - 0.5) * 0.5, objetivo[1] * 0.6 + (Math.random() - 0.5) * 0.3]
            proximaMirada = ahora + 600 + Math.random() * 1600
          }
          ojo = [ojo[0] + (ojoObj[0] - ojo[0]) * 0.35, ojo[1] + (ojoObj[1] - ojo[1]) * 0.35]
          energia += ((ENERGIA[HOJA_BOCAS[bocaB]] ?? 0) - energia) * 0.35
          const ola = ahora < e.olaHasta ? Math.max(0, Math.min(1, (e.olaHasta - ahora) / 400, (ahora - (e.olaHasta - 2600)) / 300)) : 0

          const dpr = Math.min(window.devicePixelRatio || 1, 2)
          const r = cv.getBoundingClientRect()
          const w = Math.max(1, Math.round(r.width * dpr))
          const h = Math.max(1, Math.round(r.height * dpr))
          if (cv.width !== w || cv.height !== h) {
            cv.width = w
            cv.height = h
          }
          gl.viewport(0, 0, w, h)
          gl.clearColor(0, 0, 0, 0)
          gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
          // escala: el personaje entero (alto 1) cabe con margen
          const sy = 2 / (vMax * (1 + 2 * MARGEN))
          gl.uniform2f(uni.uEsc, (sy * h) / w, sy)
          gl.uniform1f(uni.uCy, 0.5 - vMax / 2)
          gl.uniform1f(uni.uT, t)
          gl.uniform1f(uni.uHabla, energia)
          gl.uniform1f(uni.uOla, ola)
          gl.uniform1f(uni.uCalma, calma)
          gl.uniform1f(uni.uResp, Math.sin(t * 1.7) * 0.5 + 0.5)
          const k = 1 - calma * 0.7
          gl.uniform2f(uni.uMira, mira[0] * k, mira[1] * k)
          gl.uniform2f(uni.uMiraF, mira[0] * k, mira[1] * k)
          gl.uniform2f(uni.uOjo, ojo[0], ojo[1])
          gl.uniform1f(uni.uParpado, parpado)
          gl.uniform1f(uni.uBocaA, bocaA)
          gl.uniform1f(uni.uBocaB, bocaB)
          gl.uniform1f(uni.uMezcla, Math.min(1, (ahora - cambio) / 70))
          gl.uniform1f(uni.uHayTraje, e.trajeImg ? 1 : 0)
          const alerta = e.luz === 'alerta'
          gl.uniform3f(uni.uLuzA, alerta ? 1 : 0.35, alerta ? 0.2 : 0.85, alerta ? 0.25 : 1)
          gl.uniform3f(uni.uLuzB, 1, alerta ? 0.35 : 0.72, alerta ? 0.3 : 0.45)
          gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0)
        }
        raf = requestAnimationFrame(cuadro)
      })
      .catch(() => {})

    return () => {
      limpiar()
      reponer()
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [vMax])

  const ancho = Math.round((alto * ASP) / vMax)
  return (
    <span className={`zumi-vivo relative inline-block ${encuadre === 'busto' ? 'zumi-busto' : ''} ${className}`} style={{ width: ancho, height: alto }} aria-hidden="true">
      <canvas ref={lienzo} className="block h-full w-full" />
      {traje && (
        <span className="pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0">
          <TrajeSVG traje={traje} refSvg={refTraje} soloCabeza />
        </span>
      )}
    </span>
  )
}
