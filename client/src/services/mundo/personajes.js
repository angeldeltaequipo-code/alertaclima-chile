// ZUMI en 3D: el panda rojo (pelaje rojizo, máscara blanca, orejas con punta blanca, cola a rayas)
// y sus vehículos: bici, auto deportivo rojo y dron. Hechos con figuras simples, estilo videojuego.
import * as THREE from 'three'

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o })
const ROJIZO = mat('#d4652f')
const OSCURO = mat('#3b2117')
const BLANCO = mat('#f6efe6')
const NEGRO = mat('#1b1513', { roughness: 0.4 })
const NARIZ = mat('#2a1a14', { roughness: 0.3 })

function sombra(o) {
  o.traverse((x) => {
    if (x.isMesh) {
      x.castShadow = true
      x.receiveShadow = true
    }
  })
  return o
}

/** ZUMI de pie (mira hacia -z). Devuelve { grupo, animar(dt, rapidez, modo) }. */
export function crearZumi() {
  const g = new THREE.Group()
  const cuerpo = new THREE.Group()
  g.add(cuerpo)
  // torso
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.42, 6, 12), ROJIZO)
  torso.position.y = 0.78
  cuerpo.add(torso)
  const pecho = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.3, 6, 12), OSCURO)
  pecho.position.set(0, 0.74, -0.12)
  cuerpo.add(pecho)
  // cabeza
  const cabeza = new THREE.Group()
  cabeza.position.set(0, 1.36, 0)
  cuerpo.add(cabeza)
  const craneo = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 16), ROJIZO)
  craneo.scale.set(1.12, 0.95, 1)
  cabeza.add(craneo)
  const hocico = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), BLANCO)
  hocico.position.set(0, -0.09, -0.29)
  hocico.scale.set(1.2, 0.8, 0.9)
  cabeza.add(hocico)
  const nariz = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), NARIZ)
  nariz.position.set(0, -0.04, -0.44)
  cabeza.add(nariz)
  for (const s of [-1, 1]) {
    const ceja = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), BLANCO)
    ceja.position.set(0.13 * s, 0.1, -0.3)
    ceja.scale.set(1.3, 0.7, 0.5)
    cabeza.add(ceja)
    const mejilla = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), BLANCO)
    mejilla.position.set(0.24 * s, -0.08, -0.2)
    cabeza.add(mejilla)
    const ojo = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), NEGRO)
    ojo.position.set(0.13 * s, 0.01, -0.33)
    cabeza.add(ojo)
    const brillo = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6 }))
    brillo.position.set(0.14 * s, 0.03, -0.38)
    cabeza.add(brillo)
    const oreja = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.24, 10), ROJIZO)
    oreja.position.set(0.25 * s, 0.31, 0.02)
    oreja.rotation.z = -0.45 * s
    cabeza.add(oreja)
    const punta = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.15, 10), BLANCO)
    punta.position.set(0.27 * s, 0.33, -0.015)
    punta.rotation.z = -0.45 * s
    cabeza.add(punta)
  }
  // patas y brazos (oscuros, como los del panda rojo)
  const pierna = () => new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.3, 4, 8), OSCURO)
  const piernas = [-1, 1].map((s) => {
    const p = new THREE.Group()
    p.position.set(0.16 * s, 0.5, 0)
    const m = pierna()
    m.position.y = -0.24
    p.add(m)
    cuerpo.add(p)
    return p
  })
  const brazos = [-1, 1].map((s) => {
    const b = new THREE.Group()
    b.position.set(0.36 * s, 1.0, -0.02)
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.3, 4, 8), OSCURO)
    m.position.y = -0.2
    b.add(m)
    b.rotation.z = 0.25 * s
    cuerpo.add(b)
    return b
  })
  // cola a rayas
  const cola = new THREE.Group()
  cola.position.set(0, 0.62, 0.3)
  cuerpo.add(cola)
  for (let i = 0; i < 7; i++) {
    const r = 0.13 - i * 0.008
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.02, 0.15, 10), i % 2 ? OSCURO : mat('#d36b38'))
    seg.position.set(0, 0.04 + i * 0.03, 0.08 + i * 0.13)
    seg.rotation.x = Math.PI / 2 - 0.35
    cola.add(seg)
  }
  sombra(g)
  let fase = 0
  return {
    grupo: g,
    cabeza,
    animar(dt, rapidez, sentado = false) {
      fase += dt * (2 + rapidez * 3.4)
      const paso = Math.min(1, rapidez / 2)
      const sw = Math.sin(fase) * 0.7 * paso
      piernas[0].rotation.x = sentado ? -1.3 : sw
      piernas[1].rotation.x = sentado ? -1.3 : -sw
      brazos[0].rotation.x = sentado ? -0.9 : -sw * 0.8
      brazos[1].rotation.x = sentado ? -0.9 : sw * 0.8
      cuerpo.position.y = sentado ? 0 : Math.abs(Math.sin(fase)) * 0.06 * paso
      cola.rotation.y = Math.sin(fase * 0.5) * 0.25
      cola.rotation.x = -0.1 + Math.sin(fase * 0.7) * 0.06
      cabeza.rotation.z = Math.sin(fase * 0.5) * 0.04 * paso
    },
  }
}

/** Auto deportivo rojo (mira hacia -z), 4,4 m. */
export function crearAuto() {
  const g = new THREE.Group()
  const pintura = new THREE.MeshPhysicalMaterial({ color: '#d4231c', metalness: 0.4, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 })
  const vidrio = new THREE.MeshPhysicalMaterial({ color: '#1a2735', metalness: 0.2, roughness: 0.05, clearcoat: 1 })
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.4, 1, 1, 1), pintura)
  base.position.y = 0.6
  g.add(base)
  const capot = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.2, 1.3), pintura)
  capot.position.set(0, 0.92, -1.45)
  capot.rotation.x = 0.08
  g.add(capot)
  const cabina = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.0), vidrio)
  cabina.position.set(0, 1.12, 0.25)
  g.add(cabina)
  const techo = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 1.3), pintura)
  techo.position.set(0, 1.4, 0.35)
  g.add(techo)
  const aleron = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.07, 0.35), mat('#1d1d1f'))
  aleron.position.set(0, 1.18, 2.05)
  g.add(aleron)
  for (const s of [-1, 1]) {
    const soporte = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.12), mat('#1d1d1f'))
    soporte.position.set(0.6 * s, 1.0, 2.05)
    g.add(soporte)
  }
  // focos y luces traseras
  for (const s of [-1, 1]) {
    const foco = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.05), mat('#fff8e6', { emissive: '#fff4d6', emissiveIntensity: 1.2 }))
    foco.position.set(0.62 * s, 0.78, -2.21)
    g.add(foco)
    const freno = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.05), mat('#ff2a1f', { emissive: '#ff1a10', emissiveIntensity: 0.9 }))
    freno.position.set(0.6 * s, 0.82, 2.21)
    g.add(freno)
  }
  const ruedas = []
  const llanta = mat('#151515', { roughness: 0.9 })
  const rin = mat('#c9ccd0', { metalness: 0.9, roughness: 0.25 })
  for (const [x, z] of [[-0.92, -1.35], [0.92, -1.35], [-0.92, 1.35], [0.92, 1.35]]) {
    const r = new THREE.Group()
    r.position.set(x, 0.38, z)
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 18), llanta)
    t.rotation.z = Math.PI / 2
    r.add(t)
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.31, 10), rin)
    c.rotation.z = Math.PI / 2
    r.add(c)
    g.add(r)
    ruedas.push(r)
  }
  // ZUMI al volante (solo la cabeza asoma)
  const zumi = crearZumi()
  zumi.grupo.scale.setScalar(0.62)
  zumi.grupo.position.set(-0.38, 0.35, 0.25)
  zumi.animar(0, 0, true)
  g.add(zumi.grupo)
  sombra(g)
  let giro = 0
  return {
    grupo: g,
    animar(dt, rapidez, volante = 0) {
      giro += (rapidez * dt) / 0.38
      ruedas.forEach((r, i) => {
        r.children.forEach((m) => (m.rotation.x = giro))
        if (i < 2) r.rotation.y = -volante * 0.45
      })
      base.rotation.z = volante * 0.03 * Math.min(1, rapidez / 10)
    },
  }
}

/** Bicicleta con ZUMI pedaleando. */
export function crearBici() {
  const g = new THREE.Group()
  const marco = mat('#1f6fd1', { metalness: 0.5, roughness: 0.35 })
  const negro = mat('#151515')
  const ruedas = []
  for (const z of [-0.55, 0.55]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.04, 8, 24), negro)
    r.position.set(0, 0.36, z)
    r.rotation.y = Math.PI / 2
    g.add(r)
    ruedas.push(r)
  }
  const tubo = (a, b) => {
    const v = new THREE.Vector3().subVectors(b, a)
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, v.length(), 6), marco)
    m.position.copy(a).addScaledVector(v, 0.5)
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.clone().normalize())
    g.add(m)
  }
  const V = (x, y, z) => new THREE.Vector3(x, y, z)
  tubo(V(0, 0.36, 0.55), V(0, 0.75, 0.05))
  tubo(V(0, 0.75, 0.05), V(0, 0.8, -0.45))
  tubo(V(0, 0.36, -0.55), V(0, 0.8, -0.45))
  tubo(V(0, 0.36, 0.55), V(0, 0.4, 0))
  tubo(V(0, 0.4, 0), V(0, 0.75, 0.05))
  tubo(V(-0.25, 0.95, -0.45), V(0.25, 0.95, -0.45))
  const zumi = crearZumi()
  zumi.grupo.scale.setScalar(0.85)
  zumi.grupo.position.set(0, 0.12, 0.05)
  g.add(zumi.grupo)
  sombra(g)
  let fase = 0
  return {
    grupo: g,
    animar(dt, rapidez, volante = 0) {
      fase += dt * rapidez * 1.6
      ruedas.forEach((r) => (r.rotation.x = fase))
      zumi.animar(dt, rapidez * 0.4, false)
      g.rotation.z = -volante * 0.12 * Math.min(1, rapidez / 4)
    },
  }
}

/** Dron con ZUMI arriba. */
export function crearDron() {
  const g = new THREE.Group()
  const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.9), mat('#e9ebee', { metalness: 0.3, roughness: 0.4 }))
  g.add(cuerpo)
  const helices = []
  for (const [x, z] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
    const brazo = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 1.3), mat('#2b2f36'))
    brazo.position.set(x / 2, 0, z / 2)
    brazo.rotation.y = Math.atan2(x, z)
    g.add(brazo)
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.02, 20), new THREE.MeshBasicMaterial({ color: '#dfe8ff', transparent: true, opacity: 0.35 }))
    h.position.set(x, 0.12, z)
    g.add(h)
    helices.push(h)
    const luz = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat(z < 0 ? '#3dff7a' : '#ff3b30', { emissive: z < 0 ? '#3dff7a' : '#ff3b30', emissiveIntensity: 1.5 }))
    luz.position.set(x, -0.05, z)
    g.add(luz)
  }
  const zumi = crearZumi()
  zumi.grupo.scale.setScalar(0.7)
  zumi.grupo.position.set(0, 0.1, 0)
  zumi.animar(0, 0, true)
  g.add(zumi.grupo)
  sombra(g)
  let t = 0
  return {
    grupo: g,
    animar(dt, rapidez, volante = 0) {
      t += dt
      helices.forEach((h) => (h.rotation.y += dt * 40))
      g.position.y = Math.sin(t * 2) * 0.15
      g.rotation.x = Math.min(0.25, rapidez / 200)
      g.rotation.z = -volante * 0.2
    },
  }
}
