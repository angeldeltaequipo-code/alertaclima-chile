// Mundo fotorrealista: la maqueta 3D de Google (Photorealistic 3D Tiles, la de Google Earth) servida
// por Cesium ion. Cada casa, árbol y calle está escaneada desde el aire. ZUMI camina sobre ella:
// la altura del suelo y los choques se calculan con rayos contra la maqueta.
import * as THREE from 'three'
import { TilesRenderer } from '3d-tiles-renderer'
import { CesiumIonAuthPlugin, GLTFExtensionsPlugin, TileCompressionPlugin, ReorientationPlugin, UnloadTilesPlugin } from '3d-tiles-renderer/plugins'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

const GOOGLE_3D = '2275207' // Google Photorealistic 3D Tiles en Cesium ion
const D2R = Math.PI / 180

export class Fotorreal {
  constructor({ escena, camara, renderer, token, lat, lng }) {
    this.camara = camara
    this.renderer = renderer
    const tiles = (this.tiles = new TilesRenderer())
    tiles.registerPlugin(new CesiumIonAuthPlugin({ apiToken: token, assetId: GOOGLE_3D, autoRefreshToken: true }))
    const draco = new DRACOLoader().setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/')
    tiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: draco }))
    tiles.registerPlugin(new TileCompressionPlugin())
    tiles.registerPlugin(new UnloadTilesPlugin())
    this.orientar = new ReorientationPlugin({ lat: lat * D2R, lon: lng * D2R, height: 0 })
    tiles.registerPlugin(this.orientar)
    const movil = matchMedia('(pointer: coarse)').matches
    tiles.errorTarget = movil ? 6 : 3
    tiles.lruCache.minSize = 600
    tiles.lruCache.maxSize = movil ? 900 : 1600
    tiles.setCamera(camara)
    tiles.setResolutionFromRenderer(camara, renderer)
    // La maqueta va dentro de un grupo que la gira para que el este sea +x y el norte -z (como el juego)
    this.raiz = new THREE.Group()
    this.raiz.add(tiles.group)
    escena.add(this.raiz)
    this.lat0 = lat
    this.lng0 = lng
    this.alineado = false
    this.rayo = new THREE.Raycaster()
    this.rayo.firstHitOnly = true
    this.cargando = true
    tiles.addEventListener('load-root-tileset', () => this.alinear())
    tiles.addEventListener('tiles-load-end', () => (this.cargando = false))
    // La maqueta ya trae la luz real del día (fotos): se muestra tal cual, sin re-iluminarla.
    // De noche se oscurece con un tinte azulado.
    this.tinte = new THREE.Color('#ffffff')
    this.materiales = new Set()
    tiles.addEventListener('load-model', ({ scene }) => {
      scene.traverse((o) => {
        if (!o.isMesh) return
        const viejo = o.material
        const m = new THREE.MeshBasicMaterial({ map: viejo.map ?? null, color: this.tinte, fog: true })
        if (m.map) m.map.colorSpace = THREE.SRGBColorSpace
        o.material = m
        this.materiales.add(m)
        viejo.dispose?.()
      })
    })
    tiles.addEventListener('dispose-model', ({ scene }) => scene.traverse((o) => o.isMesh && this.materiales.delete(o.material)))
  }

  /** Gira la maqueta para que coincida con el mapa del juego (este = +x, norte = -z). */
  alinear() {
    const t = this.tiles
    if (!t.ellipsoid) return
    t.group.updateMatrixWorld(true)
    const p = (lat, lng) => t.ellipsoid.getCartographicToPosition(lat * D2R, lng * D2R, 0, new THREE.Vector3()).applyMatrix4(t.group.matrixWorld)
    const o = p(this.lat0, this.lng0)
    const n = p(this.lat0 + 0.001, this.lng0).sub(o)
    // el norte del juego es -z: girar en Y para que n apunte a -z
    const ang = Math.atan2(n.x, -n.z)
    this.raiz.rotation.y = ang
    this.raiz.updateMatrixWorld(true)
    this.alineado = true
  }

  /** Noche: la ciudad real se oscurece (las fotos son de día). */
  setNoche(noche) {
    this.tinte.set(noche ? '#6a7aa0' : '#ffffff')
    for (const m of this.materiales) m.color.copy(this.tinte)
  }

  actualizar() {
    this.camara.updateMatrixWorld()
    this.tiles.setResolutionFromRenderer(this.camara, this.renderer)
    this.tiles.update()
  }

  /** Altura del suelo (o techo) bajo el punto x,z del juego; null si aún no hay maqueta ahí. */
  alturaEn(x, z, desde = 3000) {
    this.rayo.set(new THREE.Vector3(x, desde, z), new THREE.Vector3(0, -1, 0))
    this.rayo.far = desde + 500
    const h = this.rayo.intersectObject(this.tiles.group, true)[0]
    return h ? h.point.y : null
  }

  /** ¿Hay una pared delante (a la altura de la cintura)? */
  pared(x, y, z, dx, dz, dist = 1.4) {
    this.rayo.set(new THREE.Vector3(x, y + 0.9, z), new THREE.Vector3(dx, 0, dz).normalize())
    this.rayo.far = dist
    return this.rayo.intersectObject(this.tiles.group, true).length > 0
  }

  /** Créditos que exige Google (logo y fuentes de las imágenes), ya limpios para mostrar. */
  creditos() {
    let lista = []
    try {
      lista = this.tiles.getAttributions?.() ?? []
    } catch {
      /* sin créditos aún */
    }
    const frag = document.createDocumentFragment()
    for (const a of lista) {
      const doc = new DOMParser().parseFromString(String(a.value ?? ''), 'text/html')
      const limpiar = (n) => {
        for (const c of n.childNodes) {
          if (c.nodeType === 3) frag.append(c.textContent + ' ')
          else if (c.nodeName === 'IMG' && /^https:\/\//.test(c.getAttribute('src') ?? '')) {
            const img = document.createElement('img')
            img.src = c.getAttribute('src')
            img.alt = c.getAttribute('alt') ?? ''
            img.style.height = '14px'
            img.style.display = 'inline-block'
            img.style.verticalAlign = 'middle'
            frag.append(img, ' ')
          } else limpiar(c)
        }
      }
      if (a.type === 'html') limpiar(doc.body)
      else frag.append(String(a.value ?? '') + ' ')
    }
    return frag
  }

  liberar() {
    this.tiles.dispose()
    this.raiz.removeFromParent()
  }
}
