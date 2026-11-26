// Avisos automáticos de SENAPRED: cuando aparece una alerta nueva en senapred.cl (o sube de nivel),
// se notifica al teléfono de quienes siguen esas comunas. Una sola vez por alerta y nivel, aunque el
// servidor se reinicie. Las alertas publicadas hace más de 12 horas no se notifican (ya no es «aviso»).
import { notificarAlerta, tipoDeAviso } from './notificaciones.js'

const MAX_EDAD_MS = 12 * 3600e3

export async function avisarSenapred(pool, alertas, { ahora = Date.now(), notificar = notificarAlerta } = {}) {
  const resumen = []
  for (const a of alertas ?? []) {
    if (!a?.comunas?.length) continue
    const publicada = Date.parse(a.vigente_desde ?? a.confirmada_en)
    if (!Number.isFinite(publicada) || ahora - publicada > MAX_EDAD_MS) continue
    const { rows } = await pool.query('SELECT nivel FROM senapred_avisados WHERE id = $1', [a.id])
    const tipo = tipoDeAviso(rows[0] ? { nivel: rows[0].nivel, estado: 'vigente' } : null, a)
    if (!tipo) continue
    // se marca ANTES de enviar: si se cae a la mitad, no se repite el aviso a quienes ya lo recibieron
    await pool.query(
      `INSERT INTO senapred_avisados (id, nivel, amenaza, publicada) VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET nivel = EXCLUDED.nivel, avisada = now()`,
      [a.id, a.nivel, a.amenaza, new Date(publicada)],
    )
    const r = await notificar(pool, a, tipo)
    const latencia = Math.round((Date.now() - publicada) / 1000)
    await pool.query('UPDATE senapred_avisados SET enviadas = $2, latencia_s = $3 WHERE id = $1', [a.id, r?.enviadas ?? 0, latencia])
    resumen.push({ id: a.id, tipo, enviadas: r?.enviadas ?? 0, latencia })
  }
  return resumen
}
