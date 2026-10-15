// Chat por comuna: conversación en tiempo real entre vecinos.
//
// Reglas pensadas para una emergencia:
// - Solo personas con cuenta (Google). Se muestra nombre e inicial.
// - Sin enlaces ni fotos: evita estafas, cadenas falsas e imágenes sin moderar.
// - Groserías tapadas y datos personales (teléfono, RUT, correo) ocultos: ver filtroChat.js.
// - Máximo 1 mensaje cada 4 segundos y 15 cada 5 minutos por persona; sin repetir el mismo texto.
// - Modo lento automático: si una comuna se llena de mensajes (emergencia), el intervalo sube a 10 s.
// - 3 denuncias de personas distintas ocultan el mensaje; el panel de administración puede
//   ocultar mensajes y bloquear cuentas.
import { ErrorValidacion } from './reportes.js'
import { filtrarMensaje } from './filtroChat.js'

export const REGLAS_CHAT = { largo: 500, cada: 4000, cadaLento: 10000, lentoDesde: 25, ventana: 5 * 60 * 1000, porVentana: 15, denunciasParaOcultar: 3, pagina: 50 }

const envios = new Map() // usuario -> [horas]
const ultimos = new Map() // usuario -> { texto, hora }
const porComuna = new Map() // cut -> [horas] del último minuto
const ENLACE = /(https?:\/\/|www\.|\b[\w-]+\.(com|cl|net|org|io|ly|me|app|xyz|info)\b)/i

/** Limpia y valida el texto de un mensaje. */
export function limpiarTexto(texto) {
  if (typeof texto !== 'string') throw new ErrorValidacion('Escribe un mensaje')
  const limpio = texto
    .normalize('NFKC') // letras «de fantasía» (𝐡𝐨𝐥𝐚, ｈｏｌａ) pasan a normales: así no se saltan los filtros
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f​-‏‪-‮⁦-⁩]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  if (!limpio) throw new ErrorValidacion('Escribe un mensaje')
  if (limpio.length > REGLAS_CHAT.largo) throw new ErrorValidacion(`Máximo ${REGLAS_CHAT.largo} caracteres`)
  if (ENLACE.test(limpio)) throw new ErrorValidacion('Por seguridad, en el chat no se permiten enlaces.')
  return limpio
}

/** Segundos entre mensajes en la comuna ahora: 4 normalmente, 10 si hay mucho movimiento. */
export function modoLento(cut, ahora = Date.now()) {
  const l = (porComuna.get(cut) ?? []).filter((t) => ahora - t < 60000)
  porComuna.set(cut, l)
  return l.length >= REGLAS_CHAT.lentoDesde ? REGLAS_CHAT.cadaLento / 1000 : 0
}

function revisarRitmo(usuarioId, cut, texto, ahora = Date.now()) {
  const lista = (envios.get(usuarioId) ?? []).filter((t) => ahora - t < REGLAS_CHAT.ventana)
  const lento = modoLento(cut, ahora)
  const cada = lento ? REGLAS_CHAT.cadaLento : REGLAS_CHAT.cada
  if (lista.length && ahora - lista[lista.length - 1] < cada)
    throw new ErrorValidacion(lento ? `Modo lento: hay mucha gente escribiendo. Puedes enviar un mensaje cada ${lento} segundos.` : 'Espera unos segundos antes de enviar otro mensaje.', 429)
  const u = ultimos.get(usuarioId)
  if (u && u.texto === texto.toLowerCase() && ahora - u.hora < 10 * 60000) throw new ErrorValidacion('Ya enviaste ese mismo mensaje.', 429)
  if (lista.length >= REGLAS_CHAT.porVentana) throw new ErrorValidacion('Enviaste muchos mensajes seguidos. Espera unos minutos.', 429)
  lista.push(ahora)
  envios.set(usuarioId, lista)
  ultimos.set(usuarioId, { texto: texto.toLowerCase(), hora: ahora })
  porComuna.get(cut).push(ahora)
  for (const m of [envios, ultimos, porComuna]) if (m.size > 20000) m.delete(m.keys().next().value)
}

const SELECT = `SELECT m.id, m.comuna_cut, m.texto, m.creado_en, m.oculto, u.id AS usuario_id, u.nombre, u.foto_url
  FROM chat_mensajes m JOIN usuarios u ON u.id = m.usuario_id`

export const aPublico = (m) => ({
  id: String(m.id),
  comuna: m.comuna_cut.trim(),
  texto: m.texto,
  hora: m.creado_en,
  autor: { id: String(m.usuario_id), nombre: m.nombre, foto: m.foto_url },
})

const cutValido = (cut) => {
  if (typeof cut !== 'string' || !/^\d{5}$/.test(cut)) throw new ErrorValidacion('Comuna inválida')
  return cut
}

/** Últimos mensajes visibles de una comuna (los más nuevos al final). `antes`: id para cargar más antiguos. */
export async function listarMensajes(db, cut, antes) {
  cutValido(cut)
  const params = [cut, REGLAS_CHAT.pagina]
  let filtro = ''
  if (antes != null && antes !== '') {
    if (!/^\d+$/.test(String(antes))) throw new ErrorValidacion('Parámetro inválido')
    params.push(antes)
    filtro = 'AND m.id < $3'
  }
  const { rows } = await db.query(
    `${SELECT} WHERE m.comuna_cut = $1 AND NOT m.oculto AND NOT u.bloqueado ${filtro} ORDER BY m.id DESC LIMIT $2`,
    params,
  )
  return rows.reverse().map(aPublico)
}

export async function publicarMensaje(db, cut, usuario, texto) {
  cutValido(cut)
  const filtro = filtrarMensaje(limpiarTexto(texto))
  const limpio = filtro.texto
  revisarRitmo(String(usuario.id), cut, limpio)
  const { rows: c } = await db.query('SELECT 1 FROM comunas WHERE cut = $1', [cut])
  if (!c.length) throw new ErrorValidacion('Comuna inválida')
  const { rows } = await db.query(
    `WITH n AS (INSERT INTO chat_mensajes (comuna_cut, usuario_id, texto) VALUES ($1, $2, $3) RETURNING *)
     SELECT n.id, n.comuna_cut, n.texto, n.creado_en, n.oculto, u.id AS usuario_id, u.nombre, u.foto_url FROM n JOIN usuarios u ON u.id = n.usuario_id`,
    [cut, usuario.id, limpio],
  )
  return { mensaje: aPublico(rows[0]), datosOcultos: filtro.datosOcultos, censurado: filtro.censurado, lento: modoLento(cut) }
}

/** Denuncia un mensaje. Devuelve { mensaje, oculto } si con esta denuncia quedó oculto. */
export async function denunciarMensaje(pool, id, usuario) {
  if (!/^\d+$/.test(String(id))) throw new ErrorValidacion('Mensaje inválido')
  const cliente = await pool.connect()
  try {
    await cliente.query('BEGIN')
    const { rows } = await cliente.query('SELECT id, comuna_cut, usuario_id, oculto FROM chat_mensajes WHERE id = $1 FOR UPDATE', [id])
    const m = rows[0]
    if (!m) throw new ErrorValidacion('El mensaje ya no existe', 404)
    if (String(m.usuario_id) === String(usuario.id)) throw new ErrorValidacion('No puedes denunciar tu propio mensaje')
    const { rowCount } = await cliente.query('INSERT INTO chat_denuncias (mensaje_id, usuario_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, usuario.id])
    let oculto = m.oculto
    if (rowCount) {
      const { rows: r2 } = await cliente.query(
        `UPDATE chat_mensajes SET denuncias = denuncias + 1,
           oculto = oculto OR denuncias + 1 >= $2,
           oculto_por = CASE WHEN NOT oculto AND denuncias + 1 >= $2 THEN 'denuncias' ELSE oculto_por END
         WHERE id = $1 RETURNING oculto`,
        [id, REGLAS_CHAT.denunciasParaOcultar],
      )
      oculto = r2[0].oculto
    }
    await cliente.query('COMMIT')
    return { id: String(m.id), comuna: m.comuna_cut.trim(), oculto, recienOculto: oculto && !m.oculto }
  } catch (e) {
    await cliente.query('ROLLBACK')
    throw e
  } finally {
    cliente.release()
  }
}

/** El autor borra su propio mensaje. */
export async function borrarPropio(db, id, usuario) {
  if (!/^\d+$/.test(String(id))) throw new ErrorValidacion('Mensaje inválido')
  const { rows } = await db.query(
    `UPDATE chat_mensajes SET oculto = true, oculto_por = 'autor' WHERE id = $1 AND usuario_id = $2 RETURNING id, comuna_cut`,
    [id, usuario.id],
  )
  if (!rows[0]) throw new ErrorValidacion('No puedes borrar ese mensaje', 403)
  return { id: String(rows[0].id), comuna: rows[0].comuna_cut.trim() }
}

// ---- Moderación (panel de administración) ----

export async function mensajesDenunciados(db) {
  const { rows } = await db.query(
    `${SELECT} WHERE m.denuncias > 0 AND m.creado_en > now() - INTERVAL '7 days' ORDER BY m.denuncias DESC, m.id DESC LIMIT 100`,
  )
  return rows.map((m) => ({ ...aPublico(m), oculto: m.oculto }))
}

export async function moderarMensaje(db, id, ocultar) {
  if (!/^\d+$/.test(String(id))) throw new ErrorValidacion('Mensaje inválido')
  const { rows } = await db.query(
    `UPDATE chat_mensajes SET oculto = $2, oculto_por = CASE WHEN $2 THEN 'moderacion' ELSE NULL END WHERE id = $1 RETURNING id, comuna_cut`,
    [id, Boolean(ocultar)],
  )
  if (!rows[0]) throw new ErrorValidacion('El mensaje no existe', 404)
  return { id: String(rows[0].id), comuna: rows[0].comuna_cut.trim() }
}

export async function bloquearUsuario(db, id, bloquear, motivo) {
  if (!/^\d+$/.test(String(id))) throw new ErrorValidacion('Usuario inválido')
  const { rowCount } = await db.query('UPDATE usuarios SET bloqueado = $2, motivo_bloqueo = $3 WHERE id = $1', [
    id,
    Boolean(bloquear),
    bloquear ? String(motivo ?? '').slice(0, 200) || null : null,
  ])
  if (!rowCount) throw new ErrorValidacion('El usuario no existe', 404)
}
