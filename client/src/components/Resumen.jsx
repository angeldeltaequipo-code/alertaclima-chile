import { NIVELES, alertaPrincipal } from '../services/alertas'
import { nombreCategoria } from '../services/reportes'
import { hhmm } from '../services/formato'
import { intensidad } from '../services/clima'

// Puntos de color por tipo de línea. El color nunca va solo: siempre hay texto que lo dice.
const PUNTO = {
  bien: 'var(--ok)',
  atento: 'var(--senal)',
  peligro: 'var(--peligro)',
  neutro: 'var(--texto-2)',
}

function lineaAlertas(estado) {
  if (!estado || estado.tipo === 'sin_servidor') return { tono: 'neutro', texto: 'Alertas oficiales: revisa senapred.cl.' }
  const p = alertaPrincipal(estado.alertas)
  if (p) {
    const tono = p.nivel === 'roja' || p.nivel === 'evacuacion' ? 'peligro' : 'atento'
    return { tono, texto: `${NIVELES[p.nivel].etiqueta} por ${p.amenaza.toLowerCase()}.`, fuerte: true }
  }
  if (estado.alertas.some((a) => a.sin_confirmar)) return { tono: 'atento', texto: 'Hay una alerta sin confirmar: revisa senapred.cl.' }
  return { tono: 'neutro', texto: 'Sin alertas oficiales cargadas.' }
}

function lineaLluvia(horas) {
  if (!horas?.length) return null
  const prox = horas.slice(0, 12)
  const primera = prox.find((h) => h.lluvia >= 0.2)
  if (!primera) return { tono: 'bien', texto: `No se espera lluvia hasta las ${hhmm(prox[prox.length - 1].hora)}.` }
  const max = prox.reduce((a, b) => (b.lluvia > a.lluvia ? b : a))
  const desde = primera === prox[0] ? 'Lluvia desde ahora' : `Lluvia desde las ${hhmm(primera.hora)}`
  const tono = max.lluvia >= 10 ? 'peligro' : max.lluvia >= 2.5 ? 'atento' : 'neutro'
  return { tono, texto: `${desde}; lo más intenso cerca de las ${hhmm(max.hora)} (${intensidad(max.lluvia)}).` }
}

function lineaVecinos(reportes, disponible) {
  if (!disponible) return null
  if (!reportes.length) return { tono: 'bien', texto: 'Ningún vecino ha reportado problemas.' }
  const porTipo = {}
  for (const r of reportes) porTipo[r.categoria] = (porTipo[r.categoria] ?? 0) + 1
  const detalle = Object.entries(porTipo)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([c, n]) => `${n} ${nombreCategoria(c).toLowerCase()}`)
    .join(', ')
  return {
    tono: 'atento',
    texto: `${reportes.length === 1 ? '1 reporte de vecinos' : `${reportes.length} reportes de vecinos`}: ${detalle}.`,
  }
}

/** Lo esencial de un vistazo, en frases simples. */
export default function Resumen({ alertas, ahora, horas, reportes, reportesDisponibles, onVerAlertas, onVerMapa }) {
  const lineas = [
    { ...lineaAlertas(alertas), accion: alertas?.alertas?.length ? { texto: 'Ver', fn: onVerAlertas } : null },
    ahora && { tono: 'neutro', texto: `Ahora: ${Math.round(ahora.temperatura)}° y ${ahora.texto.toLowerCase()}${ahora.medido ? ' (medido)' : ''}.` },
    lineaLluvia(horas),
    (() => {
      const l = lineaVecinos(reportes, reportesDisponibles)
      return l && { ...l, accion: reportes.length ? { texto: 'Mapa', fn: onVerMapa } : null }
    })(),
  ].filter(Boolean)

  return (
    <section aria-labelledby="t-resumen" className="tarjeta">
      <h2 id="t-resumen" className="titulo-tarjeta">
        En resumen
      </h2>
      <ul className="space-y-2.5">
        {lineas.map((l, i) => (
          <li key={i} className="flex items-start gap-3 text-[17px] leading-snug">
            <span className="mt-[7px] size-3 shrink-0 rounded-full" style={{ background: PUNTO[l.tono] }} aria-hidden="true" />
            <span className={`flex-1 ${l.fuerte ? 'font-bold' : ''}`}>{l.texto}</span>
            {l.accion && (
              <button type="button" onClick={l.accion.fn} className="shrink-0 text-[15px] font-bold text-senal-texto underline underline-offset-2">
                {l.accion.texto}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
