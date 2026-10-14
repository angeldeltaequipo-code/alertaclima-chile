// Reglas de negocio de los reportes ciudadanos. Toda la lógica vive aquí, separada de
// las rutas HTTP, para poder probarla directo contra la base de datos.

export const CATEGORIAS = {
  anegamiento: 'Calle anegada',
  desborde: 'Desborde de río o canal',
  corte_ruta: 'Camino cortado',
  corte_luz: 'Corte de luz',
  arbol_caido: 'Árbol caído',
  otro: 'Otro peligro',
}

export const REGLAS = {
  maxReportesPorHora: 5,
  votosNetosParaOcultar: 3, // desmentidos − confirmaciones
  duracionInicialHoras: 12,
  extensionPorConfirmacionHoras: 6,
  duracionMaximaHoras: 48,
}

// Límites aproximados del territorio continental e insular de Chile (incluye Rapa Nui).
const enRangoChile = (lat, lng) => lat >= -56.5 && lat <= -17 && lng >= -110 && lng <= -66

export class ErrorValidacion extends Error {
  constructor(mensaje, estado = 400) {
    super(mensaje)
    this.estado = estado
  }
}

const CAMPOS = `
  r.id, r.category AS categoria, r.title AS titulo, r.description AS descripcion,
  ST_Y(r.geom) AS lat, ST_X(r.geom) AS lng, r.comuna_cut, r.status AS estado,
  r.confirmations AS confirmaciones, r.flags AS desmentidos,
  r.created_at AS creado, r.expires_at AS vence`

function limpiarTexto(v, max) {
  if (v === undefined || v === null) return null
  if (typeof v !== 'string') throw new ErrorValidacion('Texto inválido')
  const t = v.replace(/\s+/g, ' ').trim()
  if (!t) return null
  if (t.length > max) throw new ErrorValidacion(`El texto no puede superar ${max} caracteres`)
  return t
}

/** Valida y normaliza lo que manda el cliente. No confía en nada de lo que llega. */
export function validarNuevoReporte(cuerpo) {
  if (!cuerpo || typeof cuerpo !== 'object') throw new ErrorValidacion('Faltan los datos del reporte')
  const { categoria, titulo, descripcion, lat, lng } = cuerpo
  if (!Object.hasOwn(CATEGORIAS, categoria)) throw new ErrorValidacion('Elige qué está pasando')
  const la = Number(lat)
  const lo = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(lo)) throw new ErrorValidacion('Falta la ubicación del reporte')
  if (!enRangoChile(la, lo)) throw new ErrorValidacion('La ubicación está fuera de Chile', 422)
  return {
    categoria,
    titulo: limpiarTexto(titulo, 150) ?? CATEGORIAS[categoria],
    descripcion: limpiarTexto(descripcion, 500),
    // ~11 m de precisión: suficiente para ubicar el problema, no a la persona.
    lat: Math.round(la * 1e4) / 1e4,
    lng: Math.round(lo * 1e4) / 1e4,
  }
}

export async function listarReportes(db, comunaCut) {
  if (!/^\d{5}$/.test(comunaCut ?? '')) throw new ErrorValidacion('Comuna inválida')
  const { rows } = await db.query(
    `SELECT ${CAMPOS} FROM emergency_reports r
     WHERE r.comuna_cut = $1 AND r.status = 'activo' AND r.expires_at > now()
     ORDER BY r.created_at DESC LIMIT 500`,
    [comunaCut],
  )
  return rows
}

export async function crearReporte(db, datos, reporterHash) {
  const v = validarNuevoReporte(datos)
  const cliente = await db.connect()
  try {
    await cliente.query('BEGIN')
    // Serializa los envíos de un mismo reportante para que el límite no se pueda saltar en paralelo.
    await cliente.query('SELECT pg_advisory_xact_lock(hashtext($1))', [reporterHash])
    const { rows: rec } = await cliente.query(
      `SELECT count(*)::int AS n FROM emergency_reports
       WHERE reporter_hash = $1 AND created_at > now() - INTERVAL '1 hour'`,
      [reporterHash],
    )
    if (rec[0].n >= REGLAS.maxReportesPorHora) {
      throw new ErrorValidacion('Llegaste al máximo de 5 reportes por hora. Intenta más tarde.', 429)
    }
    // La comuna la decide el servidor según la ubicación, no el cliente.
    const { rows: com } = await cliente.query(
      `SELECT cut FROM comunas WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)) LIMIT 1`,
      [v.lng, v.lat],
    )
    let cut = com[0]?.cut
    if (!cut) {
      // Puntos en la costa o en el borde de los límites simplificados: la comuna más cercana a menos de 2 km.
      const { rows: cerca } = await cliente.query(
        `SELECT cut FROM comunas
         WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 2000)
         ORDER BY geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326) LIMIT 1`,
        [v.lng, v.lat],
      )
      cut = cerca[0]?.cut
    }
    if (!cut) throw new ErrorValidacion('La ubicación no está dentro de ninguna comuna de Chile', 422)

    const { rows } = await cliente.query(
      `INSERT INTO emergency_reports (title, category, comuna_cut, geom, description, reporter_hash, expires_at)
       VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6, $7, now() + make_interval(hours => $8))
       RETURNING id`,
      [v.titulo, v.categoria, cut, v.lng, v.lat, v.descripcion, reporterHash, REGLAS.duracionInicialHoras],
    )
    const { rows: final } = await cliente.query(`SELECT ${CAMPOS} FROM emergency_reports r WHERE r.id = $1`, [
      rows[0].id,
    ])
    await cliente.query('COMMIT')
    return final[0]
  } catch (e) {
    await cliente.query('ROLLBACK')
    throw e
  } finally {
    cliente.release()
  }
}

/**
 * Registra o cambia el voto de un dispositivo. Recalcula los conteos, oculta el
 * reporte si la comunidad lo desmiente y extiende su vigencia si lo confirma.
 */
export async function votar(db, reporteId, voto, voterHash) {
  const id = Number(reporteId)
  if (!Number.isSafeInteger(id) || id <= 0) throw new ErrorValidacion('Reporte inválido')
  if (voto !== 1 && voto !== -1) throw new ErrorValidacion('Voto inválido')

  const cliente = await db.connect()
  try {
    await cliente.query('BEGIN')
    const { rows: r } = await cliente.query(
      `SELECT id, status, created_at FROM emergency_reports WHERE id = $1 FOR UPDATE`,
      [id],
    )
    if (!r[0]) throw new ErrorValidacion('El reporte no existe', 404)
    if (r[0].status !== 'activo') throw new ErrorValidacion('Este reporte ya no está activo', 409)

    const { rows: previo } = await cliente.query(
      `SELECT vote FROM report_votes WHERE report_id = $1 AND voter_hash = $2`,
      [id, voterHash],
    )
    await cliente.query(
      `INSERT INTO report_votes (report_id, voter_hash, vote) VALUES ($1, $2, $3)
       ON CONFLICT (report_id, voter_hash) DO UPDATE SET vote = EXCLUDED.vote, created_at = now()`,
      [id, voterHash, voto],
    )
    const confirmaNuevo = voto === 1 && previo[0]?.vote !== 1
    const { rows: act } = await cliente.query(
      `UPDATE emergency_reports r SET
         confirmations = c.pos, flags = c.neg,
         status = CASE WHEN c.neg - c.pos >= $2 THEN 'oculto'::report_status ELSE r.status END,
         expires_at = CASE WHEN $3 THEN LEAST(
             GREATEST(r.expires_at, now() + make_interval(hours => $4)),
             r.created_at + make_interval(hours => $5))
           ELSE r.expires_at END
       FROM (SELECT count(*) FILTER (WHERE vote = 1)::int AS pos,
                    count(*) FILTER (WHERE vote = -1)::int AS neg
             FROM report_votes WHERE report_id = $1) c
       WHERE r.id = $1
       RETURNING r.id`,
      [id, REGLAS.votosNetosParaOcultar, confirmaNuevo, REGLAS.extensionPorConfirmacionHoras, REGLAS.duracionMaximaHoras],
    )
    const { rows: final } = await cliente.query(`SELECT ${CAMPOS} FROM emergency_reports r WHERE r.id = $1`, [
      act[0].id,
    ])
    await cliente.query('COMMIT')
    return final[0]
  } catch (e) {
    await cliente.query('ROLLBACK')
    throw e
  } finally {
    cliente.release()
  }
}

/** Borra reportes vencidos hace más de 90 días (los recientes se guardan para informes). */
export async function limpiarVencidos(db) {
  const { rowCount } = await db.query(
    `DELETE FROM emergency_reports WHERE expires_at < now() - INTERVAL '90 days'`,
  )
  return rowCount
}
