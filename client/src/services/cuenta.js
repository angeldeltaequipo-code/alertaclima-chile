// Cuentas con Google: configuración, botón oficial de Google, inicio y cierre de sesión.
import { API_URL } from './reportes'
import { cabeceraSesion, cerrarSesion, guardarSesion } from './sesion'

let config = null

/** { activa, googleClientId }: si el servidor tiene el inicio de sesión configurado. */
export async function configCuenta() {
  if (config) return config
  if (!API_URL) return (config = { activa: false })
  const r = await fetch(`${API_URL}/api/cuenta/config`)
  if (!r.ok) throw new Error('No se pudo consultar el servidor')
  config = await r.json()
  return config
}

let cargaGoogle = null
/** Carga la biblioteca oficial «Sign in with Google» una sola vez. */
export function cargarGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  cargaGoogle ??= new Promise((ok, no) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => ok(window.google)
    s.onerror = () => {
      cargaGoogle = null
      no(new Error('No se pudo cargar el botón de Google. Revisa tu conexión.'))
    }
    document.head.appendChild(s)
  })
  return cargaGoogle
}

async function pedir(ruta, opciones = {}) {
  let r
  try {
    r = await fetch(`${API_URL}/api/cuenta${ruta}`, {
      ...opciones,
      headers: { 'content-type': 'application/json', ...cabeceraSesion(), ...(opciones.headers ?? {}) },
    })
  } catch {
    throw new Error('No hay conexión. Revisa tu señal y vuelve a intentarlo.')
  }
  const d = await r.json().catch(() => ({}))
  if (r.status === 401 && ruta !== '/google' && ruta !== '/apple') cerrarSesion()
  if (!r.ok) throw new Error(d.error ?? `El servidor respondió ${r.status}`)
  return d
}

/** Entrega al servidor la credencial que dio Google y guarda la sesión. */
export async function ingresar(credencial) {
  const { usuario, sesion } = await pedir('/google', { method: 'POST', body: JSON.stringify({ credencial }) })
  guardarSesion(sesion, usuario)
  return usuario
}

// ---------------- App nativa (iPhone y Android) ----------------
// Google no permite su botón web dentro de una app, y Apple exige «Iniciar sesión con Apple»
// si se ofrece Google. Aquí se usan los inicios de sesión nativos del teléfono.
let socialListo = null
async function social() {
  const { SocialLogin } = await import('@capgo/capacitor-social-login')
  socialListo ??= (async () => {
    const c = await configCuenta()
    const ios = (await import('./nativo')).plataforma() === 'ios'
    await SocialLogin.initialize({
      google: { webClientId: c.googleClientId, iOSClientId: c.googleClientIdIos ?? undefined, iOSServerClientId: c.googleClientId, mode: 'online' },
      ...(ios ? { apple: { clientId: 'cl.alertaclima.app' } } : {}),
    })
  })().catch((e) => {
    socialListo = null
    throw e
  })
  await socialListo
  return SocialLogin
}

const cancelo = (e) => /cancel|canceled|cancelled|1001|12501|dismiss/i.test(String(e?.message ?? e?.code ?? e))

/** Inicia sesión con Google o Apple usando la pantalla nativa del teléfono. Devuelve el usuario o null si canceló. */
export async function ingresarNativo(proveedor) {
  const SocialLogin = await social()
  let r
  try {
    r = await SocialLogin.login(
      proveedor === 'apple' ? { provider: 'apple', options: { scopes: ['email', 'name'] } } : { provider: 'google', options: { scopes: ['email', 'profile'] } },
    )
  } catch (e) {
    if (cancelo(e)) return null
    throw new Error(proveedor === 'apple' ? 'No se pudo iniciar sesión con Apple. Inténtalo de nuevo.' : 'No se pudo iniciar sesión con Google. Inténtalo de nuevo.')
  }
  const idToken = r?.result?.idToken
  if (!idToken) throw new Error('No recibimos la confirmación de tu cuenta. Inténtalo de nuevo.')
  const cuerpo =
    proveedor === 'apple'
      ? { credencial: idToken, nombre: r.result.profile?.givenName ?? undefined, apellido: r.result.profile?.familyName ?? undefined }
      : { credencial: idToken }
  const { usuario, sesion } = await pedir(`/${proveedor === 'apple' ? 'apple' : 'google'}`, { method: 'POST', body: JSON.stringify(cuerpo) })
  guardarSesion(sesion, usuario)
  return usuario
}

/** Confirma que la sesión guardada sigue siendo válida (la cuenta pudo ser borrada o bloqueada). */
export async function confirmarSesion() {
  const { usuario } = await pedir('/yo')
  return usuario
}

export function salir() {
  import('./nativo').then(({ esNativa }) => esNativa() && social().then((S) => S.logout({ provider: 'google' })).catch(() => {}))
  try {
    window.google?.accounts?.id?.disableAutoSelect()
  } catch {
    /* sin Google cargado */
  }
  cerrarSesion()
}

export async function borrarCuenta() {
  await pedir('/borrar', { method: 'POST' })
  salir()
}
