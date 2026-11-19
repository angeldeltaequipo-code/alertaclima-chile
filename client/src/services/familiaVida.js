// La inteligencia de «Mi familia», calculada en el teléfono (nada de esto llega al servidor):
//  - Lugares seguros (Casa, Colegio, Trabajo…): se comparten cifrados dentro del mensaje de cada uno
//  - Llegadas y salidas: «Tomás llegó al Colegio · 08:02», con aviso en el teléfono
//  - Recorrido de hoy de cada integrante (solo lo que este teléfono vio, guardado aquí)
//  - Batería baja: «A Sofía le queda 12 % de batería»
import { distanciaKm } from './familiaGPS'

export const RADIO_LUGAR = 0.15 // km
export const ICONOS_LUGAR = { casa: '🏠', colegio: '🏫', trabajo: '💼', abuelos: '👵', deporte: '⚽', otro: '📍' }

const leer = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(k) ?? 'null') ?? d
  } catch {
    return d
  }
}
const guardar = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* lleno */
  }
}
const hoyClave = () => new Date().toDateString()

// «llegó al colegio», «salió de la casa», «llegó a lo de la abuela»…
const ARTICULO = { casa: ['a la casa', 'de la casa'], colegio: ['al colegio', 'del colegio'], trabajo: ['al trabajo', 'del trabajo'], abuelos: ['donde los abuelos', 'de donde los abuelos'], deporte: ['al deporte', 'del deporte'] }
export const aLugar = (n) => ARTICULO[String(n).toLowerCase()]?.[0] ?? `a ${n}`
export const deLugar = (n) => ARTICULO[String(n).toLowerCase()]?.[1] ?? `de ${n}`

/** ¿En qué lugar seguro está este punto? */
export function lugarDe(p, lugares = []) {
  let mejor = null
  for (const l of lugares) {
    const d = distanciaKm(p, l)
    if (d <= (l.r ?? RADIO_LUGAR) && (!mejor || d < mejor.d)) mejor = { ...l, d }
  }
  return mejor
}

// ---- Recorrido de hoy ----
const K_RASTRO = 'ac:familia-rastro'
export function anotarRastro(miembros) {
  const r = leer(K_RASTRO, {})
  if (r.dia !== hoyClave()) {
    r.dia = hoyClave()
    r.p = {}
  }
  for (const m of miembros) {
    if (m.lat == null) continue
    const l = (r.p[m.id] ??= [])
    const u = l.at(-1)
    if (u && u[0] === m.t) continue
    if (u && distanciaKm({ lat: u[1], lng: u[2] }, m) < 0.03) continue
    l.push([m.t, +m.lat.toFixed(5), +m.lng.toFixed(5)])
    if (l.length > 300) l.splice(0, l.length - 300)
  }
  guardar(K_RASTRO, r)
}
export function rastroDe(id) {
  const r = leer(K_RASTRO, {})
  return r.dia === hoyClave() ? (r.p?.[id] ?? []) : []
}
/** Kilómetros recorridos hoy (según lo que vio este teléfono). */
export function kmHoy(id) {
  const l = rastroDe(id)
  let s = 0
  for (let i = 1; i < l.length; i++) s += distanciaKm({ lat: l[i - 1][1], lng: l[i - 1][2] }, { lat: l[i][1], lng: l[i][2] })
  return s
}

// ---- Llegadas, salidas y batería ----
const K_ESTADO = 'ac:familia-donde'
const K_EVENTOS = 'ac:familia-eventos'
export function eventosDeHoy() {
  const e = leer(K_EVENTOS, {})
  return e.dia === hoyClave() ? e.l : []
}

/**
 * Compara dónde estaba cada integrante con dónde está ahora y anota lo que cambió.
 * Devuelve los eventos nuevos (para avisar).
 */
export function detectarEventos(miembros, lugares = []) {
  const antes = leer(K_ESTADO, {})
  const ev = leer(K_EVENTOS, {})
  if (ev.dia !== hoyClave()) {
    ev.dia = hoyClave()
    ev.l = []
  }
  const nuevos = []
  // Un lugar recién agregado: quien ya estaba dentro no «llegó» (se anota en silencio).
  const conocidos = new Set(antes._lugares ?? [])
  const primeraVez = !antes._lugares
  for (const l of lugares) {
    if (conocidos.has(l.id) || primeraVez) continue
    for (const m of miembros) if (m.lat != null && antes[m.id] && lugarDe(m, [l])) antes[m.id] = { ...antes[m.id], lugar: l.id, desde: m.t }
  }
  antes._lugares = lugares.map((l) => l.id)
  for (const m of miembros) {
    if (m.lat == null || Date.now() - m.t > 6 * 3600e3) continue
    const ahora = lugarDe(m, lugares)
    const a = antes[m.id]
    const quien = m.yo ? 'Llegaste' : `${m.nombre} llegó`
    // viajes: «va camino a…» y «llegó bien a…» (también si recién lo vemos, si empezó hace poco)
    const v = m.viaje
    const reciente = (t) => t && Date.now() - t < 15 * 60e3
    if (!m.yo && v?.inicio && v.inicio !== a?.viaje && !v.llego && (a !== undefined || reciente(v.inicio)))
      nuevos.push({ t: m.t, id: m.id, nombre: m.nombre, tipo: 'viaje', icono: '🚗', texto: `${m.nombre} va camino a ${v.d}${v.eta ? `, llega cerca de las ${new Date(v.eta).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}` : ''}` })
    if (!m.yo && v?.llego && v.llego !== a?.llego && (a !== undefined || reciente(v.llego))) nuevos.push({ t: m.t, id: m.id, nombre: m.nombre, tipo: 'llego', icono: '🏁', texto: `${m.nombre} llegó bien a ${v.d}` })
    if (a !== undefined) {
      if (ahora && a?.lugar !== ahora.id) nuevos.push({ t: m.t, id: m.id, nombre: m.nombre, yo: m.yo, tipo: 'llego', lugar: ahora.n, icono: ahora.e, texto: `${quien} ${aLugar(ahora.n)}` })
      else if (!ahora && a?.lugar) {
        const l = lugares.find((x) => x.id === a.lugar)
        if (l) nuevos.push({ t: m.t, id: m.id, nombre: m.nombre, yo: m.yo, tipo: 'salio', lugar: l.n, icono: l.e, texto: `${m.yo ? 'Saliste' : `${m.nombre} salió`} ${deLugar(l.n)}` })
      }
      if (m.bateria != null && m.bateria <= 15 && (a?.bateria ?? 100) > 15 && !m.yo)
        nuevos.push({ t: m.t, id: m.id, nombre: m.nombre, tipo: 'bateria', icono: '🔋', texto: `A ${m.nombre} le queda ${m.bateria} % de batería` })
    }
    antes[m.id] = { lugar: ahora?.id ?? null, desde: ahora ? (a?.lugar === ahora.id ? a.desde : m.t) : null, bateria: m.bateria, viaje: m.viaje?.inicio ?? null, llego: m.viaje?.llego ?? null }
  }
  ev.l = [...nuevos, ...ev.l].slice(0, 80)
  guardar(K_ESTADO, antes)
  guardar(K_EVENTOS, ev)
  return nuevos
}
/** Desde qué hora está en su lugar actual. */
export const desdeCuando = (id) => leer(K_ESTADO, {})[id]?.desde ?? null
