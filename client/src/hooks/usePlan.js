import { useCallback, useEffect, useState } from 'react'
import { LIMITES_LIBRES, configPlanes, miPlan } from '../services/planes'

/**
 * Plan de la persona. Mientras el cobro no esté activo, todos tienen los límites amplios
 * y no se muestra nada de precios.
 */
export function usePlan({ enLinea, token }) {
  const [config, setConfig] = useState(null)
  const [mio, setMio] = useState(null)
  useEffect(() => {
    if (!enLinea || config) return
    configPlanes().then(setConfig).catch(() => {})
  }, [enLinea, config])
  const refrescar = useCallback(() => miPlan().then(setMio).catch(() => {}), [])
  useEffect(() => {
    if (token && config?.cobroActivo) refrescar()
    else setMio(null)
  }, [token, config?.cobroActivo, refrescar])
  // Al volver de pagar en Mercado Pago (?plan=gracias) se consulta varias veces, hasta que llegue el aviso del pago.
  useEffect(() => {
    if (!token || !new URLSearchParams(location.search).has('plan')) return
    let n = 0
    const id = setInterval(() => {
      refrescar()
      if (++n >= 6) clearInterval(id)
    }, 5000)
    return () => clearInterval(id)
  }, [token, refrescar])

  const cobro = Boolean(config?.cobroActivo)
  const plan = mio?.plan ?? 'gratis'
  const limites = !cobro ? LIMITES_LIBRES : (mio?.limites ?? config?.limites?.gratis ?? LIMITES_LIBRES)
  return { cobro, plan, familia: plan === 'familia', mio, limites, precios: config?.precios ?? null, pagos: config?.pagos ?? {}, refrescar }
}
