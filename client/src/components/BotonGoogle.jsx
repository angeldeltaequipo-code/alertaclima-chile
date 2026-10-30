import { useEffect, useRef, useState } from 'react'
import { cargarGoogle, ingresar, ingresarNativo } from '../services/cuenta'
import { esNativa, plataforma } from '../services/nativo'

/** Botón oficial «Continuar con Google» (y «Continuar con Apple» en iPhone). Al terminar llama a onListo(usuario). */
export default function BotonGoogle(props) {
  return esNativa() ? <BotonesNativos {...props} /> : <BotonWeb {...props} />
}

/** En la app nativa: inicio de sesión del sistema. Apple primero en iPhone (como pide Apple). */
function BotonesNativos({ onListo }) {
  const [error, setError] = useState(null)
  const [entrando, setEntrando] = useState(null)
  const ios = plataforma() === 'ios'
  const entrar = async (proveedor) => {
    setEntrando(proveedor)
    setError(null)
    try {
      const u = await ingresarNativo(proveedor)
      if (u) onListo?.(u)
    } catch (e) {
      setError(e.message)
    } finally {
      setEntrando(null)
    }
  }
  return (
    <div className="mx-auto flex max-w-[360px] flex-col gap-2.5">
      {ios && (
        <button
          type="button"
          disabled={Boolean(entrando)}
          onClick={() => entrar('apple')}
          className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-black text-[17px] font-semibold text-white disabled:opacity-60"
        >
          <svg width="18" height="22" viewBox="0 0 17 20" fill="currentColor" aria-hidden="true">
            <path d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9C3.6 4.8 2 5.8 1.1 7.4c-1.9 3.2-.5 8 1.3 10.6.9 1.3 1.9 2.7 3.3 2.6 1.3-.1 1.8-.9 3.4-.9s2 .9 3.4.8c1.4 0 2.3-1.3 3.2-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.9-1.1-3-4.3zM11.6 3c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z" />
          </svg>
          {entrando === 'apple' ? 'Entrando…' : 'Continuar con Apple'}
        </button>
      )}
      <button
        type="button"
        disabled={Boolean(entrando)}
        onClick={() => entrar('google')}
        className="flex min-h-12 items-center justify-center gap-2.5 rounded-full border-2 border-[#dadce0] bg-white text-[17px] font-semibold text-[#1f1f1f] disabled:opacity-60"
      >
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13.7 17.7 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
          <path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.7l7.9-6.1z" />
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
        </svg>
        {entrando === 'google' ? 'Entrando…' : 'Continuar con Google'}
      </button>
      {error && (
        <p role="alert" className="text-center text-[15px] font-bold text-peligro">
          {error}
        </p>
      )}
    </div>
  )
}

function BotonWeb({ clientId, onListo }) {
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
