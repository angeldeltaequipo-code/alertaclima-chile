// GPS familiar con cifrado de punta a punta.
//
// - Una familia = un grupo (identificador al azar) + una clave AES-256 que se crea en el teléfono.
// - El enlace de invitación lleva ambos DESPUÉS del «#» (esa parte nunca viaja a ningún servidor).
// - Cada integrante que acepta comparte su ubicación cifrada; el servidor solo guarda lo último
//   (cifrado) por 48 horas. Nadie más —ni AlertaClima— puede saber dónde está tu familia.
// - Se comparte solo si la persona lo activa, se ve quién ve tu ubicación y se puede salir cuando sea.
// - En la web la ubicación se actualiza mientras la app está abierta (los navegadores no permiten
//   rastrear en segundo plano); al abrir la app se envía al tiro.
import { API_URL } from './reportes'

const CLAVE = 'ac:familia-gps'
const CADA_MS = 2 * 60e3
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const deB64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0))
const azar = (n) => b64(crypto.getRandomValues(new Uint8Array(n)))

export function leerGrupo() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? 'null')
  } catch {
    return null
  }
}
function guardarGrupo(g) {
  try {
    if (g) localStorage.setItem(CLAVE, JSON.stringify(g))
    else localStorage.removeItem(CLAVE)
  } catch {
    /* sin almacenamiento */
  }
  window.dispatchEvent(new CustomEvent('ac:familia-gps'))
}

export function crearFamilia({ nombre, rol }) {
  const g = { grupo: azar(18), clave: azar(32), yo: { id: azar(12), nombre: nombre.trim().slice(0, 30), rol }, compartir: true, creada: Date.now() }
  guardarGrupo(g)
  return g
}

/** Enlace para invitar: quien lo abre entra a la familia (la clave va tras «#», no llega al servidor). */
export function enlaceInvitacion(g = leerGrupo()) {
  if (!g) return null
  return `${location.origin}${import.meta.env.BASE_URL}#familia=${g.grupo}.${g.clave}`
}

/** ¿La app se abrió desde una invitación? Devuelve { grupo, clave } y limpia la dirección. */
export function invitacionEnDireccion() {
  const m = location.hash.match(/familia=([A-Za-z0-9_-]{16,64})\.([A-Za-z0-9_-]{40,64})/)
  if (!m) return null
  history.replaceState(null, '', location.pathname + location.search)
  return { grupo: m[1], clave: m[2] }
}

export function unirseAFamilia({ grupo, clave }, { nombre, rol }) {
  const g = { grupo, clave, yo: { id: azar(12), nombre: nombre.trim().slice(0, 30), rol }, compartir: true, creada: Date.now() }
  guardarGrupo(g)
  return g
}

export async function salirDeFamilia() {
  const g = leerGrupo()
  if (g && API_URL) await fetch(`${API_URL}/api/familia/${g.grupo}/${g.yo.id}`, { method: 'DELETE' }).catch(() => {})
  guardarGrupo(null)
}

export function cambiarCompartir(v) {
  const g = leerGrupo()
  if (!g) return
  g.compartir = Boolean(v)
  guardarGrupo(g)
  if (!v && API_URL) fetch(`${API_URL}/api/familia/${g.grupo}/${g.yo.id}`, { method: 'DELETE' }).catch(() => {})
}

async function llave(g) {
  return crypto.subtle.importKey('raw', deB64(g.clave), 'AES-GCM', false, ['encrypt', 'decrypt'])
}

/** Envía mi ubicación cifrada. */
export async function enviarUbicacion(pos, extra = {}) {
  const g = leerGrupo()
  if (!g?.compartir || !API_URL) return false
  let bateria = null
  try {
    const b = await navigator.getBattery?.()
    if (b) bateria = Math.round(b.level * 100)
  } catch {
    /* sin batería */
  }
  // «Estoy bien» / «Necesito ayuda»: viaja cifrado junto a la ubicación y dura 24 horas
  const estado = g.estado && Date.now() - g.estado.t < 24 * 3600e3 ? g.estado : undefined
  const datos = { nombre: g.yo.nombre, rol: g.yo.rol, lat: pos.coords.latitude, lng: pos.coords.longitude, precision: Math.round(pos.coords.accuracy ?? 0), bateria, t: Date.now(), estado, ...extra }
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await llave(g), new TextEncoder().encode(JSON.stringify(datos)))
  const r = await fetch(`${API_URL}/api/familia/${g.grupo}/${g.yo.id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ iv: b64(iv), datos: b64(cifrado) }),
  })
  return r.ok
}

/**
 * Avisa a toda la familia cómo estás («bien» o «ayuda»), cifrado como la ubicación.
 * Si el GPS no responde a tiempo, usa tu última ubicación conocida.
 */
export async function marcarEstado(v) {
  const g = leerGrupo()
  if (!g) return false
  g.estado = { v, t: Date.now() }
  if (v === 'ayuda') g.compartir = true // pedir ayuda sin ubicación no sirve
  guardarGrupo(g)
  const pos = await new Promise((ok) =>
    'geolocation' in navigator ? navigator.geolocation.getCurrentPosition(ok, () => ok(null), { enableHighAccuracy: true, timeout: 12e3, maximumAge: 60e3 }) : ok(null),
  )
  const yo = ultima.find((m) => m.yo)
  const p = pos ?? (yo ? { coords: { latitude: yo.lat, longitude: yo.lng, accuracy: yo.precision } } : null)
  if (!p) return false
  return enviarUbicacion(p).catch(() => false)
}
export const miEstado = () => {
  const e = leerGrupo()?.estado
  return e && Date.now() - e.t < 24 * 3600e3 ? e : null
}

/** Lee y descifra la ubicación de cada integrante. */
export async function leerFamilia() {
  const g = leerGrupo()
  if (!g || !API_URL) return []
  const r = await fetch(`${API_URL}/api/familia/${g.grupo}`, { cache: 'no-store' })
  if (!r.ok) throw new Error('No se pudo leer la familia')
  const { miembros } = await r.json()
  const k = await llave(g)
  const out = []
  for (const m of miembros) {
    try {
      const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(m.iv) }, k, deB64(m.datos))
      out.push({ id: m.id, yo: m.id === g.yo.id, ...JSON.parse(new TextDecoder().decode(plano)) })
    } catch {
      /* mensaje de otra clave o dañado: se ignora */
    }
  }
  ultima = out.sort((a, b) => Number(b.yo) - Number(a.yo) || b.t - a.t)
  return ultima
}
let ultima = []
export const ultimaFamilia = () => ultima

// ---- envío automático mientras la app está abierta ----
let vigilando = null
export function vigilarUbicacion() {
  if (vigilando || !('geolocation' in navigator)) return
  const enviar = () => {
    const g = leerGrupo()
    if (!g?.compartir || document.hidden) return
    navigator.geolocation.getCurrentPosition((p) => enviarUbicacion(p).catch(() => {}), () => {}, { enableHighAccuracy: true, maximumAge: 60e3, timeout: 20e3 })
  }
  enviar()
  vigilando = setInterval(enviar, CADA_MS)
  document.addEventListener('visibilitychange', () => !document.hidden && enviar())
}

const R = 6371
export function distanciaKm(a, b) {
  const rad = (x) => (x * Math.PI) / 180
  const d1 = rad(b.lat - a.lat)
  const d2 = rad(b.lng - a.lng)
  const h = Math.sin(d1 / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(d2 / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function haceCuanto(t, ahora = Date.now()) {
  const m = Math.round((ahora - t) / 60e3)
  if (m < 1) return 'ahora mismo'
  if (m < 60) return `hace ${m} min`
  const h = Math.round(m / 60)
  return h < 24 ? `hace ${h} h` : `hace ${Math.round(h / 24)} d`
}
