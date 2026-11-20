// «ZUMI Explora»: el paseo 3D como juego de mundo abierto.
// Los objetivos son lugares y fotos REALES alrededor (Wikipedia y Wikimedia Commons):
// faros de luz que hay que alcanzar. Al llegar, ZUMI cuenta el dato y sumas puntos.
import { distanciaKm } from './familiaGPS'

// Radio para «alcanzar» un faro y tamaño del faro, según cómo vas (a pie se llega cerca; en dron, de lejos).
export const ALCANCE = { pie: 30, bici: 38, auto: 55, dron: 150 }
export const FARO = { pie: { r: 7, h: 38 }, bici: { r: 9, h: 46 }, auto: { r: 15, h: 75 }, dron: { r: 42, h: 230 } }

const K = 'ac:paseo-juego'
const leer = () => {
  try {
    return { puntos: 0, recogidos: [], ...JSON.parse(localStorage.getItem(K) ?? '{}') }
  } catch {
    return { puntos: 0, recogidos: [] }
  }
}
export const progreso = leer
export function guardarProgreso(p) {
  try {
    localStorage.setItem(K, JSON.stringify({ puntos: p.puntos, recogidos: p.recogidos.slice(-600) }))
  } catch {
    /* sin almacenamiento */
  }
}

/** Objetivos del juego: lugares con historia (valen más) y fotos reales, sin repetir puntos muy cercanos. */
export function objetivos(lugares = [], fotos = [], max = 14) {
  const lista = []
  for (const l of lugares) lista.push({ id: `l:${l.id}`, tipo: 'lugar', nombre: l.titulo, lat: l.lat, lng: l.lng, valor: 150, dato: l })
  for (const f of fotos) {
    if (lista.some((x) => distanciaKm(x, f) < 0.04)) continue
    lista.push({ id: `f:${f.id}`, tipo: 'foto', nombre: f.titulo || 'Foto real', lat: f.lat, lng: f.lng, valor: 75, dato: f })
  }
  return lista.slice(0, max)
}

/** Polígono circular (para el faro de luz en 3D). */
export function circulo({ lat, lng }, metros, lados = 20) {
  const pts = []
  const dLat = metros / 111320
  const dLng = metros / (111320 * Math.cos((lat * Math.PI) / 180))
  for (let i = 0; i <= lados; i++) {
    const a = (i / lados) * Math.PI * 2
    pts.push([lng + Math.cos(a) * dLng, lat + Math.sin(a) * dLat])
  }
  return [pts]
}

export function farosGeoJSON(objs, recogidos, modo) {
  const f = FARO[modo] ?? FARO.pie
  return {
    type: 'FeatureCollection',
    features: objs.map((o) => ({
      type: 'Feature',
      properties: { id: o.id, hecho: recogidos.has(o.id) ? 1 : 0, h: recogidos.has(o.id) ? f.h * 0.25 : f.h, tipo: o.tipo },
      geometry: { type: 'Polygon', coordinates: circulo(o, f.r) },
    })),
  }
}

// ---- Sonidos cortos hechos al vuelo (sin archivos) ----
let ctx = null
const audio = () => {
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  } catch {
    return null
  }
}
function nota(frec, t0, dur, vol = 0.12, tipo = 'sine') {
  const a = audio()
  if (!a) return
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = tipo
  o.frequency.value = frec
  g.gain.setValueAtTime(0, a.currentTime + t0)
  g.gain.linearRampToValueAtTime(vol, a.currentTime + t0 + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + t0 + dur)
  o.connect(g).connect(a.destination)
  o.start(a.currentTime + t0)
  o.stop(a.currentTime + t0 + dur + 0.05)
}
/** «¡Lo alcanzaste!»: un arpegio alegre. */
export function sonidoLogro(grande = false) {
  ;[659, 784, 988, grande ? 1319 : null].filter(Boolean).forEach((f, i) => nota(f, i * 0.07, 0.35, 0.11, 'triangle'))
}
/** Turbo: un «fiuu» corto. */
export function sonidoTurbo() {
  const a = audio()
  if (!a) return
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(180, a.currentTime)
  o.frequency.exponentialRampToValueAtTime(720, a.currentTime + 0.35)
  g.gain.setValueAtTime(0.04, a.currentTime)
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.4)
  o.connect(g).connect(a.destination)
  o.start()
  o.stop(a.currentTime + 0.45)
}
