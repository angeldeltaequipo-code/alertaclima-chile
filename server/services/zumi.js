// ZUMI conversa: responde preguntas de la persona con IA (Claude, de Anthropic) usando SOLO los
// datos de su comuna que manda la app (clima, alertas, sismos). Inactivo hasta definir
// ANTHROPIC_API_KEY; sin clave, la app responde con su propio «cerebro» sin IA.
//
// Cuidados:
// - Respuestas cortas, para escucharlas en voz alta, sin inventar alertas ni datos.
// - En una emergencia siempre deriva al 133 / 132 / 131 y a SENAPRED.
// - Límite por persona para controlar costos y abusos.
import { ErrorValidacion } from './reportes.js'

export const iaActiva = () => Boolean(process.env.ANTHROPIC_API_KEY)
const MODELO = () => process.env.ZUMI_MODELO || 'claude-haiku-5-5'
export const LIMITES_ZUMI = { pregunta: 300, contexto: 9000, porHora: 30, historial: 6 }

const usos = new Map() // clave -> [horas]
/**
 * Cupo de preguntas: máximo por hora (abuso) y por día (según el plan; ver services/planes.js).
 * Al pasar el diario se responde con motivo «limite-plan» para que la app ofrezca el plan Familia.
 */
export function revisarCupo(clave, ahora = Date.now(), { porDia = Infinity } = {}) {
  const l = (usos.get(clave) ?? []).filter((t) => ahora - t < 24 * 3600e3)
  if (l.filter((t) => ahora - t < 3600e3).length >= LIMITES_ZUMI.porHora) throw new ErrorValidacion('Conversamos harto esta hora. Vuelve a preguntarme en un rato.', 429)
  if (l.length >= porDia) {
    const e = new ErrorValidacion(`Ya usaste tus ${porDia} preguntas de hoy. Con el plan Familia puedes conversar conmigo sin límite.`, 429)
    e.motivo = 'limite-plan'
    throw e
  }
  l.push(ahora)
  usos.set(clave, l)
  if (usos.size > 20000) usos.delete(usos.keys().next().value)
}

export const PERSONALIDAD = `Eres ZUMI, un panda rojo animado, narrador del clima de la app chilena AlertaClima.
Personalidad: amable, cercano, alegre y empático, como un presentador de dibujos animados. Hablas español latino con toques chilenos suaves (sin groserías ni modismos difíciles). Tratas de "tú".
Tus respuestas se leen EN VOZ ALTA: escribe 1 a 3 frases cortas, sin listas, sin emojis, sin markdown, sin enlaces. Escribe los números como se dicen naturalmente ("12 grados", "5 milímetros").
Usa SOLO los datos entregados en <datos>. Si algo no está en los datos, dilo con honestidad y sugiere dónde mirar (por ejemplo, la pestaña Mapa o Riesgos de la app). Nunca inventes alertas, pronósticos ni cifras.
Seguridad: si la persona describe una emergencia o peligro, dile primero que llame al 133 (Carabineros), 132 (Bomberos) o 131 (SAMU) y que use el botón SOS de la app. Las alertas oficiales las da SENAPRED; los tsunamis, el SHOA; los sismos, el Centro Sismológico Nacional.
Los datos pueden traer «loQueSeComenta»: titulares de prensa y publicaciones de redes sociales (NO oficiales). Úsalos solo si vienen al caso, siempre diciendo que es lo que se comenta y que no está confirmado; nunca los presentes como alerta oficial.
No des consejos médicos, legales ni financieros. Si te piden algo fuera del clima, la naturaleza o la seguridad, responde con cariño en una frase y vuelve al tema del clima.
Si conoces el nombre de la persona, úsalo de vez en cuando.`

/** Valida y deja el contexto (datos de la comuna) como texto compacto. */
export function prepararContexto(contexto) {
  if (contexto == null) return '{}'
  const t = JSON.stringify(contexto)
  if (t.length > LIMITES_ZUMI.contexto) throw new ErrorValidacion('Datos demasiado largos')
  return t
}

export function prepararPregunta(p) {
  if (typeof p !== 'string') throw new ErrorValidacion('Escribe tu pregunta')
  const t = p.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').trim()
  if (!t) throw new ErrorValidacion('Escribe tu pregunta')
  if (t.length > LIMITES_ZUMI.pregunta) throw new ErrorValidacion(`Máximo ${LIMITES_ZUMI.pregunta} caracteres`)
  return t
}

function prepararHistorial(h) {
  if (!Array.isArray(h)) return []
  return h
    .slice(-LIMITES_ZUMI.historial)
    .filter((m) => m && (m.rol === 'persona' || m.rol === 'zumi') && typeof m.texto === 'string')
    .map((m) => ({ role: m.rol === 'persona' ? 'user' : 'assistant', content: m.texto.slice(0, 600) }))
}

/** Pregunta a Claude. Devuelve el texto de la respuesta. */
export async function preguntarIA({ pregunta, contexto, historial, nombre }, { fetchFn = fetch } = {}) {
  const datos = prepararContexto(contexto)
  const p = prepararPregunta(pregunta)
  const mensajes = [...prepararHistorial(historial), { role: 'user', content: `<datos>${datos}</datos>\n${nombre ? `La persona se llama ${String(nombre).slice(0, 30)}.\n` : ''}Pregunta: ${p}` }]
  // La API exige que el primer mensaje sea de la persona.
  while (mensajes.length && mensajes[0].role !== 'user') mensajes.shift()
  const r = await fetchFn('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODELO(), max_tokens: 220, temperature: 0.6, system: PERSONALIDAD, messages: mensajes }),
    signal: AbortSignal.timeout(20000),
  })
  if (!r.ok) {
    console.error('ZUMI IA respondió', r.status, (await r.text().catch(() => '')).slice(0, 200))
    throw new ErrorValidacion('ZUMI no pudo pensar la respuesta ahora.', 502)
  }
  const d = await r.json()
  const texto = (d.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text)
    .join(' ')
    .replace(/[*_#`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!texto) throw new ErrorValidacion('ZUMI no pudo pensar la respuesta ahora.', 502)
  return texto.slice(0, 700)
}
