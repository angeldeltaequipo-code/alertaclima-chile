// Alertas oficiales (SENAPRED y otras fuentes oficiales).
//
// Regla del proyecto: nunca se inventa una alerta. La app muestra solo lo que está
// cargado en el servidor, siempre con su fuente y la hora de su última verificación.
// Que no haya alertas cargadas NO significa que no existan: la app lo dice así.
import { API_URL } from './reportes'
import { guardar, leer } from './almacen'

export const NIVELES = {
  preventiva: { etiqueta: 'Alerta Temprana Preventiva', clave: 'preventiva', gravedad: 1 },
  amarilla: { etiqueta: 'Alerta Amarilla', clave: 'amarilla', gravedad: 2 },
  roja: { etiqueta: 'Alerta Roja', clave: 'roja', gravedad: 3 },
  evacuacion: { etiqueta: 'Evacuación', clave: 'evacuacion', gravedad: 4 },
}

export const FUENTE_OFICIAL = { nombre: 'SENAPRED', url: 'https://senapred.cl/' }

const revivir = (a) => ({
  ...a,
  vigente_desde: new Date(a.vigente_desde),
  vigente_hasta: a.vigente_hasta ? new Date(a.vigente_hasta) : null,
  confirmada_en: new Date(a.confirmada_en),
})

/**
 * Estado de alertas de una comuna:
 *  - tipo "sin_servidor": esta versión no tiene servidor de alertas.
 *  - tipo "ok": consulta exitosa; `alertas` puede venir vacía.
 *  - tipo "sin_conexion": no se pudo consultar; `alertas` es lo último guardado y `consultado` su hora.
 */
export async function estadoComuna(cut, { signal } = {}) {
  if (!API_URL) return { tipo: 'sin_servidor', alertas: [] }
  try {
    const r = await fetch(`${API_URL}/api/alertas?comuna=${encodeURIComponent(cut)}`, { signal, cache: 'no-store' })
    if (!r.ok) throw new Error(String(r.status))
    const { alertas, horasSinConfirmar } = await r.json()
    const consultado = new Date()
    guardar(`alertas:${cut}`, { alertas, consultado: consultado.toISOString() })
    return { tipo: 'ok', alertas: alertas.map(revivir), horasSinConfirmar, consultado }
  } catch (e) {
    if (e.name === 'AbortError') throw e
    const g = leer(`alertas:${cut}`)
    return {
      tipo: 'sin_conexion',
      alertas: (g?.alertas ?? []).map(revivir).filter((a) => !a.vigente_hasta || a.vigente_hasta > new Date()),
      consultado: g ? new Date(g.consultado) : null,
    }
  }
}

/** La alerta que manda en la banda: la más grave entre las confirmadas. */
export function alertaPrincipal(alertas) {
  const confirmadas = alertas.filter((a) => !a.sin_confirmar)
  return confirmadas.sort((a, b) => NIVELES[b.nivel].gravedad - NIVELES[a.nivel].gravedad)[0] ?? null
}
