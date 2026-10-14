// Riesgo de aluviones y desbordes, estimado con el pronóstico de las próximas 24 horas.
//
// Es una orientación de AlertaClima, NO una alerta oficial (esas las emite SENAPRED con la DMC y
// SERNAGEOMIN). Se basa en tres señales conocidas de los aluviones en Chile:
// 1. Lluvia acumulada: mucha agua en pocas horas satura el suelo de cerros y quebradas.
// 2. Intensidad: chubascos fuertes (sobre ~7–10 mm en una hora) arrastran barro y piedras.
// 3. Isoterma 0 °C alta: si la altura a la que el agua se congela supera los 2.500–3.000 m,
//    en la cordillera llueve en vez de nevar y toda esa agua baja de una vez por las quebradas
//    (así ocurrieron los aluviones de la Quebrada de Macul en 1993 o del Cajón del Maipo).

const UMBRALES = {
  alto: { lluvia24: 50, intensidad: 15, lluviaConIsoterma: 25, isoterma: 3000 },
  atencion: { lluvia24: 20, intensidad: 7, lluviaConIsoterma: 8, isoterma: 2500 },
}

/** Resume las próximas 24 horas: lluvia total, hora más intensa e isoterma mientras llueve. */
export function factores(horas) {
  const prox = horas.slice(0, 24)
  const lluvia24 = prox.reduce((s, h) => s + (h.lluvia ?? 0), 0)
  const masIntensa = prox.reduce((a, b) => ((b.lluvia ?? 0) > (a?.lluvia ?? 0) ? b : a), null)
  const conLluvia = prox.filter((h) => (h.lluvia ?? 0) >= 0.5 && h.isoterma != null)
  const isoterma = conLluvia.length ? Math.max(...conLluvia.map((h) => h.isoterma)) : null
  const primera = prox.find((h) => (h.lluvia ?? 0) >= 1)
  return {
    lluvia24: Math.round(lluvia24 * 10) / 10,
    intensidad: masIntensa?.lluvia ?? 0,
    horaIntensa: masIntensa?.lluvia > 0 ? masIntensa.hora : null,
    isoterma: isoterma != null ? Math.round(isoterma / 50) * 50 : null,
    desde: primera?.hora ?? null,
  }
}

/** 'alto' | 'atencion' | 'bajo', con los motivos en palabras. */
export function riesgoAluvion(horas) {
  if (!horas?.length) return null
  const f = factores(horas)
  const motivos = []
  let nivel = 'bajo'
  for (const n of ['alto', 'atencion']) {
    const u = UMBRALES[n]
    const m = []
    if (f.lluvia24 >= u.lluvia24) m.push('mucha lluvia acumulada')
    if (f.intensidad >= u.intensidad) m.push('chubascos intensos')
    if (f.lluvia24 >= u.lluviaConIsoterma && f.isoterma != null && f.isoterma >= u.isoterma) m.push('lluvia en la cordillera (isoterma alta)')
    if (m.length) {
      nivel = n
      motivos.push(...m)
      break
    }
  }
  return { nivel, motivos, ...f }
}

export const NIVEL_ALUVION = {
  bajo: { etiqueta: 'Bajo', color: 'var(--ok)', texto: '#ffffff' },
  atencion: { etiqueta: 'Atención', color: '#ffc93c', texto: '#0e1a24' },
  alto: { etiqueta: 'Alto', color: '#d92d20', texto: '#ffffff' },
}
