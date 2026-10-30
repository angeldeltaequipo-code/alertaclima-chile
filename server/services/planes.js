// Planes de pago (SaaS con ingreso mensual recurrente).
//
// - Gratis para siempre: alertas oficiales, SOS, evacuación, clima, mapa (lo que protege la vida).
// - «AlertaClima Familia»: más comunas con avisos, más familiares y ZUMI con IA sin límite.
//
// Cobro:
// - Web: suscripción de Flow.cl (pesos chilenos, tarjetas, cobro automático). FLOW_API_KEY y FLOW_SECRET_KEY.
// - App de iPhone / Android: compras dentro de la app, unificadas por RevenueCat (webhook).
// - Cortesía: el equipo regala el plan (pruebas, prensa, municipios).
//
// Todo queda apagado mientras COBRO_ACTIVO no sea "true": nadie ve límites ni precios.
import { createHmac, timingSafeEqual } from 'node:crypto'
import { ErrorValidacion } from './reportes.js'

export const cobroActivo = () => process.env.COBRO_ACTIVO === 'true'
export const LIMITES = {
  gratis: { comunas: 1, familiares: 1, zumiDia: 5, historialDias: 7 },
  familia: { comunas: 5, familiares: 5, zumiDia: 200, historialDias: 365 },
}
export const precios = () => ({
  mensual: Number(process.env.PRECIO_MENSUAL_CLP ?? 1990),
  anual: Number(process.env.PRECIO_ANUAL_CLP ?? 14990),
  pruebaDias: Number(process.env.PRUEBA_DIAS ?? 7),
  moneda: 'CLP',
})
/** Límites que aplican de verdad: sin cobro activo, todos tienen los del plan Familia. */
export const limitesDe = (plan) => (cobroActivo() ? LIMITES[plan] ?? LIMITES.gratis : LIMITES.familia)

const VIGENTES = ['prueba', 'activa', 'cancelada', 'problema_pago']

/** Plan vigente de una persona: { plan, estado, origen, periodo, venceEn } (gratis si no hay). */
export async function planDe(db, usuarioId) {
  if (!usuarioId) return { plan: 'gratis', estado: null }
  const { rows } = await db.query(
    `SELECT * FROM suscripciones
     WHERE usuario_id = $1 AND estado = ANY($2) AND (vence_en IS NULL OR vence_en > now())
     ORDER BY (estado = 'activa') DESC, vence_en DESC NULLS FIRST LIMIT 1`,
    [usuarioId, VIGENTES],
  )
  const s = rows[0]
  if (!s) return { plan: 'gratis', estado: null }
  return { plan: s.plan, estado: s.estado, origen: s.origen, periodo: s.periodo, venceEn: s.vence_en, id: String(s.id) }
}

/** Crea o actualiza una suscripción por (origen, externo_id) y anota el evento si cambió de estado. */
export async function guardarSuscripcion(db, { usuarioId, origen, externoId, periodo = 'mensual', estado, montoClp = null, venceEn = null, detalle = null }) {
  const { rows } = await db.query(
    `INSERT INTO suscripciones (usuario_id, origen, externo_id, periodo, estado, monto_clp, vence_en)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (origen, externo_id) DO UPDATE SET
       usuario_id = EXCLUDED.usuario_id, periodo = EXCLUDED.periodo, estado = EXCLUDED.estado,
       monto_clp = COALESCE(EXCLUDED.monto_clp, suscripciones.monto_clp), vence_en = EXCLUDED.vence_en, actualizada_en = now()
     RETURNING id, (xmax = 0) AS nueva`,
    [usuarioId, origen, externoId, periodo, estado, montoClp, venceEn],
  )
  await db.query('INSERT INTO suscripcion_eventos (suscripcion_id, tipo, detalle) VALUES ($1, $2, $3)', [rows[0].id, estado, detalle])
  return { id: String(rows[0].id), nueva: rows[0].nueva }
}

// ---------------- Flow (web, Chile) ----------------
// Flujo: cliente en Flow → la persona registra su tarjeta en Flow → se crea la suscripción al plan.
// Flow cobra solo cada mes o año y avisa a /api/pagos/flow; además se resincroniza al consultar el plan.
// Credenciales: FLOW_API_KEY y FLOW_SECRET_KEY (flow.cl → Mis datos → Integración). FLOW_SANDBOX=true para pruebas.
export const flowActivo = () => Boolean(process.env.FLOW_API_KEY && process.env.FLOW_SECRET_KEY)
const flowBase = () => (process.env.FLOW_SANDBOX === 'true' ? 'https://sandbox.flow.cl/api' : 'https://www.flow.cl/api')
const appUrl = () => process.env.APP_URL ?? 'https://angeldeltaequipo-code.github.io/alertaclima-chile/'
const apiUrl = () => (process.env.API_PUBLICA ?? process.env.RENDER_EXTERNAL_URL ?? 'https://alertaclima-api.onrender.com').replace(/\/$/, '')
export const PLANES_FLOW = { mensual: () => process.env.FLOW_PLAN_MENSUAL ?? 'alertaclima_familia_mensual', anual: () => process.env.FLOW_PLAN_ANUAL ?? 'alertaclima_familia_anual' }

/** Firma de Flow: parámetros ordenados por nombre, «nombre+valor» concatenados, HMAC-SHA256 con la clave secreta. */
export function firmaFlow(params, secreto = process.env.FLOW_SECRET_KEY) {
  const texto = Object.keys(params).sort().map((k) => `${k}${params[k]}`).join('')
  return createHmac('sha256', secreto).update(texto).digest('hex')
}

async function flow(ruta, params = {}, { metodo = 'POST', fetchFn = fetch } = {}) {
  const p = Object.fromEntries(Object.entries({ apiKey: process.env.FLOW_API_KEY, ...params }).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))
  const cuerpo = new URLSearchParams({ ...p, s: firmaFlow(p) })
  let r
  try {
    r = metodo === 'GET'
      ? await fetchFn(`${flowBase()}${ruta}?${cuerpo}`, { signal: AbortSignal.timeout(20000) })
      : await fetchFn(`${flowBase()}${ruta}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: cuerpo.toString(), signal: AbortSignal.timeout(20000) })
  } catch (err) {
    console.error('Flow sin respuesta:', err.cause?.code ?? err.message)
    throw new ErrorValidacion('No pudimos conectar con el sistema de pago. Inténtalo en un momento.', 502)
  }
  const d = await r.json().catch(() => ({}))
  if (!r.ok) {
    const e = new ErrorValidacion('No pudimos conectar con el sistema de pago. Inténtalo en un momento.', 502)
    e.codigoFlow = d.code
    e.motivo = String(d.message ?? r.status).slice(0, 160)
    console.error('Flow', ruta, r.status, e.motivo)
    throw e
  }
  return d
}

const correoValido = (c) => typeof c === 'string' && c.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c)

/** Crea los planes en Flow si aún no existen (una vez por arranque). */
let planesListos = null
export async function asegurarPlanesFlow({ fetchFn = fetch } = {}) {
  planesListos ??= (async () => {
    const p = precios()
    for (const periodo of ['mensual', 'anual']) {
      const planId = PLANES_FLOW[periodo]()
      try {
        await flow('/plans/get', { planId }, { metodo: 'GET', fetchFn })
      } catch {
        await flow('/plans/create', {
          planId,
          name: `AlertaClima Familia (${periodo})`,
          currency: 'CLP',
          amount: periodo === 'anual' ? p.anual : p.mensual,
          interval: periodo === 'anual' ? 4 : 3,
          interval_count: 1,
          trial_period_days: p.pruebaDias,
          urlCallback: `${apiUrl()}/api/pagos/flow`,
        }, { fetchFn })
      }
    }
  })().catch((e) => {
    planesListos = null
    throw e
  })
  return planesListos
}

/** Paso 1: cliente en Flow y enlace para registrar la tarjeta. Devuelve { url } para abrir. */
export async function suscribirWeb(db, usuario, { periodo, correo }, { fetchFn = fetch } = {}) {
  if (!cobroActivo() || !flowActivo()) throw new ErrorValidacion('Los pagos en la web aún no están disponibles.', 503)
  if (periodo !== 'mensual' && periodo !== 'anual') throw new ErrorValidacion('Elige mensual o anual')
  if (!correoValido(correo)) throw new ErrorValidacion('Escribe un correo válido para el comprobante de pago')
  await asegurarPlanesFlow({ fetchFn })
  const { rows } = await db.query('SELECT flow_cliente FROM usuarios WHERE id = $1', [usuario.id])
  let cliente = rows[0]?.flow_cliente
  if (!cliente) {
    const c = await flow('/customer/create', { name: String(usuario.nombre ?? 'Cliente AlertaClima').slice(0, 80), email: correo, externalId: `u:${usuario.id}` }, { fetchFn })
    cliente = c.customerId
  }
  await db.query('UPDATE usuarios SET correo_cobro = $2, flow_cliente = $3 WHERE id = $1', [usuario.id, correo, cliente])
  const reg = await flow('/customer/register', { customerId: cliente, url_return: `${apiUrl()}/api/pagos/flow/tarjeta?p=${periodo}` }, { fetchFn })
  return { url: `${reg.url}?token=${encodeURIComponent(reg.token)}` }
}

/** Fecha de Flow («2026-11-30 10:00:00», hora de Chile) a Date. */
const fechaFlow = (t) => (t ? new Date(`${String(t).replace(' ', 'T')}-03:00`) : null)

/** Estado de Flow → estado propio. status: 1 activa, 2 en prueba, 4 cancelada; morose: 1 o 2 = cobro pendiente. */
export function estadoFlow(s) {
  const st = Number(s.status)
  let estado = st === 2 ? 'prueba' : st === 1 ? 'activa' : st === 4 ? 'cancelada' : 'pendiente'
  if (estado === 'activa' && Number(s.morose) > 0) estado = 'problema_pago'
  if ((estado === 'activa' || estado === 'prueba') && Number(s.cancel_at_period_end) === 1) estado = 'cancelada'
  const fin = fechaFlow(s.period_end ?? s.trial_end ?? s.next_invoice_date)
  const venceEn = fin ? new Date(fin.getTime() + (estado === 'cancelada' ? 0 : 3 * 86400e3)) : estado === 'cancelada' ? new Date() : null
  return { estado, venceEn }
}

/** Guarda una suscripción de Flow con su estado actual. */
async function guardarFlow(db, usuarioId, s) {
  const { estado, venceEn } = estadoFlow(s)
  const anual = s.planId === PLANES_FLOW.anual()
  const p = precios()
  await guardarSuscripcion(db, {
    usuarioId,
    origen: 'flow',
    externoId: String(s.subscriptionId),
    periodo: anual ? 'anual' : 'mensual',
    estado,
    montoClp: anual ? p.anual : p.mensual,
    venceEn,
    detalle: { status: s.status, morose: s.morose ?? null },
  })
  return estado
}

/** Paso 2 (Flow vuelve con el token del registro de tarjeta): crea la suscripción. Devuelve a dónde redirigir. */
export async function tarjetaRegistrada(db, { token, periodo }, { fetchFn = fetch } = {}) {
  if (!token) return `${appUrl()}?plan=error`
  const r = await flow('/customer/getRegisterStatus', { token }, { metodo: 'GET', fetchFn })
  if (String(r.status) !== '1') return `${appUrl()}?plan=cancelado`
  const { rows } = await db.query('SELECT id FROM usuarios WHERE flow_cliente = $1', [r.customerId])
  if (!rows[0]) return `${appUrl()}?plan=error`
  const usuarioId = rows[0].id
  // ¿Ya tiene una vigente en Flow? (por si recarga la página)
  const { rows: ya } = await db.query(`SELECT 1 FROM suscripciones WHERE usuario_id = $1 AND origen = 'flow' AND estado IN ('prueba', 'activa', 'problema_pago')`, [usuarioId])
  if (!ya.length) {
    const s = await flow('/subscription/create', { planId: PLANES_FLOW[periodo === 'anual' ? 'anual' : 'mensual'](), customerId: r.customerId }, { fetchFn })
    await guardarFlow(db, usuarioId, s)
  }
  return `${appUrl()}?plan=gracias`
}

/** Resincroniza las suscripciones de Flow de una persona (consulta su estado real en Flow). */
export async function sincronizarFlow(db, usuarioId, { fetchFn = fetch, soloViejas = false } = {}) {
  if (!flowActivo()) return 0
  const { rows } = await db.query(
    `SELECT usuario_id, externo_id FROM suscripciones WHERE usuario_id = $1 AND origen = 'flow' AND estado IN ('prueba', 'activa', 'problema_pago', 'cancelada', 'pendiente')
     ${soloViejas ? "AND actualizada_en < now() - interval '6 hours'" : ''}`,
    [usuarioId],
  )
  for (const r of rows) await guardarFlow(db, r.usuario_id, await flow('/subscription/get', { subscriptionId: r.externo_id }, { metodo: 'GET', fetchFn }))
  return rows.length
}

/** Aviso de Flow por un cobro del plan: se verifica el pago con Flow y se resincroniza a quien pagó. */
export async function avisoFlow(db, { token }, { fetchFn = fetch } = {}) {
  if (!token) return { ignorado: true }
  const pago = await flow('/payment/getStatus', { token }, { metodo: 'GET', fetchFn })
  const correo = pago.payer
  if (!correo) return { ignorado: true }
  const { rows } = await db.query('SELECT id FROM usuarios WHERE lower(correo_cobro) = lower($1)', [correo])
  for (const u of rows) await sincronizarFlow(db, u.id, { fetchFn })
  return { usuarios: rows.length, estadoPago: pago.status }
}

export async function cancelarWeb(db, usuario, { fetchFn = fetch } = {}) {
  const { rows } = await db.query(`SELECT externo_id FROM suscripciones WHERE usuario_id = $1 AND origen = 'flow' AND estado IN ('prueba', 'activa', 'problema_pago', 'pendiente')`, [usuario.id])
  for (const r of rows) {
    // Al final del periodo: sigue teniendo el plan hasta la fecha que ya pagó.
    const s = await flow('/subscription/cancel', { subscriptionId: r.externo_id, at_period_end: 1 }, { fetchFn })
    await guardarFlow(db, usuario.id, s)
  }
  return { canceladas: rows.length }
}

// ---------------- RevenueCat (App Store y Google Play) ----------------
export function autorizacionRevenueCat(cabecera, secreto = process.env.REVENUECAT_WEBHOOK_SECRET) {
  if (!secreto) return false
  const recibido = Buffer.from(String(cabecera ?? '').replace(/^Bearer\s+/i, ''))
  const esperado = Buffer.from(secreto)
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado)
}

const ESTADO_RC = {
  INITIAL_PURCHASE: 'activa',
  RENEWAL: 'activa',
  UNCANCELLATION: 'activa',
  PRODUCT_CHANGE: 'activa',
  SUBSCRIPTION_EXTENDED: 'activa',
  TEMPORARY_ENTITLEMENT_GRANT: 'activa',
  CANCELLATION: 'cancelada',
  EXPIRATION: 'vencida',
  BILLING_ISSUE: 'problema_pago',
}

/** Evento de RevenueCat. El app_user_id de la app es «u:<id de usuario>». */
export async function eventoRevenueCat(db, evento) {
  const e = evento?.event ?? evento
  let estado = ESTADO_RC[e?.type]
  if (!estado) return { ignorado: true }
  const ids = [e.app_user_id, e.original_app_user_id, ...(e.aliases ?? [])]
  const usuarioId = ids.map((x) => /^u:(\d+)$/.exec(String(x ?? ''))?.[1]).find(Boolean)
  if (!usuarioId) return { ignorado: true }
  if (estado === 'activa' && e.period_type === 'TRIAL') estado = 'prueba'
  const anual = /anual|annual|year/i.test(e.product_id ?? '')
  const p = precios()
  await guardarSuscripcion(db, {
    usuarioId,
    origen: e.store === 'PLAY_STORE' ? 'google' : 'apple',
    externoId: String(e.original_transaction_id ?? e.transaction_id ?? e.id),
    periodo: anual ? 'anual' : 'mensual',
    estado,
    montoClp: e.currency === 'CLP' && e.price_in_purchased_currency ? Math.round(e.price_in_purchased_currency) : anual ? p.anual : p.mensual,
    venceEn: e.expiration_at_ms ? new Date(e.expiration_at_ms) : null,
    detalle: { tipo: e.type, producto: e.product_id ?? null, entorno: e.environment ?? null },
  })
  return { estado }
}

// ---------------- Cortesía y métricas ----------------
export async function regalarPlan(db, usuarioId, dias) {
  const d = Number(dias)
  if (!/^\d+$/.test(String(usuarioId)) || !Number.isFinite(d) || d < 1 || d > 3650) throw new ErrorValidacion('Indica el usuario y entre 1 y 3650 días')
  const { rowCount } = await db.query('SELECT 1 FROM usuarios WHERE id = $1', [usuarioId])
  if (!rowCount) throw new ErrorValidacion('Ese usuario no existe', 404)
  return guardarSuscripcion(db, { usuarioId, origen: 'cortesia', externoId: `c:${usuarioId}`, estado: 'activa', montoClp: 0, venceEn: new Date(Date.now() + d * 86400e3) })
}

/** MRR, suscriptores por origen, pruebas, altas y bajas de los últimos 30 días. */
export async function metricas(db) {
  const { rows: activas } = await db.query(
    `SELECT origen, estado, periodo, monto_clp FROM suscripciones
     WHERE estado = ANY($1) AND (vence_en IS NULL OR vence_en > now())`,
    [VIGENTES],
  )
  const pagando = activas.filter((s) => s.origen !== 'cortesia' && (s.estado === 'activa' || s.estado === 'problema_pago'))
  const mrr = Math.round(pagando.reduce((a, s) => a + (s.monto_clp ?? 0) / (s.periodo === 'anual' ? 12 : 1), 0))
  const porOrigen = {}
  for (const s of activas) porOrigen[s.origen] = (porOrigen[s.origen] ?? 0) + 1
  const { rows: ev } = await db.query(
    `SELECT e.tipo, count(DISTINCT e.suscripcion_id)::int AS n FROM suscripcion_eventos e JOIN suscripciones s ON s.id = e.suscripcion_id
     WHERE e.creado_en > now() - interval '30 days' AND s.origen <> 'cortesia' GROUP BY e.tipo`,
  )
  const e30 = Object.fromEntries(ev.map((r) => [r.tipo, r.n]))
  const { rows: u } = await db.query('SELECT count(*)::int AS n FROM usuarios')
  return {
    cobroActivo: cobroActivo(),
    mrrClp: mrr,
    arrClp: mrr * 12,
    pagando: pagando.length,
    enPrueba: activas.filter((s) => s.estado === 'prueba').length,
    cortesia: porOrigen.cortesia ?? 0,
    problemaPago: activas.filter((s) => s.estado === 'problema_pago').length,
    porOrigen,
    ultimos30: { altas: e30.activa ?? 0, pruebas: e30.prueba ?? 0, cancelaciones: e30.cancelada ?? 0, vencidas: e30.vencida ?? 0 },
    usuarios: u[0].n,
    conversion: u[0].n ? Math.round((pagando.length / u[0].n) * 1000) / 10 : 0,
  }
}
