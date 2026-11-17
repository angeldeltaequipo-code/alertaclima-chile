import pg from 'pg'

// Una sola conexión compartida a PostgreSQL/PostGIS.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 8_000, // si la base no responde, se falla rápido (no se cuelgan las peticiones)
})

// Una conexión caída (base suspendida, reinicio de la base) no debe tumbar el servidor.
pool.on('error', (e) => console.error('Base de datos:', e.code ?? e.message))

/** ¿El error es porque no se puede llegar a la base (no por un problema de los datos)? */
export const sinConexion = (e) =>
  ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', '57P03', '3D000', '28P01'].includes(e?.code) || /terminated|timeout|connect/i.test(String(e?.message))

/** Conecta, o devuelve null si la base no está disponible (el servidor arranca igual, sin ella). */
export async function conectarOAvisar(tarea) {
  try {
    return await pool.connect()
  } catch (e) {
    if (!sinConexion(e)) throw e
    console.warn(`⚠️  ${tarea}: la base de datos no está disponible (${e.code ?? e.message}). El servidor arranca sin ella: clima, alertas y ZUMI siguen funcionando; cuentas, chat y planes quedan en pausa.`)
    await pool.end().catch(() => {})
    return null
  }
}

export async function dbDisponible() {
  try {
    const { rows } = await pool.query('SELECT postgis_version() AS v')
    return { ok: true, postgis: rows[0].v }
  } catch (e) {
    return { ok: false, error: e.code ?? e.message }
  }
}
