// Aviso físico cuando llega o sube una alerta oficial: vibración del teléfono.
//
// Límites del navegador (no de la app):
// - La vibración funciona en Android (Chrome, Edge, Firefox…), no en iPhone: Safari no la permite.
// - Solo funciona con la app abierta y después de que la persona tocó la pantalla al menos una vez.
// - Con la app cerrada, el aviso tiene que llegar como notificación (Fase 4).
import { guardar, leer } from './almacen'

// Patrón largo-corto que se distingue de una notificación común.
const PATRONES = {
  preventiva: [300, 150, 300],
  amarilla: [400, 150, 400, 150, 400],
  roja: [700, 200, 700, 200, 700, 200, 700],
  evacuacion: [1000, 200, 1000, 200, 1000, 200, 1000, 200, 1000],
}

export const vibracionSoportada = () => typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
export const vibrarActivado = () => leer('vibrar', true)
export const setVibrarActivado = (v) => guardar('vibrar', v)

export function vibrar(nivel) {
  if (!vibracionSoportada() || !vibrarActivado()) return false
  try {
    return navigator.vibrate(PATRONES[nivel] ?? PATRONES.amarilla)
  } catch {
    return false
  }
}

// ---- Qué alertas ya vio la persona en este dispositivo ----
// Se guarda id + nivel: si una alerta sube de nivel, vuelve a avisar.

export const yaVista = (a) => leer(`alerta-vista:${a.id}`) === a.nivel
export const marcarVista = (a) => guardar(`alerta-vista:${a.id}`, a.nivel)
