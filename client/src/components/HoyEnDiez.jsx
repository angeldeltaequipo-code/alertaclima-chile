// «Tu día en 10 segundos»: lo que importa de hoy en una sola línea (lluvia en minutos, máxima, viento,
// UV, atardecer, helada de mañana), con la precisión verificada del pronóstico en tu comuna.
import { useEffect, useMemo, useState } from 'react'
import { lluviaPronto, momentosDelDia, precision } from '../services/inteligencia'
import { hablar } from '../services/narrador'

const TONO = { lluvia: '#7cc4ff', calor: '#ffb547', alerta: '#ff5a5f', frio: '#b9e3ff', neutro: '#ffffff' }

export default function HoyEnDiez({ punto, horas, dias, ahora }) {
  const [pronto, setPronto] = useState(null)
  const [prec, setPrec] = useState(null)
  useEffect(() => {
    if (!punto) return
    let vivo = true
    const leer = () =>
      lluviaPronto(punto)
        .then((r) => {
          if (!vivo) return
          setPronto(r)
          if (r && r.estado !== 'seco') window.dispatchEvent(new CustomEvent('ac:lluvia-pronto', { detail: r }))
        })
        .catch(() => {})
    leer()
    const t = setInterval(leer, 5 * 60e3)
    precision(punto)
      .then((r) => vivo && setPrec(r))
      .catch(() => {})
    return () => {
      vivo = false
      clearInterval(t)
    }
  }, [punto?.lat, punto?.lng]) // eslint-disable-line react-hooks/exhaustive-deps

  const momentos = useMemo(() => momentosDelDia({ horas, dias, ahora }), [horas, dias, ahora])
  const ya =
    pronto?.estado === 'empieza' && pronto.minutos <= 120
      ? { texto: `Lluvia ${pronto.intensidad} en ${pronto.minutos} min`, sub: `dura ~${pronto.dura} min`, tono: 'lluvia' }
      : pronto?.estado === 'lloviendo'
        ? { texto: `Lloviendo · ${pronto.intensidad}`, sub: pronto.minutos ? `para en ~${pronto.minutos} min` : 'sigue un buen rato', tono: 'lluvia' }
        : null

  const decir = () => {
    const partes = []
    if (ya) partes.push(`${ya.texto}, ${ya.sub}.`)
    momentos.forEach((m) => partes.push(`${m.manana ? 'Mañana' : 'A las'} ${m.hhmm.replace('mañ ', '')}, ${m.texto.toLowerCase()}.`))
    if (prec) partes.push(`Esta semana el pronóstico acertó ${prec.aciertos} de ${prec.dias} días en tu comuna.`)
    hablar(partes.length ? partes : ['Hoy se ve un día tranquilo, sin sorpresas.'])
  }

  if (!ya && !momentos.length && !prec) return null
  return (
    <section aria-labelledby="t-hoy" className="hoy-en-diez rounded-[22px] border border-linea bg-superficie px-3.5 pt-3 pb-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="t-hoy" className="rotulo">Tu día en 10 segundos</h2>
        <button type="button" onClick={decir} className="rotulo flex min-h-8 items-center gap-1.5 !text-texto" aria-label="Que ZUMI me cuente mi día">
          <span className="onda-zumi" aria-hidden="true">
            <i /><i /><i /><i />
          </span>
          Escuchar
        </button>
      </div>
      <ol className="-mx-3.5 mt-2.5 flex gap-2 overflow-x-auto px-3.5 pb-1 [scrollbar-width:none]">
        {ya && (
          <li className="momento shrink-0 rounded-2xl border px-3 py-2" style={{ borderColor: `${TONO.lluvia}66`, background: `${TONO.lluvia}14` }}>
            <p className="mono flex items-center gap-1.5 text-[11px]" style={{ color: TONO.lluvia }}>
              <span className="punto-vivo" style={{ background: TONO.lluvia }} aria-hidden="true" /> AHORA
            </p>
            <p className="mt-1 text-[15px] font-semibold whitespace-nowrap">{ya.texto}</p>
            <p className="text-[12px] text-texto-2">{ya.sub}</p>
          </li>
        )}
        {momentos.map((m) => (
          <li key={m.texto + m.hhmm} className="momento shrink-0 rounded-2xl border border-linea px-3 py-2">
            <p className="mono text-[11px] text-texto-2">{m.hhmm}</p>
            <p className="mt-1 flex items-center gap-1.5 text-[15px] font-semibold whitespace-nowrap">
              <span style={{ color: TONO[m.tono] }} aria-hidden="true">
                {m.icono}
              </span>
              {m.texto}
            </p>
          </li>
        ))}
      </ol>
      {prec && (
        <p className="mt-2 flex items-center gap-2 border-t border-linea pt-2 text-[12.5px] text-texto-2">
          <span className="mono rounded-full border border-linea px-2 py-0.5 text-[11px] text-texto">{prec.porcentaje}%</span>
          Pronóstico verificado: acertó {prec.aciertos} de {prec.dias} días esta semana en tu comuna (error medio {prec.errorMedio.toFixed(1).replace('.', ',')}°).
        </p>
      )}
    </section>
  )
}
