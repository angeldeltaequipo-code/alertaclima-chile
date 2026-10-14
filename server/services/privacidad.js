import { createHmac } from 'node:crypto'

// Identificadores anónimos para limitar abusos sin guardar datos personales.
// Nunca se guarda la IP ni el identificador del dispositivo: solo un HMAC con
// una clave secreta del servidor, que no se puede revertir.

const SECRETO = process.env.HASH_SECRET
if (!SECRETO && process.env.NODE_ENV === 'production') {
  throw new Error('Falta HASH_SECRET en producción')
}
const clave = SECRETO ?? 'solo-desarrollo-no-usar-en-produccion'

const hmac = (texto) => createHmac('sha256', clave).update(texto).digest('base64url')

/** Hash de quien reporta: cambia cada día (UTC), así no sirve para seguir a nadie en el tiempo. */
export function hashReportante(ip, ahora = new Date()) {
  return hmac(`reporte|${ahora.toISOString().slice(0, 10)}|${ip}`)
}

/** Hash de quien vota: estable por dispositivo, para que cada uno vote una sola vez por reporte. */
export function hashVotante(dispositivo) {
  return hmac(`voto|${dispositivo}`)
}
