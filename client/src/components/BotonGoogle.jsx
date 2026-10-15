import { useEffect, useRef, useState } from 'react'
import { cargarGoogle, ingresar } from '../services/cuenta'

/** Botón oficial «Continuar con Google». Al terminar llama a onListo(usuario). */
export default function BotonGoogle({ clientId, onListo }) {
  const caja = useRef(null)
  const [error, setError] = useState(null)
  const [entrando, setEntrando] = useState(false)
  const listo = useRef(onListo)
  listo.current = onListo

  useEffect(() => {
    let vivo = true
    cargarGoogle()
      .then((google) => {
        if (!vivo || !caja.current) return
        google.accounts.id.initialize({
          client_id: clientId,
          ux_mode: 'popup',
          use_fedcm_for_button: true,
          callback: async ({ credential }) => {
            setEntrando(true)
            setError(null)
            try {
              const u = await ingresar(credential)
              listo.current?.(u)
            } catch (e) {
              setError(e.message)
            } finally {
              setEntrando(false)
            }
          },
        })
        const ancho = Math.min(360, caja.current.clientWidth || 320)
        google.accounts.id.renderButton(caja.current, {
          type: 'standard',
          theme: 'filled_blue',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'left',
          locale: 'es-419',
          width: ancho,
        })
      })
      .catch((e) => vivo && setError(e.message))
    return () => {
      vivo = false
    }
  }, [clientId])

  return (
    <div>
      {/* color-scheme claro: si no, el navegador pinta un recuadro blanco detrás del botón de Google en páginas oscuras */}
      <div ref={caja} className="flex min-h-11 justify-center" style={{ colorScheme: 'light' }} />
      {entrando && (
        <p role="status" className="mt-2 text-center text-[15px] text-texto-2">
          Entrando…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-center text-[15px] font-bold text-peligro">
          {error}
        </p>
      )}
    </div>
  )
}
