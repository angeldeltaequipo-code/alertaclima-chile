// Utilidades de dibujo compartidas por los gráficos del clima.

// Escala de color de temperatura (°C). Se usa solo en barras y curvas, nunca como color de texto,
// y siempre acompaña a una cifra escrita.
const ESCALA = [
  [-5, [123, 92, 214]],
  [0, [79, 127, 224]],
  [7, [51, 167, 216]],
  [13, [63, 191, 154]],
  [19, [242, 193, 78]],
  [25, [242, 140, 56]],
  [31, [226, 72, 61]],
  [38, [176, 36, 90]],
]

export function colorTemp(t) {
  if (t <= ESCALA[0][0]) return rgb(ESCALA[0][1])
  for (let i = 1; i < ESCALA.length; i++) {
    const [t1, c1] = ESCALA[i]
    if (t <= t1) {
      const [t0, c0] = ESCALA[i - 1]
      const k = (t - t0) / (t1 - t0)
      return rgb(c0.map((v, j) => Math.round(v + (c1[j] - v) * k)))
    }
  }
  return rgb(ESCALA[ESCALA.length - 1][1])
}
const rgb = ([r, g, b]) => `rgb(${r} ${g} ${b})`

/** Curva suave que pasa por todos los puntos (Catmull-Rom convertida a Bézier), sin pasarse de los extremos. */
export function curvaSuave(puntos) {
  if (puntos.length < 2) return ''
  let d = `M${puntos[0][0]},${puntos[0][1]}`
  for (let i = 0; i < puntos.length - 1; i++) {
    const p0 = puntos[i - 1] ?? puntos[i]
    const p1 = puntos[i]
    const p2 = puntos[i + 1]
    const p3 = puntos[i + 2] ?? p2
    const t = 0.18
    let c1y = p1[1] + (p2[1] - p0[1]) * t
    let c2y = p2[1] - (p3[1] - p1[1]) * t
    // Evita que la curva "rebase" entre dos puntos (no inventa temperaturas que no están).
    const lo = Math.min(p1[1], p2[1])
    const hi = Math.max(p1[1], p2[1])
    c1y = Math.min(hi, Math.max(lo, c1y))
    c2y = Math.min(hi, Math.max(lo, c2y))
    d += ` C${p1[0] + (p2[0] - p0[0]) * t},${c1y} ${p2[0] - (p3[0] - p1[0]) * t},${c2y} ${p2[0]},${p2[1]}`
  }
  return d
}

/** Color de una barra de lluvia según su intensidad (mm/h). */
export function colorLluvia(mm) {
  if (mm >= 10) return 'var(--lluvia-fuerte)'
  if (mm >= 2.5) return 'var(--lluvia)'
  return 'var(--lluvia-debil)'
}
