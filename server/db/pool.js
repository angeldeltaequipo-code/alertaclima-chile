import pg from 'pg'

// Una sola conexión compartida a PostgreSQL/PostGIS.
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
})

export async function dbDisponible() {
  try {
    const { rows } = await pool.query('SELECT postgis_version() AS v')
    return { ok: true, postgis: rows[0].v }
  } catch (e) {
    return { ok: false, error: e.code ?? e.message }
  }
}
