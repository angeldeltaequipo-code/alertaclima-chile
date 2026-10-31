// Las «películas» de ZUMI: escenas cortas hechas con Higgsfield en las que ZUMI actúa y habla con su
// propia voz (la boca va perfecta porque voz e imagen salen del mismo video). No son un feed aparte:
// ZUMI las usa dentro de su reporte y como respuesta cuando le preguntas algo de esos temas.
export const RUTA_CINE = `${import.meta.env.BASE_URL}zumi/cine/`

export const PELICULAS = {
  hola: { tema: 'Bienvenida', titulo: 'Conoce a ZUMI', texto: '¡Hola, hola! ¡Soy ZUMI! Desde hoy cuido el clima de tu casa y de toda tu familia. ¿Listo? ¡Vamos!' },
  lluvia: { tema: 'Lluvia', titulo: 'Qué llevar si llueve', texto: '¡Uy, se viene la lluvia! Paraguas, chaqueta y botas… ¡y antes de salir, revisa las alertas en la app!' },
  calor: { tema: 'Calor', titulo: 'Cómo cuidarte del calor', texto: '¡Qué calor! Toma mucha agua, usa bloqueador y busca la sombra, sobre todo al mediodía.' },
  sismo: { tema: 'Sismos', titulo: 'Qué hacer si tiembla', texto: 'Si tiembla: agáchate, cúbrete y afírmate. Cuando pase, revisa a tu familia y sigue a Senapred.' },
  mochila: { tema: 'Prepárate', titulo: 'Tu mochila de emergencia', texto: '¡Agua, linterna, radio, pilas y tus remedios! Una mochila lista te puede salvar el día.' },
}

/** Frase del narrador que ZUMI dice actuando su película. */
export const frasePelicula = (id) => ({ texto: PELICULAS[id].texto, pelicula: id })

/** ¿La pregunta es de un tema que ZUMI explica con su película? */
export function peliculaPara(pregunta) {
  const q = pregunta.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  // Solo «qué hacer» (no «¿hubo sismos?», que se responde con los datos)
  if (/tiembl|tembl|sismo|terremoto/.test(q) && /(que hago|que hacer|como actu|como me protejo|si tiembla|durante un)/.test(q)) return 'sismo'
  if (/mochila|kit de emergencia|que (llevo|guardo|preparo).*emergencia/.test(q)) return 'mochila'
  if (/bloqueador|insolacion|golpe de calor|(como|que hago).*calor|calor.*(cuid|protej)/.test(q)) return 'calor'
  if (/paraguas|impermeable|que llevo.*lluv|lluvia.*(llevo|que me pongo)/.test(q)) return 'lluvia'
  if (/quien eres|que eres|presentate|como te llamas/.test(q)) return 'hola'
  return null
}

const hoy = () => new Date().toISOString().slice(0, 10)
const leerVisto = (id) => {
  try {
    return localStorage.getItem(`ac:cine:${id}`)
  } catch {
    return null
  }
}
export const marcarVista = (id) => {
  try {
    localStorage.setItem(`ac:cine:${id}`, hoy())
  } catch {
    /* sin almacenamiento */
  }
}
export const yaVista = (id) => Boolean(leerVisto(id))
export const vistaHoy = (id) => leerVisto(id) === hoy()

/** El consejo que sirve para hoy según el clima (o null). */
export function consejoDelDia({ ahora, horas, dias } = {}) {
  if ((horas ?? []).slice(0, 12).some((h) => (h.lluvia ?? 0) >= 0.5)) return 'lluvia'
  if ((ahora?.temperatura ?? 0) >= 28 || (dias?.[0]?.max ?? 0) >= 30) return 'calor'
  return null
}
