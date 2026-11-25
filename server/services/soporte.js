// Chat de soporte del sitio: la persona escribe desde zumichile.com y Angel (fundador) responde
// desde zumichile.com/soporte/. Se guarda en PostgreSQL; sin base (pruebas o base caída al arrancar),
// en memoria, para que el chat nunca se quede mudo.
import { randomBytes } from 'node:crypto'
import { enviarCorreo } from './correo.js'

export const ID = /^[A-Za-z0-9_-]{20,64}$/
const limpiar = (t, max) => String(t ?? '').replace(/\s+\n/g, '\n').trim().slice(0, max)
const nuevoId = () => randomBytes(18).toString('base64url')

export class ErrorSoporte extends Error {
  constructor(msg, estado = 400) {
    super(msg)
    this.estado = estado
  }
}

/** Valida lo que llega de la persona. */
export function validar({ texto, nombre, contacto, pagina } = {}) {
  const t = limpiar(texto, 2000)
  if (t.length < 1) throw new ErrorSoporte('Escribe un mensaje')
  return { texto: t, nombre: limpiar(nombre, 60) || null, contacto: limpiar(contacto, 120) || null, pagina: limpiar(pagina, 200) || null }
}

// ---------- Almacenes ----------
export function almacenMemoria({ ahora = () => Date.now() } = {}) {
  const convs = new Map()
  let sec = 0
  const vista = (c) => ({ id: c.id, nombre: c.nombre, contacto: c.contacto, pagina: c.pagina, creada_en: new Date(c.creada).toISOString(), actualizada_en: new Date(c.act).toISOString(), sin_leer: c.sin_leer, visto_en: new Date(c.visto).toISOString() })
  const msg = (m) => ({ id: m.id, autor: m.autor, texto: m.texto, creado_en: new Date(m.t).toISOString() })
  return {
    async crear({ nombre, contacto, pagina, texto }) {
      const c = { id: nuevoId(), nombre, contacto, pagina, creada: ahora(), act: ahora(), sin_leer: 1, visto: ahora(), mensajes: [] }
      c.mensajes.push({ id: ++sec, autor: 'visita', texto, t: ahora() })
      convs.set(c.id, c)
      return c.id
    },
    async existe(id) {
      return convs.has(id)
    },
    async agregar(id, autor, texto) {
      const c = convs.get(id)
      if (!c) return null
      const m = { id: ++sec, autor, texto, t: ahora() }
      c.mensajes.push(m)
      c.act = ahora()
      c.sin_leer = autor === 'visita' ? c.sin_leer + 1 : 0
      return msg(m)
    },
    async datos(id, { desde = 0, visita = false } = {}) {
      const c = convs.get(id)
      if (!c) return null
      if (visita) c.visto = ahora()
      return { conversacion: vista(c), mensajes: c.mensajes.filter((m) => m.id > desde).map(msg) }
    },
    async actualizarContacto(id, { nombre, contacto }) {
      const c = convs.get(id)
      if (c) Object.assign(c, nombre ? { nombre } : {}, contacto ? { contacto } : {})
    },
    async leida(id) {
      const c = convs.get(id)
      if (c) c.sin_leer = 0
    },
    async lista() {
      return [...convs.values()]
        .sort((a, b) => b.act - a.act)
        .slice(0, 200)
        .map((c) => ({ ...vista(c), ultimo: msg(c.mensajes.at(-1)) }))
    },
  }
}

export function almacenPg(pool) {
  return {
    async crear({ nombre, contacto, pagina, texto }) {
      const id = nuevoId()
      const cli = await pool.connect()
      try {
        await cli.query('BEGIN')
        await cli.query('INSERT INTO soporte_conversaciones (id, nombre, contacto, pagina, sin_leer) VALUES ($1,$2,$3,$4,1)', [id, nombre, contacto, pagina])
        await cli.query("INSERT INTO soporte_mensajes (conv_id, autor, texto) VALUES ($1,'visita',$2)", [id, texto])
        await cli.query('COMMIT')
      } catch (e) {
        await cli.query('ROLLBACK').catch(() => {})
        throw e
      } finally {
        cli.release()
      }
      return id
    },
    async existe(id) {
      return (await pool.query('SELECT 1 FROM soporte_conversaciones WHERE id = $1', [id])).rowCount > 0
    },
    async agregar(id, autor, texto) {
      const { rows } = await pool.query('INSERT INTO soporte_mensajes (conv_id, autor, texto) SELECT id, $2, $3 FROM soporte_conversaciones WHERE id = $1 RETURNING id::int, autor, texto, creado_en', [id, autor, texto])
      if (!rows[0]) return null
      await pool.query(`UPDATE soporte_conversaciones SET actualizada_en = now(), sin_leer = CASE WHEN $2 = 'visita' THEN sin_leer + 1 ELSE 0 END WHERE id = $1`, [id, autor])
      return rows[0]
    },
    async datos(id, { desde = 0, visita = false } = {}) {
      const c = await pool.query(`${visita ? 'UPDATE soporte_conversaciones SET visto_en = now() WHERE id = $1 RETURNING' : 'SELECT'} id, nombre, contacto, pagina, creada_en, actualizada_en, sin_leer, visto_en ${visita ? '' : 'FROM soporte_conversaciones WHERE id = $1'}`, [id])
      if (!c.rows[0]) return null
      const m = await pool.query('SELECT id::int, autor, texto, creado_en FROM soporte_mensajes WHERE conv_id = $1 AND id > $2 ORDER BY id LIMIT 500', [id, desde])
      return { conversacion: c.rows[0], mensajes: m.rows }
    },
    async actualizarContacto(id, { nombre, contacto }) {
      await pool.query('UPDATE soporte_conversaciones SET nombre = COALESCE($2, nombre), contacto = COALESCE($3, contacto) WHERE id = $1', [id, nombre, contacto])
    },
    async leida(id) {
      await pool.query('UPDATE soporte_conversaciones SET sin_leer = 0 WHERE id = $1', [id])
    },
    async lista() {
      const { rows } = await pool.query(`SELECT c.id, c.nombre, c.contacto, c.pagina, c.creada_en, c.actualizada_en, c.sin_leer, c.visto_en,
          json_build_object('id', m.id, 'autor', m.autor, 'texto', m.texto, 'creado_en', m.creado_en) AS ultimo
        FROM soporte_conversaciones c
        LEFT JOIN LATERAL (SELECT id, autor, texto, creado_en FROM soporte_mensajes WHERE conv_id = c.id ORDER BY id DESC LIMIT 1) m ON true
        ORDER BY c.actualizada_en DESC LIMIT 200`)
      return rows
    },
  }
}

// ---------- Avisos por correo (si Resend está configurado) ----------
const esCorreo = (t) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t ?? '')
const ultimoAviso = new Map() // conv -> ms (no más de un correo cada 10 min por conversación)

export async function avisarAngel(conv, texto, { ahora = Date.now(), enviar = enviarCorreo } = {}) {
  const para = process.env.SOPORTE_CORREO
  if (!para || ahora - (ultimoAviso.get(conv.id) ?? 0) < 10 * 60e3) return false
  ultimoAviso.set(conv.id, ahora)
  const quien = conv.nombre || 'Alguien'
  const r = await enviar({
    para,
    asunto: `💬 ${quien} te escribió en zumichile.com`,
    texto: `${quien}${conv.contacto ? ` (${conv.contacto})` : ''} escribió:\n\n${texto}\n\nResponde aquí: https://zumichile.com/soporte/#${conv.id}`,
    html: `<p><b>${escapar(quien)}</b>${conv.contacto ? ` (${escapar(conv.contacto)})` : ''} escribió:</p><blockquote style="border-left:3px solid #c8501f;padding-left:12px;margin-left:0">${escapar(texto).replace(/\n/g, '<br>')}</blockquote><p><a href="https://zumichile.com/soporte/#${conv.id}">Responder en el chat de soporte</a></p>`,
  })
  return r.enviado
}

/** Si la persona dejó un correo y ya no está mirando el chat, le llega la respuesta de Angel. */
export async function avisarVisita(conv, texto, { ahora = Date.now(), enviar = enviarCorreo } = {}) {
  if (!esCorreo(conv.contacto) || ahora - new Date(conv.visto_en).getTime() < 90e3) return false
  const r = await enviar({
    para: conv.contacto,
    asunto: 'Angel de ZUMI te respondió',
    texto: `Hola${conv.nombre ? ` ${conv.nombre}` : ''}, te respondí en el chat de zumichile.com:\n\n${texto}\n\nPuedes seguir la conversación en https://zumichile.com/#soporte\n\nAngel, fundador de ZUMI`,
    html: `<p>Hola${conv.nombre ? ` ${escapar(conv.nombre)}` : ''}, te respondí en el chat de zumichile.com:</p><blockquote style="border-left:3px solid #c8501f;padding-left:12px;margin-left:0">${escapar(texto).replace(/\n/g, '<br>')}</blockquote><p><a href="https://zumichile.com/#soporte">Seguir la conversación</a></p><p>Angel, fundador de ZUMI</p>`,
  })
  return r.enviado
}
const escapar = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
