import { leerGrupo, ultimaFamilia, distanciaKm, haceCuanto } from './familiaGPS'
import { anotarPregunta, aprenderSolo, leerMemoria, recordar, resumenParaIA } from './zumiMemoria'
// El «cerebro» de ZUMI para conversar.
// 1. Si el servidor tiene IA activa (Claude) y la persona tiene cuenta, ZUMI responde con IA
//    usando solo los datos de la comuna que se le entregan aquí.
// 2. Si no (sin cuenta, sin internet o sin IA), responde con sus propias reglas: entiende las
//    preguntas más comunes sobre lluvia, temperatura, ropa, alertas, sismos, viento, sol y luna.
import { API_URL } from './reportes'
import { cabeceraSesion } from './sesion'
import { NIVELES, alertaPrincipal } from './alertas'
import { describir, direccionViento } from './clima'
import { faseLunar } from './cielo'
import { riesgoAluvion } from './aluvion'

const sinTildes = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const g = (n) => `${Math.round(n)} grados`
const mm = (n) => (n < 1 ? 'menos de un milímetro' : `${Math.round(n)} ${Math.round(n) === 1 ? 'milímetro' : 'milímetros'}`)
const hora = (d) => `${d.getHours()}:00`
const azar = (l) => l[Math.floor(Math.random() * l.length)]

/** Datos compactos de la comuna para la IA (sin datos personales). */
export function armarContexto({ comuna, ahora, horas, dias, alertas, sismos, reportes, comunidad }) {
  const p = alertas?.alertas ? alertaPrincipal(alertas.alertas) : null
  return {
    comuna: comuna?.nombre,
    region: comuna?.region,
    fechaHora: new Date().toLocaleString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
    ahora: ahora && {
      temperatura: Math.round(ahora.temperatura),
      sensacion: Math.round(ahora.sensacion),
      estado: ahora.texto,
      humedad: ahora.humedad,
      vientoKmh: Math.round(ahora.viento ?? 0),
      rafagasKmh: Math.round(ahora.rafagas ?? 0),
      uv: ahora.uv,
      esDeDia: ahora.esDeDia,
    },
    proximasHoras: (horas ?? []).slice(0, 12).map((h) => ({ hora: hora(h.hora), temp: Math.round(h.temperatura), lluviaMm: Math.round(h.lluvia * 10) / 10, prob: h.probabilidad })),
    dias: (dias ?? []).slice(0, 5).map((d) => ({
      dia: d.fecha.toLocaleDateString('es-CL', { weekday: 'long' }),
      estado: describir(d.codigo).texto,
      max: Math.round(d.max),
      min: Math.round(d.min),
      lluviaMm: Math.round(d.lluvia),
      prob: d.probabilidad,
      uv: d.uv,
    })),
    alertaOficial: p ? { nivel: NIVELES[p.nivel].etiqueta, amenaza: p.amenaza, instrucciones: p.instrucciones ?? null } : alertas?.tipo === 'ok' ? 'ninguna' : 'desconocido',
    riesgoAluvion: riesgoAluvion(horas)?.nivel ?? null,
    sismosRecientes: (sismos ?? []).slice(0, 3).map((s) => ({ magnitud: s.magnitud, lugar: s.lugar, haceHoras: Math.round((Date.now() - s.hora) / 3600e3) })),
    reportesVecinos: reportes?.length ?? 0,
    luna: faseLunar().nombre,
    ...(comunidad ? { loQueSeComenta: comunidad } : {}),
  }
}

let iaDisponible = null
export async function hayIA() {
  if (iaDisponible != null) return iaDisponible
  try {
    const r = await fetch(`${API_URL}/api/zumi/config`)
    iaDisponible = r.ok ? Boolean((await r.json()).ia) : false
  } catch {
    iaDisponible = false
  }
  return iaDisponible
}

/** Pregunta a ZUMI. Devuelve { texto, fuente: 'ia' | 'zumi' }. Nunca lanza: si la IA falla, responde ZUMI solo. */
/** ¿Es una pregunta directa del clima que ZUMI sabe contestar solo, al instante y sin internet? */
export function esPreguntaRapida(pregunta) {
  const t = sinTildes(String(pregunta ?? ''))
  if (t.length > 90 || aprenderSolo(pregunta).length) return false
  if (QUIERE.emergencia.test(t) || QUIERE.saludo.test(t) || QUIERE.gracias.test(t) || QUIERE.memoria.test(t) || QUIERE.familia.test(t)) return true
  return ['lluvia', 'temperatura', 'ropa', 'alerta', 'sismo', 'viento', 'sol', 'luna'].some((k) => QUIERE[k].test(t)) && !/por que|como funciona|explica|historia|que es (el|la|un|una)/.test(t)
}

// La memoria de ZUMI (miles de preguntas): se carga aparte, en segundo plano, y queda lista.
let saber = null
export const cargarSaber = () => (saber ??= import('./saber/index.js').catch(() => (saber = null)))
let memoria = null
// se precarga cuando la app ya está tranquila
if (typeof window !== 'undefined') setTimeout(() => cargarSaber()?.then?.((m) => (memoria = m)), 5000)

/** ¿Pregunta por el clima de ahora o de los próximos días en su comuna? (eso se responde con datos en vivo) */
function esClimaEnVivo(pregunta) {
  const t = sinTildes(String(pregunta ?? ''))
  if (t.length > 90) return false
  return ['lluvia', 'temperatura', 'ropa', 'alerta', 'sismo', 'viento', 'sol', 'luna'].some((k) => QUIERE[k].test(t)) && !/por que|como funciona|explica|historia|que es (el|la|un|una)|que significa|que hago|como (me )?protej|consejo/.test(t)
}

/** Agrega la memoria verificada al contexto sin pasarse del límite que acepta el servidor (9.000 caracteres). */
function conSaber(ctx, saber) {
  const s = saber.map((x) => ({ pregunta: x.pregunta, respuesta: x.respuesta.slice(0, 420) }))
  while (s.length && JSON.stringify({ ...ctx, saber: s }).length > 8800) s.pop()
  return s.length ? { ...ctx, saber: s } : ctx
}

/** Pregunta a ZUMI. Si la persona además cuenta que tiene miedo o está preocupada, ZUMI lo acoge antes del dato. */
export async function preguntarZumi(pregunta, datos, historial = [], opciones = {}) {
  const r = await preguntarZumiBase(pregunta, datos, historial, opciones)
  if (r?.fuente === 'zumi' && sentimientoDe(pregunta) && PIDE_ALGO.test(pregunta) && !/^uy, te entiendo/i.test(r.texto)) {
    return { ...r, texto: `Tranquilo, te entiendo. ${r.texto}` }
  }
  return r
}
const PIDE_ALGO = /qu[eé] hago|qu[eé] hacer|c[oó]mo|d[oó]nde|cu[aá]ndo|tiembl|sismo|terremoto|tsunami|evacu|llov|alerta|incendio|volc[aá]n|\?/i

async function preguntarZumiBase(pregunta, datos, historial = [], { conCuenta = false } = {}) {
  import('./metricas').then((m) => m.evento('pregunta')).catch(() => {})
  anotarPregunta(pregunta) // ZUMI recuerda el tema y aprende de frases claras («me llamo…», «tengo un perro…»)
  const S = (memoria ??= await cargarSaber())
  // 0. Si la persona cuenta cómo se siente, ZUMI responde primero a eso (como un amigo), no a una palabra suelta.
  const sentir = sentimientoDe(pregunta)
  if (sentir && !PIDE_ALGO.test(pregunta)) {
    const otra = S?.comunaPedida(pregunta)
    let dato = ''
    if (otra) {
      try {
        dato = ' ' + (await S.climaDeComuna(otra, '¿cómo está el clima?'))
      } catch {
        /* sin red */
      }
    }
    const quien = sentir.quien ? `por ${sentir.quien}` : ''
    const texto = otra
      ? `Uy, te entiendo… es normal preocuparse ${quien}.${dato} Si la agregas a Mi familia, te aviso al tiro si hay cualquier alerta en ${otra.nombre}. ¿Quieres que lo hagamos?`
      : `Uy, te entiendo… ${quien ? `es normal preocuparse ${quien}.` : 'aquí estoy contigo.'} Cuéntame un poquito más: ¿te preocupa un temblor, la lluvia o alguna alerta?`
    return { texto: texto.replace(/\s+/g, ' ').trim(), fuente: 'zumi', rapida: true }
  }
  // 1. El clima de cualquier otra comuna de Chile, al momento.
  const otra = S?.comunaPedida(pregunta)
  if (otra && otra.cut !== datos.comuna?.cut) {
    try {
      return { texto: await S.climaDeComuna(otra, pregunta), fuente: 'zumi', rapida: true }
    } catch {
      /* sin red: sigue */
    }
  }
  // 2. Lo de su memoria, con calibración: responde si está seguro, pregunta si duda.
  const m = S?.decidir(pregunta, { ...datos, nombre: datos.nombre }) ?? { tipo: 'nada' }
  const segura = m.tipo === 'responder' && m.puntaje >= 0.75 && m.tema !== 'clima'
  // 3. El clima de ahora en su comuna, con datos en vivo.
  if (esClimaEnVivo(pregunta) && !segura) return { texto: responderSinIA(pregunta, datos), fuente: 'zumi', rapida: true }
  if (m.tipo === 'responder') return { texto: m.texto, fuente: 'zumi', rapida: true }
  if (esPreguntaRapida(pregunta)) return { texto: responderSinIA(pregunta, datos), fuente: 'zumi', rapida: true }
  if (conCuenta && navigator.onLine && (await hayIA())) {
    try {
      const r = await fetch(`${API_URL}/api/zumi/preguntar`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...cabeceraSesion() },
        // la IA recibe además las respuestas verificadas de la memoria de ZUMI más parecidas (base para no inventar)
        body: JSON.stringify({ pregunta, contexto: conSaber(armarContexto(datos), S?.candidatos(pregunta, 3) ?? []), historial, memoria: resumenParaIA() }),
        signal: AbortSignal.timeout(22000),
      })
      if (r.ok) {
        const d = await r.json()
        const aprendio = recordar(d.recuerdos, 'zumi')
        return { texto: d.respuesta, fuente: 'ia', aprendio }
      }
      if (r.status === 429) {
        const d = await r.json()
        // Llegó al límite diario del plan gratis: ZUMI lo dice y luego se muestra el plan Familia.
        if (d.motivo === 'limite-plan') setTimeout(() => window.dispatchEvent(new CustomEvent('ac:abrir-planes', { detail: 'zumi' })), 4500)
        return { texto: d.error, fuente: 'zumi' }
      }
    } catch {
      /* sin red o lento: responde ZUMI solo */
    }
  }
  // 4. Algo parecido en su memoria (o pedir que lo diga de otra forma), o sus propias reglas; nunca «no sé».
  if (m.tipo === 'quizas' || m.tipo === 'aclarar') return { texto: m.texto, fuente: 'zumi' }
  return { texto: responderSinIA(pregunta, datos), fuente: 'zumi' }
}

// Lo que siente la persona («estoy preocupado por mi mamá…»), para responder con cariño antes que con datos
const SENTIMIENTOS = /(^|[^a-záéíóúñ])(preocupad[oa]s?|me preocupa|miedo|asustad[oa]|susto|nervios[oa]?|angusti|triste|ansios|intranquil|inquiet)/i
const PERSONAS = [['mi mam[aá]', 'tu mamá'], ['mi pap[aá]', 'tu papá'], ['mis? hij[oa]s?', 'tu familia'], ['mi abuel[oa]', 'tu abuelita'], ['mi herman[oa]', 'tu hermano'], ['mi pareja|mi señora|mi esposa?|mi marido|mi pololo|mi polola', 'tu pareja'], ['mi familia', 'tu familia']]
export function sentimientoDe(texto) {
  const t = String(texto ?? '')
  if (!SENTIMIENTOS.test(t)) return null
  const p = PERSONAS.find(([re]) => new RegExp(`(^|[^a-záéíóúñ])(${re})(?![a-záéíóúñ])`, 'i').test(t))
  return { quien: p ? p[1] : null }
}

// ---- Respuestas propias (sin IA) ----

const QUIERE = {
  emergencia: /emergencia|ayuda|auxilio|atrapad|herid|incendio|me ahogo|peligro|socorro|sos\b/,
  saludo: /^(hola|holi|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hey|wena|que tal)\b/,
  familia: /donde (esta|estan|anda|andan)( mi| mis| la| el)? ?(hij|mama|papa|abuel|herman|pareja|esposa|esposo|familia|polol|nieto|nieta)/,
  memoria: /te acuerdas de mi|que sabes de mi|me recuerdas|que recuerdas|sabes quien soy/,
  quien: /quien eres|como te llamas|que eres|eres (un|una)|tu nombre/,
  gracias: /gracias|te quiero|eres (lo mejor|genial|bacan)|buena zumi/,
  chiste: /chiste|algo gracioso|hazme reir/,
  ropa: /ropa|me pongo|abrig|chaqueta|parka|vestir|polera|paraguas|bloqueador|lentes/,
  lluvia: /llov|lluvia|llueve|precipit|agua cae|chubasco|aguacero|temporal/,
  temperatura: /temperatura|grados|frio|calor|helad|caluroso|maxima|minima/,
  alerta: /alerta|senapred|alarma|evacu/,
  sismo: /sismo|temblor|terremoto|tembl|tiembla|tsunami|maremoto/,
  viento: /viento|rafaga|ventolera/,
  sol: /\buv\b|sol\b|rayos|quemar|soleado|despejado/,
  luna: /luna|estrella|cielo|planeta|noche estrellada/,
  aluvion: /aluvion|desborde|rio|quebrada|inund/,
  manana: /manana|pasado manana|fin de semana|semana|lunes|martes|miercoles|jueves|viernes|sabado|domingo/,
}

function diaPedido(t, dias) {
  if (!dias?.length) return null
  if (/pasado manana/.test(t)) return { d: dias[2], nombre: 'pasado mañana' }
  if (/manana/.test(t)) return { d: dias[1], nombre: 'mañana' }
  const nombres = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
  for (let i = 1; i < dias.length; i++) {
    const n = nombres[dias[i].fecha.getDay()]
    if (t.includes(n)) return { d: dias[i], nombre: `el ${dias[i].fecha.toLocaleDateString('es-CL', { weekday: 'long' })}` }
  }
  return null
}

export function responderSinIA(pregunta, { nombre, comuna, ahora, horas, dias, alertas, sismos, comunidad }) {
  const t = sinTildes(pregunta)
  const lugar = comuna?.nombre ?? 'tu comuna'
  const tu = nombre ? `${nombre}, ` : ''
  const hoy = dias?.[0]
  const prox = horas?.slice(0, 12) ?? []
  const p = alertas?.alertas ? alertaPrincipal(alertas.alertas) : null
  const dia = diaPedido(t, dias)

  if (QUIERE.emergencia.test(t))
    return `${tu}si estás en peligro, llama ahora al 133 de Carabineros, al 132 de Bomberos o al 131 del SAMU. También puedes tocar el botón rojo SOS para enviar tu ubicación a tu familia.`
  if (QUIERE.familia.test(t)) {
    if (!leerGrupo()) return 'Todavía no tienes tu GPS familiar. Abre «Mi familia» bajo mí, crea tu familia en 10 segundos e invita a los tuyos: así te digo dónde está cada uno, con su clima y si hay alertas ahí.'
    const l = ultimaFamilia()
    const yo = l.find((m) => m.yo)
    const otros = l.filter((m) => !m.yo)
    if (!otros.length) return 'Aún no veo a nadie de tu familia. Invítalos desde «Mi familia»: cuando acepten en su teléfono, te digo dónde están.'
    return otros
      .slice(0, 4)
      .map((m) => `${m.nombre} (${m.rol.toLowerCase()})${yo ? ` está a ${distanciaKm(yo, m) < 1 ? `${Math.round(distanciaKm(yo, m) * 1000)} metros` : `${distanciaKm(yo, m).toFixed(1).replace('.', ',')} kilómetros`} de ti` : ' compartió su ubicación'}, ${haceCuanto(m.t)}${m.bateria != null && m.bateria <= 20 ? `, y le queda poca batería (${m.bateria} %)` : ''}.`)
      .join(' ') + ' Te lo muestro en «Mi familia».'
  }
  if (QUIERE.memoria.test(t)) {
    const h = leerMemoria().hechos.slice(-4).map((x) => x.texto.charAt(0).toLowerCase() + x.texto.slice(1))
    return h.length
      ? `¡Claro que me acuerdo${nombre ? `, ${nombre}` : ''}! Sé que ${h.join(', que ').replace(/^se llama/, 'te llamas')}. Si quieres que olvide algo, entra a Ajustes.`
      : '¡Todavía te estoy conociendo! Cuéntame de ti: cómo te llamas, si tienes mascota o qué te gusta hacer, y lo voy a recordar.'
  }
  const aprendido = aprenderSolo(pregunta)
  if (aprendido.length && pregunta.length < 90 && !QUIERE.lluvia.test(t) && !QUIERE.temperatura.test(t))
    return `¡Anotado${nombre ? `, ${nombre}` : ''}! Lo voy a recordar para cuidarte mejor. ¿Quieres que te cuente cómo viene el clima?`
  if (QUIERE.quien.test(t)) return `¡Soy ZUMI, un panda rojo que vive en su estudio del clima! Te cuento cómo está ${lugar}, te aviso de las alertas y te acompaño cuando el tiempo se pone feo.`
  if (QUIERE.gracias.test(t)) return azar([`¡Gracias a ti${nombre ? `, ${nombre}` : ''}! Me alegra mucho acompañarte.`, '¡Ay, me hiciste mover la cola de felicidad! Aquí estoy cuando me necesites.'])
  if (QUIERE.chiste.test(t))
    return azar([
      '¿Qué le dijo una nube a otra nube? ¡Qué cara de lluvia tienes hoy!',
      '¿Sabes por qué el sol no fue a la universidad? Porque ya tenía miles de grados.',
      '¿Qué hace un panda rojo cuando llueve? ¡Se pone más rojo de la vergüenza por andar mojado!',
    ])

  if (QUIERE.alerta.test(t)) {
    if (p) return `Sí, hay ${NIVELES[p.nivel].etiqueta} por ${p.amenaza.toLowerCase()} en ${lugar}. ${p.instrucciones ? `La indicación es: ${p.instrucciones}` : 'Sigue las indicaciones de SENAPRED.'}`
    if (alertas?.tipo === 'ok') return `Ahora no hay alertas oficiales en ${lugar}. Si eso cambia, te aviso altiro.`
    return 'No pude revisar las alertas oficiales en este momento. Puedes confirmarlas en senapred.cl.'
  }

  if (/(que se (dice|comenta)|noticias|redes|reddit|twitter|que esta pasando|que paso|comunidad)/.test(t)) {
    const tit = comunidad?.titulares ?? []
    if (!tit.length) return 'Ahora no encuentro noticias ni comentarios de emergencias en Chile. Lo oficial siempre está en senapred.cl.'
    const pico = comunidad.picos?.[0]
    return `${pico ? `Ojo: hay muchas personas comentando. ${pico}. ` : ''}Lo más reciente que se comenta es: ${tit[0].replace(/^\[[^\]]*\]\s*/, '')}. Recuerda que esto no es oficial: confírmalo en SENAPRED.`
  }

  if (QUIERE.sismo.test(t)) {
    const s = sismos?.[0]
    if (!s) return 'No tengo sismos recientes registrados. Puedes revisar la pestaña Riesgos.'
    const horasAtras = Math.round((Date.now() - s.hora) / 3600e3)
    return `El último sismo que registré fue de magnitud ${String(s.magnitud).replace('.', ',')}${s.lugar ? `, ${s.lugar}` : ''}, hace ${horasAtras < 1 ? 'menos de una hora' : `${horasAtras} ${horasAtras === 1 ? 'hora' : 'horas'}`}. Si tiembla fuerte: agáchate, cúbrete y afírmate.`
  }

  if (QUIERE.aluvion.test(t)) {
    const r = riesgoAluvion(horas)
    if (r?.nivel === 'alto') return 'El riesgo de aluviones y desbordes es alto. Aléjate de quebradas y ríos, y no los cruces aunque parezcan bajos.'
    if (r?.nivel === 'atencion') return 'Hay que poner atención: podría haber crecidas en quebradas y ríos. Revisa los ríos cercanos en el mapa.'
    return 'Por ahora el riesgo de aluviones es bajo. En el mapa puedes ver los ríos cercanos.'
  }

  if (QUIERE.ropa.test(t)) {
    const ref = dia?.d ?? hoy
    if (!ref && !ahora) return 'Todavía no tengo el pronóstico cargado. Dame un segundo y pregúntame otra vez.'
    const min = ref?.min ?? ahora.temperatura
    const llueve = dia ? (ref.lluvia ?? 0) >= 1 : prox.some((h) => h.lluvia >= 0.5)
    const partes = []
    if (min <= 8) partes.push('abrígate bien, con parka y algo para el cuello')
    else if (min <= 14) partes.push('lleva una chaqueta')
    else partes.push('anda liviano')
    if (llueve) partes.push('no olvides el paraguas')
    if ((ref?.uv ?? ahora?.uv ?? 0) >= 6) partes.push('ponte bloqueador y lentes de sol')
    const frase = `${dia ? `para ${dia.nombre}` : 'hoy'} ${partes.join(', ')}`
    return `${tu ? tu + frase : frase[0].toUpperCase() + frase.slice(1)}. ${ref ? `La mínima será de ${g(ref.min)} y la máxima de ${g(ref.max)}.` : ''}`.trim()
  }

  if (QUIERE.lluvia.test(t)) {
    if (dia) {
      const { d, nombre: n } = dia
      return d.lluvia >= 1
        ? `Sí, ${n} se esperan unos ${mm(d.lluvia)} en ${lugar}${d.probabilidad != null ? `, con ${d.probabilidad} por ciento de probabilidad` : ''}.`
        : `${n[0].toUpperCase()}${n.slice(1)} no se espera lluvia importante en ${lugar}${d.probabilidad ? `; la probabilidad es de ${d.probabilidad} por ciento` : ''}.`
    }
    const primera = prox.find((h) => h.lluvia >= 0.2)
    if (!prox.length) return 'Todavía no tengo el pronóstico cargado.'
    if (!primera) return `No se espera lluvia en ${lugar} en las próximas doce horas. ${hoy && hoy.lluvia >= 1 ? '' : '¡Puedes dejar el paraguas en casa!'}`.trim()
    const total = prox.reduce((a, h) => a + h.lluvia, 0)
    return primera === prox[0] ? `Sí, está lloviendo, y en las próximas horas caerían unos ${mm(total)}.` : `Va a llover desde las ${hora(primera.hora)}, unos ${mm(total)} en total. Lleva paraguas.`
  }

  if (QUIERE.viento.test(t)) {
    if (!ahora) return 'Todavía no tengo los datos del viento.'
    return `Ahora el viento sopla a ${Math.round(ahora.viento)} kilómetros por hora${ahora.direccion != null ? ` desde el ${direccionViento(ahora.direccion)}` : ''}${ahora.rafagas >= 50 ? `, con ráfagas de hasta ${Math.round(ahora.rafagas)}. Cuidado con objetos sueltos` : ''}.`
  }

  if (QUIERE.sol.test(t)) {
    const uv = ahora?.uv ?? hoy?.uv
    if (uv == null) return 'No tengo el índice UV ahora.'
    if (uv >= 8) return `El índice UV está muy alto, en ${Math.round(uv)}. Usa bloqueador, gorro y lentes, y busca sombra al mediodía.`
    if (uv >= 3) return `El índice UV es ${Math.round(uv)}: ponte bloqueador si vas a estar al sol.`
    return 'El sol está suave ahora: el índice UV es bajo.'
  }

  if (QUIERE.luna.test(t)) {
    const l = faseLunar()
    return `Hoy hay ${l.nombre.toLowerCase()}, iluminada en un ${Math.round(l.iluminacion * 100)} por ciento. ${ahora?.esDeDia ? 'Esta noche' : 'Ahora'} puedes mirar el cielo en la sección Mira el cielo.`
  }

  if (QUIERE.temperatura.test(t) || dia) {
    if (dia) return `${dia.nombre[0].toUpperCase()}${dia.nombre.slice(1)} en ${lugar} tendremos una máxima de ${g(dia.d.max)} y una mínima de ${g(dia.d.min)}, con ${describir(dia.d.codigo).texto.toLowerCase()}.`
    if (!ahora) return 'Todavía no tengo la temperatura cargada.'
    return `Ahora hay ${g(ahora.temperatura)} en ${lugar}${Math.abs(ahora.sensacion - ahora.temperatura) >= 3 ? `, pero se sienten como ${g(ahora.sensacion)}` : ''}.${hoy ? ` Hoy la máxima es de ${g(hoy.max)} y la mínima de ${g(hoy.min)}.` : ''}`
  }

  if (QUIERE.saludo.test(t)) return `¡Hola${nombre ? `, ${nombre}` : ''}! ¿Qué quieres saber? Puedes preguntarme si va a llover, qué ropa ponerte o si hubo sismos.`

  if (memoria) return memoria.respaldo(pregunta, { nombre })
  return `${tu}buena pregunta. Te puedo contar el clima de cualquier comuna, qué hacer en una emergencia, cómo usar la app o datos de Chile. Por ejemplo: ¿qué hago si tiembla? o ¿va a llover mañana?`
}

/** Sugerencias para empezar a conversar. */
export const SUGERENCIAS = ['¿Va a llover mañana?', '¿Qué ropa me pongo?', '¿Hay alertas?', '¿Hubo sismos?', 'Cuéntame un chiste']
