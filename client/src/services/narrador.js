// ZUMI, el narrador de AlertaClima: arma un reporte hablado con los datos del momento y lo
// lee con la voz en español del teléfono (funciona incluso sin internet). Pensado para personas
// ciegas o con baja visión, y para quien prefiere escuchar en vez de leer.
//
// La voz se puede cambiar más adelante por una voz de personaje (por ejemplo, ElevenLabs)
// sin tocar el resto: basta con reemplazar `hablar`.
import { guardar, leer } from './almacen'
import { NIVELES, alertaPrincipal } from './alertas'
import { riesgoAluvion } from './aluvion'
import { faseLunar } from './cielo'
import { direccionViento } from './clima'

export const NOMBRE = 'ZUMI'

const sintesis = () => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null)
export const vozDisponible = () => Boolean(sintesis())

// Preferencias de la persona
export const nombrePreferido = () => leer('zumi:nombre', '')
export const guardarNombre = (n) => guardar('zumi:nombre', String(n ?? '').trim().slice(0, 30))
export const leerAlertasEnVoz = () => leer('zumi:alertas', true)
export const guardarLeerAlertas = (v) => guardar('zumi:alertas', Boolean(v))
export const modoNarrador = () => leer('zumi:modo', false) // lee el reporte solo al abrir la app
export const guardarModoNarrador = (v) => guardar('zumi:modo', Boolean(v))

/** Elige la mejor voz en español latino disponible en el dispositivo. */
export function elegirVoz() {
  const s = sintesis()
  if (!s) return null
  const voces = s.getVoices().filter((v) => /^es/i.test(v.lang))
  if (!voces.length) return null
  const puntaje = (v) => {
    const lang = v.lang.toLowerCase().replace('_', '-')
    let p = 0
    if (lang === 'es-419' || lang === 'es-mx' || lang === 'es-us' || lang === 'es-cl' || lang === 'es-co' || lang === 'es-ar') p += 10
    if (lang === 'es-es') p -= 5
    if (/google|natural|neural|premium|enhanced|mejorad/i.test(v.name)) p += 4
    if (/paulina|sabina|juan|diego|francisca|camila|soledad|valeria/i.test(v.name)) p += 2
    if (v.localService) p += 1
    return p
  }
  return voces.sort((a, b) => puntaje(b) - puntaje(a))[0]
}

/** Las voces se cargan de forma asíncrona en algunos navegadores. */
export function cuandoHayVoces() {
  const s = sintesis()
  if (!s) return Promise.resolve([])
  const v = s.getVoices()
  if (v.length) return Promise.resolve(v)
  return new Promise((ok) => {
    const t = setTimeout(() => ok(s.getVoices()), 1500)
    s.addEventListener?.('voiceschanged', () => {
      clearTimeout(t)
      ok(s.getVoices())
    }, { once: true })
  })
}

// Pronunciación: los números y símbolos se escriben como se dicen.
function paraVoz(texto) {
  return texto
    .replace(/(\d+),(\d+)\s*mm/g, '$1 coma $2 milímetros')
    .replace(/(\d+)\s*mm/g, '$1 milímetros')
    .replace(/(\d+)\s*km\/h/g, '$1 kilómetros por hora')
    .replace(/(-?\d+)°/g, '$1 grados')
    .replace(/(\d+)\s*%/g, '$1 por ciento')
    .replace(/(\d{1,2}):00/g, '$1 horas')
    .replace(/(\d{1,2}):(\d{2})/g, '$1 y $2')
    .replace(/SENAPRED/g, 'Senapred')
}

const oyentes = new Set()
let estado = { hablando: false, frase: -1, frases: [] }
const avisar = () => oyentes.forEach((f) => f(estado))
export function alCambiarNarrador(fn) {
  oyentes.add(fn)
  fn(estado)
  return () => oyentes.delete(fn)
}

/**
 * Lee las frases una por una (los navegadores cortan textos largos). Tono algo agudo y ritmo
 * pausado: amable, como un personaje animado.
 */
export async function hablar(frases) {
  const s = sintesis()
  if (!s) return false
  s.cancel()
  await cuandoHayVoces()
  const voz = elegirVoz()
  estado = { hablando: true, frase: 0, frases }
  avisar()
  for (let i = 0; i < frases.length; i++) {
    if (estado.frases !== frases) return false // se interrumpió
    estado = { ...estado, frase: i }
    avisar()
    await new Promise((ok) => {
      const u = new SpeechSynthesisUtterance(paraVoz(frases[i]))
      if (voz) u.voice = voz
      u.lang = voz?.lang ?? 'es-419'
      u.pitch = 1.35
      u.rate = 0.98
      u.onend = ok
      u.onerror = ok
      s.speak(u)
    })
  }
  if (estado.frases === frases) {
    estado = { hablando: false, frase: -1, frases }
    avisar()
  }
  return true
}

export function callar() {
  sintesis()?.cancel()
  estado = { hablando: false, frase: -1, frases: [] }
  avisar()
}

const saludoHora = () => {
  const h = new Date().getHours()
  return h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches'
}

/**
 * Reporte completo, en frases cortas y en orden de importancia: primero lo que puede
 * poner en riesgo a la persona, después el clima y al final algo amable.
 */
export function guionReporte({ nombre, comuna, ahora, horas, dias, alertas, reportes, sismos }) {
  const f = []
  const quien = nombre ? `, ${nombre}` : ''
  f.push(`¡${saludoHora()}${quien}! Soy ${NOMBRE}, y te cuento cómo está ${comuna?.nombre ?? 'tu comuna'}.`)

  const p = alertas?.alertas ? alertaPrincipal(alertas.alertas) : null
  if (p) {
    f.push(`Atención: hay ${NIVELES[p.nivel].etiqueta} por ${p.amenaza.toLowerCase()}.`)
    if (p.instrucciones) f.push(`${p.fuente_nombre ?? 'La autoridad'} indica: ${p.instrucciones}`)
  } else if (alertas?.tipo === 'ok') {
    f.push('No hay alertas oficiales en tu comuna.')
  }

  const s = sismos?.[0]
  if (s && s.magnitud >= 5 && Date.now() - s.hora < 6 * 3600e3) {
    f.push(`Hubo un sismo de magnitud ${s.magnitud.toLocaleString('es-CL', { maximumFractionDigits: 1 })} ${s.lugar ? `cerca de ${s.lugar}` : ''}.`)
  }

  if (ahora) {
    f.push(`Ahora hay ${Math.round(ahora.temperatura)}° y está ${ahora.texto.toLowerCase()}.`)
    if (Math.abs(ahora.sensacion - ahora.temperatura) >= 3) f.push(`Pero se siente como ${Math.round(ahora.sensacion)}°.`)
    if (ahora.viento >= 30) f.push(`Hay viento fuerte, de ${Math.round(ahora.viento)} km/h${ahora.direccion != null ? ` desde el ${direccionViento(ahora.direccion)}` : ''}.`)
  }

  const prox = horas?.slice(0, 12) ?? []
  const primera = prox.find((h) => h.lluvia >= 0.2)
  if (!prox.length);
  else if (!primera) f.push('No se espera lluvia en las próximas doce horas.')
  else {
    const total = prox.reduce((a, h) => a + h.lluvia, 0)
    const hh = primera.hora.getHours()
    f.push(`${primera === prox[0] ? 'Está lloviendo' : `Va a llover desde las ${hh}:00`}, y se esperan unos ${Math.round(total)} mm.`)
  }

  const r = riesgoAluvion(horas)
  if (r?.nivel === 'alto') f.push('El riesgo de aluviones y desbordes es alto. Aléjate de quebradas y cauces, y no cruces ríos.')
  else if (r?.nivel === 'atencion') f.push('Pon atención: hay riesgo de aluviones o desbordes. Revisa por dónde pasan las quebradas cerca de ti.')

  const hoy = dias?.[0]
  if (hoy) f.push(`Hoy la máxima será de ${Math.round(hoy.max)}° y la mínima de ${Math.round(hoy.min)}°.`)

  if (reportes?.length) f.push(`Tus vecinos hicieron ${reportes.length} ${reportes.length === 1 ? 'reporte' : 'reportes'} en la comuna. Puedes verlos en el mapa.`)

  const luna = faseLunar()
  if (!ahora?.esDeDia) f.push(`Y si miras al cielo, hoy hay ${luna.nombre.toLowerCase()}.`)

  const h = new Date().getHours()
  f.push(
    p || r?.nivel === 'alto'
      ? 'Cuídate mucho. Estoy aquí para avisarte si algo cambia.'
      : h >= 20 || h < 6
        ? '¡Que descanses! Aquí estaré si me necesitas.'
        : '¡Que tengas un lindo día! Aquí estaré si me necesitas.',
  )
  return f
}

/** Lectura de una alerta oficial, para el aviso a pantalla completa. */
export function guionAlerta(alerta, comuna, nombre) {
  const f = [`${nombre ? `${nombre}, ` : ''}soy ${NOMBRE} y tengo un aviso importante.`]
  f.push(`${NIVELES[alerta.nivel].etiqueta} por ${alerta.amenaza.toLowerCase()} en ${comuna?.nombre ?? 'tu comuna'}.`)
  if (alerta.titulo) f.push(alerta.titulo)
  if (alerta.instrucciones) f.push(alerta.instrucciones)
  f.push('Sigue las indicaciones de Senapred. Si estás en peligro, llama al 133.')
  return f
}
