// Alertas oficiales.
//
// Regla del proyecto: nunca se inventa una alerta. Cada alerta tiene una fuente oficial
// enlazada y la hora de su última verificación. Si nadie la confirma en N horas, se
// marca como "sin confirmar" en vez de seguir mostrándose como vigente.
//
// ---- Interfaz AlertSource ----
// Una fuente de alertas es un objeto { nombre, alertasDeComuna(db, cut) } que devuelve
// alertas con la forma de `CAMPOS` más abajo. Hoy existe solo la fuente "manual"
// (cargada desde el panel). Una integración futura con SENAPRED u otra fuente oficial
// se agrega como otra AlertSource, sin tocar la API ni la app.
import { ErrorValidacion } from './reportes.js'

export const NIVELES = ['preventiva', 'amarilla', 'roja', 'evacuacion']
const GRAVEDAD = Object.fromEntries(NIVELES.map((n, i) => [n, i]))

export const horasSinConfirmar = () => Number(process.env.ALERTA_HORAS_SIN_CONFIRMAR ?? 12)

// Solo se aceptan enlaces a sitios oficiales. Se puede ampliar con FUENTES_PERMITIDAS (separadas por coma).
const DOMINIOS_BASE = ['gob.cl', 'senapred.cl']
const dominiosPermitidos = () => [
  ...DOMINIOS_BASE,
  ...(process.env.FUENTES_PERMITIDAS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
]

export function fuenteValida(url) {
  let u
  try {
    u = new URL(url)
  } catch {
    return false
  }
  if (u.protocol !== 'https:') return false
  return dominiosPermitidos().some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`))
}

const CAMPOS = `
  a.id, a.nivel, a.amenaza, a.titulo, a.descripcion, a.instrucciones,
  a.fuente_nombre, a.fuente_url, a.origen, a.estado,
  a.vigente_desde, a.vigente_hasta, a.confirmada_en, a.actualizada_en`

const fuenteManual = {
  nombre: 'manual',
  async alertasDeComuna(db, cut) {
    const { rows } = await db.query(
      `SELECT ${CAMPOS}, (a.confirmada_en < now() - make_interval(hours => $2)) AS sin_confirmar
       FROM official_alerts a
       JOIN official_alert_comunas c ON c.alert_id = a.id
       WHERE c.comuna_cut = $1 AND a.estado = 'vigente'
         AND a.vigente_desde <= now() AND (a.vigente_hasta IS NULL OR a.vigente_hasta > now())`,
      [cut, horasSinConfirmar()],
    )
    return rows
  },
}

export const FUENTES = [fuenteManual]

/** Alertas vigentes de una comuna, de la más grave a la menos grave. */
export async function alertasDeComuna(db, cut) {
  if (!/^\d{5}$/.test(cut ?? '')) throw new ErrorValidacion('Comuna inválida')
  const listas = await Promise.all(FUENTES.map((f) => f.alertasDeComuna(db, cut)))
  return listas
    .flat()
    .sort((a, b) => a.sin_confirmar - b.sin_confirmar || GRAVEDAD[b.nivel] - GRAVEDAD[a.nivel] || b.confirmada_en - a.confirmada_en)
}

// ---- Administración ----

function texto(v, max, nombre, { requerido = false } = {}) {
  if (v === undefined || v === null || (typeof v === 'string' && !v.trim())) {
    if (requerido) throw new ErrorValidacion(`Falta ${nombre}`)
    return null
  }
  if (typeof v !== 'string') throw new ErrorValidacion(`${nombre} no es válido`)
  const t = v.trim()
  if (t.length > max) throw new ErrorValidacion(`${nombre} no puede superar ${max} caracteres`)
  return t
}

function fecha(v, nombre) {
  if (v === undefined || v === null || v === '') return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) throw new ErrorValidacion(`${nombre} no es una fecha válida`)
  return d
}

export async function validarAlerta(db, datos) {
  if (!datos || typeof datos !== 'object') throw new ErrorValidacion('Faltan los datos de la alerta')
  if (!NIVELES.includes(datos.nivel)) throw new ErrorValidacion('Elige el nivel de la alerta')
  const v = {
    nivel: datos.nivel,
    amenaza: texto(datos.amenaza, 80, 'la amenaza', { requerido: true }),
    titulo: texto(datos.titulo, 160, 'el título', { requerido: true }),
    descripcion: texto(datos.descripcion, 1500, 'la descripción'),
    instrucciones: texto(datos.instrucciones, 1000, 'las instrucciones'),
    fuente_nombre: texto(datos.fuente_nombre, 80, 'el nombre de la fuente', { requerido: true }),
    fuente_url: texto(datos.fuente_url, 500, 'el enlace a la fuente', { requerido: true }),
    vigente_hasta: fecha(datos.vigente_hasta, 'La fecha de término'),
  }
  if (!fuenteValida(v.fuente_url)) {
    throw new ErrorValidacion('El enlace debe ser https y de un sitio oficial (gob.cl o senapred.cl)')
  }
  if (v.vigente_hasta && v.vigente_hasta <= new Date()) throw new ErrorValidacion('La fecha de término ya pasó')

  // Cobertura: lista de comunas y/o regiones completas.
  const comunas = Array.isArray(datos.comunas) ? datos.comunas : []
  const regiones = Array.isArray(datos.regiones) ? datos.regiones : []
  if (!comunas.every((c) => /^\d{5}$/.test(c)) || !regiones.every((r) => /^\d{2}$/.test(r))) {
    throw new ErrorValidacion('Cobertura inválida')
  }
  const { rows } = await db.query(
    `SELECT cut FROM comunas WHERE cut = ANY($1::char(5)[]) OR region_cut = ANY($2::char(2)[]) ORDER BY cut`,
    [comunas, regiones],
  )
  if (!rows.length) throw new ErrorValidacion('Elige al menos una comuna o región')
  v.cobertura = rows.map((r) => r.cut)
  return v
}

async function registrar(db, accion, detalle) {
  await db.query('INSERT INTO admin_log (accion, detalle) VALUES ($1, $2)', [accion, detalle])
}

async function leerAlerta(db, id) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS}, (a.confirmada_en < now() - make_interval(hours => $2)) AS sin_confirmar,
            ARRAY(SELECT comuna_cut FROM official_alert_comunas WHERE alert_id = a.id ORDER BY 1) AS comunas
     FROM official_alerts a WHERE a.id = $1`,
    [id, horasSinConfirmar()],
  )
  if (!rows[0]) throw new ErrorValidacion('La alerta no existe', 404)
  return rows[0]
}

export async function crearAlerta(pool, datos) {
  const v = await validarAlerta(pool, datos)
  const cliente = await pool.connect()
  try {
    await cliente.query('BEGIN')
    const { rows } = await cliente.query(
      `INSERT INTO official_alerts (nivel, amenaza, titulo, descripcion, instrucciones, fuente_nombre, fuente_url, vigente_hasta)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [v.nivel, v.amenaza, v.titulo, v.descripcion, v.instrucciones, v.fuente_nombre, v.fuente_url, v.vigente_hasta],
    )
    const id = rows[0].id
    await cliente.query(
      `INSERT INTO official_alert_comunas (alert_id, comuna_cut) SELECT $1, unnest($2::char(5)[])`,
      [id, v.cobertura],
    )
    await registrar(cliente, 'alerta:crear', { id, nivel: v.nivel, titulo: v.titulo, comunas: v.cobertura.length })
    await cliente.query('COMMIT')
    return leerAlerta(pool, id)
  } catch (e) {
    await cliente.query('ROLLBACK')
    throw e
  } finally {
    cliente.release()
  }
}

/** acciones: "confirmar" (sigue vigente), "cancelar" (terminó), "editar" (corrige datos o cobertura). */
export async function actualizarAlerta(pool, id, { accion, ...datos } = {}) {
  const n = Number(id)
  if (!Number.isSafeInteger(n) || n <= 0) throw new ErrorValidacion('Alerta inválida')
  const antes = await leerAlerta(pool, n)

  if (accion === 'confirmar' || accion === 'cancelar') {
    if (antes.estado !== 'vigente') throw new ErrorValidacion('La alerta ya fue cancelada', 409)
    await pool.query(
      accion === 'confirmar'
        ? `UPDATE official_alerts SET confirmada_en = now(), actualizada_en = now() WHERE id = $1`
        : `UPDATE official_alerts SET estado = 'cancelada', actualizada_en = now() WHERE id = $1`,
      [n],
    )
    await registrar(pool, `alerta:${accion}`, { id: String(n), titulo: antes.titulo })
  } else if (accion === 'editar') {
    const v = await validarAlerta(pool, datos)
    const cliente = await pool.connect()
    try {
      await cliente.query('BEGIN')
      await cliente.query(
        `UPDATE official_alerts SET nivel = $2, amenaza = $3, titulo = $4, descripcion = $5, instrucciones = $6,
           fuente_nombre = $7, fuente_url = $8, vigente_hasta = $9, confirmada_en = now(), actualizada_en = now()
         WHERE id = $1`,
        [n, v.nivel, v.amenaza, v.titulo, v.descripcion, v.instrucciones, v.fuente_nombre, v.fuente_url, v.vigente_hasta],
      )
      await cliente.query('DELETE FROM official_alert_comunas WHERE alert_id = $1', [n])
      await cliente.query(
        `INSERT INTO official_alert_comunas (alert_id, comuna_cut) SELECT $1, unnest($2::char(5)[])`,
        [n, v.cobertura],
      )
      await registrar(cliente, 'alerta:editar', { id: String(n), nivel: v.nivel, comunas: v.cobertura.length })
      await cliente.query('COMMIT')
    } catch (e) {
      await cliente.query('ROLLBACK')
      throw e
    } finally {
      cliente.release()
    }
  } else {
    throw new ErrorValidacion('Acción inválida')
  }
  const despues = await leerAlerta(pool, n)
  // Comunas afectadas = las de antes y las de después (por si cambió la cobertura).
  return { alerta: despues, comunasAfectadas: [...new Set([...antes.comunas, ...despues.comunas])] }
}

export async function listarAlertasAdmin(db) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS}, (a.confirmada_en < now() - make_interval(hours => $1)) AS sin_confirmar,
            ARRAY(SELECT comuna_cut FROM official_alert_comunas WHERE alert_id = a.id ORDER BY 1) AS comunas
     FROM official_alerts a
     WHERE a.estado = 'vigente' OR a.actualizada_en > now() - INTERVAL '7 days'
     ORDER BY (a.estado = 'vigente') DESC, a.actualizada_en DESC
     LIMIT 200`,
    [horasSinConfirmar()],
  )
  return rows
}

export async function bitacora(db) {
  const { rows } = await db.query('SELECT accion, detalle, creado_en FROM admin_log ORDER BY id DESC LIMIT 50')
  return rows
}
