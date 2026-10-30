// Planes: Gratis y «AlertaClima Familia». El servidor decide los límites y si el cobro está activo.
// Cobro: compras de la tienda en la app de iPhone y Android (RevenueCat). El cobro web (Flow) queda apagado.
import { API_URL } from './reportes'
import { sesionActual } from './sesion'
import { esNativa, plataforma } from './nativo'

const conSesion = () => {
  const t = sesionActual()?.token
  return t ? { authorization: `Bearer ${t}` } : {}
}

export const LIMITES_LIBRES = { comunas: 5, familiares: 5, zumiDia: 200, historialDias: 365 }

export async function configPlanes() {
  if (!API_URL) return { cobroActivo: false }
  const r = await fetch(`${API_URL}/api/planes`)
  if (!r.ok) throw new Error('planes')
  return r.json()
}

export async function miPlan() {
  if (!API_URL || !sesionActual()?.token) return null
  const r = await fetch(`${API_URL}/api/planes/yo`, { headers: conSesion(), cache: 'no-store' })
  if (!r.ok) return null
  return r.json()
}

async function enviar(ruta, cuerpo) {
  const r = await fetch(`${API_URL}/api/planes${ruta}`, { method: 'POST', headers: { 'content-type': 'application/json', ...conSesion() }, body: JSON.stringify(cuerpo ?? {}) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.error ?? 'No se pudo completar. Inténtalo de nuevo.')
  return d
}

/** Web: abre la página de Flow para registrar la tarjeta; al volver, la suscripción queda creada. */
export async function pagarEnWeb(periodo, correo) {
  const { url } = await enviar('/web', { periodo, correo })
  window.location.href = url
}

export const cancelarWeb = () => enviar('/cancelar')

// ---------- App de tiendas (RevenueCat) ----------
const CLAVES_RC = { ios: import.meta.env.VITE_RC_IOS, android: import.meta.env.VITE_RC_ANDROID }
export const compraEnApp = () => esNativa() && Boolean(CLAVES_RC[plataforma()])

let rcListo = null
async function revenueCat(usuarioId) {
  const { Purchases } = await import('@revenuecat/purchases-capacitor')
  if (!rcListo) rcListo = Purchases.configure({ apiKey: CLAVES_RC[plataforma()], appUserID: usuarioId ? `u:${usuarioId}` : undefined })
  await rcListo
  if (usuarioId) await Purchases.logIn({ appUserID: `u:${usuarioId}` }).catch(() => {})
  return Purchases
}

/** Precios de la tienda (en la moneda del teléfono) para mostrarlos tal cual. */
export async function ofertasTienda(usuarioId) {
  const P = await revenueCat(usuarioId)
  const { current } = await P.getOfferings()
  const paquetes = current?.availablePackages ?? []
  const buscar = (tipo) => paquetes.find((p) => p.packageType === tipo)
  return { mensual: buscar('MONTHLY') ?? null, anual: buscar('ANNUAL') ?? null }
}

export async function comprarEnTienda(usuarioId, paquete) {
  const P = await revenueCat(usuarioId)
  try {
    const { customerInfo } = await P.purchasePackage({ aPackage: paquete })
    return Boolean(customerInfo.entitlements.active.familia)
  } catch (e) {
    if (e?.userCancelled || e?.code === '1') return false
    throw new Error('La tienda no pudo completar la compra. Inténtalo de nuevo.')
  }
}

/** Apple y Google exigen un botón para recuperar compras hechas antes. */
export async function restaurarCompras(usuarioId) {
  const P = await revenueCat(usuarioId)
  const { customerInfo } = await P.restorePurchases()
  return Boolean(customerInfo.entitlements.active.familia)
}

/** Para cambiar o cancelar una suscripción de tienda se abre la página de la tienda. */
export const gestionarEnTienda = () =>
  window.open(plataforma() === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions', '_blank')

/** Abre la pantalla de planes desde cualquier parte (con el motivo que la gatilló). */
export const abrirPlanes = (motivo = 'general') => window.dispatchEvent(new CustomEvent('ac:abrir-planes', { detail: motivo }))
