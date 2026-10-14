// Carga las 346 comunas (código, nombre, región) y sus límites en la base de datos.
// Usa los mismos archivos que el cliente, para que ambos lados coincidan.
// Nota: los límites están simplificados (~300 m); sirven para asignar la comuna
// de un reporte, pero no para trabajos cartográficos de precisión.
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pool } from '../db/pool.js'

const CLIENTE = join(import.meta.dirname, '..', '..', 'client')
const regiones = JSON.parse(await readFile(join(CLIENTE, 'src', 'data', 'comunas.json'), 'utf8'))

const cliente = await pool.connect()
try {
  await cliente.query('BEGIN')
  let n = 0
  for (const r of regiones) {
    const limites = JSON.parse(await readFile(join(CLIENTE, 'public', 'limites', `${r.cut}.json`), 'utf8'))
    const geomPorCut = new Map(limites.features.map((f) => [f.properties.cut, f.geometry]))
    for (const c of r.comunas) {
      const g = geomPorCut.get(c.cut)
      await cliente.query(
        `INSERT INTO comunas (cut, nombre, region_cut, region_nombre, geom)
         VALUES ($1, $2, $3, $4, CASE WHEN $5::text IS NULL THEN NULL
                 ELSE ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON($5), 4326)) END)
         ON CONFLICT (cut) DO UPDATE SET nombre = EXCLUDED.nombre, region_cut = EXCLUDED.region_cut,
           region_nombre = EXCLUDED.region_nombre, geom = EXCLUDED.geom`,
        [c.cut, c.nombre, r.cut, r.nombreOficial, g ? JSON.stringify(g) : null],
      )
      n++
    }
  }
  await cliente.query('COMMIT')
  console.log(`${n} comunas cargadas.`)
} catch (e) {
  await cliente.query('ROLLBACK')
  throw e
} finally {
  cliente.release()
  await pool.end()
}
