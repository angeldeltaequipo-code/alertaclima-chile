// Motor de emociones de ZUMI: elige cómo reacciona con el cuerpo según lo que le dicen y lo que
// responde, usando solo las tomas de video que existen en cada escena (nunca una al azar).
import { VIDEOS } from './zumiVideos'

const t = (x) =>
  String(x ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

// En orden de prioridad: la primera regla que calza decide.
const REGLAS = [
  // seguridad primero: ante peligro, ZUMI se pone serio (calma) o indica qué hacer (señala)
  { emocion: 'serio', si: (p, r) => /\b(131|132|133|evacu|peligro|alerta roja|tsunami|incendio|suicid|4141|no respira|infarto)/.test(r) || /\b(ayuda|emergencia|me muero|socorro)\b/.test(p) },
  { emocion: 'cueca', si: (p) => /cueca|baila|bailar|fiestas patrias|dieciocho/.test(p) },
  { emocion: 'saludo', si: (p) => /^(hola|wena|buenas|buen dia|buenos dias|buenas tardes|buenas noches|chao|adios|nos vemos|hasta luego)\b/.test(p) },
  { emocion: 'celebrar', si: (p) => /gracias|te quiero|te amo|eres (el mejor|bacan|lindo|tierno)|bacan|genial|excelente|correcto|ojos del salado/.test(p) },
  { emocion: 'calor', si: (p, r) => /calor|bochorno|ola de calor|playa|bloqueador|uv/.test(p) || /\b(3[0-9]) grados/.test(r) },
  { emocion: 'frio', si: (p, r) => /frio|helad|nieve|nevar|abrig|hipotermia|escarcha/.test(p) || /helada|bajo cero/.test(r) },
  { emocion: 'triste', si: (p) => /triste|pena|miedo|asustad|solo|sola|ansiedad|nervios|no puedo dormir|enferm|duele/.test(p) },
  { emocion: 'curioso', si: (p) => /^(por que|como se|que es|que significa|sabias|cuentame|dato|adivinanza|quien|cual es|cuantos|cuantas|donde queda)/.test(p) },
  { emocion: 'buena', si: (p, r) => /sin alertas|despejado|soleado|tranquilo|buen dia|sin lluvia|no va a llover|no hay alertas/.test(r) },
  { emocion: 'advertir', si: (p, r) => /ojo|cuidado|lluvia|llovera|paraguas|viento|ráfaga|rafaga|sismo|temblor|alerta|lleva/.test(r) },
]

// Cada emoción, en orden de preferencia, según las tomas que haya en la escena.
const TOMAS = {
  serio: ['calma', 'pensar', 'reposo'],
  cueca: ['cueca', 'celebrar'],
  saludo: ['saludo2', 'saludo'],
  celebrar: ['celebrar', 'saludo2', 'saludo'],
  calor: ['verano', 'senalar'],
  frio: ['invierno', 'senalar'],
  triste: ['curioso', 'pensar', 'reposo'],
  advertir: ['senalar', 'calma', 'curioso'],
  curioso: ['curioso', 'pensar'],
  buena: ['celebrar', 'saludo2', 'saludo'],
  neutro: ['senalar', 'curioso', 'saludo'],
}

/** La emoción de un intercambio: { emocion, toma } (toma = nombre del video, o null si no hay ninguno). */
export function emocionDe(pregunta, respuesta, escena = 'sala') {
  const p = t(pregunta).trim()
  const r = t(respuesta)
  const regla = REGLAS.find((x) => x.si(p, r))
  const emocion = regla?.emocion ?? 'neutro'
  const disponibles = VIDEOS[escena] ?? VIDEOS.sala
  const toma = TOMAS[emocion].find((x) => disponibles.includes(x)) ?? null
  return { emocion, toma }
}
