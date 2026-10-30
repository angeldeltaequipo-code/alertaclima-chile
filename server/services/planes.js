// Planes de pago (SaaS con ingreso mensual recurrente).
//
// - Gratis para siempre: alertas oficiales, SOS, evacuación, clima, mapa (lo que protege la vida).
// - «AlertaClima Familia»: más comunas con avisos, más familiares y ZUMI con IA sin límite.
//
// Cobro:
// - Web: suscripción de Mercado Pago (pesos chilenos, débito automático). MP_ACCESS_TOKEN.
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

// ---------------- Mercado Pago (web) ----------------
const MP = 'https://api.mercadopago.com'
export const mercadoPagoActivo = () => Boolean(process.env.MP_ACCESS_TOKEN)
const appUrl = () => process.env.APP_URL ?? 'https://angeldeltaequipo-code.github.io/alertaclima-chile/'

async function mp(ruta, opciones = {}, fetchFn = fetch) {
  let r
  try {
    r = await fetchFn(`${MP}${ruta}`, {
      ...opciones,
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`, 'content-type': 'application/json', ...(opciones.headers ?? {}) },
      signal: AbortSignal.timeout(20000),
    })
  } catch (err) {
    console.error('Mercado Pago sin respuesta:', err.cause?.code ?? err.message)
    const e = new ErrorValidacion('No pudimos conectar con Mercado Pago. Inténtalo en un momento.', 502)
    e.motivo = String(err.cause?.code ?? err.message).slice(0, 120)
    throw e
  }
  const d = await r.json().catch(() => ({}))
  if (!r.ok) {
    console.error('Mercado Pago', r.status, JSON.stringify(d).slice(0, 300))
    const e = new ErrorValidacion('No pudimos conectar con Mercado Pago. Inténtalo en un momento.', 502)
    e.motivo = String(d.message ?? r.status).slice(0, 120)
    throw e
  }
  return d
}

const correoValido = (c) => typeof c === 'string' && c.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c)

/** Crea la suscripción en Mercado Pago y devuelve el enlace de pago. */
export async function suscribirWeb(db, usuario, { periodo, correo }, { fetchFn = fetch } = {}) {
  if (!cobroActivo() || !mercadoPagoActivo()) throw new ErrorValidacion('Los pagos en la web aún no están disponibles.', 503)
  if (periodo !== 'mensual' && periodo !== 'anual') throw new ErrorValidacion('Elige mensual o anual')
  if (!correoValido(correo)) throw new ErrorValidacion('Escribe un correo válido para el comprobante de pago')
  const p = precios()
  const monto = periodo === 'anual' ? p.anual : p.mensual
  const d = await mp(
    '/preapproval',
    {
      method: 'POST',
      body: JSON.stringify({
        reason: `AlertaClima Familia (${periodo})`,
        external_reference: `u:${usuario.id}`,
        payer_email: correo,
        back_url: `${appUrl()}?plan=gracias`,
        status: 'pending',
        auto_recurring: {
          frequency: periodo === 'anual' ? 12 : 1,
          frequency_type: 'months',
          transaction_amount: monto,
          currency_id: 'CLP',
          ...(p.pruebaDias > 0 ? { free_trial: { frequency: p.pruebaDias, frequency_type: 'days' } } : {}),
        },
      }),
    },
    fetchFn,
  )
  await db.query('UPDATE usuarios SET correo_cobro = $2 WHERE id = $1', [usuario.id, correo])
  await guardarSuscripcion(db, { usuarioId: usuario.id, origen: 'mercadopago', externoId: d.id, periodo, estado: 'pendiente', montoClp: monto })
  return { url: d.init_point, id: d.id }
}

/** Firma de los avisos de Mercado Pago (x-signature: ts=…,v1=…). Sin MP_WEBHOOK_SECRET no se verifica. */
export function firmaMercadoPagoValida({ firma, requestId, dataId }, secreto = process.env.MP_WEBHOOK_SECRET) {
  if (!secreto) return true
  const partes = Object.fromEntries(String(firma ?? '').split(',').map((p) => p.trim().split('=')))
  if (!partes.ts || !partes.v1) return false
  const manifiesto = `id:${String(dataId ?? '').toLowerCase()};request-id:${requestId ?? ''};ts:${partes.ts};`
  const esperada = Buffer.from(createHmac('sha256', secreto).update(manifiesto).digest('hex'))
  const recibida = Buffer.from(partes.v1)
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida)
}

const ESTADO_MP = { authorized: 'activa', paused: 'problema_pago', cancelled: 'cancelada', pending: 'pendiente' }

/** Aviso de Mercado Pago: se consulta la suscripción y se actualiza su estado. */
export async function avisoMercadoPago(db, { tipo, id }, { fetchFn = fetch } = {}) {
  if (!id || !/preapproval/.test(String(tipo ?? ''))) return { ignorado: true }
  const s = await mp(`/preapproval/${encodeURIComponent(id)}`, {}, fetchFn)
  const m = /^u:(\d+)$/.exec(s.external_reference ?? '')
  if (!m) return { ignorado: true }
  let estado = ESTADO_MP[s.status] ?? 'pendiente'
  // Autorizada pero aún sin cobros: está en los días de prueba.
  if (estado === 'activa' && (s.summarized?.charged_quantity ?? 0) === 0 && s.auto_recurring?.free_trial) estado = 'prueba'
  const proximo = s.next_payment_date ? new Date(s.next_payment_date) : null
  // 3 días de gracia por si el cobro se atrasa; cancelada = vale hasta el fin del periodo pagado.
  const venceEn = proximo ? new Date(proximo.getTime() + (estado === 'cancelada' ? 0 : 3 * 86400e3)) : estado === 'cancelada' ? new Date() : null
  const periodo = s.auto_recurring?.frequency === 12 ? 'anual' : 'mensual'
  await guardarSuscripcion(db, {
    usuarioId: m[1],
    origen: 'mercadopago',
    externoId: s.id,
    periodo,
    estado,
    montoClp: Math.round(s.auto_recurring?.transaction_amount ?? 0) || null,
    venceEn,
    detalle: { status: s.status, cobros: s.summarized?.charged_quantity ?? null },
  })
  return { estado }
}

export async function cancelarWeb(db, usuario, { fetchFn = fetch } = {}) {
  const { rows } = await db.query(`SELECT externo_id FROM suscripciones WHERE usuario_id = $1 AND origen = 'mercadopago' AND estado IN ('prueba', 'activa', 'problema_pago', 'pendiente')`, [usuario.id])
  for (const r of rows) {
    await mp(`/preapproval/${encodeURIComponent(r.externo_id)}`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) }, fetchFn)
    await avisoMercadoPago(db, { tipo: 'subscription_preapproval', id: r.externo_id }, { fetchFn })
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
