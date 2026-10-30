import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { cancelarWeb, compraEnApp, comprarEnTienda, gestionarEnTienda, ofertasTienda, pagarEnWeb, restaurarCompras } from '../services/planes'
import { esNativa } from '../services/nativo'
import { poseZumi } from './ZumiTeCuenta'

const clp = (n) => `$${Math.round(n).toLocaleString('es-CL')}`

const MOTIVOS = {
  familia: 'Para cuidar a más de un familiar necesitas el plan Familia.',
  comunas: 'Para recibir avisos de más de una comuna necesitas el plan Familia.',
  zumi: 'Usaste tus preguntas de hoy a ZUMI. Con el plan Familia conversas sin límite.',
  general: null,
  'pago-gracias': '¡Listo! Estamos confirmando tu suscripción, tarda unos segundos.',
  'pago-cancelado': 'No se registró la tarjeta. Puedes intentarlo de nuevo cuando quieras.',
  'pago-error': 'Hubo un problema con el pago. No se te cobró nada; inténtalo de nuevo en un momento.',
}

const BENEFICIOS = [
  ['👨‍👩‍👧', 'Hasta 5 familiares', 'Mira el clima y las alertas de donde vive cada uno.'],
  ['🔔', 'Avisos de 5 comunas', 'Tu casa, tu trabajo, la de tus padres o tus hijos.'],
  ['💬', 'ZUMI sin límite', 'Pregúntale lo que quieras, todas las veces que quieras.'],
  ['🤝', 'Alertas gratis para todos', 'Tu plan ayuda a que los avisos de emergencia sigan gratis para cada vecino de Chile.'],
]

/**
 * Pantalla del plan «AlertaClima Familia». Se abre desde Ajustes o cuando la persona llega a
 * un límite del plan gratis. Lo que protege la vida (alertas, SOS, evacuación) sigue gratis.
 */
export default function Planes({ abierto, motivo = 'general', onCerrar, plan, cuenta }) {
  const [periodo, setPeriodo] = useState('anual')
  const [correo, setCorreo] = useState('')
  const [pidiendoCorreo, setPidiendoCorreo] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState(null)
  const [ofertas, setOfertas] = useState(null)
  const enApp = compraEnApp()
  const p = plan.precios ?? { mensual: 1990, anual: 14990, pruebaDias: 7 }
  const usuarioId = cuenta.usuario?.id

  useEffect(() => {
    if (!abierto || !enApp) return
    ofertasTienda(usuarioId).then(setOfertas).catch(() => setOfertas({}))
  }, [abierto, enApp, usuarioId])

  useEffect(() => {
    if (!abierto) {
      setError(null)
      setPidiendoCorreo(false)
    }
  }, [abierto])

  if (!abierto) return null

  // Precio a mostrar: el de la tienda (en su moneda) o el nuestro en pesos.
  const precioTienda = (per) => ofertas?.[per]?.product?.priceString
  const precioMes = precioTienda('mensual') ?? clp(p.mensual)
  const precioAnio = precioTienda('anual') ?? clp(p.anual)
  const ahorro = Math.round((1 - p.anual / (p.mensual * 12)) * 100)
  const disponible = enApp ? Boolean(ofertas?.[periodo]) : plan.pagos?.web

  const empezar = async () => {
    setError(null)
    if (!cuenta.token) return cuenta.pedir('plan')
    if (enApp) {
      setOcupado(true)
      try {
        const ok = await comprarEnTienda(usuarioId, ofertas[periodo])
        if (ok) {
          // El servidor se entera por RevenueCat; se consulta varias veces hasta que llegue.
          for (let i = 0; i < 5; i++) {
            await new Promise((r) => setTimeout(r, 2500))
            await plan.refrescar()
          }
          onCerrar()
        }
      } catch (e) {
        setError(e.message)
      } finally {
        setOcupado(false)
      }
      return
    }
    if (!pidiendoCorreo) return setPidiendoCorreo(true)
    setOcupado(true)
    try {
      await pagarEnWeb(periodo, correo.trim())
    } catch (e) {
      setError(e.message)
      setOcupado(false)
    }
  }

  const contenido = (
    <div className="fixed inset-0 z-[4000] flex items-end justify-center bg-black/55 sm:items-center" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="t-planes"
        onClick={(e) => e.stopPropagation()}
        className="hoja-capas safe-bottom max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-t-[32px] px-5 pt-4 pb-6 shadow-2xl sm:rounded-[32px]"
      >
        <div className="flex items-start justify-between">
          <img src={poseZumi(plan.familia ? 'celebrando' : 'corazon')} alt="" width="96" height="128" className="zumi-pose -mb-2 h-28 w-auto" />
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid size-12 place-items-center rounded-full text-[28px]">
            ×
          </button>
        </div>

        {plan.familia ? (
          <TuPlan plan={plan} onCerrar={onCerrar} />
        ) : (
          <>
            <h2 id="t-planes" className="text-[28px] leading-tight font-bold">AlertaClima Familia</h2>
            <p className="mt-1 text-[17px] text-texto-2">{MOTIVOS[motivo] ?? 'Cuida a toda tu familia con una sola cuenta.'}</p>

            <ul className="mt-4 space-y-3">
              {BENEFICIOS.map(([i, t, d]) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-senal/15 text-[22px]" aria-hidden="true">
                    {i}
                  </span>
                  <span>
                    <span className="block text-[18px] font-bold">{t}</span>
                    <span className="block text-[15px] text-texto-2">{d}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div role="radiogroup" aria-label="Forma de pago" className="mt-5 grid grid-cols-2 gap-2">
              {[
                ['anual', 'Anual', `${precioAnio} al año`, ahorro > 0 ? `Ahorras ${ahorro} %` : null],
                ['mensual', 'Mensual', `${precioMes} al mes`, null],
              ].map(([k, t, precio, etiqueta]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={periodo === k}
                  onClick={() => setPeriodo(k)}
                  className={`relative rounded-2xl px-3 pt-3 pb-3 text-left ring-2 ${periodo === k ? 'bg-senal/15 ring-senal' : 'ring-linea'}`}
                >
                  {etiqueta && <span className="absolute -top-3 right-2 rounded-full bg-ok px-2 py-0.5 text-[12px] font-black text-white">{etiqueta}</span>}
                  <span className="block text-[17px] font-bold">{t}</span>
                  <span className="block text-[16px]">{precio}</span>
                </button>
              ))}
            </div>

            {pidiendoCorreo && !enApp && (
              <div className="mt-4">
                <label htmlFor="correo-pago" className="block text-[16px] font-bold">
                  Tu correo para el comprobante
                </label>
                <input
                  id="correo-pago"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  placeholder="nombre@correo.cl"
                  className="mt-1 min-h-12 w-full rounded-xl border-2 border-borde bg-superficie px-3 text-[17px]"
                />
                <p className="mt-1 text-[13px] text-texto-2">Lo usa Flow, nuestro sistema de pago chileno, para enviarte los comprobantes. No lo usamos para nada más.</p>
              </div>
            )}

            {error && (
              <p role="alert" className="mt-3 rounded-xl bg-peligro/10 px-3 py-2 text-[15px] font-bold text-peligro">
                {error}
              </p>
            )}

            <button
              type="button"
              disabled={ocupado || (!disponible && Boolean(cuenta.token))}
              onClick={empezar}
              className="mt-5 min-h-14 w-full rounded-2xl bg-senal text-[19px] font-bold text-sobre-senal shadow-lg disabled:opacity-60"
            >
              {ocupado
                ? 'Un momento…'
                : !cuenta.token
                  ? 'Crear cuenta y probar gratis'
                  : !disponible
                    ? 'Muy pronto disponible'
                    : pidiendoCorreo
                      ? 'Registrar mi tarjeta en Flow'
                      : p.pruebaDias > 0
                        ? `Probar ${p.pruebaDias} días gratis`
                        : 'Activar el plan Familia'}
            </button>

            <p className="mt-3 text-center text-[13px] leading-snug text-texto-2">
              {p.pruebaDias > 0 ? `Gratis por ${p.pruebaDias} días; después ` : ''}
              {periodo === 'anual' ? `${precioAnio} cada año` : `${precioMes} cada mes`}. Se renueva solo y puedes cancelar cuando quieras
              {enApp ? ' desde los ajustes de tu teléfono' : ''}. Las alertas oficiales, el SOS y la evacuación siguen gratis siempre.
            </p>
            <p className="mt-2 text-center text-[13px]">
              <a href="./terminos.html" target="_blank" rel="noopener" className="underline">
                Términos
              </a>{' '}
              ·{' '}
              <a href="./privacidad.html" target="_blank" rel="noopener" className="underline">
                Privacidad
              </a>
              {enApp && (
                <>
                  {' '}
                  ·{' '}
                  <button
                    type="button"
                    className="underline"
                    onClick={async () => {
                      setOcupado(true)
                      try {
                        const ok = await restaurarCompras(usuarioId)
                        await plan.refrescar()
                        setError(ok ? null : 'No encontramos compras anteriores en esta cuenta de la tienda.')
                      } catch {
                        setError('No se pudieron restaurar las compras.')
                      } finally {
                        setOcupado(false)
                      }
                    }}
                  >
                    Restaurar compras
                  </button>
                </>
              )}
            </p>
          </>
        )}
      </div>
    </div>
  )
  return createPortal(contenido, document.querySelector('.con-cosmos') ?? document.body)
}

function TuPlan({ plan, onCerrar }) {
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState(null)
  const [confirmar, setConfirmar] = useState(false)
  const m = plan.mio ?? {}
  const vence = m.venceEn ? new Date(m.venceEn).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' }) : null
  const estado = { prueba: 'En prueba gratis', activa: 'Activo', cancelada: 'Cancelado (sigue vigente hasta el final del periodo)', problema_pago: 'Hay un problema con el pago' }[m.estado] ?? 'Activo'
  return (
    <>
      <h2 id="t-planes" className="text-[28px] leading-tight font-bold">Tienes el plan Familia</h2>
      <p className="mt-1 text-[17px]">¡Gracias por cuidar a los tuyos con AlertaClima!</p>
      <dl className="mt-4 space-y-2 rounded-2xl bg-superficie-2 p-4 text-[16px]">
        <div className="flex justify-between gap-3">
          <dt className="text-texto-2">Estado</dt>
          <dd className="text-right font-bold">{estado}</dd>
        </div>
        {vence && (
          <div className="flex justify-between gap-3">
            <dt className="text-texto-2">{m.estado === 'cancelada' ? 'Vigente hasta' : 'Próxima renovación'}</dt>
            <dd className="text-right font-bold">{vence}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-texto-2">Pago</dt>
          <dd className="text-right font-bold">{{ flow: 'Web (Flow)', mercadopago: 'Mercado Pago', apple: 'App Store', google: 'Google Play', cortesia: 'Regalo de AlertaClima' }[m.origen] ?? '—'}</dd>
        </div>
      </dl>
      {msg && <p className="mt-3 text-[15px]">{msg}</p>}
      {(m.origen === 'apple' || m.origen === 'google') && (
        <button type="button" onClick={gestionarEnTienda} className="mt-4 min-h-12 w-full rounded-2xl bg-superficie-2 text-[16px] font-bold">
          Cambiar o cancelar en la tienda
        </button>
      )}
      {['flow', 'mercadopago'].includes(m.origen) && m.estado !== 'cancelada' && !esNativa() && (
        <button
          type="button"
          disabled={ocupado}
          onClick={async () => {
            if (!confirmar) return setConfirmar(true)
            setOcupado(true)
            try {
              await cancelarWeb()
              await plan.refrescar()
              setMsg('Listo. No se harán más cobros; el plan sigue hasta el final del periodo pagado.')
            } catch (e) {
              setMsg(e.message)
            } finally {
              setOcupado(false)
            }
          }}
          className={`mt-4 min-h-12 w-full rounded-2xl text-[16px] font-bold ${confirmar ? 'bg-peligro text-white' : 'bg-superficie-2'}`}
        >
          {confirmar ? 'Sí, cancelar la suscripción' : 'Cancelar la suscripción'}
        </button>
      )}
      <button type="button" onClick={onCerrar} className="mt-2 min-h-12 w-full rounded-2xl bg-senal text-[17px] font-bold text-sobre-senal">
        Listo
      </button>
    </>
  )
}

