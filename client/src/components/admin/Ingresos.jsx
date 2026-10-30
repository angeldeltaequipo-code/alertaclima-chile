import { useEffect, useState } from 'react'
import { metricasPlanes, regalarPlan } from '../../services/admin'

const clp = (n) => `$${Math.round(n ?? 0).toLocaleString('es-CL')}`
const ORIGEN = { mercadopago: 'Web (Mercado Pago)', apple: 'App Store', google: 'Google Play', cortesia: 'Cortesía' }

/** Panel de ingresos del plan Familia: MRR, suscriptores, pruebas, cancelaciones y regalar el plan. */
export default function Ingresos({ clave }) {
  const [m, setM] = useState(null)
  const [error, setError] = useState(null)
  const [usuario, setUsuario] = useState('')
  const [dias, setDias] = useState('30')
  const [msg, setMsg] = useState(null)
  const cargar = () => metricasPlanes(clave).then(setM).catch((e) => setError(e.message))
  useEffect(() => {
    cargar()
  }, [clave]) // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <p className="text-peligro">Ingresos: {error}</p>
  if (!m) return <p className="text-texto-2">Cargando ingresos…</p>
  const tarjetas = [
    ['MRR', clp(m.mrrClp), 'Ingreso mensual recurrente'],
    ['ARR', clp(m.arrClp), 'MRR × 12'],
    ['Pagando', m.pagando, `${m.conversion} % de ${m.usuarios} cuentas`],
    ['En prueba', m.enPrueba, 'Días gratis en curso'],
    ['Problemas de pago', m.problemaPago, 'Cobro rechazado'],
    ['Cortesía', m.cortesia, 'Planes regalados'],
  ]
  return (
    <section>
      <h2 className="mb-2 text-[20px] font-bold">Ingresos del plan Familia</h2>
      {!m.cobroActivo && (
        <p className="mb-3 rounded-xl bg-amber-500/10 px-3 py-2 text-[15px]">
          El cobro está <strong>apagado</strong>: nadie ve precios ni límites. Se enciende con <code>COBRO_ACTIVO=true</code> en Render.
        </p>
      )}
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {tarjetas.map(([t, v, d]) => (
          <div key={t} className="rounded-2xl border-2 border-borde p-3">
            <dt className="text-[13px] font-bold text-texto-2">{t}</dt>
            <dd className="text-[26px] font-bold tabular-nums">{v}</dd>
            <dd className="text-[13px] text-texto-2">{d}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-4 text-[16px] font-bold">Últimos 30 días</h3>
      <p className="text-[15px]">
        Altas: <strong>{m.ultimos30.altas}</strong> · Pruebas iniciadas: <strong>{m.ultimos30.pruebas}</strong> · Cancelaciones:{' '}
        <strong>{m.ultimos30.cancelaciones}</strong> · Vencidas: <strong>{m.ultimos30.vencidas}</strong>
      </p>
      <h3 className="mt-3 text-[16px] font-bold">Por origen</h3>
      <ul className="text-[15px]">
        {Object.entries(m.porOrigen).length === 0 && <li className="text-texto-2">Todavía no hay suscripciones.</li>}
        {Object.entries(m.porOrigen).map(([k, n]) => (
          <li key={k}>
            {ORIGEN[k] ?? k}: <strong>{n}</strong>
          </li>
        ))}
      </ul>
      <form
        className="mt-4 flex flex-wrap items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          setMsg(null)
          try {
            await regalarPlan(clave, usuario.trim(), Number(dias))
            setMsg(`Plan Familia regalado por ${dias} días al usuario ${usuario}.`)
            setUsuario('')
            cargar()
          } catch (er) {
            setMsg(er.message)
          }
        }}
      >
        <label className="text-[14px] font-bold">
          N.º de usuario
          <input value={usuario} onChange={(e) => setUsuario(e.target.value)} inputMode="numeric" className="mt-1 block min-h-11 w-32 rounded-lg border-2 border-borde bg-superficie px-2" />
        </label>
        <label className="text-[14px] font-bold">
          Días
          <input value={dias} onChange={(e) => setDias(e.target.value)} inputMode="numeric" className="mt-1 block min-h-11 w-20 rounded-lg border-2 border-borde bg-superficie px-2" />
        </label>
        <button type="submit" className="min-h-11 rounded-lg bg-senal px-4 font-bold text-sobre-senal">
          Regalar plan Familia
        </button>
      </form>
      {msg && <p className="mt-2 text-[15px]">{msg}</p>}
    </section>
  )
}
