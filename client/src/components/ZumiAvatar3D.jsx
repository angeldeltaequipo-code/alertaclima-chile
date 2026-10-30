// ZUMI en 3D de verdad: modelo con esqueleto y animaciones (creado con Higgsfield a partir del
// diseño del personaje), dibujado en tiempo real con three.js.
//
// Capas de movimiento:
// 1. Animaciones del modelo: reposo (respira y se mece), hablar (gesticula con las manos),
//    saludo y celebrar (una vez), con transiciones suaves entre ellas.
// 2. Encima, movimiento procedural: la cabeza mira hacia tu dedo o hacia donde inclinas el
//    teléfono, asiente sílaba por sílaba mientras habla (labios.js), ladea la cabeza cuando piensa
//    y se acerca un poco cuando te escucha.
// 3. Luz de estudio con borde de color: azul/naranjo normal, rojo cuando hay alerta.
//
// Si el teléfono no puede (sin WebGL, poca memoria o falla la carga), avisa con onFalla y quien lo
// usa muestra a ZUMI en 2D.
import { useEffect, useRef, useState } from 'react'
import { alCambiarBoca } from '../services/labios'

const BASE = import.meta.env.BASE_URL
export const URL_MODELO = `${BASE}zumi/zumi3d.glb`
const ENERGIA = { reposo: 0, m: 0.35, e: 0.7, a: 1, i: 0.55, o: 0.85 }
const LUZ_BORDE = { normal: 0x7fb4ff, alerta: 0xff3b3b }
// Rasgos de la cara en proporción a la altura del personaje (medidos en el diseño frontal):
// boca [x, alto, ancho, alto de la pieza], ojo [separación, alto, tamaño], color del pelaje.
const CARA = { boca: [0, 0.711, 0.07, 0.05], ojo: [0.076, 0.8, 0.078], piel: '#a8502a' }

/** ¿Vale la pena intentar el 3D en este equipo? */
export function puede3D() {
  try {
    if (typeof window === 'undefined') return false
    if (navigator.deviceMemory && navigator.deviceMemory < 2) return false
    const c = document.createElement('canvas')
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

const suave = (a, b, k) => a + (b - a) * k

export default function ZumiAvatar3D({ alto = 360, estado = 'reposo', gesto = null, luz = 'normal', encuadre = 'cuerpo', onFalla, onListo, className = '' }) {
  const caja = useRef(null)
  const vivo = useRef({ estado, gesto: null, luz, boca: 0 })
  const [listo, setListo] = useState(false)
  const ancho = Math.round(alto * (encuadre === 'busto' ? 1 : 1.05))

  useEffect(() => {
    vivo.current.estado = estado
  }, [estado])
  useEffect(() => {
    vivo.current.luz = luz
  }, [luz])
  useEffect(() => {
    if (gesto) vivo.current.gesto = gesto
  }, [gesto])
  useEffect(() => alCambiarBoca((v) => (vivo.current.boca = ENERGIA[v] ?? 0)), [])

  useEffect(() => {
    let cancelado = false
    let limpiar = () => {}
    ;(async () => {
      try {
        const [THREE, { GLTFLoader }, { MeshoptDecoder }, { RoomEnvironment }] = await Promise.all([
          import('three'),
          import('three/examples/jsm/loaders/GLTFLoader.js'),
          import('three/examples/jsm/libs/meshopt_decoder.module.js'),
          import('three/examples/jsm/environments/RoomEnvironment.js'),
        ])
        if (cancelado) return
        const el = caja.current
        const W = el.clientWidth
        const H = el.clientHeight
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
        renderer.setSize(W, H)
        renderer.outputColorSpace = THREE.SRGBColorSpace
        renderer.toneMapping = THREE.ACESFilmicToneMapping
        renderer.toneMappingExposure = 1.05
        renderer.domElement.setAttribute('aria-hidden', 'true')
        renderer.domElement.style.cssText = 'width:100%;height:100%;display:block'
        el.appendChild(renderer.domElement)

        const escena = new THREE.Scene()
        const pmrem = new THREE.PMREMGenerator(renderer)
        const ambiente = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
        escena.environment = ambiente
        escena.environmentIntensity = 0.55

        escena.add(new THREE.HemisphereLight(0xfff1e0, 0x2a3550, 0.9))
        const clave = new THREE.DirectionalLight(0xfff0dd, 2.2)
        clave.position.set(1.2, 2.2, 2.4)
        escena.add(clave)
        const borde = new THREE.DirectionalLight(LUZ_BORDE.normal, 2.4)
        borde.position.set(-1.8, 1.6, -1.6)
        escena.add(borde)
        const relleno = new THREE.DirectionalLight(0xffb37a, 0.7)
        relleno.position.set(2, 0.6, -1.2)
        escena.add(relleno)

        const camara = new THREE.PerspectiveCamera(26, W / H, 0.05, 50)

        const cargador = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
        const gltf = await cargador.loadAsync(URL_MODELO)
        if (cancelado) {
          renderer.dispose()
          return
        }
        const modelo = gltf.scene
        modelo.traverse((o) => {
          if (o.isMesh) {
            o.frustumCulled = false
            if (o.material) o.material.envMapIntensity = 0.8
          }
        })
        escena.add(modelo)

        // Encuadre: todo el cuerpo o del pecho hacia arriba.
        const bb = new THREE.Box3().setFromObject(modelo)
        const tam = bb.getSize(new THREE.Vector3())
        modelo.position.x -= (bb.min.x + bb.max.x) / 2
        modelo.position.z -= (bb.min.z + bb.max.z) / 2
        modelo.position.y -= bb.min.y
        // Centrar en la cadera (la caja incluye la cola, que corre al personaje hacia un lado).
        modelo.updateMatrixWorld(true)
        const cadera = modelo.getObjectByName('Hips')
        if (cadera) modelo.position.x -= cadera.getWorldPosition(new THREE.Vector3()).x
        const altoVisto = encuadre === 'busto' ? tam.y * 0.66 : tam.y * 1.16
        const centroY = encuadre === 'busto' ? tam.y * 0.7 : tam.y * 0.53
        const dist = altoVisto / 2 / Math.tan(THREE.MathUtils.degToRad(camara.fov / 2))
        camara.position.set(0, centroY + tam.y * 0.03, dist)
        camara.lookAt(0, centroY, 0)

        // Sombra suave en el piso (un disco con degradado, liviano).
        const lz = document.createElement('canvas')
        lz.width = lz.height = 128
        const g = lz.getContext('2d')
        const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64)
        gr.addColorStop(0, 'rgba(0,0,0,0.45)')
        gr.addColorStop(1, 'rgba(0,0,0,0)')
        g.fillStyle = gr
        g.fillRect(0, 0, 128, 128)
        const sombra = new THREE.Mesh(new THREE.PlaneGeometry(tam.x * 1.3, tam.x * 0.7), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(lz), transparent: true, depthWrite: false }))
        sombra.rotation.x = -Math.PI / 2
        sombra.position.y = 0.002
        escena.add(sombra)

        // Animaciones del modelo
        const mixer = new THREE.AnimationMixer(modelo)
        const clip = (re) => gltf.animations.find((a) => re.test(a.name))
        const acciones = {}
        for (const [k, re] of [
          ['reposo', /reposo|idle/i],
          ['hablar', /hablar|talk/i],
          ['saludo', /saludo|wave/i],
          ['celebrar', /celebrar|happy|jump/i],
        ]) {
          const c = clip(re)
          if (c) acciones[k] = mixer.clipAction(c)
        }
        if (!acciones.reposo && gltf.animations[0]) acciones.reposo = mixer.clipAction(gltf.animations[0])
        for (const k of ['saludo', 'celebrar']) {
          if (acciones[k]) {
            acciones[k].setLoop(THREE.LoopOnce, 1)
            acciones[k].clampWhenFinished = false
          }
        }
        let base = acciones.reposo
        base?.play()
        let unaVez = null
        const cambiarBase = (nueva) => {
          if (!nueva || nueva === base) return
          nueva.reset().setEffectiveWeight(1).play()
          if (!unaVez) base?.crossFadeTo(nueva, 0.45, false)
          else base?.stop()
          base = nueva
        }
        mixer.addEventListener('finished', (ev) => {
          if (ev.action !== unaVez) return
          base.reset().play()
          unaVez.crossFadeTo(base, 0.4, false)
          unaVez = null
        })
        const hacerGesto = (k) => {
          const a = acciones[k]
          if (!a || unaVez) return
          a.reset().setEffectiveWeight(1).play()
          base.crossFadeTo(a, 0.3, false)
          unaVez = a
        }

        // Huesos para el movimiento procedural (nombres típicos de los esqueletos automáticos).
        let cabeza = null
        let cuello = null
        let pecho = null
        modelo.traverse((o) => {
          if (!o.isBone) return
          const n = o.name.toLowerCase()
          if (!cabeza && n === 'head') cabeza = o
          else if (!cuello && n === 'neck') cuello = o
          else if (!pecho && (n === 'spine' || n === 'chest')) pecho = o
        })

        // Cara viva: boca que se abre con cada sílaba y párpados que parpadean. Son piezas pequeñas
        // pegadas a la cabeza (el modelo no trae boca ni párpados móviles). Se ubican lanzando un
        // rayo contra la cara en la pose de descanso, en las proporciones del diseño de ZUMI.
        modelo.updateMatrixWorld(true)
        const rayo = new THREE.Raycaster()
        const enCara = (fx, fy) => {
          rayo.set(new THREE.Vector3(fx * tam.y, fy * tam.y, tam.z * 4 + 1), new THREE.Vector3(0, 0, -1))
          return rayo.intersectObject(modelo, true).find((h) => h.object.isMesh && h.object !== sombra)?.point ?? null
        }
        const textura = (dibujar, w = 128, h = 96) => {
          const c = document.createElement('canvas')
          c.width = w
          c.height = h
          dibujar(c.getContext('2d'), w, h)
          const t = new THREE.CanvasTexture(c)
          t.colorSpace = THREE.SRGBColorSpace
          return t
        }
        const alturaZ = tam.y
        let boca = null
        const parpados = []
        if (cabeza) {
          const pBoca = enCara(0, CARA.boca[1])
          if (pBoca) {
            const tex = textura((g, w, h) => {
              g.fillStyle = '#3b0f0c'
              g.beginPath()
              g.ellipse(w / 2, h / 2, w / 2 - 2, h / 2 - 2, 0, 0, Math.PI * 2)
              g.fill()
              g.fillStyle = '#d9686f'
              g.beginPath()
              g.ellipse(w / 2, h * 0.86, w * 0.3, h * 0.26, 0, 0, Math.PI * 2)
              g.fill()
            })
            boca = new THREE.Mesh(new THREE.PlaneGeometry(alturaZ * CARA.boca[2], alturaZ * CARA.boca[3]), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }))
            boca.position.copy(pBoca).add(new THREE.Vector3(0, -alturaZ * CARA.boca[3] * 0.25, alturaZ * 0.006))
            boca.renderOrder = 2
            escena.add(boca)
            cabeza.attach(boca)
            boca.userData.esc = boca.scale.clone()
            boca.visible = false
          }
          for (const lado of [-1, 1]) {
            const pOjo = enCara(lado * CARA.ojo[0], CARA.ojo[1])
            if (!pOjo) continue
            const tex = textura((g, w, h) => {
              g.fillStyle = CARA.piel
              g.beginPath()
              g.ellipse(w / 2, h / 2, w / 2 - 1, h / 2 - 1, 0, 0, Math.PI * 2)
              g.fill()
              g.strokeStyle = '#2a120c'
              g.lineWidth = 6
              g.beginPath()
              g.ellipse(w / 2, h * 0.35, w / 2 - 6, h * 0.55, 0, Math.PI * 0.15, Math.PI * 0.85)
              g.stroke()
            }, 96, 96)
            // Encima de todo (el ojo sobresale de la cara), sin tono de cámara para calzar con el pelaje.
            const par = new THREE.Mesh(new THREE.PlaneGeometry(alturaZ * CARA.ojo[2], alturaZ * CARA.ojo[2]), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, toneMapped: false }))
            par.position.copy(pOjo).add(new THREE.Vector3(0, -alturaZ * 0.022, alturaZ * 0.004))
            par.renderOrder = 2
            escena.add(par)
            cabeza.attach(par)
            par.userData.esc = par.scale.clone()
            par.visible = false
            parpados.push(par)
          }
        }
        let proximoParpadeo = 1.5
        let parpadeo = -1

        // Posición de descanso de esos huesos: se restaura cada cuadro antes de la animación, para
        // que el movimiento procedural no se acumule si un clip no mueve ese hueso.
        const huesos = [cabeza, cuello, pecho].filter(Boolean).map((h) => [h, h.quaternion.clone()])

        // Hacia dónde mira: dedo, mouse o inclinación del teléfono.
        const mira = { x: 0, y: 0, hasta: 0 }
        const alPuntero = (e) => {
          const r = el.getBoundingClientRect()
          mira.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2))
          mira.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.35) * 2))
          mira.hasta = performance.now() + 2500
        }
        const alInclinar = (e) => {
          if (e.gamma == null) return
          mira.x = Math.max(-1, Math.min(1, e.gamma / 30))
          mira.y = Math.max(-1, Math.min(1, ((e.beta ?? 45) - 45) / 40))
          mira.hasta = performance.now() + 1500
        }
        window.addEventListener('pointermove', alPuntero, { passive: true })
        window.addEventListener('pointerdown', alPuntero, { passive: true })
        window.addEventListener('deviceorientation', alInclinar, { passive: true })

        const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        const reloj = new THREE.Clock()
        const p = { yaw: 0, pitch: 0, ladeo: 0, nod: 0, borde: new THREE.Color(LUZ_BORDE.normal) }
        let quadro = 0
        let visible = true
        const io = new IntersectionObserver(([en]) => (visible = en.isIntersecting))
        io.observe(el)

        const cuadro = () => {
          quadro = requestAnimationFrame(cuadro)
          if (!visible || document.hidden) return
          const dt = Math.min(reloj.getDelta(), 0.1)
          const t = reloj.elapsedTime
          const v = vivo.current

          if (v.gesto) {
            hacerGesto(v.gesto)
            v.gesto = null
          }
          for (const [h, q] of huesos) h.quaternion.copy(q)
          cambiarBase(v.estado === 'hablando' && acciones.hablar ? acciones.hablar : acciones.reposo)
          mixer.update(reducido ? dt * 0.5 : dt)

          // Capa procedural encima de la animación
          const libre = performance.now() > mira.hasta
          const objYaw = libre ? Math.sin(t * 0.35) * 0.12 : mira.x * 0.45
          const objPitch = libre ? Math.sin(t * 0.5) * 0.04 : mira.y * 0.22
          const objLadeo = v.estado === 'pensando' ? 0.22 + Math.sin(t * 1.3) * 0.04 : v.estado === 'escuchando' ? -0.1 : 0
          p.yaw = suave(p.yaw, objYaw, 1 - Math.exp(-dt * 5))
          p.pitch = suave(p.pitch, objPitch, 1 - Math.exp(-dt * 5))
          p.ladeo = suave(p.ladeo, objLadeo, 1 - Math.exp(-dt * 4))
          p.nod = suave(p.nod, v.estado === 'hablando' ? v.boca : 0, 1 - Math.exp(-dt * 18))
          if (cabeza) {
            cabeza.rotation.y += p.yaw * 0.6
            cabeza.rotation.x += p.pitch * 0.6 + p.nod * 0.09
            cabeza.rotation.z += p.ladeo
          }
          if (cuello) {
            cuello.rotation.y += p.yaw * 0.4
            cuello.rotation.x += p.pitch * 0.4
          }
          if (pecho && v.estado === 'escuchando') pecho.rotation.x += 0.08

          // Boca: se abre con la energía de la sílaba (a, o más abiertas; m casi cerrada).
          if (boca) {
            const abre = v.estado === 'hablando' ? p.nod : 0
            boca.visible = abre > 0.06
            boca.scale.set(boca.userData.esc.x * (0.75 + abre * 0.25), boca.userData.esc.y * (0.15 + abre * 0.85), 1)
          }
          // Parpadeo cada 2 a 5 segundos (doble de vez en cuando).
          if (parpados.length) {
            if (parpadeo < 0 && t > proximoParpadeo) parpadeo = 0
            let cierre = 0
            if (parpadeo >= 0) {
              parpadeo += dt
              cierre = parpadeo < 0.07 ? parpadeo / 0.07 : parpadeo < 0.15 ? 1 - (parpadeo - 0.07) / 0.08 : 0
              if (parpadeo >= 0.15) {
                parpadeo = -1
                proximoParpadeo = t + (Math.random() < 0.2 ? 0.25 : 2 + Math.random() * 3)
              }
            }
            if (v.cierre != null) cierre = v.cierre // para pruebas
            for (const par of parpados) {
              par.visible = cierre > 0.02
              par.scale.set(par.userData.esc.x, par.userData.esc.y * Math.max(cierre, 0.02), 1)
            }
          }

          p.borde.lerp(new THREE.Color(LUZ_BORDE[v.luz] ?? LUZ_BORDE.normal), 1 - Math.exp(-dt * 3))
          borde.color.copy(p.borde)
          borde.intensity = v.luz === 'alerta' ? 5 + Math.sin(t * 4) * 1.5 : 2.4
          renderer.render(escena, camara)
        }
        cuadro()
        el.zumi = vivo.current // acceso para pruebas automáticas
        setListo(true)
        onListo?.()

        const alCambiarTam = () => {
          const w = el.clientWidth
          const h = el.clientHeight
          if (!w || !h) return
          renderer.setSize(w, h)
          camara.aspect = w / h
          camara.updateProjectionMatrix()
        }
        const ro = new ResizeObserver(alCambiarTam)
        ro.observe(el)

        limpiar = () => {
          cancelAnimationFrame(quadro)
          io.disconnect()
          ro.disconnect()
          window.removeEventListener('pointermove', alPuntero)
          window.removeEventListener('pointerdown', alPuntero)
          window.removeEventListener('deviceorientation', alInclinar)
          mixer.stopAllAction()
          modelo.traverse((o) => {
            if (o.isMesh) {
              o.geometry?.dispose()
              for (const m of [].concat(o.material ?? [])) {
                for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap']) m[k]?.dispose()
                m.dispose()
              }
            }
          })
          ambiente.dispose()
          pmrem.dispose()
          renderer.dispose()
          renderer.domElement.remove()
        }
      } catch (err) {
        console.warn('ZUMI 3D no disponible:', err?.message ?? err)
        if (!cancelado) onFalla?.(err)
      }
    })()
    return () => {
      cancelado = true
      limpiar()
    }
    // El modelo se arma una sola vez; estado, gesto y luz llegan por la referencia «vivo».
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encuadre])

  return (
    <div
      ref={caja}
      className={`zumi-3d relative ${listo ? 'listo' : ''} ${className}`}
      style={{ width: ancho, height: alto }}
      aria-hidden="true"
    />
  )
}
