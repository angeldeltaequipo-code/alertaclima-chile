// Motor del mundo de ZUMI: Chile real (OpenStreetMap) convertido en videojuego 3D con three.js.
// Cielo con sol y sombras, barrios que se arman a tu alrededor mientras avanzas, ZUMI y sus vehículos,
// faros de objetivos y cámara de persecución como en un juego de carreras.
import * as THREE from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { cargarTesela, proyector, teselaDe } from './teselas'
import { armarTesela, generarTesela } from './construir'
import { crearMateriales, nocheMateriales } from './materiales'
import { crearAuto, crearBici, crearDron, crearZumi } from './personajes'

const CAMARA = {
  pie: { dist: 6.2, alto: 2.9, mira: 1.5, fov: 58, radio: 1, niebla: [120, 650] },
  bici: { dist: 7.4, alto: 3.3, mira: 1.5, fov: 60, radio: 1, niebla: [150, 750] },
  auto: { dist: 9.6, alto: 3.5, mira: 1.3, fov: 60, radio: 1, niebla: [200, 950] },
  dron: { dist: 60, alto: 46, mira: 0, fov: 60, radio: 2, niebla: [700, 3600], vuelo: 70 },
}

// En la maqueta real la cámara va un poco más alta (las fotos se ven mejor desde arriba, como en Google Earth)
const CAMARA_FOTO = {
  pie: { dist: 15, alto: 10, mira: 2, fov: 55 },
  bici: { dist: 17, alto: 11, mira: 2, fov: 55 },
  auto: { dist: 21, alto: 12, mira: 2, fov: 55 },
  dron: { dist: 70, alto: 50 },
}

// Corrección de color «de cine»: un poco más de contraste y saturación, sombras frías y luces cálidas,
// y viñeta suave en los bordes (como en los juegos de mundo abierto).
function texturaNubes() {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const g = c.getContext('2d')
  g.clearRect(0, 0, 512, 512)
  for (let i = 0; i < 70; i++) {
    const x = Math.random() * 512
    const y = Math.random() * 512
    const r = 30 + Math.random() * 90
    for (const [dx, dy] of [[0, 0], [512, 0], [-512, 0], [0, 512], [0, -512]]) {
      const gr = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r)
      gr.addColorStop(0, 'rgba(255,255,255,0.55)')
      gr.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = gr
      g.beginPath()
      g.arc(x + dx, y + dy, r, 0, Math.PI * 2)
      g.fill()
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const GRADO = {
  uniforms: { tDiffuse: { value: null }, fuerza: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float fuerza; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, 1.0 + 0.16 * fuerza);                 // saturación
      col = (col - 0.5) * (1.0 + 0.1 * fuerza) + 0.5;               // contraste
      col += vec3(0.02, 0.006, -0.018) * smoothstep(0.45, 1.0, l) * fuerza;  // luces cálidas
      col += vec3(-0.012, 0.0, 0.022) * (1.0 - smoothstep(0.0, 0.4, l)) * fuerza; // sombras frías
      float v = smoothstep(0.95, 0.35, length(vUv - 0.5));          // viñeta
      col *= mix(1.0, v, 0.32 * fuerza);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }`,
}

export class Mundo {
  constructor(contenedor, { lat, lng, rumbo = 0, modo = 'pie' }) {
    this.cont = contenedor
    this.proy = proyector(lat, lng)
    this.x = 0
    this.z = 0
    this.rumbo = rumbo
    this.modo = modo
    this.vel = 0
    this.volante = 0
    this.teselas = new Map() // clave → { estado, obj }
    this.cola = []
    this.pines = []
    this.listo = false
    this.alListo = null
    this.alCuadro = null
    this.alMover = null
    this.giroSuave = null
    this.h0 = 0 // altura del suelo bajo ZUMI (en el mundo fotorrealista)
    this.foto = null
    if (typeof window !== 'undefined') window.__mundoZumi = this // para revisar en vivo

    const movil = matchMedia('(pointer: coarse)').matches
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: !movil, powerPreference: 'high-performance' }))
    r.setPixelRatio(Math.min(devicePixelRatio || 1, movil ? 1.5 : 2))
    r.shadowMap.enabled = true
    r.shadowMap.type = THREE.PCFSoftShadowMap
    r.toneMapping = THREE.ACESFilmicToneMapping
    r.toneMappingExposure = 0.82
    r.outputColorSpace = THREE.SRGBColorSpace
    contenedor.appendChild(r.domElement)
    r.domElement.style.display = 'block'

    const s = (this.escena = new THREE.Scene())
    this.camara = new THREE.PerspectiveCamera(58, 1, 0.3, 9000)
    this.camPos = new THREE.Vector3(0, 4, 8)
    this.camMira = new THREE.Vector3()

    // cielo y sol
    this.cielo = new Sky()
    this.cielo.scale.setScalar(20000)
    s.add(this.cielo)
    const u = this.cielo.material.uniforms
    u.turbidity.value = 3.2
    u.rayleigh.value = 1.1
    u.mieCoefficient.value = 0.004
    u.mieDirectionalG.value = 0.82
    this.solDir = new THREE.Vector3()
    this.hemi = new THREE.HemisphereLight('#d8ecff', '#a9a07e', 0.7)
    s.add(this.hemi)
    this.sol = new THREE.DirectionalLight('#fff1d6', 2.6)
    this.sol.castShadow = true
    this.sol.shadow.mapSize.set(movil ? 1024 : 2048, movil ? 1024 : 2048)
    Object.assign(this.sol.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, near: 10, far: 600 })
    this.sol.shadow.bias = -0.0004
    this.sol.shadow.normalBias = 0.04
    s.add(this.sol, this.sol.target)
    this.niebla = new THREE.Fog('#cfe0ee', 120, 650)
    s.fog = this.niebla
    this.ponerSol(32, 35)
    // nubes: una capa alta que sigue a la cámara y se mueve con el viento
    this.nubes = new THREE.Mesh(
      new THREE.PlaneGeometry(9000, 9000).rotateX(Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: texturaNubes(), transparent: true, opacity: 0.85, depthWrite: false, fog: false, side: THREE.DoubleSide }),
    )
    this.nubes.material.map.repeat.set(3, 3)
    this.nubes.position.y = 1100
    this.nubes.renderOrder = -1
    s.add(this.nubes)
    // reflejos del cielo en autos, vidrios y zinc
    this.pmrem = new THREE.PMREMGenerator(r)
    this.cieloRefl = new Sky()
    this.cieloRefl.scale.setScalar(1000)
    this.escenaRefl = new THREE.Scene()
    this.escenaRefl.add(this.cieloRefl)
    this.reflejos()

    // suelo base (campo) que sigue al jugador
    this.mat = crearMateriales()
    const sueloMat = new THREE.MeshStandardMaterial({ color: '#aebf7f', map: this.mat.suelo.map.clone(), roughness: 1 })
    sueloMat.map.repeat.set(900, 900)
    sueloMat.map.needsUpdate = true
    this.suelo = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000), sueloMat)
    this.suelo.rotation.x = -Math.PI / 2
    this.suelo.receiveShadow = true
    s.add(this.suelo)
    this.barrios = new THREE.Group()
    s.add(this.barrios)

    // personajes
    this.vehiculos = { pie: crearZumi(), bici: crearBici(), auto: crearAuto(), dron: crearDron() }
    this.jugador = new THREE.Group()
    for (const v of Object.values(this.vehiculos)) {
      v.grupo.visible = false
      this.jugador.add(v.grupo)
    }
    s.add(this.jugador)
    this.sombraDron = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.25, depthWrite: false }))
    this.sombraDron.rotation.x = -Math.PI / 2
    s.add(this.sombraDron)
    this.faros = new THREE.Group()
    // tráfico: autos que circulan por las calles reales
    this.trafico = new THREE.InstancedMesh(this.mat.autoGeo, this.mat.auto, 40)
    this.trafico.castShadow = true
    this.trafico.frustumCulled = false
    this.npcs = []
    const colores = ['#e9e9ea', '#2b2e33', '#b3261e', '#1f4e8c', '#9aa0a8', '#d7c9a6', '#2f6b4f', '#c9ccd1']
    for (let i = 0; i < 40; i++) this.trafico.setColorAt(i, new THREE.Color(colores[i % colores.length]))
    this.trafico.count = 0
    s.add(this.faros, this.trafico)
    this.lluvia = null

    // etiquetas de lugares (HTML encima)
    this.capaPines = document.createElement('div')
    this.capaPines.className = 'mundo-pines'
    contenedor.appendChild(this.capaPines)

    this.setModo(modo)
    // Post-proceso de cine: sombras de contacto (GTAO), brillo de luces y corrección de color
    this.movil = movil
    this.composer = new EffectComposer(r)
    this.composer.addPass(new RenderPass(s, this.camara))
    if (!movil) {
      this.ao = new GTAOPass(s, this.camara, 800, 600)
      this.ao.output = GTAOPass.OUTPUT.Default
      this.ao.blendIntensity = 0.85
      this.ao.updateGtaoMaterial({ radius: 1.6, distanceExponent: 1.4, thickness: 2.2, scale: 1.1, samples: 12 })
      this.composer.addPass(this.ao)
    }
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.25, 0.5, 0.92)
    this.composer.addPass(this.bloom)
    this.composer.addPass(new OutputPass())
    this.composer.addPass(new ShaderPass(GRADO))
    this.redimensionar = () => {
      const w = contenedor.clientWidth || innerWidth
      const h = contenedor.clientHeight || innerHeight
      r.setSize(w, h)
      this.composer.setSize(w, h)
      this.ao?.setSize(w, h)
      this.camara.aspect = w / h
      this.camara.updateProjectionMatrix()
    }
    this.redimensionar()
    addEventListener('resize', this.redimensionar)
    this.reloj = new THREE.Clock()
    this.vivo = true
    this.actualizarTeselas(true)
    const bucle = () => {
      if (!this.vivo) return
      this.raf = requestAnimationFrame(bucle)
      this.cuadro()
    }
    bucle()
  }

  // ---------- API parecida a la del mapa ----------
  getCenter() {
    return this.proy.aGeo(this.x, this.z)
  }
  getBearing() {
    return this.rumbo
  }
  jumpTo({ center, bearing } = {}) {
    if (center) {
      const [lng, lat] = center
      const d = Math.hypot(...this.proy.aLocal(lat, lng))
      if (d > 12000) this.reorigen(lat, lng)
      else {
        const [x, z] = this.proy.aLocal(lat, lng)
        if (Math.hypot(x - this.x, z - this.z) > 300) {
          // otro lugar: revisar de nuevo si hay ciudad 3D y medir el suelo desde arriba
          this.cobertura = null
          this.fotoDesde = performance.now()
          this.h0Listo = false
          if (this.soloAire) {
            this.soloAire = false
            this.alSoloAire?.(false)
          }
          if (this.foto && this.fotoVisible) {
            // vuelve a probar a escondidas en el lugar nuevo
            this.foto.raiz.visible = false
            this.fotoVisible = false
            this.barrios.visible = this.trafico.visible = this.suelo.visible = true
          }
        }
        this.x = x
        this.z = z
      }
    }
    if (bearing != null) this.rumbo = ((bearing % 360) + 360) % 360
    this.alMover?.()
  }
  easeTo({ bearing, duration = 800 } = {}) {
    if (bearing == null) return
    const desde = this.rumbo
    const delta = ((bearing - desde + 540) % 360) - 180
    this.giroSuave = { desde, delta, t0: performance.now(), dur: duration }
  }
  setModo(m) {
    this.modo = m
    for (const [k, v] of Object.entries(this.vehiculos)) v.grupo.visible = k === m
    const c = CAMARA[m]
    this.niebla.near = c.niebla[0]
    this.niebla.far = c.niebla[1]
    this.sol.shadow.camera.left = this.sol.shadow.camera.bottom = m === 'dron' ? -260 : -90
    this.sol.shadow.camera.right = this.sol.shadow.camera.top = m === 'dron' ? 260 : 90
    this.sol.shadow.camera.updateProjectionMatrix()
    this.actualizarTeselas()
  }
  /** Para la animación del personaje (m/s y giro -1…1). */
  setMarcha(vel, volante) {
    this.vel = vel
    this.volante = volante
  }
  /** ¿Se puede estar en ese punto? (no atravesar casas; en dron, sí) */
  libre(lat, lng) {
    if (this.modo === 'dron') return true
    const [x, z] = this.proy.aLocal(lat, lng)
    if (this.fotoVisible) {
      const dx = x - this.x
      const dz = z - this.z
      if (Math.hypot(dx, dz) < 0.001) return true
      // en la maqueta real: no atravesar paredes y no subir escalones de más de 1,4 m
      if (this.foto.pared(this.x, this.h0, this.z, dx, dz, this.modo === 'auto' ? 2.6 : 1.1)) return false
      const h = this.foto.alturaEn(x, z, this.h0 + 60)
      return h == null || h - this.h0 < 1.4
    }
    for (const t of this.teselas.values()) if (t.obj?.choca(x, z)) return false
    if (this.modo !== 'pie' && this.chocaTrafico(x, z)) return false
    return true
  }
  edificiosCerca(radio = 250) {
    let n = 0
    for (const t of this.teselas.values()) for (const h of t.obj?.huellas ?? []) if (Math.hypot((h.x0 + h.x1) / 2 - this.x, (h.z0 + h.z1) / 2 - this.z) < radio) n++
    return n
  }

  // ---------- mundo fotorrealista (maqueta 3D de Google) ----------
  async activarFotorreal(token) {
    if (this.foto || !token) return false
    this.tokenFoto = token
    // si el token no sirve, se queda el mundo dibujado (mejor que una pantalla negra)
    try {
      const r = await fetch(`https://api.cesium.com/v1/assets/2275207/endpoint?access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(15000) })
      if (!r.ok) {
        console.warn('mundo: token de Cesium inválido', r.status)
        return false
      }
    } catch {
      return false
    }
    const { Fotorreal } = await import('./fotorreal')
    if (!this.vivo) return false
    const { lat, lng } = this.proy.aGeo(0, 0)
    this.foto = new Fotorreal({ escena: this.escena, camara: this.camara, renderer: this.renderer, token, lat, lng })
    this.foto.tiles.addEventListener('load-error', (e) => console.warn('mundo: maqueta', e?.error?.message ?? e))
    // Primero se prueba a escondidas: el mundo dibujado sigue a la vista hasta confirmar que aquí
    // hay ciudad 3D real. Así nunca se ve una pantalla negra ni una foto plana.
    this.foto.raiz.visible = false
    this.fotoVisible = false
    this.fotoDesde = performance.now()
    this.cobertura = null
    return true
  }
  mostrarFotorreal() {
    if (!this.foto) return
    this.foto.raiz.visible = true
    this.fotoVisible = true
    this.barrios.visible = false
    this.trafico.visible = false
    this.suelo.visible = false
    this.niebla.near = 600
    this.niebla.far = 9000
    this.camara.far = 30000
    this.camara.updateProjectionMatrix()
    this.sol.castShadow = false
    this.sombraDron.material.opacity = 0.35
    this.intro = { t0: performance.now(), dur: 4200 }
    this.alFotorreal?.(true)
  }

  /** Sin ciudad 3D de Google en este lugar (solo foto plana): se vuelve al mundo dibujado con casas. */
  revisarCobertura() {
    const alturas = []
    for (let i = -2; i <= 2; i++)
      for (let j = -2; j <= 2; j++) {
        const h = this.foto.alturaEn(this.x + i * 45, this.z + j * 45, 600)
        if (h != null) alturas.push(h)
      }
    if (alturas.length < 15) return null // aún cargando
    const orden = [...alturas].sort((a, b) => a - b)
    const base = orden[Math.floor(orden.length * 0.25)]
    const altos = alturas.filter((h) => h - base > 4).length
    return altos >= 3
  }
  desactivarFotorreal() {
    if (!this.foto) return
    this.foto.liberar()
    this.foto = null
    this.fotoVisible = false
    this.h0 = 0
    this.h0Listo = false
    this.barrios.visible = true
    this.trafico.visible = true
    this.suelo.visible = true
    this.sol.castShadow = true
    this.camara.far = 9000
    this.camara.updateProjectionMatrix()
    this.sombraDron.material.opacity = 0.25
    this.setModo(this.modo)
    this.alFotorreal?.(false)
  }

  // ---------- cielo y clima ----------
  ponerSol(elev, azim) {
    const phi = THREE.MathUtils.degToRad(90 - elev)
    const theta = THREE.MathUtils.degToRad(azim)
    this.solDir.setFromSphericalCoords(1, phi, theta)
    this.cielo.material.uniforms.sunPosition.value.copy(this.solDir)
  }
  reflejos() {
    const u = this.cielo.material.uniforms
    const v = this.cieloRefl.material.uniforms
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) v[k].value = u[k].value
    v.sunPosition.value.copy(u.sunPosition.value)
    this.envRT?.dispose()
    this.envRT = this.pmrem.fromScene(this.escenaRefl, 0, 1, 2000)
    this.escena.environment = this.envRT.texture
    this.escena.environmentIntensity = this.cielo.visible ? 0.55 : 0.15
  }
  setClima(c) {
    if (!c) return
    this.clima = c
    const noche = !c.dia
    const gris = c.lluvia || c.nubes > 75
    nocheMateriales(this.mat, noche)
    const u = this.cielo.material.uniforms
    if (noche) {
      this.ponerSol(-8, 20)
      this.cielo.visible = false
      this.nubes.visible = false
      this.escena.background = new THREE.Color('#0b1630')
      this.niebla.color.set('#13213d')
      this.hemi.intensity = 0.6
      this.hemi.color.set('#8fa6d6')
      this.sol.intensity = 0.55
      this.sol.color.set('#a9c0ff')
      this.renderer.toneMappingExposure = 1.25
      this.mat.auto.envMapIntensity = 0.3
    } else {
      this.cielo.visible = true
      this.nubes.visible = true
      this.nubes.material.opacity = gris ? 1 : 0.7
      this.escena.background = null
      this.ponerSol(gris ? 30 : 32, 35)
      u.turbidity.value = gris ? 12 : 3.2
      u.rayleigh.value = gris ? 3 : 1.1
      this.niebla.color.set(gris ? '#b9c2cb' : '#cfe0ee')
      this.hemi.intensity = gris ? 1.0 : 0.7
      this.sol.intensity = gris ? 0.8 : 2.4
      this.sol.color.set('#fff1d6')
      this.renderer.toneMappingExposure = 0.82
    }
    if (this.vehiculos.auto.luces) this.vehiculos.auto.luces.intensity = noche ? 60 : 0
    this.ponerLluvia(!!c.lluvia)
    this.reflejos()
  }
  ponerLluvia(si) {
    if (this.lluvia) {
      this.escena.remove(this.lluvia)
      this.lluvia.geometry.dispose()
      this.lluvia = null
    }
    if (!si) return
    const n = 2500
    const p = new Float32Array(n * 6)
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * 80
      const y = Math.random() * 40
      const z = (Math.random() - 0.5) * 80
      p.set([x, y, z, x + 0.05, y - 0.9, z], i * 6)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    this.lluvia = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#c9d6e6', transparent: true, opacity: 0.45 }))
    this.lluvia.frustumCulled = false
    this.escena.add(this.lluvia)
  }

  // ---------- objetivos (faros de luz) y etiquetas ----------
  setFaros(objs, recogidos, modo) {
    for (const f of this.faros.children) f.geometry.dispose()
    this.faros.clear()
    const tam0 = { pie: [5, 40], bici: [6, 50], auto: [10, 80], dron: [30, 260] }[modo] ?? [5, 40]
    const tam = this.fotoVisible ? [tam0[0] * 0.35, tam0[1] * 1.2] : tam0
    for (const o of objs) {
      const hecho = recogidos.has(o.id)
      const color = hecho ? '#3ddc84' : o.tipo === 'lugar' ? '#ffc23d' : '#7cc4ff'
      const [x, z] = this.proy.aLocal(o.lat, o.lng)
      const h = hecho ? tam[1] * 0.25 : tam[1]
      const haz = new THREE.Mesh(
        new THREE.CylinderGeometry(tam[0] * 0.55, tam[0], h, 28, 1, true),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: (hecho ? 0.25 : 0.42) * (this.foto ? 0.55 : 1), blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }),
      )
      haz.position.set(x, h / 2, z)
      const anillo = new THREE.Mesh(new THREE.RingGeometry(tam[0] * 0.8, tam[0] * 1.1, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }))
      anillo.rotation.x = -Math.PI / 2
      anillo.position.set(x, 0.3, z)
      anillo.userData.gira = true
      this.faros.add(haz, anillo)
    }
  }
  setPines(lugares, alTocar) {
    this.capaPines.textContent = ''
    this.pines = lugares.map((l) => {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'paseo-pin'
      el.textContent = l.titulo
      el.setAttribute('aria-label', `Ir hacia ${l.titulo}`)
      el.onclick = () => alTocar(l)
      this.capaPines.appendChild(el)
      const [x, z] = this.proy.aLocal(l.lat, l.lng)
      return { el, v: new THREE.Vector3(x, 14, z), base: 14 }
    })
  }

  // ---------- barrios ----------
  reorigen(lat, lng) {
    // la maqueta real se reorienta al nuevo lugar
    if (this.foto) {
      this.foto.liberar()
      this.foto = null
      this.h0Listo = false
      setTimeout(() => this.activarFotorreal(this.tokenFoto), 0)
    }
    for (const t of this.teselas.values()) if (t.obj) {
      this.barrios.remove(t.obj.grupo)
      t.obj.liberar()
    }
    this.teselas.clear()
    this.cola = []
    this.proy = proyector(lat, lng)
    this.x = 0
    this.z = 0
    this.listo = false
    this.actualizarTeselas(true)
  }
  actualizarTeselas(urgente = false) {
    const { lat, lng } = this.getCenter()
    const c = teselaDe(lat, lng)
    const R = CAMARA[this.modo].radio
    const quiero = []
    for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) quiero.push({ x: c.x + dx, y: c.y + dy, d: Math.abs(dx) + Math.abs(dy) })
    quiero.sort((a, b) => a.d - b.d)
    const claves = new Set(quiero.map((q) => `${q.x}/${q.y}`))
    // suelta lo que quedó lejos
    for (const [k, t] of this.teselas) {
      const [tx, ty] = k.split('/').map(Number)
      if (Math.max(Math.abs(tx - c.x), Math.abs(ty - c.y)) > R + 1) {
        t.ctl?.abort()
        if (t.obj) {
          this.barrios.remove(t.obj.grupo)
          t.obj.liberar()
        }
        this.teselas.delete(k)
      }
    }
    for (const q of quiero) {
      const k = `${q.x}/${q.y}`
      if (this.teselas.has(k)) continue
      const ctl = new AbortController()
      const reg = { estado: 'bajando', ctl }
      this.teselas.set(k, reg)
      const proy = this.proy
      this.generar(q.x, q.y, proy, ctl.signal)
        .then((datos) => {
          if (this.teselas.get(k) !== reg || this.proy !== proy) return
          reg.estado = 'en cola'
          this.cola.push({ k, datos, reg, d: q.d })
          this.cola.sort((a, b) => a.d - b.d)
        })
        .catch(() => {
          if (this.teselas.get(k) === reg) reg.estado = 'error'
        })
    }
    this.ultimaTesela = `${c.x}/${c.y}`
    if (urgente) this.centroTesela = `${c.x}/${c.y}`
    void claves
  }
  /** Genera el barrio en un hilo aparte (si el navegador lo permite) para que la pantalla no se trabe. */
  generar(tx, ty, proy, signal) {
    if (!this.hilos) {
      this.hilos = []
      this.pedidosHilo = new Map()
      try {
        for (let i = 0; i < 2; i++) {
          const w = new Worker(new URL('./trabajador.js', import.meta.url), { type: 'module' })
          w.onmessage = (e) => {
            const p = this.pedidosHilo.get(e.data.id)
            this.pedidosHilo.delete(e.data.id)
            if (p) e.data.error ? p.no(new Error(e.data.error)) : p.si(e.data.d)
          }
          this.hilos.push(w)
        }
      } catch {
        this.hilos = []
      }
    }
    if (!this.hilos.length) return cargarTesela(tx, ty, proy, { signal }).then(generarTesela)
    const id = (this.sec = (this.sec ?? 0) + 1)
    const w = this.hilos[id % this.hilos.length]
    return new Promise((si, no) => {
      this.pedidosHilo.set(id, { si, no })
      signal?.addEventListener('abort', () => this.pedidosHilo.delete(id))
      w.postMessage({ id, tx, ty, lat0: proy.lat0, lng0: proy.lng0 })
    })
  }
  construirSiguiente() {
    const it = this.cola.shift()
    if (!it || this.teselas.get(it.k) !== it.reg) return
    try {
      it.reg.obj = armarTesela(it.datos, this.mat)
      it.reg.estado = 'lista'
      this.barrios.add(it.reg.obj.grupo)
    } catch (e) {
      console.warn('mundo: tesela', it.k, e)
      it.reg.estado = 'error'
    }
    if (!this.listo) {
      const { lat, lng } = this.getCenter()
      const c = teselaDe(lat, lng)
      const centro = this.teselas.get(`${c.x}/${c.y}`)
      if (centro?.estado === 'lista' || centro?.estado === 'error') {
        this.salirDeCasa()
        this.listo = true
        this.alListo?.()
      }
    }
  }

  /** Si quedaste dentro de una casa, te deja en la calle libre más cercana. */
  salirDeCasa() {
    const choca = (x, z) => [...this.teselas.values()].some((t) => t.obj?.choca(x, z))
    // parte en medio de la calle (o sendero de plaza) más cercana
    let mejor = null
    for (const t of this.teselas.values())
      for (const sg of t.obj?.calles.cerca(this.x, this.z, 120) ?? []) {
        if (sg.cl === 'rail') continue
        const dx = sg.bx - sg.ax
        const dz = sg.bz - sg.az
        const l2 = dx * dx + dz * dz || 1
        const k = Math.max(0, Math.min(1, ((this.x - sg.ax) * dx + (this.z - sg.az) * dz) / l2))
        const x = sg.ax + k * dx
        const z = sg.az + k * dz
        const d = Math.hypot(x - this.x, z - this.z)
        // mejor una calle de verdad que un pasaje o sendero
        const pena = sg.cl === 'path' || sg.cl === 'service' || sg.cl === 'track' ? 90 : 0
        if (d < 120 && (!mejor || d + pena < mejor.d) && !choca(x, z)) mejor = { x, z, d: d + pena, r: (Math.atan2(dx, -dz) * 180) / Math.PI }
      }
    if (mejor) {
      this.x = mejor.x
      this.z = mejor.z
      // mirar a lo largo de la calle, hacia el lado más parecido al rumbo pedido
      const a = (mejor.r + 360) % 360
      const b = (a + 180) % 360
      const dif = (x) => Math.abs(((x - this.rumbo + 540) % 360) - 180)
      this.rumbo = dif(a) < dif(b) ? a : b
      return
    }
    if (!choca(this.x, this.z)) return
    for (let r = 3; r < 120; r += 3)
      for (let a = 0; a < 360; a += 20) {
        const x = this.x + Math.sin((a * Math.PI) / 180) * r
        const z = this.z - Math.cos((a * Math.PI) / 180) * r
        if (!choca(x, z) && !choca(x + 1.5, z) && !choca(x - 1.5, z) && !choca(x, z + 1.5) && !choca(x, z - 1.5)) {
          this.x = x
          this.z = z
          return
        }
      }
  }

  moverTrafico(dt) {
    const rutas = []
    for (const t of this.teselas.values()) for (const r of t.obj?.rutas ?? []) rutas.push(r)
    if (!rutas.length) {
      this.trafico.count = 0
      return
    }
    const lejos = this.modo === 'dron' ? 1400 : 450
    const nuevo = () => {
      // una ruta cerca del jugador
      const cerca = rutas.filter((r) => r.linea.some(([x, z]) => Math.hypot(x - this.x, z - this.z) < (this.modo === 'dron' ? 900 : 220)))
      const r = (cerca.length ? cerca : rutas)[Math.floor(Math.random() * (cerca.length || rutas.length))]
      return { r, d: Math.random() * r.largo, dir: Math.random() < 0.5 ? 1 : -1, v: 7 + Math.random() * 6 }
    }
    while (this.npcs.length < (this.modo === 'dron' ? 40 : 22)) this.npcs.push(nuevo())
    const o = new THREE.Object3D()
    let i = 0
    for (let k = 0; k < this.npcs.length; k++) {
      let n = this.npcs[k]
      n.d += n.v * dt * n.dir
      if (n.d < 0 || n.d > n.r.largo) {
        n.dir *= -1
        n.d = Math.max(0, Math.min(n.r.largo, n.d))
      }
      // ubicar en la polilínea
      let acum = 0
      let pos = null
      const L = n.r.linea
      for (let j = 0; j < L.length - 1; j++) {
        const l = Math.hypot(L[j + 1][0] - L[j][0], L[j + 1][1] - L[j][1])
        if (acum + l >= n.d || j === L.length - 2) {
          const t = l ? Math.min(1, (n.d - acum) / l) : 0
          const ux = (L[j + 1][0] - L[j][0]) / (l || 1)
          const uz = (L[j + 1][1] - L[j][1]) / (l || 1)
          const carril = (n.r.w / 4) * n.dir // por la derecha
          pos = { x: L[j][0] + ux * l * t - uz * carril, z: L[j][1] + uz * l * t + ux * carril, a: Math.atan2(ux * n.dir, -uz * n.dir) }
          break
        }
        acum += l
      }
      if (!pos || Math.hypot(pos.x - this.x, pos.z - this.z) > lejos) {
        this.npcs[k] = nuevo()
        continue
      }
      // frena si el jugador está delante
      const dj = Math.hypot(pos.x - this.x, pos.z - this.z)
      n.v = dj < 9 ? Math.max(0, n.v - dt * 12) : Math.min(n.v + dt * 3, 12)
      o.position.set(pos.x, 0, pos.z)
      o.rotation.set(0, -pos.a, 0)
      o.updateMatrix()
      this.trafico.setMatrixAt(i++, o.matrix)
      n.pos = pos
    }
    this.trafico.count = i
    this.trafico.instanceMatrix.needsUpdate = true
  }
  /** ¿Hay un auto del tráfico en ese punto? */
  chocaTrafico(x, z) {
    return this.npcs.some((n) => n.pos && Math.hypot(n.pos.x - x, n.pos.z - z) < 2.3)
  }

  // ---------- cada cuadro ----------
  cuadro() {
    const dt = Math.min(0.1, this.reloj.getDelta())
    this.alCuadro?.(dt)
    if (this.giroSuave) {
      const g = this.giroSuave
      const k = Math.min(1, (performance.now() - g.t0) / g.dur)
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2
      this.rumbo = (g.desde + g.delta * e + 360) % 360
      if (k >= 1) this.giroSuave = null
    }
    if (this.cola.length) this.construirSiguiente()
    this.moverTrafico(dt)
    const { lat, lng } = this.getCenter()
    const t = teselaDe(lat, lng)
    if (`${t.x}/${t.y}` !== this.ultimaTesela) this.actualizarTeselas()

    // en la maqueta real, el suelo sube y baja: se mide con un rayo bajo ZUMI
    if (this.foto) {
      this.foto.actualizar()
      this.nRayo = (this.nRayo ?? 0) + 1
      // ¿hay ciudad 3D aquí? (se revisa a escondidas; si no hay, se queda el mundo dibujado)
      const espera = performance.now() - this.fotoDesde
      const st = this.foto.tiles.stats ?? {}
      const quieta = (st.downloading ?? 0) + (st.parsing ?? 0) + (st.queued ?? 0) === 0
      if (this.cobertura == null && espera > 3500 && (this.h0Listo || espera > 9000) && this.nRayo % 20 === 0) {
        let c = this.revisarCobertura()
        // «sin 3D» solo se decide con la maqueta ya cargada (si no, Santiago parecía plano)
        if (c === false && !quieta && espera < 12000) c = null
        if (c === true) {
          this.cobertura = true
          this.mostrarFotorreal()
        } else if (c === false) {
          // Sin ciudad 3D: la foto real de Google, vista desde el aire (de cerca sería borrosa)
          this.cobertura = false
          this.soloAire = true
          this.mostrarFotorreal()
          this.setModo('dron')
          this.alSoloAire?.(true)
        } else if (espera > 25000) {
          // No alcanzó a decidirse (teléfono lento o red lenta). Nunca se muestra una ciudad inventada si
          // llegó la foto real: se recorre desde el aire. Solo si Google no mandó nada, queda el mundo dibujado.
          this.cobertura = false
          if ((this.foto.tiles.visibleTiles?.size ?? 0) > 0) {
            this.soloAire = true
            this.mostrarFotorreal()
            this.setModo('dron')
            this.alSoloAire?.(true)
          } else {
            this.desactivarFotorreal()
            return
          }
        }
      }
      if (this.foto && this.nRayo % 2 === 0) {
        const h = this.foto.alturaEn(this.x, this.z, this.fotoVisible ? this.h0 + (this.modo === 'dron' ? 400 : 40) : 9000)
        if (h != null && !this.fotoVisible) {
          // Mientras se prueba, la maqueta se baja para que su suelo quede a la altura del juego
          // (así carga con detalle de calle). Se repite mientras mejora el detalle: las primeras
          // capas son burdas y su «suelo» puede quedar kilómetros arriba o abajo.
          if (Math.abs(h) > 1.5) {
            this.foto.raiz.position.y -= h
            this.foto.raiz.updateMatrixWorld(true)
          }
          this.h0 = 0
          const st = this.foto.tiles.stats ?? {}
          this.h0Listo = Math.abs(h) <= 1.5 && (st.downloading ?? 0) + (st.parsing ?? 0) + (st.queued ?? 0) === 0
        } else if (h != null) {
          if (this.h0Listo) this.h0 += (h - this.h0) * Math.min(1, dt * 12)
          else {
            this.h0 = h
            this.h0Listo = true
          }
        }
      }
    }
    // jugador
    const c = this.fotoVisible ? { ...CAMARA[this.modo], ...CAMARA_FOTO[this.modo] } : CAMARA[this.modo]
    const yJ = (c.vuelo ?? 0) + (this.fotoVisible ? this.h0 : 0)
    const rad = THREE.MathUtils.degToRad(this.rumbo)
    const fx = Math.sin(rad)
    const fz = -Math.cos(rad)
    this.jugador.position.set(this.x, yJ, this.z)
    this.jugador.rotation.y = -rad
    this.vehiculos[this.modo].animar(dt, Math.abs(this.vel), this.volante)
    this.sombraDron.visible = this.modo === 'dron' || !!this.fotoVisible
    this.sombraDron.position.set(this.x, (this.fotoVisible ? this.h0 : 0) + 0.15, this.z)
    this.sombraDron.scale.setScalar(this.modo === 'dron' ? 1 : this.modo === 'auto' ? 1.6 : 0.42)

    // cámara de persecución con un poco de retraso; más ángulo con velocidad (sensación de rapidez)
    const rapidez = Math.abs(this.vel)
    const dist = c.dist + Math.min(4, rapidez * 0.08) * (this.modo === 'dron' ? 3 : 1)
    const deseo = new THREE.Vector3(this.x - fx * dist, yJ + c.alto, this.z - fz * dist)
    const k = 1 - Math.exp(-dt * (this.modo === 'auto' ? 6 : 5))
    this.camPos.lerp(deseo, k)
    const mira = new THREE.Vector3(this.x + fx * (this.modo === 'dron' ? 40 : 6), yJ + c.mira, this.z + fz * (this.modo === 'dron' ? 40 : 6))
    this.camMira.lerp(mira, Math.min(1, k * 1.6))
    if (this.intro) {
      // Entrada de cine: la cámara baja desde el cielo hasta ZUMI (como Google Earth)
      const k2 = Math.min(1, (performance.now() - this.intro.t0) / this.intro.dur)
      const e = 1 - Math.pow(1 - k2, 3)
      const alto = new THREE.Vector3(this.x - fx * 300, yJ + 1800, this.z - fz * 300)
      this.camara.position.lerpVectors(alto, deseo, e)
      const objetivo = new THREE.Vector3(this.x, yJ, this.z).lerp(mira, e)
      this.camara.lookAt(objetivo)
      this.camPos.copy(this.camara.position)
      this.camMira.copy(objetivo)
      if (k2 >= 1) this.intro = null
    } else {
      this.camara.position.copy(this.camPos)
      this.camara.lookAt(this.camMira)
    }
    const fov = c.fov + Math.min(16, rapidez * (this.modo === 'auto' ? 0.42 : 0.6))
    if (Math.abs(this.camara.fov - fov) > 0.05) {
      this.camara.fov += (fov - this.camara.fov) * 0.08
      this.camara.updateProjectionMatrix()
    }
    // cielo, sol y suelo siguen al jugador
    this.cielo.position.copy(this.camara.position)
    this.nubes.position.x = this.camara.position.x
    this.nubes.position.z = this.camara.position.z
    this.nubes.material.map.offset.x += dt * 0.0016
    this.nubes.material.map.offset.y += dt * 0.0006
    this.sol.position.set(this.x + this.solDir.x * 300, this.solDir.y * 300, this.z + this.solDir.z * 300)
    this.sol.target.position.set(this.x, 0, this.z)
    this.suelo.position.set(Math.round(this.x / 100) * 100, 0, Math.round(this.z / 100) * 100)
    this.faros.position.y = this.fotoVisible ? this.h0 : 0
    if (this.lluvia) {
      this.lluvia.position.set(this.camara.position.x, this.camara.position.y - 20, this.camara.position.z)
      const p = this.lluvia.geometry.attributes.position
      for (let i = 0; i < p.count; i += 2) {
        let y = p.getY(i) - dt * 22
        if (y < 0) y += 40
        p.setY(i, y)
        p.setY(i + 1, y - 0.9)
      }
      p.needsUpdate = true
    }
    for (const f of this.faros.children) if (f.userData.gira) f.rotation.z += dt * 0.8
    this.composer.render()

    // etiquetas
    const w = this.renderer.domElement.clientWidth
    const h = this.renderer.domElement.clientHeight
    const lejos = this.modo === 'dron' ? 2600 : 650
    const v = new THREE.Vector3()
    for (const p of this.pines) {
      p.v.y = p.base + (this.fotoVisible ? this.h0 : 0)
      const d = Math.hypot(p.v.x - this.x, p.v.z - this.z)
      v.copy(p.v).project(this.camara)
      const ver = v.z < 1 && d < lejos && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1
      p.el.style.display = ver ? '' : 'none'
      if (ver) p.el.style.transform = `translate(-50%,-100%) translate(${((v.x + 1) / 2) * w}px,${((1 - v.y) / 2) * h}px) scale(${Math.max(0.65, Math.min(1, 160 / d))})`
    }
  }

  remove() {
    this.vivo = false
    cancelAnimationFrame(this.raf)
    removeEventListener('resize', this.redimensionar)
    for (const t of this.teselas.values()) {
      t.ctl?.abort()
      t.obj?.liberar()
    }
    for (const w of this.hilos ?? []) w.terminate()
    this.foto?.liberar()
    this.composer?.dispose?.()
    this.renderer.dispose()
    this.renderer.domElement.remove()
    this.capaPines.remove()
  }
}
