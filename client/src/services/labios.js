// Sincronía de labios de ZUMI: convierte el texto que se está diciendo en una secuencia de
// «visemas» (formas de la boca: a, e, i, o, m y reposo) y la va siguiendo en el tiempo.
//
// El navegador avisa cuando empieza cada palabra (evento `boundary` de la síntesis de voz): con eso
// se re-sincroniza la boca palabra por palabra. Entre palabras, la boca avanza a la velocidad
// estimada del habla. Si el navegador no da esos avisos, igual se mueve al ritmo estimado.

export const VISEMAS = ['reposo', 'm', 'e', 'a', 'i', 'o'] // formas de boca de ZUMI (zumi3d-bocas.webp trae m, e, a, i, o; «reposo» es la boca base)

const sinTildes = (c) => c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function visemaDe(c) {
  const l = sinTildes(c)
  if (l === 'a') return 'a'
  if (l === 'e') return 'e'
  if (l === 'i' || l === 'y') return 'i'
  if (l === 'o' || l === 'u') return 'o'
  if ('mbp'.includes(l)) return 'reposo' // labios juntos
  if (/[a-zñ0-9]/.test(l)) return 'm' // consonantes: boca entreabierta
  return null // espacios y signos: pausa
}

/** Duración relativa de cada carácter (las vocales se sostienen, las pausas cierran la boca). */
function peso(c) {
  if (/[.!?¡¿]/.test(c)) return 4
  if (/[,;:]/.test(c)) return 2.5
  if (c === ' ') return 0.6
  return /[aeiouáéíóú]/i.test(c) ? 1.25 : 0.85
}

const oyentes = new Set()
let actual = 'reposo'
const avisar = (v) => {
  if (v === actual) return
  actual = v
  oyentes.forEach((f) => f(v))
}
export function alCambiarBoca(fn) {
  oyentes.add(fn)
  fn(actual)
  return () => oyentes.delete(fn)
}

let seq = null // { texto, tiempos[], visemas[], inicio, total, ancla }
let raf = 0

/**
 * Empieza a mover la boca para `texto`. `duracionMs` es la estimación total; `cps` (caracteres por
 * segundo) se usa si no hay duración. Devuelve funciones para re-sincronizar y terminar.
 */
export function empezar(texto, { cps = 13.5, duracionMs = null, reloj = null, energia = null } = {}) {
  const chars = [...texto]
  const pesos = chars.map(peso)
  const total = pesos.reduce((a, b) => a + b, 0)
  // Con audio real (voz propia de ZUMI) se conoce la duración exacta y el reloj es el del audio.
  const msPorPeso = duracionMs ? (duracionMs * 0.94) / total : 1000 / cps / (total / chars.length)
  const tiempos = []
  let t = 0
  for (const p of pesos) {
    tiempos.push(t)
    t += p * msPorPeso
  }
  seq = { chars, tiempos, fin: t, inicio: performance.now(), desfase: 0, reloj, energia }
  cancelAnimationFrame(raf)
  const paso = () => {
    if (!seq) return
    const ahora = seq.reloj ? seq.reloj() : performance.now() - seq.inicio + seq.desfase
    if (ahora >= seq.fin) {
      avisar('reposo')
      raf = requestAnimationFrame(paso) // sigue vivo hasta `terminar` (la voz puede ir más lenta)
      return
    }
    // índice actual por búsqueda binaria
    let lo = 0
    let hi = seq.tiempos.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (seq.tiempos[mid] <= ahora) lo = mid
      else hi = mid - 1
    }
    const c = seq.chars[lo]
    const v = visemaDe(c)
    // Media vocal: al final de cada letra la boca se relaja un poco (se ve más natural).
    const dentro = (ahora - seq.tiempos[lo]) / ((seq.tiempos[lo + 1] ?? seq.fin) - seq.tiempos[lo])
    let forma = v == null ? 'reposo' : dentro > 0.82 && v !== 'm' ? 'm' : v
    // Energía real del audio: en silencio la boca se cierra; si suena suave, apenas se abre.
    if (seq.energia) {
      const e = seq.energia[Math.floor(ahora / 20)] ?? 0
      if (e < 0.1) forma = 'reposo'
      else if (e < 0.28 && (forma === 'a' || forma === 'o' || forma === 'e')) forma = 'm'
      else if (e > 0.6 && forma === 'm') forma = 'e'
    }
    avisar(forma)
    raf = requestAnimationFrame(paso)
  }
  raf = requestAnimationFrame(paso)
}

/** El navegador avisó que empieza la palabra en `indice`: se ajusta el reloj a ese punto. */
export function sincronizar(indice) {
  if (!seq || indice == null || indice >= seq.tiempos.length) return
  const esperado = seq.tiempos[indice]
  const ahora = performance.now() - seq.inicio + seq.desfase
  seq.desfase += esperado - ahora
}

export function terminar() {
  seq = null
  cancelAnimationFrame(raf)
  avisar('reposo')
}

export const _visemaDe = visemaDe
