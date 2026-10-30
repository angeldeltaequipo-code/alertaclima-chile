// Notificaciones (Web Push): llegan al teléfono aunque la app esté cerrada.
//
// - Las claves VAPID (que identifican a este servidor ante Google, Apple y Mozilla)
//   se generan solas la primera vez y se guardan en la base de datos. Si existen
//   VAPID_PUBLIC_KEY y VAPID_PRIVATE_KEY en el entorno, se usan esas.
// - Solo se notifican alertas oficiales: nueva, sube de nivel o termina.
//   Los reportes vecinales no generan notificaciones.
import webpush from 'web-push'
import { enviarFCM, esNativa } from './fcm.js'

/** Envía por Web Push o, si es la app nativa (endpoint «fcm:…»), por Firebase. */
export const enviarUniversal = (sub, mensaje, opciones) => (esNativa(sub.endpoint) ? enviarFCM(sub.endpoint, mensaje, opciones) : webpush.sendNotification(sub, mensaje, opciones))
import { ErrorValidacion } from './reportes.js'
import { NIVELES } from './alertas.js'

const ETIQUETAS = {
  preventiva: 'Alerta Temprana Preventiva',
  amarilla: 'Alerta Amarilla',
  roja: 'Alerta Roja',
  evacuacion: 'EVACUACIÓN',
}

let claves = null

export async function clavesVapid(db) {
  if (claves) return claves
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    claves = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY }
  } else {
    const { rows } = await db.query(`SELECT valor FROM server_config WHERE clave = 'vapid'`)
    if (rows[0]) claves = JSON.parse(rows[0].valor)
    else {
      const nuevas = webpush.generateVAPIDKeys()
      // Si dos procesos arrancan a la vez, gana el primero y el otro lee el mismo par.
      await db.query(`INSERT INTO server_config (clave, valor) VALUES ('vapid', $1) ON CONFLICT DO NOTHING`, [
        JSON.stringify(nuevas),
      ])
      const { rows: r2 } = await db.query(`SELECT valor FROM server_config WHERE clave = 'vapid'`)
      claves = JSON.parse(r2[0].valor)
    }
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'https://angeldeltaequipo-code.github.io/alertaclima-chile/', claves.publicKey, claves.privateKey)
  return claves
}

export function reiniciarClaves() {
  claves = null
}

function validarSuscripcion(s) {
  const endpoint = s?.endpoint
  const p256dh = s?.keys?.p256dh
  const auth = s?.keys?.auth
  // Web Push (https://…) o app nativa (fcm:<token de Firebase>).
  if (typeof endpoint !== 'string' || !(/^https:\/\//.test(endpoint) || /^fcm:[\w:-]{20,400}$/.test(endpoint)) || endpoint.length > 1000) {
    throw new ErrorValidacion('Suscripción inválida')
  }
  if (typeof p256dh !== 'string' || typeof auth !== 'string' || p256dh.length > 200 || auth.length > 100) {
    throw new ErrorValidacion('Suscripción inválida')
  }
  return { endpoint, p256dh, auth }
}

/** Crea o actualiza la suscripción de un navegador con sus comunas (máximo 5). */
export async function guardarSuscripcion(pool, suscripcion, comunas) {
  const s = validarSuscripcion(suscripcion)
  if (!Array.isArray(comunas) || !comunas.length || comunas.length > 5 || !comunas.every((c) => /^\d{5}$/.test(c))) {
    throw new ErrorValidacion('Elige entre 1 y 5 comunas')
  }
  const cliente = await pool.connect()
  try {
    await cliente.query('BEGIN')
    const { rows } = await cliente.query(
      `INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES ($1, $2, $3)
       ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, fallos = 0
       RETURNING id`,
      [s.endpoint, s.p256dh, s.auth],
    )
    const id = rows[0].id
    await cliente.query('DELETE FROM push_subscription_comunas WHERE subscription_id = $1', [id])
    const { rowCount } = await cliente.query(
      `INSERT INTO push_subscription_comunas (subscription_id, comuna_cut)
       SELECT $1, cut FROM comunas WHERE cut = ANY($2::char(5)[])`,
      [id, comunas],
    )
    if (!rowCount) throw new ErrorValidacion('Ninguna de esas comunas existe')
    await cliente.query('COMMIT')
    return { id, comunas: rowCount }
  } catch (e) {
    await cliente.query('ROLLBACK')
    throw e
  } finally {
    cliente.release()
  }
}

export async function borrarSuscripcion(db, endpoint) {
  if (typeof endpoint !== 'string') throw new ErrorValidacion('Suscripción inválida')
  await db.query('DELETE FROM push_subscriptions WHERE endpoint = $1', [endpoint])
}

/** Arma el mensaje de una alerta. tipo: 'nueva' | 'sube' | 'termina'. */
export function mensajeAlerta(alerta, tipo, urlApp) {
  const nivel = ETIQUETAS[alerta.nivel] ?? 'Alerta'
  const grave = alerta.nivel === 'roja' || alerta.nivel === 'evacuacion'
  if (tipo === 'termina') {
    return {
      titulo: `Terminó: ${nivel}`,
      cuerpo: `${alerta.amenaza}. ${alerta.fuente_nombre} levantó esta alerta.`,
      nivel: alerta.nivel,
      grave: false,
      url: urlApp,
      etiqueta: `alerta-${alerta.id}`,
      tipo,
    }
  }
  return {
    titulo: `${tipo === 'sube' ? 'Sube a ' : ''}${nivel}: ${alerta.amenaza}`,
    cuerpo: alerta.instrucciones ? `${alerta.titulo}. ${alerta.instrucciones}` : alerta.titulo,
    nivel: alerta.nivel,
    grave,
    url: urlApp,
    etiqueta: `alerta-${alerta.id}`,
    tipo,
  }
}

/**
 * Qué notificar al cambiar una alerta, comparando antes y después.
 * Devuelve null si no corresponde avisar (confirmaciones, correcciones de texto…).
 */
export function tipoDeAviso(antes, despues) {
  if (!antes) return 'nueva'
  if (antes.estado === 'vigente' && despues.estado === 'cancelada') return 'termina'
  if (NIVELES.indexOf(despues.nivel) > NIVELES.indexOf(antes.nivel)) return 'sube'
  return null
}

/**
 * Envía a todos los suscritos de las comunas de la alerta. Una persona suscrita a
 * varias de esas comunas recibe una sola notificación. Borra las suscripciones que
 * el servicio de notificaciones informa como vencidas (404/410).
 */
export async function notificarAlerta(pool, alerta, tipo, { enviar = enviarUniversal, urlApp } = {}) {
  await clavesVapid(pool)
  const { rows } = await pool.query(
    `SELECT DISTINCT s.id, s.endpoint, s.p256dh, s.auth
     FROM push_subscriptions s JOIN push_subscription_comunas c ON c.subscription_id = s.id
     WHERE c.comuna_cut = ANY($1::char(5)[])`,
    [alerta.comunas],
  )
  const app = urlApp ?? process.env.APP_URL ?? 'https://angeldeltaequipo-code.github.io/alertaclima-chile/'
  const mensaje = JSON.stringify(mensajeAlerta(alerta, tipo, app))
  const resumen = { enviadas: 0, vencidas: 0, fallidas: 0 }
  // Lotes de 20 para no saturar el servidor ni el servicio de notificaciones.
  for (let i = 0; i < rows.length; i += 20) {
    await Promise.all(
      rows.slice(i, i + 20).map(async (s) => {
        try {
          await enviar({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, mensaje, {
            TTL: 6 * 3600,
            urgency: alerta.nivel === 'preventiva' ? 'normal' : 'high',
            topic: `alerta-${alerta.id}`.slice(0, 32),
          })
          resumen.enviadas++
          await pool.query('UPDATE push_subscriptions SET ultimo_ok = now(), fallos = 0 WHERE id = $1', [s.id])
        } catch (e) {
          if (e.statusCode === 404 || e.statusCode === 410) {
            resumen.vencidas++
            await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [s.id])
          } else {
            resumen.fallidas++
            await pool.query('UPDATE push_subscriptions SET fallos = fallos + 1 WHERE id = $1', [s.id])
          }
        }
      }),
    )
  }
  await pool.query('INSERT INTO admin_log (accion, detalle) VALUES ($1, $2)', [
    'notificacion:enviar',
    { id: String(alerta.id), tipo, ...resumen },
  ])
  return resumen
}

const ultimaPrueba = new Map() // endpoint -> hora de la última prueba

/**
 * Notificación de prueba a UN dispositivo ya suscrito (máximo una por minuto).
 * Sirve para que la persona confirme que todo funciona sin esperar una alerta real.
 */
export async function enviarPrueba(pool, endpoint, { enviar = enviarUniversal, urlApp } = {}) {
  if (typeof endpoint !== 'string' || endpoint.length > 1000) throw new ErrorValidacion('Suscripción inválida')
  const antes = ultimaPrueba.get(endpoint)
  if (antes && Date.now() - antes < 60_000) throw new ErrorValidacion('Espera un minuto antes de pedir otra prueba.', 429)
  await clavesVapid(pool)
  const { rows } = await pool.query('SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE endpoint = $1', [endpoint])
  const s = rows[0]
  if (!s) {
    throw new ErrorValidacion('Algo se desconectó. Toca «Desactivar notificaciones» y vuelve a activarlas.', 404)
  }
  ultimaPrueba.set(endpoint, Date.now())
  if (ultimaPrueba.size > 5000) ultimaPrueba.delete(ultimaPrueba.keys().next().value)
  const app = urlApp ?? process.env.APP_URL ?? 'https://angeldeltaequipo-code.github.io/alertaclima-chile/'
  const mensaje = JSON.stringify({
    titulo: 'Prueba de AlertaClima',
    cuerpo: '¡Funciona! Así te llegarán las alertas oficiales de tus comunas.',
    nivel: 'preventiva',
    grave: false,
    url: app,
    etiqueta: 'prueba',
    tipo: 'prueba',
  })
  try {
    await enviar({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, mensaje, { TTL: 600, urgency: 'high' })
    await pool.query('UPDATE push_subscriptions SET ultimo_ok = now(), fallos = 0 WHERE id = $1', [s.id])
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) {
      await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [s.id])
      throw new ErrorValidacion('Algo se desconectó. Toca «Desactivar notificaciones» y vuelve a activarlas.', 410)
    }
    console.error('Prueba de notificación falló', e.statusCode, e.body)
    throw new ErrorValidacion('No pudimos enviar la prueba. Inténtalo de nuevo en un rato.', 502)
  }
}

/** El navegador cambió la suscripción (lo avisa el service worker): se reemplaza conservando las comunas. */
export async function renovarSuscripcion(pool, anterior, nueva) {
  const s = validarSuscripcion(nueva)
  if (typeof anterior !== 'string') throw new ErrorValidacion('Suscripción inválida')
  const { rowCount } = await pool.query(
    `UPDATE push_subscriptions SET endpoint = $2, p256dh = $3, auth = $4, fallos = 0
     WHERE endpoint = $1 AND NOT EXISTS (SELECT 1 FROM push_subscriptions WHERE endpoint = $2)`,
    [anterior, s.endpoint, s.p256dh, s.auth],
  )
  return { actualizada: rowCount > 0 }
}

export async function contarSuscritos(db, cuts) {
  const { rows } = await db.query(
    `SELECT count(DISTINCT subscription_id)::int AS n FROM push_subscription_comunas WHERE comuna_cut = ANY($1::char(5)[])`,
    [cuts],
  )
  return rows[0].n
}
