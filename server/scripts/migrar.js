// Aplica en orden las migraciones de db/migrations que aún no se han aplicado.
// Cada archivo corre dentro de una transacción.
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pool } from '../db/pool.js'

const DIR = join(import.meta.dirname, '..', 'db', 'migrations')

const cliente = await pool.connect()
try {
  await cliente.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    nombre TEXT PRIMARY KEY, aplicada_en TIMESTAMPTZ NOT NULL DEFAULT now())`)
  const { rows } = await cliente.query('SELECT nombre FROM schema_migrations')
  const aplicadas = new Set(rows.map((r) => r.nombre))
  const archivos = (await readdir(DIR)).filter((f) => f.endsWith('.sql')).sort()

  let n = 0
  for (const archivo of archivos) {
    if (aplicadas.has(archivo)) continue
    const sql = await readFile(join(DIR, archivo), 'utf8')
    await cliente.query('BEGIN')
    try {
      await cliente.query(sql)
      await cliente.query('INSERT INTO schema_migrations (nombre) VALUES ($1)', [archivo])
      await cliente.query('COMMIT')
      console.log(`Aplicada ${archivo}`)
      n++
    } catch (e) {
      await cliente.query('ROLLBACK')
      throw new Error(`Falló ${archivo}: ${e.message}`)
    }
  }
  console.log(n ? `${n} migración(es) aplicada(s).` : 'La base de datos ya está al día.')
} finally {
  cliente.release()
  await pool.end()
}
