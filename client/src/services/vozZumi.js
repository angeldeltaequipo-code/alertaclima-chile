// Voz propia de ZUMI: la genera nuestro servidor con un motor de voz libre (ver server/services/voz).
// Aquí: saber si está disponible, pedir cada frase (con la siguiente ya encargada mientras habla),
// desbloquear el audio en iPhone y medir la energía del audio para mover la boca.
import { API_URL } from './reportes'
import { guardar, leer } from './almacen'

export const usarVozPropia = () => leer('zumi:voz-propia', true)
export const guardarUsarVozPropia = (v) => guardar('zumi:voz-propia', Boolean(v))

let disponible = null
export async function vozPropiaDisponible() {
  if (!API_URL || !usarVozPropia()) return false
  if (disponible !== null) return disponible
  try {
    const r = await fetch(`${API_URL}/api/voz/estado`, { signal: AbortSignal.timeout(4000) })
    disponible = r.ok && (await r.json()).activa === true
  } catch {
    disponible = false
    setTimeout(() => (disponible = null), 60_000) // se reintenta en un minuto
  }
  return disponible
}

// Un solo elemento de audio para toda la app (en iPhone se desbloquea con el primer toque).
let audio = null
export function elementoAudio() {
  if (!audio && typeof Audio !== 'undefined') {
    audio = new Audio()
    audio.preload = 'auto'
    audio.setAttribute('playsinline', '')
  }
  return audio
}
const SILENCIO = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
let desbloqueado = false
export function desbloquearAudio() {
  if (desbloqueado) return
  const a = elementoAudio()
  if (!a) return
  desbloqueado = true
  a.src = SILENCIO
  a.play().catch(() => (desbloqueado = false))
}
if (typeof document !== 'undefined') {
  const una = () => desbloquearAudio()
  document.addEventListener('pointerdown', una, { capture: true, passive: true })
  document.addEventListener('keydown', una, { capture: true })
}

/**
 * Energía del audio cada 20 ms (0 a 1), leída directo del WAV de 16 bits que manda el servidor.
 * Sirve para cerrar la boca en las pausas y abrirla más en las sílabas fuertes.
 */
export function envolvente(buf) {
  const dv = new DataView(buf)
  if (dv.getUint32(0, false) !== 0x52494646) return null // «RIFF»
  const rate = dv.getUint32(24, true)
  let p = 12
  while (p + 8 <= dv.byteLength) {
    const id = dv.getUint32(p, false)
    const tam = dv.getUint32(p + 4, true)
    if (id === 0x64617461) {
      const n = Math.floor(Math.min(tam, dv.byteLength - p - 8) / 2)
      const paso = Math.round(rate * 0.02)
      const e = []
      let max = 1e-6
      for (let i = 0; i < n; i += paso) {
        let s = 0
        const fin = Math.min(n, i + paso)
        for (let j = i; j < fin; j++) {
          const v = dv.getInt16(p + 8 + j * 2, true) / 32768
          s += v * v
        }
        const rms = Math.sqrt(s / Math.max(1, fin - i))
        e.push(rms)
        if (rms > max) max = rms
      }
      return e.map((x) => Math.min(1, x / (max * 0.75)))
    }
    p += 8 + tam + (tam % 2)
  }
  return null
}

/** Pide la frase al servidor. Devuelve { url, env, ms } o lanza error (se usa entonces la voz del teléfono). */
export async function pedirFrase(texto, { signal } = {}) {
  const r = await fetch(`${API_URL}/api/voz?t=${encodeURIComponent(texto)}`, { signal: signal ?? AbortSignal.timeout(12000) })
  if (!r.ok) throw new Error(`voz ${r.status}`)
  const buf = await r.arrayBuffer()
  const env = envolvente(buf)
  return { url: URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })), env, ms: env ? env.length * 20 : null }
}
