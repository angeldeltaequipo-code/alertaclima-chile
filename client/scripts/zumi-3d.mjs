// Arma el modelo 3D de ZUMI para la app a partir de los GLB que genera Higgsfield (Meshy):
// - Toma el modelo base (con esqueleto y la animación de reposo) y le suma las animaciones de los
//   otros GLB (hablar, saludo, celebrar), uniendo cada pista con el hueso del mismo nombre.
// - Reduce las texturas a 1024 px en WebP y comprime la malla y las animaciones (meshopt) para que
//   el archivo pese poco en el teléfono.
//
// Uso: node scripts/zumi-3d.mjs salida.glb base.glb reposo hablar.glb hablar saludo.glb saludo …
//      (después de base.glb, pares «archivo nombre»; el primer nombre es el de la animación del base)
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, prune, resample, textureCompress, weld, meshopt, quantize } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import sharp from 'sharp'

const [salida, baseRuta, nombreBase, ...resto] = process.argv.slice(2)
if (!salida || !baseRuta) {
  console.error('Uso: node scripts/zumi-3d.mjs salida.glb base.glb reposo [otro.glb nombre]…')
  process.exit(1)
}
await MeshoptDecoder.ready
await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder })

const doc = await io.read(baseRuta)
const raiz = doc.getRoot()
const buffer = raiz.listBuffers()[0]
const nodoPorNombre = new Map(raiz.listNodes().map((n) => [n.getName(), n]))
raiz.listAnimations().forEach((a, i) => a.setName(i === 0 ? nombreBase || 'reposo' : `${nombreBase}_${i}`))

for (let i = 0; i < resto.length; i += 2) {
  const otro = await io.read(resto[i])
  const nombre = resto[i + 1]
  const anim = otro.getRoot().listAnimations()[0]
  if (!anim) {
    console.warn(`Sin animación en ${resto[i]}`)
    continue
  }
  const nueva = doc.createAnimation(nombre)
  let unidas = 0
  for (const canal of anim.listChannels()) {
    const destino = nodoPorNombre.get(canal.getTargetNode()?.getName())
    if (!destino) continue
    const s = canal.getSampler()
    const copiar = (acc) => doc.createAccessor().setType(acc.getType()).setArray(acc.getArray().slice()).setBuffer(buffer)
    const muestra = doc.createAnimationSampler().setInput(copiar(s.getInput())).setOutput(copiar(s.getOutput())).setInterpolation(s.getInterpolation())
    nueva.addSampler(muestra).addChannel(doc.createAnimationChannel().setTargetNode(destino).setTargetPath(canal.getTargetPath()).setSampler(muestra))
    unidas++
  }
  console.log(`${nombre}: ${unidas} pistas unidas`)
}

await doc.transform(
  dedup(),
  weld(),
  resample(),
  prune(),
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024], quality: 82 }),
  quantize(),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
)
await io.write(salida, doc)
console.log('Animaciones:', doc.getRoot().listAnimations().map((a) => a.getName()).join(', '))
