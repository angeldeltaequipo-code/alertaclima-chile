// Reportes ciudadanos: llamadas a la API, identificador anónimo del dispositivo
// y cola de envíos pendientes para cuando no hay señal.
import { guardar, leer } from './almacen'

// URL del servidor. Si no está configurada, la app funciona sin reportes y lo dice.
export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
export const reportesDisponibles = Boolean(API_URL)

export const CATEGORIAS = [
  { id: 'anegamiento', nombre: 'Calle anegada' },
  { id: 'desborde', nombre: 'Desborde de río o canal' },
  { id: 'corte_ruta', nombre: 'Camino cortado' },
  { id: 'corte_luz', nombre: 'Corte de luz' },
  { id: 'arbol_caido', nombre: 'Árbol caído' },
  { id: 'otro', nombre: 'Otro peligro' },
]
export const nombreCategoria = (id) => CATEGORIAS.find((c) => c.id === id)?.nombre ?? 'Reporte'

/** Identificador aleatorio de este dispositivo, solo para votar una vez por reporte. No es personal. */
export function idDispositivo() {
  let id = leer('dispositivo')
  if (!id) {
    id = crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-dispositivo`
    guardar('dispositivo', id)
  }
  return id
}

export class ErrorApi extends Error {
  constructor(mensaje, estado) {
    super(mensaje)
    this.estado = estado
  }
}

async function pedir(ruta, opciones = {}) {
  let r
  try {
    r = await fetch(`${API_URL}${ruta}`, {
      ...opciones,
      headers: { 'content-type': 'application/json', ...(opciones.headers ?? {}) },
    })
  } catch {
    throw new ErrorApi('No hay conexión con el servidor', 0)
  }
  const cuerpo = await r.json().catch(() => ({}))
  if (!r.ok) throw new ErrorApi(cuerpo.error ?? `El servidor respondió ${r.status}`, r.status)
  return cuerpo
}

export const revivir = (x) => ({ ...x, creado: new Date(x.creado), vence: new Date(x.vence) })

export async function listarReportes(cut, { signal } = {}) {
  const { reportes } = await pedir(`/api/reportes?comuna=${encodeURIComponent(cut)}`, { signal })
  return reportes.map(revivir)
}

export async function crearReporte(datos) {
  const { reporte } = await pedir('/api/reportes', { method: 'POST', body: JSON.stringify(datos) })
  return revivir(reporte)
}

export async function votarReporte(id, voto) {
  const { reporte } = await pedir(`/api/reportes/${id}/votos`, {
    method: 'POST',
    body: JSON.stringify({ voto, dispositivo: idDispositivo() }),
  })
  guardar(`voto:${id}`, voto)
  return revivir(reporte)
}

export const miVoto = (id) => leer(`voto:${id}`, 0)

// ---- Cola sin conexión ----

export const pendientes = () => leer('cola:reportes', [])

export function encolar(datos) {
  guardar('cola:reportes', [...pendientes(), { ...datos, encolado: new Date().toISOString() }])
}

/** Envía lo pendiente. Descarta lo que el servidor rechaza por datos inválidos (4xx que no sean 429). */
export async function enviarPendientes() {
  const cola = pendientes()
  if (!cola.length) return { enviados: 0, restantes: 0 }
  const restantes = []
  let enviados = 0
  for (const item of cola) {
    const { encolado, ...datos } = item
    // Un reporte con más de 6 horas sin enviarse probablemente ya no es útil.
    if (Date.now() - new Date(encolado).getTime() > 6 * 3600e3) continue
    try {
      await crearReporte(datos)
      enviados++
    } catch (e) {
      if (e.estado === 0 || e.estado === 429 || e.estado >= 500) restantes.push(item)
    }
  }
  guardar('cola:reportes', restantes)
  return { enviados, restantes: restantes.length }
}

/** Tiempo transcurrido en palabras: "hace 25 min". */
export function hace(fecha, ahora = Date.now()) {
  const min = Math.max(0, Math.round((ahora - fecha.getTime()) / 60000))
  if (min < 1) return 'recién'
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  return h < 24 ? `hace ${h} h${min % 60 ? ` ${min % 60} min` : ''}` : `hace ${Math.floor(h / 24)} d`
}
