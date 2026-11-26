// Métricas de uso sin datos personales (panel de zumichile.com/panel).
// Un latido por apertura: { id al azar de la instalación, comuna, plataforma, avisos activos }.
// Se guarda solo la huella del id (SHA-256 con sal), nunca el id, ni IP, ni nombre, ni ubicación exacta.
import { createHash } from 'node:crypto'

export const EVENTOS = new Set(['pregunta', 'llamada', 'paseo', 'viaje', 'sos', 'reporte', 'alerta_abierta', 'familia', 'compartir'])
const PLATAFORMAS = new Set(['web', 'pwa', 'android', 'ios'])
const sal = () => process.env.METRICAS_SAL ?? 'zumi-metricas'
export const huellaDe = (id) => createHash('sha256').update(`${sal()}:${id}`).digest('hex').slice(0, 32)

export function validarLatido(b = {}) {
  const id = String(b.id ?? '')
  if (!/^[a-zA-Z0-9-]{16,64}$/.test(id)) return null
  return {
    huella: huellaDe(id),
    plataforma: PLATAFORMAS.has(b.plataforma) ? b.plataforma : 'web',
    comuna: /^\d{5}$/.test(String(b.comuna ?? '')) ? String(b.comuna) : null,
    avisos: b.avisos === true,
  }
}

export function metricasPg(pool) {
  return {
    async latido(l) {
      await pool.query(
        `INSERT INTO metricas_instalaciones (huella, plataforma, comuna_cut, avisos) VALUES ($1, $2, $3, $4)
         ON CONFLICT (huella) DO UPDATE SET plataforma = EXCLUDED.plataforma, comuna_cut = COALESCE(EXCLUDED.comuna_cut, metricas_instalaciones.comuna_cut), avisos = EXCLUDED.avisos`,
        [l.huella, l.plataforma, l.comuna, l.avisos],
      )
      await pool.query('INSERT INTO metricas_dias (huella) VALUES ($1) ON CONFLICT DO NOTHING', [l.huella])
    },
    async evento(tipo) {
      await pool.query('INSERT INTO metricas_eventos (tipo, n) VALUES ($1, 1) ON CONFLICT (dia, tipo) DO UPDATE SET n = metricas_eventos.n + 1', [tipo])
    },
    async resumen() {
      const uno = async (sql, p = []) => (await pool.query(sql, p)).rows
      const [act] = await uno(`SELECT
          COUNT(DISTINCT huella) FILTER (WHERE dia = CURRENT_DATE)::int AS hoy,
          COUNT(DISTINCT huella) FILTER (WHERE dia > CURRENT_DATE - 7)::int AS semana,
          COUNT(DISTINCT huella) FILTER (WHERE dia > CURRENT_DATE - 30)::int AS mes
        FROM metricas_dias WHERE dia > CURRENT_DATE - 30`)
      const [tot] = await uno(`SELECT COUNT(*)::int AS instalaciones, COUNT(*) FILTER (WHERE avisos)::int AS con_avisos FROM metricas_instalaciones`)
      const dias = await uno(`SELECT d::date AS dia,
          (SELECT COUNT(*) FROM metricas_dias m WHERE m.dia = d::date)::int AS activos,
          (SELECT COUNT(*) FROM metricas_instalaciones i WHERE i.primera_vez = d::date)::int AS nuevos
        FROM generate_series(CURRENT_DATE - 29, CURRENT_DATE, interval '1 day') d ORDER BY 1`)
      const comunas = await uno(`SELECT i.comuna_cut AS cut, c.nombre, COUNT(*)::int AS n FROM metricas_instalaciones i
          LEFT JOIN comunas c ON c.cut = i.comuna_cut WHERE i.comuna_cut IS NOT NULL GROUP BY 1, 2 ORDER BY n DESC LIMIT 12`)
      const plataformas = await uno(`SELECT plataforma, COUNT(*)::int AS n FROM metricas_instalaciones GROUP BY 1 ORDER BY n DESC`)
      const eventos = await uno(`SELECT tipo, SUM(n)::int AS n FROM metricas_eventos WHERE dia > CURRENT_DATE - 30 GROUP BY 1 ORDER BY n DESC`)
      const subs = await uno(`SELECT plan, COUNT(*)::int AS n, COALESCE(SUM(CASE WHEN periodo = 'anual' THEN monto_clp / 12 ELSE monto_clp END), 0)::int AS mensual_clp
          FROM suscripciones WHERE estado IN ('activa', 'prueba') GROUP BY 1`).catch(() => [])
      const [push] = await uno('SELECT COUNT(*)::int AS n FROM push_subscriptions').catch(() => [{ n: 0 }])
      // Retención: de quienes llegaron, cuántos volvieron al día siguiente (D1) y en su segunda semana (D7)
      const [ret] = await uno(`SELECT
          COUNT(*) FILTER (WHERE i.primera_vez BETWEEN CURRENT_DATE - 8 AND CURRENT_DATE - 1)::int AS d1_base,
          COUNT(*) FILTER (WHERE i.primera_vez BETWEEN CURRENT_DATE - 8 AND CURRENT_DATE - 1
            AND EXISTS (SELECT 1 FROM metricas_dias m WHERE m.huella = i.huella AND m.dia = i.primera_vez + 1))::int AS d1,
          COUNT(*) FILTER (WHERE i.primera_vez BETWEEN CURRENT_DATE - 37 AND CURRENT_DATE - 14)::int AS d7_base,
          COUNT(*) FILTER (WHERE i.primera_vez BETWEEN CURRENT_DATE - 37 AND CURRENT_DATE - 14
            AND EXISTS (SELECT 1 FROM metricas_dias m WHERE m.huella = i.huella AND m.dia BETWEEN i.primera_vez + 7 AND i.primera_vez + 13))::int AS d7
        FROM metricas_instalaciones i`).catch(() => [{}])
      const avisos = await uno(`SELECT amenaza, nivel, enviadas, latencia_s, avisada FROM senapred_avisados ORDER BY avisada DESC LIMIT 8`).catch(() => [])
      return { activos: act, ...tot, dias, comunas, plataformas, eventos, suscripciones: subs, notificaciones: push?.n ?? 0, retencion: ret, avisos, generado: new Date().toISOString() }
    },
  }
}

export function metricasMemoria() {
  const inst = new Map()
  const dias = new Set()
  const ev = new Map()
  const hoy = () => new Date().toISOString().slice(0, 10)
  return {
    async latido(l) {
      inst.set(l.huella, { ...(inst.get(l.huella) ?? { primera: hoy() }), ...l })
      dias.add(`${hoy()}|${l.huella}`)
    },
    async evento(t) {
      ev.set(t, (ev.get(t) ?? 0) + 1)
    },
    async resumen() {
      const h = [...dias].filter((d) => d.startsWith(hoy())).length
      return {
        activos: { hoy: h, semana: inst.size, mes: inst.size },
        instalaciones: inst.size,
        con_avisos: [...inst.values()].filter((i) => i.avisos).length,
        dias: [],
        comunas: [],
        plataformas: [],
        eventos: [...ev].map(([tipo, n]) => ({ tipo, n })),
        suscripciones: [],
        notificaciones: 0,
        generado: new Date().toISOString(),
      }
    },
  }
}
