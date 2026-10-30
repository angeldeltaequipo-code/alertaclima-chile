// Widget de la pantalla de inicio (iPhone y Android).
// La app le deja al widget un resumen pequeño (comuna, temperatura, alerta) y el punto de la comuna,
// para que el widget se actualice solo cada 30 minutos aunque la app esté cerrada.
import { registerPlugin } from '@capacitor/core'
import { esNativa } from './nativo'
import { NIVELES, alertaPrincipal } from './alertas'
import { API_URL } from './reportes'

const WidgetZumi = registerPlugin('WidgetZumi')
let ultimo = ''

/** Arma el resumen para el widget (función pura, para probarla). */
export function resumenWidget({ comuna, clima, alertas }) {
  if (!comuna || !clima?.ahora) return null
  const p = alertas?.alertas ? alertaPrincipal(alertas.alertas) : null
  const hoy = clima.dias?.[0]
  return {
    comuna: comuna.nombre,
    cut: comuna.cut,
    lat: clima.punto?.lat ?? null,
    lng: clima.punto?.lng ?? null,
    temp: Math.round(clima.ahora.temperatura),
    texto: clima.ahora.texto,
    max: hoy ? Math.round(hoy.max) : null,
    min: hoy ? Math.round(hoy.min) : null,
    alerta: p ? { nivel: p.nivel, titulo: NIVELES[p.nivel].etiqueta, amenaza: p.amenaza } : null,
    api: API_URL,
    hora: Date.now(),
  }
}

/** Entrega el resumen al widget nativo (solo si cambió). En la web no hace nada. */
export async function actualizarWidget(datos) {
  if (!esNativa()) return
  const r = resumenWidget(datos)
  if (!r) return
  const clave = JSON.stringify({ ...r, hora: 0 })
  if (clave === ultimo) return
  ultimo = clave
  await WidgetZumi.guardar({ datos: JSON.stringify(r) }).catch(() => {})
}
