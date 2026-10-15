// Cuentas: inicio de sesión con Google y sesiones firmadas por el servidor.
//
// - La app recibe de Google un "ID token" (firmado por Google) y lo manda aquí.
//   Se verifica la firma, que sea para NUESTRO ID de cliente (GOOGLE_CLIENT_ID) y que no haya vencido.
// - Se guarda lo mínimo: el identificador de Google, nombre e inicial, y la foto.
// - La sesión es un texto firmado con HMAC (no hay contraseñas ni cookies de terceros).
//   Dura 60 días; se renueva sola cada vez que la persona vuelve a entrar con Google.
import { correoBienvenida, enviarCorreo } from './correo.js'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { OAuth2Client } from 'google-auth-library'
import { ErrorValidacion } from './reportes.js'

const DURACION_MS = 60 * 24 * 3600 * 1000

export const cuentasActivas = () => Boolean(process.env.GOOGLE_CLIENT_ID)

function secreto() {
  const s = process.env.SESSION_SECRET ?? process.env.HASH_SECRET
  if (!s && process.env.NODE_ENV === 'production') throw new Error('Falta SESSION_SECRET')
  return s ?? 'solo-desarrollo-no-usar-en-produccion'
}
const firma = (texto) => createHmac('sha256', secreto()).update(`sesion|${texto}`).digest('base64url')

export function firmarSesion(usuarioId, ahora = Date.now()) {
  const datos = Buffer.from(JSON.stringify({ u: String(usuarioId), e: ahora + DURACION_MS })).toString('base64url')
  return `${datos}.${firma(datos)}`
}

/** Devuelve el id de usuario si la sesión es válida y vigente; si no, null. */
export function leerSesion(token, ahora = Date.now()) {
  if (typeof token !== 'string' || token.length > 400) return null
  const [datos, f] = token.split('.')
  if (!datos || !f) return null
  const esperada = Buffer.from(firma(datos))
  const recibida = Buffer.from(f)
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null
  try {
    const { u, e } = JSON.parse(Buffer.from(datos, 'base64url').toString())
    return e > ahora && /^\d+$/.test(u) ? u : null
  } catch {
    return null
  }
}

/** «Ángel L.»: nombre de pila e inicial del apellido. */
export function nombreMostrado({ given_name: nombre, family_name: apellido, name }) {
  const pila = (nombre ?? name ?? '').trim().split(/\s+/)[0] || 'Vecino'
  const inicial = (apellido ?? (name ?? '').trim().split(/\s+/)[1] ?? '').trim().charAt(0)
  return (inicial ? `${pila} ${inicial.toUpperCase()}.` : pila).slice(0, 40)
}

let cliente = null
async function verificarConGoogle(credencial) {
  cliente ??= new OAuth2Client()
  const ticket = await cliente.verifyIdToken({ idToken: credencial, audience: process.env.GOOGLE_CLIENT_ID })
  return ticket.getPayload()
}

/**
 * Inicia sesión con el ID token de Google. Crea la cuenta la primera vez.
 * `verificar` se puede reemplazar en las pruebas.
 */
export async function ingresarConGoogle(pool, credencial, { verificar = verificarConGoogle } = {}) {
  if (!cuentasActivas()) throw new ErrorValidacion('El inicio de sesión no está habilitado', 503)
  if (typeof credencial !== 'string' || credencial.length > 4000) throw new ErrorValidacion('Credencial inválida')
  let datos
  try {
    datos = await verificar(credencial)
  } catch {
    throw new ErrorValidacion('No se pudo confirmar tu cuenta de Google. Intenta de nuevo.', 401)
  }
  if (!datos?.sub || (datos.email_verified === false)) throw new ErrorValidacion('Cuenta de Google no verificada', 401)
  const foto = typeof datos.picture === 'string' && /^https:\/\/[\w.-]+\.googleusercontent\.com\//.test(datos.picture) ? datos.picture : null
  const { rows } = await pool.query(
    `INSERT INTO usuarios (google_sub, nombre, foto_url) VALUES ($1, $2, $3)
     ON CONFLICT (google_sub) DO UPDATE SET nombre = EXCLUDED.nombre, foto_url = EXCLUDED.foto_url, ultimo_ingreso = now()
     RETURNING id, nombre, foto_url, bloqueado, creado_en, (xmax = 0) AS nueva`,
    [datos.sub, nombreMostrado(datos), foto],
  )
  const u = rows[0]
  if (u.bloqueado) throw new ErrorValidacion('Esta cuenta fue bloqueada por no respetar las reglas de la comunidad.', 403)
  // Bienvenida por correo solo al crear la cuenta. El correo se usa aquí y no se guarda.
  if (u.nueva && datos.email && datos.email_verified !== false) {
    const c = correoBienvenida(u.nombre)
    enviarCorreo({ para: datos.email, asunto: c.asunto, html: c.html, texto: c.texto })
  }
  return { usuario: publico(u), sesion: firmarSesion(u.id) }
}

export const publico = (u) => ({ id: String(u.id), nombre: u.nombre, foto: u.foto_url, desde: u.creado_en })

export async function usuarioPorId(db, id) {
  const { rows } = await db.query('SELECT id, nombre, foto_url, bloqueado, creado_en FROM usuarios WHERE id = $1', [id])
  return rows[0] ?? null
}

/** Borra la cuenta y todo lo que escribió en el chat (derecho de supresión, Ley 21.719). */
export async function borrarCuenta(db, id) {
  await db.query('DELETE FROM usuarios WHERE id = $1', [id])
}

/** Middleware: exige sesión válida. Deja la persona en req.usuario. */
export function exigirCuenta(pool) {
  return async (req, res, next) => {
    try {
      const id = leerSesion((req.get('authorization') ?? '').replace(/^Bearer\s+/i, ''))
      const u = id && (await usuarioPorId(pool, id))
      if (!u) return res.status(401).json({ error: 'Inicia sesión con Google para participar', codigo: 'sin-sesion' })
      if (u.bloqueado) return res.status(403).json({ error: 'Esta cuenta está bloqueada', codigo: 'bloqueada' })
      req.usuario = u
      next()
    } catch (e) {
      next(e)
    }
  }
}

/** Igual que exigirCuenta, pero solo si las cuentas están activadas en el servidor (GOOGLE_CLIENT_ID). */
export function exigirCuentaSiActiva(pool) {
  const exigir = exigirCuenta(pool)
  return (req, res, next) => (cuentasActivas() ? exigir(req, res, next) : next())
}
