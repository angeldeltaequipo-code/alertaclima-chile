// La memoria de ZUMI: lo que la persona le ha contado (su nombre, con quién vive, su mascota, a qué se
// dedica, qué le gusta, si el frío le afecta…), los temas que le preocupan y cuándo se vieron por última
// vez. Vive SOLO en este teléfono (no se sube a ningún servidor salvo, en resumen, dentro de cada
// pregunta a ZUMI), se puede ver y borrar en Ajustes → «Lo que ZUMI recuerda de ti».
//
// Con esto ZUMI se retroalimenta: saluda distinto si vuelves después de días, retoma lo que te
// preocupaba ayer y responde pensando en ti («como tu perrita Luna le teme a los truenos…»).

const CLAVE = 'ac:zumi:memoria'
const MAX_HECHOS = 40
const MAX_TEMAS = 30
const DIA = 86400e3

const vacia = () => ({ hechos: [], temas: [], visitas: { primera: null, ultima: null, anterior: null, racha: 0, total: 0 }, charlas: 0 })

export function leerMemoria() {
  try {
    const m = JSON.parse(localStorage.getItem(CLAVE) ?? 'null')
    if (m && Array.isArray(m.hechos)) return { ...vacia(), ...m, visitas: { ...vacia().visitas, ...m.visitas } }
  } catch {
    /* sin almacenamiento: memoria vacía */
  }
  return vacia()
}

function guardar(m) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(m))
  } catch {
    /* lleno o bloqueado: ZUMI olvida, pero sigue funcionando */
  }
  window.dispatchEvent(new CustomEvent('ac:zumi-memoria'))
  return m
}

const normal = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim()

// Nada que no deba guardarse: datos de contacto, documentos, claves, direcciones exactas.
const PROHIBIDO = /\b(rut|run|clave|contrase|password|tarjeta|cuenta corriente|banco|@|\d{6,}|calle .+ \d+|depto|departamento \d)/i

/** Agrega hechos nuevos (texto breve). Reemplaza uno parecido si ya existía. Devuelve los agregados. */
export function recordar(hechos, origen = 'charla') {
  const m = leerMemoria()
  const nuevos = []
  for (const h of hechos ?? []) {
    const texto = String(h ?? '').replace(/\s+/g, ' ').trim().replace(/\.$/, '').slice(0, 140)
    if (texto.length < 4 || PROHIBIDO.test(texto)) continue
    const n = normal(texto)
    const clave = n.split(' ').slice(0, 3).join(' ')
    const i = m.hechos.findIndex((x) => normal(x.texto) === n || (clave.length > 8 && normal(x.texto).startsWith(clave)))
    const item = { texto, fecha: Date.now(), origen }
    if (i >= 0) m.hechos[i] = item
    else m.hechos.push(item)
    nuevos.push(texto)
  }
  if (!nuevos.length) return []
  m.hechos = m.hechos.slice(-MAX_HECHOS)
  guardar(m)
  return nuevos
}

export function olvidar(indice) {
  const m = leerMemoria()
  m.hechos.splice(indice, 1)
  guardar(m)
}

export function olvidarTodo() {
  guardar(vacia())
}

// Temas de las preguntas: para retomar lo que le preocupaba («¿al final llovió en tu paseo?»).
const TEMAS = [
  ['lluvia', /llov|lluvia|llueve|paraguas|chubasco|temporal/],
  ['frío', /frio|helad|abrig|escarcha/],
  ['calor', /calor|caluroso|ola de calor|uv|bloqueador/],
  ['sismos', /sismo|temblor|terremoto|tsunami/],
  ['alertas', /alerta|evacu|senapred|emergencia/],
  ['viento', /viento|rafaga/],
  ['incendios', /incendio|humo|fuego/],
  ['fin de semana', /fin de semana|sabado|domingo|paseo|viaje|vacacion/],
]

export function anotarPregunta(pregunta) {
  const n = normal(pregunta)
  const tema = TEMAS.find(([, re]) => re.test(n))?.[0]
  const m = leerMemoria()
  m.charlas = (m.charlas ?? 0) + 1
  if (tema) {
    m.temas.push({ tema, texto: String(pregunta).slice(0, 120), fecha: Date.now() })
    m.temas = m.temas.slice(-MAX_TEMAS)
  }
  // Lo que se aprende sin IA, de frases claras («me llamo…», «tengo un perro…», «trabajo en…»)
  const aprendido = aprenderSolo(pregunta)
  guardar(m)
  if (aprendido.length) recordar(aprendido, 'dicho')
}

const may = (t) => t.charAt(0).toUpperCase() + t.slice(1)
export function aprenderSolo(frase) {
  const t = String(frase ?? '').trim()
  const out = []
  let r
  if ((r = t.match(/\bme llamo ([a-záéíóúñ]{2,20})/i)) || (r = t.match(/\bmi nombre es ([a-záéíóúñ]{2,20})/i))) out.push(`Se llama ${may(r[1])}`)
  if ((r = t.match(/\btengo (un|una|dos|tres) (perr[oa]s?|gat[oa]s?|mascotas?|hij[oa]s?|nietos?|nietas?)( que se llaman? ([a-záéíóúñ]+))?/i)))
    out.push(`Tiene ${r[1]} ${r[2]}${r[4] ? ` (${may(r[4])})` : ''}`)
  if ((r = t.match(/\btrabajo (en|de|como) ([^.,;!?]{3,40})/i))) out.push(`Trabaja ${r[1]} ${r[2]}`)
  if ((r = t.match(/\bme (encanta|gusta|gustan|encantan) ([^.,;!?]{3,40})/i))) out.push(`Le ${r[1]} ${r[2]}`)
  if ((r = t.match(/\b(odio|no me gusta|me da miedo|me asusta|le temo a) ([^.,;!?]{3,40})/i))) out.push(`${may(r[1])} ${r[2]}`.replace(/^Odio/, 'No le gusta').replace(/^Me da miedo/, 'Le da miedo').replace(/^Me asusta/, 'Le asusta').replace(/^No me gusta/, 'No le gusta').replace(/^Le temo a/, 'Le teme a'))
  if ((r = t.match(/\b(salgo a|voy a) (correr|trotar|pedalear|andar en bici|caminar|pescar|surfear|esquiar)/i))) out.push(`Le gusta ${r[2]}`)
  if (/\b(soy|tengo) asm[aá]tic|tengo asma\b/i.test(t)) out.push('El aire y el humo le afectan (asma)')
  return out
}

/** Marca la visita de hoy. Devuelve cuántos días pasaron desde la anterior y la racha de días seguidos. */
export function registrarVisita(ahora = Date.now()) {
  const m = leerMemoria()
  const v = m.visitas
  const hoy = new Date(ahora).toDateString()
  if (v.ultima && new Date(v.ultima).toDateString() === hoy) return { ...v, dias: 0, nueva: false }
  const dias = v.ultima ? Math.round((new Date(hoy) - new Date(new Date(v.ultima).toDateString())) / DIA) : null
  v.anterior = v.ultima
  v.ultima = ahora
  v.primera ??= ahora
  v.total = (v.total ?? 0) + 1
  v.racha = dias === 1 ? (v.racha ?? 0) + 1 : 1
  guardar(m)
  return { ...v, dias, nueva: true }
}

/** Resumen compacto para la IA (máx. ~900 caracteres): lo que sabe de la persona y lo que le preocupa. */
export function resumenParaIA(ahora = Date.now()) {
  const m = leerMemoria()
  const partes = []
  if (m.hechos.length) partes.push(`Lo que sabes de la persona: ${m.hechos.slice(-15).map((h) => h.texto).join('; ')}.`)
  const recientes = m.temas.filter((x) => ahora - x.fecha < 7 * DIA).slice(-4)
  if (recientes.length) partes.push(`Hace poco te preguntó: ${recientes.map((x) => `«${x.texto}» (${haceCuanto(x.fecha, ahora)})`).join('; ')}.`)
  if (m.visitas.racha > 2) partes.push(`Lleva ${m.visitas.racha} días seguidos visitándote.`)
  if (m.charlas > 0) partes.push(`Han conversado ${m.charlas} veces.`)
  return partes.join(' ').slice(0, 900)
}

function haceCuanto(t, ahora) {
  const d = Math.round((new Date(new Date(ahora).toDateString()) - new Date(new Date(t).toDateString())) / DIA)
  return d <= 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`
}

/** Una frase de reencuentro para el saludo, o null. Usa la memoria (sin IA). */
export function fraseDeReencuentro(visita, { nombre } = {}, ahora = Date.now()) {
  const m = leerMemoria()
  const quien = nombre ? `, ${nombre}` : ''
  const tema = [...m.temas].reverse().find((x) => ahora - x.fecha < 4 * DIA && ahora - x.fecha > 3 * 3600e3)
  if (tema) {
    const cuando = haceCuanto(tema.fecha, ahora)
    const de = { lluvia: 'la lluvia', frío: 'el frío', calor: 'el calor', sismos: 'los temblores', alertas: 'las alertas', viento: 'el viento', incendios: 'los incendios', 'fin de semana': 'tus planes del fin de semana' }[tema.tema]
    if (de) return `${cuando === 'ayer' ? 'Ayer' : may(cuando)} me preguntaste por ${de}. Ya lo revisé por ti${quien}.`
  }
  if (visita?.dias >= 3) return `¡Te extrañé${quien}! Pasaron ${visita.dias} días. Te cuento cómo viene todo.`
  if (visita?.racha >= 3) return `¡${visita.racha} días seguidos juntos${quien}! Me encanta verte.`
  const mascota = m.hechos.find((h) => /perr|gat|mascota/i.test(h.texto))
  if (mascota && Math.random() < 0.35) return `¿Cómo está tu mascota${quien}? Hoy te digo si es buen día para pasear.`
  return null
}
