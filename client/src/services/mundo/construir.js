// Convierte una tesela de OpenStreetMap en un barrio de videojuego: calles con asfalto y líneas,
// veredas, casas chilenas (las del mapa y, donde el mapa no las tiene, generadas a lo largo de cada
// cuadra), techos de teja o zinc, plazas con árboles, agua y canales. Todo fusionado en pocas mallas.
import * as THREE from 'three'

// ---------- utilidades ----------
function azar(semilla) {
  let s = 0
  for (const c of String(semilla)) s = (s * 31 + c.charCodeAt(0)) | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const areaFirmada = (r) => {
  let a = 0
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1])
  return a / 2
}
/** Anillos de una tesela → [{ ext, huecos }] (el primer anillo define la orientación exterior). */
function poligonos(anillos) {
  const out = []
  let signo = 0
  for (const r of anillos) {
    if (r.length < 4) continue
    const a = areaFirmada(r)
    if (!a) continue
    if (!signo) signo = Math.sign(a)
    if (Math.sign(a) === signo) out.push({ ext: r, huecos: [] })
    else out.at(-1)?.huecos.push(r)
  }
  return out
}
const dentro = (x, z, r) => {
  let c = false
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i]
    const [xj, zj] = r[j]
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c
  }
  return c
}
const distSeg = (px, pz, ax, az, bx, bz) => {
  const dx = bx - ax
  const dz = bz - az
  const l = dx * dx + dz * dz
  const t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l)) : 0
  const x = ax + t * dx - px
  const z = az + t * dz - pz
  return Math.sqrt(x * x + z * z)
}

// Rejilla para buscar rápido calles y casas cercanas
class Rejilla {
  constructor(celda = 24) {
    this.c = celda
    this.m = new Map()
  }
  k(i, j) {
    return i * 100003 + j
  }
  agregar(x0, z0, x1, z1, v) {
    const c = this.c
    for (let i = Math.floor(Math.min(x0, x1) / c); i <= Math.floor(Math.max(x0, x1) / c); i++)
      for (let j = Math.floor(Math.min(z0, z1) / c); j <= Math.floor(Math.max(z0, z1) / c); j++) {
        const k = this.k(i, j)
        if (!this.m.has(k)) this.m.set(k, [])
        this.m.get(k).push(v)
      }
  }
  cerca(x, z, r = 0) {
    const c = this.c
    const vistos = new Set()
    for (let i = Math.floor((x - r) / c); i <= Math.floor((x + r) / c); i++)
      for (let j = Math.floor((z - r) / c); j <= Math.floor((z + r) / c); j++) for (const v of this.m.get(this.k(i, j)) ?? []) vistos.add(v)
    return vistos
  }
}

// Acumulador de una malla (posiciones, normales, colores, uv)
class Lote {
  constructor() {
    this.p = []
    this.n = []
    this.c = []
    this.uv = []
  }
  v(x, y, z, nx, ny, nz, col, u, w) {
    this.p.push(x, y, z)
    this.n.push(nx, ny, nz)
    this.c.push(col.r, col.g, col.b)
    this.uv.push(u, w)
  }
  quad(a, b, c, d, n, col, uv) {
    // a b c d en orden; dos triángulos a-b-c, a-c-d
    const vs = [a, b, c, a, c, d]
    const us = [uv[0], uv[1], uv[2], uv[0], uv[2], uv[3]]
    vs.forEach((p, i) => this.v(p[0], p[1], p[2], n[0], n[1], n[2], col, us[i][0], us[i][1]))
  }
  geometria() {
    if (!this.p.length) return null
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3))
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2))
    g.computeBoundingSphere()
    return g
  }
}

const C = (h) => new THREE.Color(h)
// Paleta de casas chilenas: estucos de colores, adobe encalado, ladrillo
const MUROS = ['#f1e6cf', '#e9d3a8', '#d99a6c', '#e6c27a', '#b7d3df', '#f4f0e6', '#c9dbb5', '#e8b4a0', '#d6c3e0', '#f2d9a6', '#a7c4d8', '#e0a96d'].map(C)
const MUROS_ALTOS = ['#d9d5cc', '#c9c2b4', '#bfc6cc', '#e1dbd0', '#b5aea2'].map(C)
const TEJA = [C('#b4553a'), C('#a2462f'), C('#c0643f')]
const ZINC = [C('#8d969d'), C('#7a8b93'), C('#9aa3a6'), C('#6f8f86')]
const PLANO = [C('#9b9a96'), C('#a8a49b'), C('#8b8f93')]
const BLANCO = C('#ffffff')
const COLORES_AUTO = ['#e9e9ea', '#c9ccd1', '#2b2e33', '#9aa0a8', '#b3261e', '#1f4e8c', '#e2e2dc', '#5b6066', '#1d1f22', '#7b2a2a', '#2f6b4f', '#d7c9a6'].map(C)
const PUERTAS = ['#5b3a24', '#6e4a2f', '#3e2a1d', '#2f3b46', '#7a2d22'].map(C)
const lote4 = (lote, a, b, c, d, n, col) => lote.quad(a, b, c, d, n, col, [[0, 0], [1, 0], [1, 1], [0, 1]])

// Ancho (m) de cada tipo de calle
const ANCHO = { motorway: 16, trunk: 13, primary: 11, secondary: 9.5, tertiary: 8, minor: 6.6, service: 4, track: 3, path: 1.8, rail: 2.6, raceway: 10, busway: 7 }
const PRINCIPAL = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary'])
const CON_CASAS = new Set(['primary', 'secondary', 'tertiary', 'minor'])
const ALTURA_CALLE = { motorway: 0.16, trunk: 0.15, primary: 0.14, secondary: 0.13, tertiary: 0.12, minor: 0.11, service: 0.1, busway: 0.12, raceway: 0.12, track: 0.09, path: 0.085, rail: 0.08 }
const VEREDA = 2.6

const SUELO = {
  grass: '#86bf63', wood: '#5f9a49', forest: '#5f9a49', farmland: '#c5d48a', sand: '#e6d6a6', wetland: '#8fb59c', rock: '#b9b2a6', ice: '#eef4f8', scrub: '#9bb36c',
  residential: '#d8d1c0', commercial: '#d3cdc1', retail: '#d3cdc1', industrial: '#cbc6bc', school: '#e3dac4', college: '#e3dac4', university: '#e3dac4', kindergarten: '#e3dac4',
  hospital: '#e6d8d4', pitch: '#4f9f58', stadium: '#d0cbc0', cemetery: '#a9c59a', playground: '#d9c79e', park: '#7dbd59', garden: '#7dbd59', zoo: '#7dbd59', railway: '#c2b9ab',
}

/**
 * Construye el barrio de una tesela.
 * @returns {{ grupo: THREE.Group, solidos: Rejilla-like, liberar: Function }}
 */
export function generarTesela(t) {
  const rnd = azar(t.clave)
  const L = { puerta: new Lote(), suelo: new Lote(), agua: new Lote(), calle: new Lote(), callePpal: new Lote(), tierra: new Lote(), vereda: new Lote(), muro: new Lote(), muroAlto: new Lote(), teja: new Lote(), zinc: new Lote(), plano: new Lote() }
  const calles = new Rejilla(30)
  const solidos = new Rejilla(20) // huellas de edificios (para chocar y para no encimar casas)
  const huellas = []

  // ---- zonas urbanas: centros de ciudades, pueblos y barrios + números de casas ----
  const urbes = []
  const RADIO = { city: 2600, town: 1300, village: 550, suburb: 700, quarter: 500, neighbourhood: 420, hamlet: 180, isolated_dwelling: 50 }
  for (const p of t.lugares) {
    const r = RADIO[p.props.class]
    if (r && p.g[0]?.[0]) urbes.push({ x: p.g[0][0][0], z: p.g[0][0][1], r, centro: p.props.class === 'city' || p.props.class === 'town' })
  }
  for (const n of t.numeros) if (n.g[0]?.[0]) urbes.push({ x: n.g[0][0][0], z: n.g[0][0][1], r: 70 })
  for (const u of t.uso) if (['residential', 'commercial', 'retail'].includes(u.props.class)) for (const pol of poligonos(u.g)) urbes.push({ pol: pol.ext })
  const urbano = (x, z) => {
    let best = 0
    for (const u of urbes) {
      if (u.pol) {
        if (dentro(x, z, u.pol)) best = Math.max(best, 0.9)
        continue
      }
      const d = Math.hypot(x - u.x, z - u.z)
      if (d < u.r) best = Math.max(best, u.centro && d < u.r * 0.35 ? 1.2 : 1 - (d / u.r) * 0.4)
    }
    return best // 0 campo · ~1 ciudad · 1.2 centro (fachada continua, más pisos)
  }

  // ---- suelo: parques, pasto, bosques, agua, usos ----
  const plano = (lote, anillos, y, col, escalaUV = 8) => {
    for (const { ext, huecos } of poligonos(anillos)) {
      const contorno = ext.slice(0, -1).map(([x, z]) => new THREE.Vector2(x, z))
      const hs = huecos.map((h) => h.slice(0, -1).map(([x, z]) => new THREE.Vector2(x, z)))
      let tris
      try {
        tris = THREE.ShapeUtils.triangulateShape(contorno, hs)
      } catch {
        continue
      }
      const todos = contorno.concat(...hs)
      for (const [a, b, c] of tris)
        for (const i of [a, c, b]) {
          const p = todos[i]
          lote.v(p.x, y, p.y, 0, 1, 0, col, p.x / escalaUV, p.y / escalaUV)
        }
    }
  }
  for (const u of t.uso) if (SUELO[u.props.class] && u.props.class !== 'residential') plano(L.suelo, u.g, 0.02, C(SUELO[u.props.class]))
  for (const u of t.uso) if (u.props.class === 'residential') plano(L.suelo, u.g, 0.015, C(SUELO.residential))
  for (const c of t.cobertura) if (SUELO[c.props.class]) plano(L.suelo, c.g, 0.025, C(SUELO[c.props.class]))
  for (const p of t.parques) plano(L.suelo, p.g, 0.03, C(SUELO.park))
  for (const a of t.agua) plano(L.agua, a.g, 0.05, C('#ffffff'), 30)

  // ---- calles ----
  const cinta = (lote, linea, ancho, y, col, largoUV = 8, ok = () => true) => {
    let acum = 0
    for (let i = 0; i < linea.length - 1; i++) {
      const [ax, az] = linea[i]
      const [bx, bz] = linea[i + 1]
      const dx = bx - ax
      const dz = bz - az
      const l = Math.hypot(dx, dz)
      if (l < 0.01 || !ok(ax, az, bx, bz)) {
        acum += l
        continue
      }
      // extiende un poco cada tramo para cerrar las juntas
      const ex = (dx / l) * (ancho * 0.5)
      const ez = (dz / l) * (ancho * 0.5)
      const nx = (-dz / l) * (ancho / 2)
      const nz = (dx / l) * (ancho / 2)
      const p0 = [ax - ex, az - ez]
      const p1 = [bx + ex, bz + ez]
      const u0 = (acum - ancho * 0.5) / largoUV
      const u1 = (acum + l + ancho * 0.5) / largoUV
      lote.quad([p0[0] + nx, y, p0[1] + nz], [p0[0] - nx, y, p0[1] - nz], [p1[0] - nx, y, p1[1] - nz], [p1[0] + nx, y, p1[1] + nz], [0, 1, 0], col, [[u0, 0], [u0, 1], [u1, 1], [u1, 0]])
      acum += l
    }
  }
  const lineasCalle = []
  for (const f of t.calles) {
    if (f.tipo !== 2) continue
    const cl = String(f.props.class ?? '').replace('_construction', '')
    if (f.props.brunnel === 'tunnel') continue
    const w = ANCHO[cl]
    if (!w) continue
    for (const linea of f.g) {
      lineasCalle.push({ linea, cl, w })
      for (let i = 0; i < linea.length - 1; i++) {
        const s = { ax: linea[i][0], az: linea[i][1], bx: linea[i + 1][0], bz: linea[i + 1][1], w, cl, linea }
        calles.agregar(s.ax - w, s.az - w, s.bx + w, s.bz + w, s)
      }
    }
  }
  // ¿Hay otra calle cruzando cerca? (esquinas: ahí no se estaciona)
  const esquina = (x, z, propia, margen = 4) => {
    for (const s of calles.cerca(x, z, 20)) if (s.linea !== propia && s.cl !== 'path' && s.cl !== 'rail' && distSeg(x, z, s.ax, s.az, s.bx, s.bz) < s.w / 2 + margen) return true
    return false
  }
  const sobreCalle = (x, z, margen, conSenderos = false) => {
    for (const s of calles.cerca(x, z, 20)) {
      if (s.cl === 'rail') continue
      // los senderos peatonales marcan plazas y parques: ahí no van casas
      const m = s.cl === 'path' ? (conSenderos ? 5 : -99) : margen
      if (distSeg(x, z, s.ax, s.az, s.bx, s.bz) < s.w / 2 + m) return true
    }
    return false
  }
  for (const { linea, cl, w } of lineasCalle) {
    const y = ALTURA_CALLE[cl] ?? 0.1
    if (cl === 'path' || cl === 'track') {
      cinta(L.tierra, linea, w, y, C(cl === 'path' ? '#d8c9a8' : '#c9b38c'), 6)
      // los senderos de la ciudad son plazas y parques: pasto alrededor
      if (cl === 'path' && urbano(linea[0][0], linea[0][1]) > 0.3) cinta(L.suelo, linea, 15, 0.028, C(SUELO.park), 8)
    }
    else if (cl === 'rail') cinta(L.tierra, linea, w, y, C('#8a7d70'), 3)
    else {
      cinta(PRINCIPAL.has(cl) ? L.callePpal : L.calle, linea, w, y, BLANCO, 8)
      if (CON_CASAS.has(cl)) {
        const urb = urbano(linea[0][0], linea[0][1]) || urbano(linea.at(-1)[0], linea.at(-1)[1])
        if (urb > 0.3) cinta(L.vereda, linea, w + VEREDA * 2, 0.06, BLANCO, 2)
      }
    }
  }
  for (const f of t.cauces) {
    const w = { river: 9, canal: 6, stream: 2.4, ditch: 1.4, drain: 1.4 }[f.props.class] ?? 2
    for (const linea of f.g) cinta(L.agua, linea, w, 0.055, BLANCO, 20)
  }

  // ---- edificios ----
  const muro = (lote, a, b, y0, y1, col, celda, piso, u0) => {
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const l = Math.hypot(dx, dz)
    if (l < 0.05) return u0
    const n = [dz / l, 0, -dx / l]
    const u1 = u0 + l / celda
    lote.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], n, col, [[u0, y0 / piso], [u1, y0 / piso], [u1, y1 / piso], [u0, y1 / piso]])
    return u1
  }
  // orienta el anillo para que las normales de los muros miren hacia afuera
  const haciaFuera = (r) => (areaFirmada(r) > 0 ? r : [...r].reverse())

  for (const e of t.edificios) {
    if (e.props.hide_3d) continue
    const h = Math.max(3, Number(e.props.render_height) || 6)
    const base = Number(e.props.render_min_height) || 0
    for (const { ext, huecos } of poligonos(e.g)) {
      const alto = h > 12
      const col = (alto ? MUROS_ALTOS : MUROS)[Math.floor(rnd() * (alto ? MUROS_ALTOS : MUROS).length)]
      for (const anillo of [haciaFuera(ext), ...huecos.map((x) => [...haciaFuera(x)].reverse())]) {
        let u = 0
        for (let i = 0; i < anillo.length - 1; i++) u = muro(alto ? L.muroAlto : L.muro, anillo[i], anillo[i + 1], base, h, col, alto ? 3.4 : 3.2, alto ? 3.3 : 3.2, u)
      }
      plano(L.plano, [ext, ...huecos], h, PLANO[Math.floor(rnd() * PLANO.length)], 4)
      const xs = ext.map((p) => p[0])
      const zs = ext.map((p) => p[1])
      const hu = { pol: ext, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }
      huellas.push(hu)
      solidos.agregar(hu.x0, hu.z0, hu.x1, hu.z1, hu)
    }
  }

  // Casa generada: rectángulo con muros con ventanas y techo a cuatro aguas (teja o zinc) o plano.
  const casa = (cx, cz, ang, ancho, fondo, h, col, techo, alto, frente = 1) => {
    const ca = Math.cos(ang)
    const sa = Math.sin(ang)
    const P = (u, v) => [cx + u * ca - v * sa, cz + u * sa + v * ca]
    const a = ancho / 2
    const f = fondo / 2
    const anillo = [P(-a, -f), P(a, -f), P(a, f), P(-a, f), P(-a, -f)]
    const r = haciaFuera(anillo)
    let u = 0
    const lm = alto ? L.muroAlto : L.muro
    for (let i = 0; i < 4; i++) u = muro(lm, r[i], r[i + 1], 0, h, col, alto ? 3.4 : 3.2, 3.2, u)
    // puerta de entrada (madera o metal) hacia la calle
    {
      const vf = -frente * (f + 0.04)
      const pu = (rnd() - 0.5) * (ancho - 2.4)
      const pc = PUERTAS[Math.floor(rnd() * PUERTAS.length)]
      const nx = -sa * -frente
      const nz = ca * -frente
      const A = P(pu - 0.55, vf)
      const B = P(pu + 0.55, vf)
      lote4(L.puerta, [A[0], 0.05, A[1]], [B[0], 0.05, B[1]], [B[0], 2.25, B[1]], [A[0], 2.25, A[1]], [nx, 0, nz], pc)
    }
    if (techo === 'plano') {
      plano(L.plano, [anillo], h, PLANO[Math.floor(rnd() * PLANO.length)], 4)
    } else {
      // cuatro aguas: cumbrera a lo largo del lado más largo
      const lote = techo === 'zinc' ? L.zinc : L.teja
      const tc = (techo === 'zinc' ? ZINC : TEJA)[Math.floor(rnd() * 3)]
      const largo = ancho >= fondo
      const sem = (largo ? fondo : ancho) / 2
      const hr = h + Math.min(2.6, sem * 0.62)
      const vol = 0.35 // alero
      const A = a + vol
      const F = f + vol
      const c1 = largo ? P(-(A - sem - vol), 0) : P(0, -(F - sem - vol))
      const c2 = largo ? P(A - sem - vol, 0) : P(0, F - sem - vol)
      const e = [P(-A, -F), P(A, -F), P(A, F), P(-A, F)]
      const y = h - 0.05
      const tri = (p, q, s) => {
        const v1 = new THREE.Vector3(q[0] - p[0], q[1] - p[1], q[2] - p[2])
        const v2 = new THREE.Vector3(s[0] - p[0], s[1] - p[1], s[2] - p[2])
        const n = v1.cross(v2).normalize()
        if (n.y < 0) [q, s] = [s, q]
        const nn = n.y < 0 ? n.negate() : n
        for (const v of [p, q, s]) lote.v(v[0], v[1], v[2], nn.x, nn.y, nn.z, tc, v[0] / 2.2 + v[1] * 0.4, v[2] / 2.2 + v[1] * 0.4)
      }
      const E = e.map((p) => [p[0], y, p[1]])
      const K1 = [c1[0], hr, c1[1]]
      const K2 = [c2[0], hr, c2[1]]
      if (largo) {
        tri(E[0], E[1], K2), tri(E[0], K2, K1) // lado -f
        tri(E[2], E[3], K1), tri(E[2], K1, K2) // lado +f
        tri(E[3], E[0], K1) // punta -a
        tri(E[1], E[2], K2) // punta +a
      } else {
        tri(E[1], E[2], K2), tri(E[1], K2, K1)
        tri(E[3], E[0], K1), tri(E[3], K1, K2)
        tri(E[0], E[1], K1)
        tri(E[2], E[3], K2)
      }
    }
    const xs = anillo.map((p) => p[0])
    const zs = anillo.map((p) => p[1])
    const hu = { pol: anillo, x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }
    huellas.push(hu)
    solidos.agregar(hu.x0, hu.z0, hu.x1, hu.z1, hu)
  }
  const libre = (pol) => {
    const xs = pol.map((p) => p[0])
    const zs = pol.map((p) => p[1])
    const x0 = Math.min(...xs)
    const x1 = Math.max(...xs)
    const z0 = Math.min(...zs)
    const z1 = Math.max(...zs)
    for (const o of solidos.cerca((x0 + x1) / 2, (z0 + z1) / 2, Math.max(x1 - x0, z1 - z0))) {
      if (o.x1 < x0 + 0.3 || o.x0 > x1 - 0.3 || o.z1 < z0 + 0.3 || o.z0 > z1 - 0.3) continue
      if (pol.some(([x, z]) => dentro(x, z, o.pol)) || o.pol.some(([x, z]) => dentro(x, z, pol))) return false
      const [cx, cz] = [(x0 + x1) / 2, (z0 + z1) / 2]
      if (dentro(cx, cz, o.pol)) return false
    }
    return true
  }
  const { x0: bx0, z0: bz0, x1: bx1, z1: bz1 } = t.caja
  // Donde no van casas: plazas, parques, canchas, pasto, bosques y agua (la Plaza de Armas queda libre)
  const vacios = []
  for (const p of t.parques) for (const { ext } of poligonos(p.g)) vacios.push(ext)
  for (const c of t.cobertura) if (['grass', 'wood', 'forest', 'sand', 'wetland'].includes(c.props.class)) for (const { ext } of poligonos(c.g)) vacios.push(ext)
  for (const u of t.uso) if (['park', 'garden', 'pitch', 'playground', 'cemetery', 'stadium', 'railway'].includes(u.props.class)) for (const { ext } of poligonos(u.g)) vacios.push(ext)
  for (const a of t.agua) for (const { ext } of poligonos(a.g)) vacios.push(ext)
  const plazas = []
  for (const p of t.poi ?? []) if (p.props.class === 'park' && p.g[0]?.[0]) plazas.push({ x: p.g[0][0][0], z: p.g[0][0][1], r: /plaza|parque/i.test(p.props.name ?? '') ? 55 : 25 })
  const enVacio = (x, z) => plazas.some((q) => Math.hypot(x - q.x, z - q.z) < q.r) || vacios.some((r) => dentro(x, z, r))
  const enTesela = (x, z) => x >= Math.min(bx0, bx1) && x < Math.max(bx0, bx1) && z >= Math.min(bz0, bz1) && z < Math.max(bz0, bz1)

  // Cuadras: casas a ambos lados de cada calle urbana (y alguna suelta en el campo)
  let generadas = 0
  for (const { linea, cl, w } of lineasCalle) {
    if (!CON_CASAS.has(cl)) continue
    for (let i = 0; i < linea.length - 1; i++) {
      const [ax, az] = linea[i]
      const [bx, bz] = linea[i + 1]
      const l = Math.hypot(bx - ax, bz - az)
      if (l < 6) continue
      const ux = (bx - ax) / l
      const uz = (bz - az) / l
      const ang = Math.atan2(uz, ux)
      for (const lado of [1, -1]) {
        let s = 3
        while (s < l - 3) {
          const x = ax + ux * s
          const z = az + uz * s
          const urb = urbano(x, z)
          const centro = urb > 1.1
          const ancho = centro ? 9 + rnd() * 8 : 7 + rnd() * 6
          const hueco = centro ? 0 : urb > 0.5 ? rnd() * 3 : 4 + rnd() * 14
          if (s + ancho > l - 2) break
          const cx0 = ax + ux * (s + ancho / 2)
          const cz0 = az + uz * (s + ancho / 2)
          const prob = urb > 0.5 ? 0.94 : urb > 0.2 ? 0.55 : 0.07
          if (rnd() < prob && generadas < 6000) {
            const fondo = centro ? 12 + rnd() * 8 : 8 + rnd() * 5
            const off = w / 2 + (urb > 0.3 ? VEREDA : 1.2) + 0.4 + fondo / 2
            const nx = -uz * lado
            const nz = ux * lado
            const cx = cx0 + nx * off
            const cz = cz0 + nz * off
            const ca = Math.cos(ang)
            const sa = Math.sin(ang)
            const P = (u, v) => [cx + u * ca - v * sa, cz + u * sa + v * ca]
            const pol = [P(-ancho / 2, -fondo / 2), P(ancho / 2, -fondo / 2), P(ancho / 2, fondo / 2), P(-ancho / 2, fondo / 2), P(-ancho / 2, -fondo / 2)]
            const choca = pol.slice(0, 4).some(([px, pz]) => sobreCalle(px, pz, 0.8, true)) || sobreCalle(cx, cz, 0.8, true)
            if (enTesela(cx, cz) && !choca && !enVacio(cx, cz) && !pol.slice(0, 4).some(([px, pz]) => enVacio(px, pz)) && libre(pol)) {
              const r = rnd()
              const pisos = centro ? (r < 0.45 ? 2 : r < 0.8 ? 1 : 3 + Math.floor(rnd() * 3)) : r < 0.62 ? 1 : r < 0.95 ? 2 : 3
              const h = pisos * 3.1 + 0.4
              const alto = pisos >= 4
              const col = (alto ? MUROS_ALTOS : MUROS)[Math.floor(rnd() * (alto ? MUROS_ALTOS : MUROS).length)]
              const techo = alto || (centro && rnd() < 0.45) ? 'plano' : rnd() < 0.3 ? 'zinc' : 'teja'
              casa(cx, cz, ang, ancho, fondo, h, col, techo, alto, lado)
              generadas++
            }
          }
          s += ancho + hueco
        }
      }
    }
  }

  // ---- árboles: plazas, parques, bosques y en las veredas ----
  const arboles = []
  const sembrar = (anillos, cada, max) => {
    for (const { ext } of poligonos(anillos)) {
      const xs = ext.map((p) => p[0])
      const zs = ext.map((p) => p[1])
      const x0 = Math.min(...xs)
      const z0 = Math.min(...zs)
      const area = Math.abs(areaFirmada(ext))
      const n = Math.min(max, Math.round(area / cada))
      for (let i = 0, intentos = 0; i < n && intentos < n * 3; intentos++) {
        const x = x0 + rnd() * (Math.max(...xs) - x0)
        const z = z0 + rnd() * (Math.max(...zs) - z0)
        if (!dentro(x, z, ext) || sobreCalle(x, z, 0.6) || !enTesela(x, z)) continue
        arboles.push([x, z, 0.75 + rnd() * 0.6, rnd()])
        i++
      }
    }
  }
  for (const p of t.parques) sembrar(p.g, 90, 400)
  for (const c of t.cobertura) {
    if (c.props.class === 'wood' || c.props.class === 'forest') sembrar(c.g, 70, 500)
    else if (c.props.class === 'grass' || c.props.class === 'scrub') sembrar(c.g, 260, 160)
  }
  for (const u of t.uso) if (['park', 'garden', 'cemetery', 'playground'].includes(u.props.class)) sembrar(u.g, 110, 250)
  for (const { linea, cl, w } of lineasCalle) {
    if (!CON_CASAS.has(cl)) continue
    for (let i = 0; i < linea.length - 1; i++) {
      const [ax, az] = linea[i]
      const [bx, bz] = linea[i + 1]
      const l = Math.hypot(bx - ax, bz - az)
      const ux = (bx - ax) / (l || 1)
      const uz = (bz - az) / (l || 1)
      for (let s = 6; s < l - 6; s += 12 + rnd() * 6)
        for (const lado of [1, -1]) {
          const x = ax + ux * s - uz * lado * (w / 2 + 1.2)
          const z = az + uz * s + ux * lado * (w / 2 + 1.2)
          if (urbano(x, z) < 0.4 || rnd() > 0.55 || sobreCalle(x, z, 0.3) || !enTesela(x, z)) continue
          arboles.push([x, z, 0.6 + rnd() * 0.35, rnd()])
        }
    }
  }
  for (const { linea, cl } of lineasCalle) {
    if (cl !== 'path') continue
    for (let i = 0; i < linea.length - 1; i++) {
      const [ax, az] = linea[i]
      const [bx, bz] = linea[i + 1]
      const l = Math.hypot(bx - ax, bz - az)
      const ux = (bx - ax) / (l || 1)
      const uz = (bz - az) / (l || 1)
      for (let s2 = 3; s2 < l - 2; s2 += 7 + rnd() * 4)
        for (const lado of [1, -1]) {
          const x = ax + ux * s2 - uz * lado * 3.2
          const z = az + uz * s2 + ux * lado * 3.2
          if (urbano(x, z) < 0.3 || rnd() > 0.7 || sobreCalle(x, z, 0.5) || !enTesela(x, z)) continue
          arboles.push([x, z, 0.8 + rnd() * 0.5, rnd()])
        }
    }
  }
  // ---- calle viva: autos estacionados, postes con cables y rutas para el tráfico ----
  const autos = []
  const postes = []
  const cables = []
  const rutas = []
  for (const { linea, cl, w } of lineasCalle) {
    if (!CON_CASAS.has(cl) && !PRINCIPAL.has(cl)) continue
    let largo = 0
    for (let i = 0; i < linea.length - 1; i++) largo += Math.hypot(linea[i + 1][0] - linea[i][0], linea[i + 1][1] - linea[i][1])
    if (largo > 60 && cl !== 'motorway') rutas.push({ linea, w, largo })
    if (!CON_CASAS.has(cl)) continue
    // recorrido continuo a lo largo de la calle (los tramos de OSM pueden ser muy cortos)
    const puntoEn = (d) => {
      let acum = 0
      for (let i = 0; i < linea.length - 1; i++) {
        const [ax, az] = linea[i]
        const [bx, bz] = linea[i + 1]
        const l = Math.hypot(bx - ax, bz - az)
        if (acum + l >= d) {
          const t = l ? (d - acum) / l : 0
          return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, ux: (bx - ax) / (l || 1), uz: (bz - az) / (l || 1) }
        }
        acum += l
      }
      return null
    }
    let ultimoPoste = null
    let proxAuto = [6 + rnd() * 8, 6 + rnd() * 8]
    for (let d = 4; d < largo - 4; d += 2) {
      const p = puntoEn(d)
      if (!p) break
      const { x: px, z: pz, ux, uz } = p
      const ang = Math.atan2(ux, -uz)
      const urb = urbano(px, pz)
      if (urb < 0.3) continue
      ;[1, -1].forEach((lado, k) => {
        if (d < proxAuto[k]) return
        proxAuto[k] = d + 5.5 + rnd() * 8
        if (rnd() > (urb > 1.1 ? 0.55 : 0.35)) return
        const x = px - uz * lado * (w / 2 - 1.05)
        const z = pz + ux * lado * (w / 2 - 1.05)
        if (!enTesela(x, z) || esquina(x, z, linea, 5)) return
        autos.push([x, z, ang + (lado > 0 ? 0 : Math.PI) + (rnd() - 0.5) * 0.04, rnd()])
      })
      if (!ultimoPoste || d - ultimoPoste.d >= 30) {
        const x = px - uz * (w / 2 + VEREDA - 0.45)
        const z = pz + ux * (w / 2 + VEREDA - 0.45)
        if (!enTesela(x, z) || esquina(x, z, linea, 1)) continue
        postes.push([x, z, ang])
        if (ultimoPoste && Math.hypot(x - ultimoPoste.x, z - ultimoPoste.z) < 45)
          for (const [dy, dl] of [[7.6, 0], [7.25, 0.5], [7.25, -0.5]]) {
            const { x: qx, z: qz } = ultimoPoste
            const ox = -uz * dl
            const oz = ux * dl
            for (let k = 0; k < 8; k++) {
              const t0 = k / 8
              const t1 = (k + 1) / 8
              const sag = (t) => dy - Math.sin(Math.PI * t) * 0.45
              cables.push(qx + (x - qx) * t0 + ox, sag(t0), qz + (z - qz) * t0 + oz, qx + (x - qx) * t1 + ox, sag(t1), qz + (z - qz) * t1 + oz)
            }
          }
        ultimoPoste = { x, z, d }
      }
    }
  }
  const nArb = Math.min(arboles.length, 2200)

  const lotes = {}
  for (const [k, l] of Object.entries(L)) if (l.p.length) lotes[k] = { p: new Float32Array(l.p), n: new Float32Array(l.n), c: new Float32Array(l.c), uv: new Float32Array(l.uv) }
  return {
    clave: t.clave,
    lotes,
    arboles: arboles.slice(0, nArb),
    autos,
    postes,
    cables: new Float32Array(cables),
    rutas,
    huellas,
    calles: lineasCalle,
    casas: generadas,
  }
}

/** Arma las mallas (en el hilo principal) a partir de lo generado (puede venir de un Worker). */
export function armarTesela(d, mat) {
  const grupo = new THREE.Group()
  grupo.name = d.clave
  const MAT = { puerta: [mat.puerta, 0, false], suelo: [mat.suelo, 1, false], agua: [mat.agua, 2, false], vereda: [mat.vereda, 3, false], tierra: [mat.tierra, 3, false], calle: [mat.calle, 4, false], callePpal: [mat.callePpal, 5, false], muro: [mat.muro, 0, true], muroAlto: [mat.muroAlto, 0, true], teja: [mat.teja, 0, true], zinc: [mat.zinc, 0, true], plano: [mat.plano, 0, true] }
  for (const [k, l] of Object.entries(d.lotes)) {
    const [material, orden, sombra] = MAT[k]
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(l.p, 3))
    g.setAttribute('normal', new THREE.BufferAttribute(l.n, 3))
    g.setAttribute('color', new THREE.BufferAttribute(l.c, 3))
    g.setAttribute('uv', new THREE.BufferAttribute(l.uv, 2))
    g.computeBoundingSphere()
    const m = new THREE.Mesh(g, material)
    m.castShadow = sombra
    m.receiveShadow = true
    m.renderOrder = orden
    m.matrixAutoUpdate = false
    grupo.add(m)
  }
  const nArb = d.arboles.length
  if (nArb) {
    const tronco = new THREE.InstancedMesh(mat.troncoGeo, mat.tronco, nArb)
    const copa = new THREE.InstancedMesh(mat.copaGeo, mat.copa, nArb)
    const o = new THREE.Object3D()
    const verdes = ['#4f8f3a', '#5c9e43', '#3f7d33', '#6aa84a', '#7aa63f'].map(C)
    for (let i = 0; i < nArb; i++) {
      const [x, z, s, r] = d.arboles[i]
      o.position.set(x, 0, z)
      o.rotation.set(0, r * 6.28, 0)
      o.scale.set(s, s * (0.9 + r * 0.4), s)
      o.updateMatrix()
      tronco.setMatrixAt(i, o.matrix)
      copa.setMatrixAt(i, o.matrix)
      copa.setColorAt(i, verdes[Math.floor(r * verdes.length)])
    }
    for (const m of [tronco, copa]) {
      m.castShadow = true
      m.receiveShadow = true
      m.computeBoundingSphere()
      grupo.add(m)
    }
  }
  const instancias = (geo, material, lista, poner, colores) => {
    const n = Math.min(lista.length, 9000)
    if (!n) return
    const im = new THREE.InstancedMesh(geo, material, n)
    const o = new THREE.Object3D()
    for (let i = 0; i < n; i++) {
      poner(o, lista[i])
      o.updateMatrix()
      im.setMatrixAt(i, o.matrix)
      if (colores) im.setColorAt(i, colores(lista[i]))
    }
    im.castShadow = true
    im.receiveShadow = true
    im.computeBoundingSphere()
    grupo.add(im)
  }
  instancias(mat.autoGeo, mat.auto, d.autos, (o, [x, z, a]) => (o.position.set(x, 0, z), o.rotation.set(0, -a, 0)), ([, , , r]) => COLORES_AUTO[Math.floor(r * COLORES_AUTO.length)])
  instancias(mat.posteGeo, mat.poste, d.postes, (o, [x, z, a]) => (o.position.set(x, 0, z), o.rotation.set(0, -a, 0)))
  if (d.cables.length) {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(d.cables, 3))
    grupo.add(new THREE.LineSegments(g, mat.cable))
  }
  const solidos = new Rejilla(20)
  for (const h of d.huellas) solidos.agregar(h.x0, h.z0, h.x1, h.z1, h)
  const calles = new Rejilla(30)
  for (const { linea, cl, w } of d.calles)
    for (let i = 0; i < linea.length - 1; i++) {
      const s = { ax: linea[i][0], az: linea[i][1], bx: linea[i + 1][0], bz: linea[i + 1][1], w, cl }
      calles.agregar(s.ax - w, s.az - w, s.bx + w, s.bz + w, s)
    }
  return {
    rutas: d.rutas,
    grupo,
    huellas: d.huellas,
    solidos,
    calles,
    casas: d.casas,
    liberar() {
      grupo.traverse((o) => o.geometry && !o.isInstancedMesh && o.geometry.dispose())
      grupo.traverse((o) => o.isInstancedMesh && o.dispose?.())
    },
    /** ¿El punto choca con un edificio de esta tesela? */
    choca(x, z) {
      for (const h of solidos.cerca(x, z, 0)) if (x > h.x0 && x < h.x1 && z > h.z0 && z < h.z1 && dentro(x, z, h.pol)) return true
      return false
    },
  }
}

export const construirTesela = (t, mat) => armarTesela(generarTesela(t), mat)
