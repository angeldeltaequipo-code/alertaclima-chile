import { useState } from 'react'
import { NIVEL_ALUVION, riesgoAluvion } from '../services/aluvion'
import { hhmm } from '../services/formato'

const num = (v, d = 1) => v.toLocaleString('es-CL', { maximumFractionDigits: d })
const COLOR = {
  bajo: { fondo: '#1f7a47', texto: '#ffffff' },
  atencion: { fondo: '#ffc93c', texto: '#0e1a24' },
  alto: { fondo: '#c81e1e', texto: '#ffffff' },
}

const CONSEJOS = {
  atencion: [
    'Ubica las quebradas y cauces cerca de tu casa, trabajo y colegio.',
    'Ten a mano una mochila con linterna, agua, documentos y remedios.',
    'Evita acampar o estacionar cerca de quebradas y lechos de ríos.',
  ],
  alto: [
    'Aléjate de quebradas, cauces y laderas de cerro. No esperes a ver el agua.',
    'No cruces ríos ni calles inundadas, ni a pie ni en auto.',
    'Si vives cerca de una quebrada, ten listo dónde irte (a un lugar más alto).',
    'Sigue las instrucciones de SENAPRED y de tu municipio.',
  ],
}

/** Tarjeta «Aluviones y desbordes»: nivel orientativo, por qué, y qué hacer. */
export default function RiesgoAluvion({ horas, onVerRios }) {
  const [abierta, setAbierta] = useState(false)
  const r = riesgoAluvion(horas)
  if (!r) return null
  const c = COLOR[r.nivel]
  const titulo =
    r.nivel === 'bajo'
      ? 'Riesgo bajo de aluviones y desbordes'
      : r.nivel === 'atencion'
        ? 'Atención: posible riesgo de aluviones o desbordes'
        : 'Riesgo alto de aluviones y desbordes'

  return (
    <section aria-labelledby="t-aluvion" className="tarjeta">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full" style={{ background: c.fondo, color: c.texto }} aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 20l6-12 4 6 2-3 6 9z" />
            <path d="M14 20c.5-2 2-3 3.5-3" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="t-aluvion" className="text-[18px] leading-tight font-bold">
            {titulo}
          </h2>
          <p className="mt-1 text-[15px] text-texto-2">
            {r.nivel === 'bajo'
              ? r.lluvia24 < 1
                ? 'No se espera lluvia importante en las próximas 24 horas.'
                : `Se esperan ${num(r.lluvia24)} mm en 24 horas: no es suficiente para aluviones.`
              : `Por ${r.motivos.join(', ')}${r.desde ? `, desde las ${hhmm(r.desde)}` : ''}.`}
          </p>
        </div>
        <span className="shrink-0 rounded-full px-2.5 py-1 text-[13px] font-bold" style={{ background: c.fondo, color: c.texto }}>
          {NIVEL_ALUVION[r.nivel].etiqueta}
        </span>
      </div>

      {(r.nivel !== 'bajo' || abierta) && (
        <dl className="mt-3 grid grid-cols-3 gap-2">
          <Factor titulo="Lluvia 24 h" valor={`${num(r.lluvia24)} mm`} alerta={r.lluvia24 >= 20} />
          <Factor titulo="Máx. en 1 hora" valor={`${num(r.intensidad)} mm`} extra={r.horaIntensa ? `a las ${hhmm(r.horaIntensa)}` : null} alerta={r.intensidad >= 7} />
          <Factor
            titulo="Isoterma 0 °C"
            valor={r.isoterma != null ? `${num(r.isoterma, 0)} m` : '—'}
            extra={r.isoterma != null ? (r.isoterma >= 2500 ? 'llueve en la cordillera' : 'nieva en altura') : 'sin lluvia'}
            alerta={r.isoterma != null && r.isoterma >= 2500 && r.lluvia24 >= 8}
          />
        </dl>
      )}

      {r.nivel !== 'bajo' && (
        <ul className="mt-3 space-y-1.5 text-[15px]">
          {CONSEJOS[r.nivel].map((t) => (
            <li key={t} className="flex gap-2">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-texto" aria-hidden="true" />
              {t}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onVerRios}
          className={`min-h-11 rounded-full px-4 text-[15px] font-bold ${r.nivel === 'bajo' ? 'bg-superficie-2' : 'bg-senal text-sobre-senal'}`}
        >
          Ver quebradas y ríos cercanos
        </button>
        <button type="button" onClick={() => setAbierta(!abierta)} aria-expanded={abierta} className="min-h-11 rounded-full px-3 text-[15px] font-bold text-texto-2 underline">
          {abierta ? 'Ocultar' : '¿Cómo se calcula?'}
        </button>
      </div>
      {abierta && (
        <p className="mt-2 text-[14px] leading-snug text-texto-2">
          Miramos la lluvia esperada en 24 horas, la hora más intensa y la <strong>isoterma 0 °C</strong> (la altura sobre la que el agua se
          congela). Cuando está sobre los 2.500–3.000 m, en la cordillera llueve en vez de nevar, y esa agua baja de golpe por las quebradas:
          así ocurrieron grandes aluviones en Santiago. Es una orientación de AlertaClima, <strong>no una alerta oficial</strong>; las alertas las
          emite SENAPRED.
        </p>
      )}
    </section>
  )
}

function Factor({ titulo, valor, extra, alerta }) {
  return (
    <div className={`rounded-xl px-2.5 py-2 ${alerta ? 'bg-senal/20 ring-1 ring-senal' : 'bg-superficie-2'}`}>
      <dt className="text-[12px] font-bold text-texto-2">{titulo}</dt>
      <dd className="text-[16px] leading-tight font-bold tabular-nums">{valor}</dd>
      {extra && <dd className="text-[12px] leading-tight text-texto-2">{extra}</dd>}
    </div>
  )
}
