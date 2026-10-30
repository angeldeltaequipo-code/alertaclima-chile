// Cuentas: inicio de sesión con Google y sesiones firmadas por el servidor.
//
// - La app recibe de Google un "ID token" (firmado por Google) y lo manda aquí.
//   Se verifica la firma, que sea para NUESTRO ID de cliente (GOOGLE_CLIENT_ID) y que no haya vencido.
// - Se guarda lo mínimo: el identificador de Google, nombre e inicial, y la foto.
// - La sesión es un texto firmado con HMAC (no hay contraseñas ni cookies de terceros).
//   Dura 60 días; se renueva sola cada vez que la persona vuelve a entrar con Google.
import { correoBienvenida, enviarCorreo } from './correo.js'
import { createHmac, createPublicKey, timingSafeEqual, verify } from 'node:crypto'
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

/** IDs de cliente de Google aceptados: el de la web y, si existe, el de la app de iPhone. */
export const audienciasGoogle = () =>
  [process.env.GOOGLE_CLIENT_ID, ...String(process.env.GOOGLE_CLIENT_ID_IOS ?? '').split(',')].map((x) => x?.trim()).filter(Boolean)

let cliente = null
async function verificarConGoogle(credencial) {
  cliente ??= new OAuth2Client()
  const ticket = await cliente.verifyIdToken({ idToken: credencial, audience: audienciasGoogle() })
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

// ---------------- Iniciar sesión con Apple ----------------
// La app de iPhone recibe de Apple un «identity token» (JWT RS256). Se verifica con las llaves públicas
// de Apple, que sea para nuestra app (APPLE_BUNDLE_ID) y que no haya vencido.
const APPLE_ISS = 'https://appleid.apple.com'
export const audienciasApple = () => String(process.env.APPLE_BUNDLE_ID ?? 'cl.alertaclima.app').split(',').map((x) => x.trim()).filter(Boolean)
let llavesApple = { en: 0, llaves: [] }
async function llavePublicaApple(kid, fetchFn) {
  if (Date.now() - llavesApple.en > 6 * 3600e3 || !llavesApple.llaves.some((k) => k.kid === kid)) {
    const r = await fetchFn(`${APPLE_ISS}/auth/keys`, { signal: AbortSignal.timeout(10000) })
    if (!r.ok) throw new Error(`Apple keys ${r.status}`)
    llavesApple = { en: Date.now(), llaves: (await r.json()).keys ?? [] }
  }
  const jwk = llavesApple.llaves.find((k) => k.kid === kid)
  if (!jwk) throw new Error('Llave de Apple desconocida')
  return createPublicKey({ key: jwk, format: 'jwk' })
}

/** Verifica el identity token de Apple y devuelve su contenido ({ sub, email, ... }). */
export async function verificarConApple(token, { fetchFn = fetch, ahora = Date.now() } = {}) {
  const [h, p, f] = String(token).split('.')
  if (!h || !p || !f) throw new Error('Token mal formado')
  const cab = JSON.parse(Buffer.from(h, 'base64url').toString())
  if (cab.alg !== 'RS256') throw new Error('Algoritmo no permitido')
  const llave = await llavePublicaApple(cab.kid, fetchFn)
  if (!verify('RSA-SHA256', Buffer.from(`${h}.${p}`), llave, Buffer.from(f, 'base64url'))) throw new Error('Firma inválida')
  const d = JSON.parse(Buffer.from(p, 'base64url').toString())
  if (d.iss !== APPLE_ISS) throw new Error('Emisor inválido')
  if (!audienciasApple().includes(d.aud)) throw new Error('Audiencia inválida')
  if (!d.exp || d.exp * 1000 < ahora - 60e3) throw new Error('Token vencido')
  return d
}

/** Inicia sesión con Apple. Apple entrega el nombre solo la primera vez: lo manda la app. */
export async function ingresarConApple(pool, { credencial, nombre, apellido }, { verificar = verificarConApple } = {}) {
  if (typeof credencial !== 'string' || credencial.length > 4000) throw new ErrorValidacion('Credencial inválida')
  let datos
  try {
    datos = await verificar(credencial)
  } catch {
    throw new ErrorValidacion('No se pudo confirmar tu cuenta de Apple. Intenta de nuevo.', 401)
  }
  if (!datos?.sub) throw new ErrorValidacion('Cuenta de Apple no válida', 401)
  const limpio = (x) => (typeof x === 'string' ? x.trim().slice(0, 60) : '')
  const nombreDado = limpio(nombre) ? nombreMostrado({ given_name: limpio(nombre), family_name: limpio(apellido) }) : null
  const { rows } = await pool.query(
    `INSERT INTO usuarios (apple_sub, nombre) VALUES ($1, $2)
     ON CONFLICT (apple_sub) DO UPDATE SET nombre = COALESCE($3, usuarios.nombre), ultimo_ingreso = now()
     RETURNING id, nombre, foto_url, bloqueado, creado_en, (xmax = 0) AS nueva`,
    [datos.sub, nombreDado ?? 'Vecino', nombreDado],
  )
  const u = rows[0]
  if (u.bloqueado) throw new ErrorValidacion('Esta cuenta fue bloqueada por no respetar las reglas de la comunidad.', 403)
  if (u.nueva && datos.email && String(datos.email_verified) !== 'false') {
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

/** Si viene una sesión válida deja req.usuario; si no, sigue sin cuenta (no exige nada). */
export function cuentaOpcional(pool) {
  return async (req, res, next) => {
    try {
      const id = leerSesion((req.get('authorization') ?? '').replace(/^Bearer\s+/i, ''))
      const u = id && (await usuarioPorId(pool, id))
      if (u && !u.bloqueado) req.usuario = u
      next()
    } catch (e) {
      next(e)
    }
  }
}
