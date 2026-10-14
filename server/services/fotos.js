// Fotos de los reportes vecinales.
//
// - Solo quien creó el reporte puede agregarle una foto (clave de edición), una sola
//   vez y durante los primeros 30 minutos.
// - Se aceptan solo JPEG y WebP de hasta 800 KB. A los JPEG se les quitan los
//   metadatos (EXIF, que puede incluir la ubicación exacta de la casa de quien la tomó).
// - Con 2 denuncias de la comunidad, la foto se oculta hasta que un administrador la revise.
import { createHash, randomBytes } from 'node:crypto'
import { ErrorValidacion } from './reportes.js'

export const REGLAS_FOTOS = { maxBytes: 800 * 1024, minutosParaAgregar: 30, denunciasParaOcultar: 2 }

export const nuevaClaveEdicion = () => randomBytes(24).toString('base64url')
export const hashClave = (c) => createHash('sha256').update(String(c)).digest('base64url')

/** Tipo real del archivo según sus primeros bytes (no se confía en lo que dice el cliente). */
export function tipoImagen(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp'
  return null
}

/** Quita de un JPEG los bloques de metadatos (APP1–APP15 y comentarios), dejando la imagen intacta. */
export function limpiarJpeg(buf) {
  const partes = [buf.subarray(0, 2)]
  let i = 2
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) break
    const marca = buf[i + 1]
    if (marca === 0xff) {
      i++ // byte de relleno
      continue
    }
    if (marca === 0xda) {
      // Inicio de los datos de la imagen: desde aquí se copia todo tal cual.
      partes.push(buf.subarray(i))
      return Buffer.concat(partes)
    }
    const largo = buf.readUInt16BE(i + 2)
    const segmento = buf.subarray(i, i + 2 + largo)
    const esMetadato = (marca >= 0xe1 && marca <= 0xef) || marca === 0xfe
    if (!esMetadato) partes.push(segmento)
    i += 2 + largo
  }
  throw new ErrorValidacion('La imagen está dañada')
}

/** WebP: se quitan los bloques EXIF y XMP del contenedor RIFF. */
export function limpiarWebp(buf) {
  const partes = []
  let i = 12
  while (i + 8 <= buf.length) {
    const tipo = buf.toString('ascii', i, i + 4)
    const largo = buf.readUInt32LE(i + 4)
    const total = 8 + largo + (largo % 2)
    if (tipo !== 'EXIF' && tipo !== 'XMP ') partes.push(buf.subarray(i, i + total))
    i += total
  }
  const cuerpo = Buffer.concat(partes)
  const cabecera = Buffer.alloc(12)
  cabecera.write('RIFF', 0, 'ascii')
  cabecera.writeUInt32LE(cuerpo.length + 4, 4)
  cabecera.write('WEBP', 8, 'ascii')
  return Buffer.concat([cabecera, cuerpo])
}

export async function agregarFoto(db, reporteId, clave, buf) {
  const id = Number(reporteId)
  if (!Number.isSafeInteger(id) || id <= 0) throw new ErrorValidacion('Reporte inválido')
  if (!Buffer.isBuffer(buf) || !buf.length) throw new ErrorValidacion('Falta la foto')
  if (buf.length > REGLAS_FOTOS.maxBytes) throw new ErrorValidacion('La foto pesa demasiado (máximo 800 KB)', 413)
  const mime = tipoImagen(buf)
  if (!mime) throw new ErrorValidacion('Solo se aceptan fotos JPEG o WebP', 415)

  const { rows } = await db.query(
    `SELECT id, clave_edicion_hash, status, created_at,
            (SELECT count(*) FROM report_photos WHERE report_id = r.id)::int AS fotos
     FROM emergency_reports r WHERE id = $1`,
    [id],
  )
  const r = rows[0]
  if (!r) throw new ErrorValidacion('El reporte no existe', 404)
  if (!clave || !r.clave_edicion_hash || hashClave(clave) !== r.clave_edicion_hash) {
    throw new ErrorValidacion('Solo quien hizo el reporte puede agregarle una foto', 403)
  }
  if (r.status !== 'activo') throw new ErrorValidacion('El reporte ya no está activo', 409)
  if (r.fotos > 0) throw new ErrorValidacion('Este reporte ya tiene una foto', 409)
  if (Date.now() - new Date(r.created_at).getTime() > REGLAS_FOTOS.minutosParaAgregar * 60000) {
    throw new ErrorValidacion('Pasó el plazo para agregar una foto a este reporte', 409)
  }

  const limpia = mime === 'image/jpeg' ? limpiarJpeg(buf) : limpiarWebp(buf)
  const { rows: ins } = await db.query(
    `INSERT INTO report_photos (report_id, mime, datos, bytes) VALUES ($1, $2, $3, $4) RETURNING id`,
    [id, mime, limpia, limpia.length],
  )
  return ins[0].id
}

export async function leerFoto(db, fotoId) {
  const id = Number(fotoId)
  if (!Number.isSafeInteger(id) || id <= 0) throw new ErrorValidacion('Foto inválida', 404)
  const { rows } = await db.query(`SELECT mime, datos, estado FROM report_photos WHERE id = $1`, [id])
  const f = rows[0]
  if (!f || f.estado !== 'visible' || !f.datos) throw new ErrorValidacion('La foto no está disponible', 404)
  return f
}

/** Denuncia de un dispositivo. Devuelve el id del reporte y si la foto quedó oculta. */
export async function denunciarFoto(db, fotoId, voterHash) {
  const id = Number(fotoId)
  if (!Number.isSafeInteger(id) || id <= 0) throw new ErrorValidacion('Foto inválida')
  await db.query(
    `INSERT INTO photo_flags (photo_id, voter_hash) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [id, voterHash],
  )
  const { rows } = await db.query(
    `UPDATE report_photos SET
       denuncias = (SELECT count(*) FROM photo_flags WHERE photo_id = $1),
       estado = CASE WHEN estado = 'visible' AND (SELECT count(*) FROM photo_flags WHERE photo_id = $1) >= $2
                     THEN 'oculta' ELSE estado END
     WHERE id = $1 RETURNING report_id, estado, denuncias`,
    [id, REGLAS_FOTOS.denunciasParaOcultar],
  )
  if (!rows[0]) throw new ErrorValidacion('La foto no existe', 404)
  return rows[0]
}

// ---- Revisión por administradores ----

export async function fotosPorRevisar(db) {
  const { rows } = await db.query(
    `SELECT p.id, p.report_id, p.denuncias, p.estado, p.creada_en, p.bytes, r.comuna_cut, r.title AS titulo
     FROM report_photos p JOIN emergency_reports r ON r.id = p.report_id
     WHERE p.estado = 'oculta' ORDER BY p.creada_en DESC LIMIT 100`,
  )
  return rows
}

/** Imagen de una foto oculta, solo para que el administrador la revise. */
export async function leerFotoAdmin(db, fotoId) {
  const { rows } = await db.query(`SELECT mime, datos FROM report_photos WHERE id = $1 AND datos IS NOT NULL`, [
    Number(fotoId),
  ])
  if (!rows[0]) throw new ErrorValidacion('La foto no está disponible', 404)
  return rows[0]
}

export async function revisarFoto(db, fotoId, accion) {
  const id = Number(fotoId)
  if (!['restaurar', 'eliminar'].includes(accion)) throw new ErrorValidacion('Acción inválida')
  const { rows } = await db.query(
    accion === 'restaurar'
      ? `UPDATE report_photos SET estado = 'visible', revisada_en = now() WHERE id = $1 RETURNING report_id`
      : `UPDATE report_photos SET estado = 'eliminada', datos = NULL, revisada_en = now() WHERE id = $1 RETURNING report_id`,
    [id],
  )
  if (!rows[0]) throw new ErrorValidacion('La foto no existe', 404)
  await db.query('INSERT INTO admin_log (accion, detalle) VALUES ($1, $2)', [`foto:${accion}`, { id: String(id) }])
  return rows[0].report_id
}
