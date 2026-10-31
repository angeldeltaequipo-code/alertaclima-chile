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
import * as labios from './labios'
import { elementoAudio, pedirFrase, vozPropiaDisponible } from './vozZumi'

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
export function paraVoz(texto) {
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
export const vozSilenciada = () => leer('zumi:silencio', false)
export const guardarVozSilenciada = (v) => guardar('zumi:silencio', Boolean(v))

// Películas de ZUMI: el escenario donde aparece (estudio, bienvenida) registra cómo reproducirlas.
// Una frase puede ser texto o { texto, pelicula }: ZUMI la «dice» actuando su película.
let reproductorPelicula = null
export function registrarPelicula(fn) {
  reproductorPelicula = fn
  return () => {
    if (reproductorPelicula === fn) reproductorPelicula = null
  }
}
let cortarPelicula = null
let detenerPelicula = null
/** El escenario avisa cómo detener la película si la persona interrumpe. */
export const alDetenerPelicula = (fn) => (detenerPelicula = fn)
const textoDe = (f) => (typeof f === 'string' ? f : (f?.texto ?? ''))

// Frase que está sonando con la voz propia (para poder cortarla)
let cortarAudio = null
function reproducirFrase(f, dicho) {
  const a = elementoAudio()
  return new Promise((ok) => {
    let listo = false
    const fin = () => {
      if (listo) return
      listo = true
      cortarAudio = null
      a.onended = a.onerror = null
      labios.terminar()
      ok()
    }
    cortarAudio = () => {
      a.pause()
      fin()
    }
    a.onended = fin
    a.onerror = fin
    a.src = f.url
    a.play()
      .then(() => labios.empezar(dicho, { duracionMs: f.ms ?? a.duration * 1000, reloj: () => a.currentTime * 1000, energia: f.env }))
      .catch(fin)
  })
}

export async function hablar(frases, { silencio = vozSilenciada() } = {}) {
  const s = silencio ? null : sintesis()
  sintesis()?.cancel()
  cortarAudio?.()
  estado = { hablando: true, frase: 0, frases }
  avisar()
  // Voz propia de ZUMI (servidor); si no está o falla, la voz del teléfono.
  const propia = !silencio && (await vozPropiaDisponible())
  if (s && !propia) await cuandoHayVoces()
  const voz = s && !propia ? elegirVoz() : null
  const pedidos = []
  const pedir = (i) => (pedidos[i] ??= i < frases.length && !frases[i]?.pelicula ? pedirFrase(paraVoz(textoDe(frases[i]))).catch(() => null) : Promise.resolve(null))
  for (let i = 0; i < frases.length; i++) {
    if (estado.frases !== frases) return false // se interrumpió
    estado = { ...estado, frase: i }
    avisar()
    // Película: ZUMI la actúa con su voz; si no se puede (sin escenario o sin sonido), la dice normal.
    if (frases[i]?.pelicula && reproductorPelicula) {
      pedir(i + 1)
      const hecho = await new Promise((ok) => {
        cortarPelicula = () => ok(true)
        reproductorPelicula(frases[i].pelicula, { silencio }).then(ok, () => ok(false))
      })
      cortarPelicula = null
      if (estado.frases !== frases) return false
      if (hecho) continue
      // No se pudo actuar: la dice con su voz de narrador
      if (propia) pedidos[i] = pedirFrase(paraVoz(textoDe(frases[i]))).catch(() => null)
    }
    if (propia) {
      pedir(i + 1) // la siguiente frase se va preparando mientras ZUMI habla
      const f = await pedir(i)
      if (estado.frases !== frases) return false
      if (f) {
        await reproducirFrase(f, paraVoz(textoDe(frases[i])))
        URL.revokeObjectURL(f.url)
        continue
      }
    }
    // Sin voz (silenciado o navegador sin lectura): avanza al ritmo de lectura de los subtítulos.
    if (!s) {
      const t = textoDe(frases[i])
      const ms = Math.max(2200, t.length * 62)
      labios.empezar(t, { cps: (t.length / ms) * 1000 * 0.92 })
      await new Promise((ok) => setTimeout(ok, ms))
      labios.terminar()
      continue
    }
    await new Promise((ok) => {
      const dicho = paraVoz(textoDe(frases[i]))
      const u = new SpeechSynthesisUtterance(dicho)
      // La boca de ZUMI sigue lo que dice: arranca con la voz y se ajusta en cada palabra.
      let partio = false
      u.onstart = () => {
        partio = true
        labios.empezar(dicho, { cps: 14.5 })
      }
      // Algunas voces no avisan el inicio: se arranca igual tras un instante.
      setTimeout(() => !partio && estado.frases === frases && labios.empezar(dicho, { cps: 14.5 }), 450)
      u.onboundary = (ev) => (ev.name === 'word' || ev.name == null) && labios.sincronizar(ev.charIndex)
      if (voz) u.voice = voz
      u.lang = voz?.lang ?? 'es-419'
      u.pitch = 1.35
      u.rate = 0.98
      u.onend = () => (labios.terminar(), ok())
      u.onerror = () => (labios.terminar(), ok())
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
  cortarAudio?.()
  cortarPelicula?.()
  detenerPelicula?.()
  labios.terminar()
  estado = { hablando: false, frase: -1, frases: [] }
  avisar()
}

/** «y está despejado» / «con lluvia moderada»: concuerda con el estado del cielo. */
export function comoEsta(texto) {
  const t = texto.toLowerCase()
  return /^(lluvia|llovizna|chubasco|tormenta|nieve|niebla|neblina|granizo)/.test(t) ? `con ${t}` : `y está ${t}`
}

const saludoHora = () => {
  const h = new Date().getHours()
  return h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches'
}

/**
 * Reporte completo como «escenas»: cada frase trae la tarjeta holográfica que se muestra mientras
 * ZUMI la dice y el clip del estudio que la acompaña. Orden de importancia: primero lo que puede
 * poner en riesgo a la persona, después el clima y al final algo amable.
 */
export function escenasReporte({ nombre, comuna, ahora, horas, dias, alertas, reportes, sismos }) {
  const f = []
  const di = (texto, tarjeta = null, clip = 'pronostico') => f.push({ texto, tarjeta, clip })
  const quien = nombre ? `, ${nombre}` : ''
  di(`¡${saludoHora()}${quien}! Soy ${NOMBRE}, y te cuento cómo está ${comuna?.nombre ?? 'tu comuna'}.`, { tipo: 'saludo', comuna: comuna?.nombre }, 'cerca')

  const p = alertas?.alertas ? alertaPrincipal(alertas.alertas) : null
  if (p) {
    di(`Atención: hay ${NIVELES[p.nivel].etiqueta} por ${p.amenaza.toLowerCase()}.`, { tipo: 'alerta', nivel: p.nivel, titulo: NIVELES[p.nivel].etiqueta, texto: p.amenaza }, 'alerta')
    if (p.instrucciones) di(`${p.fuente_nombre ?? 'La autoridad'} indica: ${p.instrucciones}`, { tipo: 'alerta', nivel: p.nivel, titulo: 'Qué hacer', texto: p.fuente_nombre ?? 'Autoridad' }, 'alerta')
  } else if (alertas?.tipo === 'ok') {
    di('No hay alertas oficiales en tu comuna.', { tipo: 'ok', texto: 'Sin alertas oficiales' }, 'estudio')
  }

  const s = sismos?.[0]
  if (s && s.magnitud >= 5 && Date.now() - s.hora < 6 * 3600e3) {
    di(`Hubo un sismo de magnitud ${s.magnitud.toLocaleString('es-CL', { maximumFractionDigits: 1 })} ${s.lugar ? (/^a \d/.test(s.lugar) ? s.lugar : `cerca de ${s.lugar}`) : ''}.`, { tipo: 'sismo', magnitud: s.magnitud, texto: s.lugar }, 'alerta')
  }

  if (ahora) {
    di(`Ahora hay ${Math.round(ahora.temperatura)}° ${comoEsta(ahora.texto)}.`, { tipo: 'temp', valor: Math.round(ahora.temperatura), texto: ahora.texto, icono: ahora.icono }, 'estudio')
    if (Math.abs(ahora.sensacion - ahora.temperatura) >= 3) di(`Pero se siente como ${Math.round(ahora.sensacion)}°.`, { tipo: 'temp', valor: Math.round(ahora.sensacion), texto: 'Sensación térmica', icono: ahora.icono }, 'estudio')
    if (ahora.viento >= 30)
      di(`Hay viento fuerte, de ${Math.round(ahora.viento)} km/h${ahora.direccion != null ? ` desde el ${direccionViento(ahora.direccion)}` : ''}.`, { tipo: 'viento', valor: Math.round(ahora.viento), grados: ahora.direccion }, 'pronostico')
  }

  const prox = horas?.slice(0, 12) ?? []
  const primera = prox.find((h) => h.lluvia >= 0.2)
  if (!prox.length);
  else if (!primera) di('No se espera lluvia en las próximas doce horas.', { tipo: 'lluvia', mm: 0, barras: prox.map((h) => h.lluvia) }, 'pronostico')
  else {
    const total = prox.reduce((a, h) => a + h.lluvia, 0)
    const hh = primera.hora.getHours()
    di(`${primera === prox[0] ? 'Está lloviendo' : `Va a llover desde las ${hh}:00`}, y se esperan unos ${Math.round(total)} mm.`, { tipo: 'lluvia', mm: total, barras: prox.map((h) => h.lluvia) }, 'pronostico')
  }

  const r = riesgoAluvion(horas)
  if (r?.nivel === 'alto') di('El riesgo de aluviones y desbordes es alto. Aléjate de quebradas y cauces, y no cruces ríos.', { tipo: 'aluvion', nivel: 'alto' }, 'alerta')
  else if (r?.nivel === 'atencion') di('Pon atención: hay riesgo de aluviones o desbordes. Revisa por dónde pasan las quebradas cerca de ti.', { tipo: 'aluvion', nivel: 'atencion' }, 'alerta')

  const hoy = dias?.[0]
  if (hoy) di(`Hoy la máxima será de ${Math.round(hoy.max)}° y la mínima de ${Math.round(hoy.min)}°.`, { tipo: 'minmax', max: Math.round(hoy.max), min: Math.round(hoy.min) }, 'pronostico')

  if (reportes?.length) di(`Tus vecinos hicieron ${reportes.length} ${reportes.length === 1 ? 'reporte' : 'reportes'} en la comuna. Puedes verlos en el mapa.`, { tipo: 'vecinos', n: reportes.length }, 'estudio')

  const luna = faseLunar()
  if (ahora && !ahora.esDeDia) di(`Y si miras al cielo, hoy hay ${luna.nombre.toLowerCase()}.`, { tipo: 'luna', texto: luna.nombre, fraccion: luna.iluminacion }, 'cerca')

  const h = new Date().getHours()
  di(
    p || r?.nivel === 'alto'
      ? 'Cuídate mucho. Estoy aquí para avisarte si algo cambia.'
      : h >= 20 || h < 6
        ? '¡Que descanses! Aquí estaré si me necesitas.'
        : '¡Que tengas un lindo día! Aquí estaré si me necesitas.',
    null,
    'cerca',
  )
  return f
}

/** El mismo reporte, solo el texto de cada frase. */
export const guionReporte = (datos) => escenasReporte(datos).map((e) => e.texto)

/**
 * Traje de ZUMI según el momento (como un personaje que se cambia de ropa):
 * alerta → casco de emergencia, lluvia → paraguas, frío → gorro y bufanda, sol fuerte → lentes,
 * noche despejada → casco de astronauta, y si no, audífonos de presentador.
 */
export function elegirTraje({ ahora, alertas, hoy, vista } = {}) {
  const p = alertas?.alertas ? alertaPrincipal(alertas.alertas) : null
  if (p || vista === 'riesgos') return 'casco'
  if (!ahora) return 'presentador'
  if (['lluvia', 'lluvia-fuerte', 'llovizna', 'tormenta'].includes(ahora.icono)) return 'paraguas'
  if (ahora.temperatura <= 8) return 'gorro'
  if (!ahora.esDeDia && ['despejado', 'parcial'].includes(ahora.icono)) return 'astronauta'
  if (ahora.esDeDia && (ahora.temperatura >= 24 || (ahora.uv ?? hoy?.uv ?? 0) >= 7) && ['despejado', 'parcial'].includes(ahora.icono)) return 'lentes'
  return 'presentador'
}

export const TRAJES = {
  presentador: 'Presentador',
  paraguas: 'Para la lluvia',
  gorro: 'Para el frío',
  lentes: 'Para el sol',
  astronauta: 'Astronauta',
  casco: 'Emergencias',
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
