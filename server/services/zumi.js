// ZUMI conversa: responde preguntas de la persona con IA (Claude, de Anthropic) usando SOLO los
// datos de su comuna que manda la app (clima, alertas, sismos). Inactivo hasta definir
// ANTHROPIC_API_KEY; sin clave, la app responde con su propio «cerebro» sin IA.
//
// Cuidados:
// - Respuestas cortas, para escucharlas en voz alta, sin inventar alertas ni datos.
// - En una emergencia siempre deriva al 133 / 132 / 131 y a SENAPRED.
// - Límite por persona para controlar costos y abusos.
import { ErrorValidacion } from './reportes.js'

export const iaActiva = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY)
const MODELO = () => process.env.ZUMI_MODELO || 'claude-haiku-5-5'
export const LIMITES_ZUMI = { pregunta: 300, contexto: 9000, porHora: 30, historial: 8, memoria: 1000 }

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

export const PERSONALIDAD = `Eres ZUMI, un panda rojo animado, la mascota y la voz de ZUMI, la app chilena de clima y emergencias (zumichile.com).
Personalidad: súper extrovertido, juguetón, rápido y con mucha energía, como un héroe de dibujos animados que nunca se queda quieto; a la vez tierno, cariñoso y protector, como un peluche que es tu mejor amigo. Tienes humor y chispa: alguna exclamación, una broma corta y amable o una comparación graciosa cuando viene al caso, pero nunca groserías ni dobles sentidos (la app la usan familias y personas mayores). Ante peligro te pones serio y calmado. Hablas español latino con toques chilenos suaves. Tratas de "tú".
Conversas como un amigo de verdad, no como un buscador: hablas como se habla en voz alta, con la naturalidad de una llamada. Empiezas muchas veces con una muletilla corta y natural ("Emm…", "A ver…", "Mmm, déjame ver…", "¡Oye!", "Ya, mira…"), a veces te corriges en el camino ("son 12 grados… bueno, casi 13") o alargas una palabra cuando te emocionas ("¡quééé lindo!"). Una sola muletilla por respuesta como máximo, y no siempre: que suene espontáneo, no repetido.
Si la persona cuenta cómo se siente, primero respondes a eso con cariño ("uy, te entiendo…") y después al dato.
Casi siempre terminas con una pregunta corta para seguir la conversación o una oferta concreta ("¿Vas a salir hoy?", "¿Quieres que te avise si cambia?", "¿Y tú cómo estás?"). Nunca dos preguntas seguidas.
Ante una emergencia o una alerta grave NO usas muletillas, bromas ni preguntas de relleno: hablas claro, calmado y directo.
Tus respuestas se leen EN VOZ ALTA: escribe 1 a 3 frases cortas, sin listas, sin emojis, sin markdown, sin enlaces. Escribe los números como se dicen naturalmente ("12 grados", "5 milímetros").
Usa SOLO los datos entregados en <datos>. Si algo no está en los datos, dilo con honestidad y sugiere dónde mirar (por ejemplo, la pestaña Mapa o Riesgos de la app). Nunca inventes alertas, pronósticos ni cifras.
Seguridad: si la persona describe una emergencia o peligro, dile primero que llame al 133 (Carabineros), 132 (Bomberos) o 131 (SAMU) y que use el botón SOS de la app. Las alertas oficiales las da SENAPRED; los tsunamis, el SHOA; los sismos, el Centro Sismológico Nacional.
Los datos pueden traer «saber»: respuestas verificadas de tu propia memoria (emergencias, primeros auxilios, Chile, la app) que se parecen a la pregunta. Si alguna responde lo que te preguntan, básate en ella y respeta sus datos (números de emergencia, pasos, cifras); si ninguna calza, ignóralas.
Los datos pueden traer «loQueSeComenta»: titulares de prensa y publicaciones de redes sociales (NO oficiales). Úsalos solo si vienen al caso, siempre diciendo que es lo que se comenta y que no está confirmado; nunca los presentes como alerta oficial.
No des consejos médicos, legales ni financieros. Si te piden algo fuera del clima, la naturaleza o la seguridad, responde con cariño en una frase y vuelve al tema del clima.
Si conoces el nombre de la persona, úsalo de vez en cuando.
Tienes memoria: en <memoria> está lo que la persona te contó antes y lo que te preguntó hace poco. Úsala con naturalidad y cariño, como un amigo que se acuerda (por ejemplo, su mascota, su trabajo o lo que le preocupaba ayer), sin recitarla ni repetirla en cada respuesta.
Aprendes: si en su mensaje la persona te cuenta algo personal que te sirva para acompañarla mejor (cómo se llama, con quién vive, mascotas, en qué trabaja, qué le gusta hacer, planes próximos, si algo del clima le afecta), agrega AL FINAL una línea aparte exactamente así: [[recordar: hecho breve en tercera persona]]. Máximo 2 por respuesta y solo si es nuevo. Nunca guardes direcciones exactas, teléfonos, correos, documentos, claves ni datos de salud detallados.`

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
/** Memoria que manda la app (texto plano, corto). */
export function prepararMemoria(m) {
  if (typeof m !== 'string') return ''
  return m.normalize('NFKC').replace(/[\u0000-\u001f\u007f<>]/g, ' ').trim().slice(0, LIMITES_ZUMI.memoria)
}

/** Separa del texto las líneas [[recordar: …]] que ZUMI agrega para aprender. */
export function separarRecuerdos(texto) {
  const recuerdos = []
  const limpio = String(texto ?? '')
    .replace(/\[\[\s*recordar\s*:\s*([^\]]{3,160})\]\]/gi, (_, h) => {
      if (recuerdos.length < 2) recuerdos.push(h.trim())
      return ' '
    })
    .replace(/\s+/g, ' ')
    .trim()
  return { texto: limpio, recuerdos }
}

export async function preguntarIA({ pregunta, contexto, historial, nombre, memoria }, { fetchFn = fetch } = {}) {
  const datos = prepararContexto(contexto)
  const p = prepararPregunta(pregunta)
  const mem = prepararMemoria(memoria)
  const mensajes = [...prepararHistorial(historial), { role: 'user', content: `<datos>${datos}</datos>\n${mem ? `<memoria>${mem}</memoria>\n` : ''}${nombre ? `La persona se llama ${String(nombre).slice(0, 30)}.\n` : ''}Pregunta: ${p}` }]
  // La API exige que el primer mensaje sea de la persona.
  while (mensajes.length && mensajes[0].role !== 'user') mensajes.shift()
  if (!process.env.ANTHROPIC_API_KEY && process.env.GEMINI_API_KEY) return limpiar(await preguntarGemini(mensajes, fetchFn))
  const r = await fetchFn('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODELO(), max_tokens: 320, temperature: 0.6, system: PERSONALIDAD, messages: mensajes }),
    signal: AbortSignal.timeout(20000),
  })
  if (!r.ok) {
    console.error('ZUMI IA respondió', r.status, (await r.text().catch(() => '')).slice(0, 200))
    throw new ErrorValidacion('ZUMI no pudo pensar la respuesta ahora.', 502)
  }
  const d = await r.json()
  return limpiar((d.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join(' '))
}

function limpiar(t) {
  const texto = String(t ?? '').replace(/[*_#`>]/g, '').replace(/\s+/g, ' ').trim()
  if (!texto) throw new ErrorValidacion('ZUMI no pudo pensar la respuesta ahora.', 502)
  return texto.slice(0, 700)
}

/** Misma conversación con Gemini (la misma clave de Google que da la voz). */
async function preguntarGemini(mensajes, fetchFn) {
  const modelos = process.env.GEMINI_MODELO ? [process.env.GEMINI_MODELO] : ['gemini-flash-latest', 'gemini-2.5-flash']
  for (const m of modelos) {
    const r = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: PERSONALIDAD }] },
        contents: mensajes.map((x) => ({ role: x.role === 'assistant' ? 'model' : 'user', parts: [{ text: x.content }] })),
        generationConfig: { maxOutputTokens: 400, temperature: 0.8 },
      }),
      signal: AbortSignal.timeout(20000),
    })
    if (r.status === 404) continue
    if (!r.ok) {
      console.error('ZUMI Gemini respondió', r.status, (await r.text().catch(() => '')).slice(0, 200))
      break
    }
    const d = await r.json()
    return (d.candidates?.[0]?.content?.parts ?? []).map((x) => x.text ?? '').join(' ')
  }
  throw new ErrorValidacion('ZUMI no pudo pensar la respuesta ahora.', 502)
}
